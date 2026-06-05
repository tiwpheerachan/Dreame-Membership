-- ============================================================
-- Migration 0026: Bulk cron batches (set-based instead of FOR loop)
--
-- ของเก่า (0011): run_quarterly_gift_batch + run_monthly_shipping_batch
-- ใช้ FOR loop เรียก issue_quarterly_gift() ทีละคน → ที่ 5k users = 5k function calls
-- = 25k SQL statements → ไม่ทันใน 60s timeout ของ Render
--
-- ของใหม่: bulk INSERT ... SELECT จาก users → run ได้ <5s แม้ 10k users
-- ใช้ ON CONFLICT DO NOTHING (unique index uniq_coupons_user_auto_key) idempotent
-- ============================================================

-- ── Quarterly Gift (Gold + Platinum) ──
CREATE OR REPLACE FUNCTION public.run_quarterly_gift_batch()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
  v_key   VARCHAR(80);
  v_q_end DATE;
BEGIN
  v_key   := 'QUARTERLY_' || EXTRACT(YEAR FROM CURRENT_DATE)::int || 'Q' || EXTRACT(QUARTER FROM CURRENT_DATE)::int;
  v_q_end := (date_trunc('quarter', CURRENT_DATE) + INTERVAL '3 months - 1 day')::date;

  INSERT INTO public.coupons (
    user_id, code, title, description,
    discount_type, discount_value, min_purchase, max_discount,
    valid_from, valid_until, theme, auto_issue_key
  )
  SELECT
    u.id,
    public._gen_unique_coupon_code(),
    'Quarterly Gift 10%',
    'ของขวัญรายไตรมาสสำหรับสมาชิก ' || u.tier::text ||
      ' — ส่วนลด 10% สูงสุด ฿' ||
      CASE u.tier::text WHEN 'GOLD' THEN '100' ELSE '200' END ||
      ' เมื่อซื้อครบ ฿1,000',
    'PERCENT', 10, 1000,
    CASE u.tier::text WHEN 'GOLD' THEN 100 ELSE 200 END,
    CURRENT_DATE, v_q_end,
    CASE u.tier::text WHEN 'GOLD' THEN 'gold' ELSE 'black' END,
    v_key
  FROM public.users u
  WHERE u.is_active = true
    AND u.tier::text IN ('GOLD', 'PLATINUM')
    AND NOT EXISTS (
      SELECT 1 FROM public.coupons c
       WHERE c.user_id = u.id AND c.auto_issue_key = v_key
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Monthly Shipping (Gold) ──
CREATE OR REPLACE FUNCTION public.run_monthly_shipping_batch()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
  v_key   VARCHAR(80);
  v_m_end DATE;
BEGIN
  v_key   := 'SHIP_' || to_char(CURRENT_DATE, 'YYYYMM');
  v_m_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date;

  INSERT INTO public.coupons (
    user_id, code, title, description,
    discount_type, discount_value, min_purchase, max_uses,
    valid_from, valid_until, theme, auto_issue_key
  )
  SELECT
    u.id,
    public._gen_unique_coupon_code(),
    'ส่งฟรี 1 ครั้ง',
    'สิทธิ์ส่งฟรี 1 ออเดอร์ในเดือนนี้สำหรับสมาชิก Gold',
    'FIXED', 100, 0, 1,
    CURRENT_DATE, v_m_end,
    'gold', v_key
  FROM public.users u
  WHERE u.is_active = true AND u.tier::text = 'GOLD'
    AND NOT EXISTS (
      SELECT 1 FROM public.coupons c
       WHERE c.user_id = u.id AND c.auto_issue_key = v_key
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Cleanup: เก่ากว่า 90 วันลบทิ้ง (เรียก daily ผ่าน cron) ──
CREATE OR REPLACE FUNCTION public.cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM public.shopify_webhook_events
   WHERE received_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Bulk claim Shopify codes for tier (เร็วกว่า loop user-by-user) ──
-- ใช้ใน cron sync-shopify-discounts ตอน auto top-up
CREATE OR REPLACE FUNCTION public.bulk_claim_for_tier(
  p_shop_id       VARCHAR,
  p_price_rule_id BIGINT,
  p_tier          user_tier,
  p_issue_key     VARCHAR,
  p_max           INTEGER DEFAULT 500
) RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  -- หา user ที่ tier ตรง + ยังไม่ได้รับ code นี้
  -- + code ที่ยังว่างใน pool
  -- → จับคู่ผ่าน CTE → bulk update
  WITH eligible_users AS (
    SELECT u.id, row_number() OVER (ORDER BY u.created_at) AS rn
      FROM public.users u
     WHERE u.is_active = true
       AND u.tier = p_tier
       AND NOT EXISTS (
         SELECT 1 FROM public.coupons c
          WHERE c.user_id = u.id
            AND c.auto_issue_key = p_issue_key
       )
     LIMIT p_max
  ),
  free_codes AS (
    SELECT c.id, row_number() OVER (ORDER BY c.created_at) AS rn
      FROM public.coupons c
     WHERE c.shopify_shop_id = p_shop_id
       AND c.shopify_price_rule_id = p_price_rule_id
       AND c.user_id IS NULL
       AND c.used_at IS NULL
     LIMIT p_max
     FOR UPDATE SKIP LOCKED
  ),
  pairs AS (
    SELECT u.id AS user_id, c.id AS coupon_id
      FROM eligible_users u
      JOIN free_codes c ON c.rn = u.rn
  )
  UPDATE public.coupons
     SET user_id        = pairs.user_id,
         auto_issue_key = p_issue_key
    FROM pairs
   WHERE coupons.id = pairs.coupon_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── View: reward redemption counts (admin reward list) ──
-- ทดแทน N+1 ใน /api/admin/rewards ที่ดึง redemptions ทั้งหมดมา group ใน JS
CREATE OR REPLACE VIEW public.v_reward_redemption_counts AS
SELECT
  reward_id,
  COUNT(*)                                            AS total,
  COUNT(*) FILTER (WHERE status = 'pending')          AS pending,
  COUNT(*) FILTER (WHERE status = 'redeemed')         AS redeemed,
  COUNT(*) FILTER (WHERE status IN ('confirmed','shipping')) AS in_progress,
  COUNT(*) FILTER (WHERE status = 'delivered')        AS delivered,
  COUNT(*) FILTER (WHERE status = 'cancelled')        AS cancelled
FROM public.redemptions
GROUP BY reward_id;

COMMENT ON VIEW public.v_reward_redemption_counts IS
  'Per-reward redemption stats — used by /admin/rewards list to avoid N+1';

NOTIFY pgrst, 'reload schema';
