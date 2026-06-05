-- ============================================================
-- Migration 0014: Coupon polish — RLS, webhook log, self-heal
--
-- 1) แก้ RLS leak: policy เดิม allow user_id IS NULL ทำให้ pool codes
--    (ที่ admin ใช้สำหรับ auto top-up) รั่วไปฝั่ง user
-- 2) ตาราง webhook event log — เก็บ payload ที่ Shopify push เข้ามา
-- 3) Index เพิ่มประสิทธิภาพหน้า /coupons ฝั่ง user
-- 4) Helper function self_heal_user_coupons() — เรียกตอน user เปิด /coupons
--    ครั้งแรก ถ้ายังไม่เคยได้ welcome (รอบ migration เก่า)
-- ============================================================

-- ── 1. RLS: ปิดรั่ว pool codes ────────────────────────────
DROP POLICY IF EXISTS coupons_self_select ON public.coupons;
CREATE POLICY "coupons_self_select" ON public.coupons
  FOR SELECT
  USING (auth.uid() = user_id);
-- ลบ OR user_id IS NULL ออก — pool codes ต้องเข้าผ่าน service role เท่านั้น

-- ── 2. Index: query /coupons ของ user ────────────────────
CREATE INDEX IF NOT EXISTS idx_coupons_user_valid
  ON public.coupons(user_id, valid_until DESC)
  WHERE user_id IS NOT NULL;

-- ── 3. Webhook event log — ทุก payload ที่ Shopify push ─
CREATE TABLE IF NOT EXISTS public.shopify_webhook_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  shop_id       VARCHAR(120),
  price_rule_id BIGINT,
  code          VARCHAR(120),
  payload       JSONB NOT NULL,
  matched_coupon_id UUID,
  processing_status VARCHAR(20) NOT NULL DEFAULT 'received',  -- received | applied | skipped | error
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
  ON public.shopify_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON public.shopify_webhook_events(processing_status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_price_rule
  ON public.shopify_webhook_events(price_rule_id, received_at DESC)
  WHERE price_rule_id IS NOT NULL;

ALTER TABLE public.shopify_webhook_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'shopify_webhook_events_admin' AND tablename = 'shopify_webhook_events') THEN
    CREATE POLICY "shopify_webhook_events_admin" ON public.shopify_webhook_events
      FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;

COMMENT ON TABLE public.shopify_webhook_events IS
  'Audit log of every Shopify webhook payload — used for debugging missed/duplicate events';

-- ── 4. Self-heal: ออกคูปองที่ user สมควรมีตอนนี้ ──────────
-- เรียกเมื่อ user เปิด /coupons ครั้งแรก — กรณีบัญชีเก่าก่อนมี trigger
-- หรือ trigger ครั้งก่อนล้มเหลว (network/transaction error)
CREATE OR REPLACE FUNCTION public.self_heal_user_coupons(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_before INTEGER;
  v_after  INTEGER;
  v_active BOOLEAN;
BEGIN
  -- ตรวจ user มีและ active
  SELECT is_active INTO v_active FROM public.users WHERE id = p_user_id;
  IF NOT FOUND OR NOT v_active THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO v_before FROM public.coupons WHERE user_id = p_user_id;

  -- ออกคูปองที่สมควรมีตาม tier (idempotent — auto_issue_key UNIQUE)
  PERFORM public.apply_tier_coupons(p_user_id);

  -- ถ้ามี Shopify campaign ผูก tier ก็ claim ให้ด้วย
  PERFORM public.apply_shopify_tier_campaigns(p_user_id, 'signup');

  SELECT COUNT(*) INTO v_after FROM public.coupons WHERE user_id = p_user_id;
  RETURN v_after - v_before;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.self_heal_user_coupons IS
  'Idempotently issue all tier coupons + Shopify campaign codes the user should currently have. Safe to call anytime.';

-- ── 5. View: tier-up forecast ─────────────────────────────
-- ใช้บนหน้า admin ดู user ที่ใกล้เลื่อน tier ใน rolling window
CREATE OR REPLACE VIEW public.v_tier_up_forecast AS
SELECT
  u.id,
  u.member_id,
  u.full_name,
  u.email,
  u.phone,
  u.tier                                AS current_tier,
  u.lifetime_points,
  CASE
    WHEN u.tier = 'SILVER'   THEN 'GOLD'::user_tier
    WHEN u.tier = 'GOLD'     THEN 'PLATINUM'::user_tier
    ELSE NULL
  END                                   AS next_tier,
  CASE
    WHEN u.tier = 'SILVER'   THEN GREATEST(80  - u.lifetime_points, 0)
    WHEN u.tier = 'GOLD'     THEN GREATEST(400 - u.lifetime_points, 0)
    ELSE 0
  END                                   AS points_to_next,
  CASE
    WHEN u.tier = 'SILVER'   THEN 80
    WHEN u.tier = 'GOLD'     THEN 400
    ELSE NULL
  END                                   AS next_threshold
FROM public.users u
WHERE u.is_active = true
  AND u.tier IN ('SILVER', 'GOLD')
ORDER BY points_to_next ASC NULLS LAST;

COMMENT ON VIEW public.v_tier_up_forecast IS
  'Users sorted by closeness to next tier — for preemptive marketing campaigns';

-- ── 6. Reload PostgREST schema ─────────────────────────────
NOTIFY pgrst, 'reload schema';
