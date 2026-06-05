-- ============================================================
-- Migration 0024: redeem_reward + refund_redemption เขียน points_log
--
-- ปัญหา: redeem_reward update total_points แต่ไม่ insert points_log
-- → /points history ไม่ขึ้นรายการ "ใช้แลก reward"
-- → user สับสน เพราะ total_points ลดแต่ไม่เห็นประวัติ
--
-- แก้: insert points_log type='REDEEMED' ตอน redeem
-- และ type='ADMIN_ADJUST' (refund) ตอน refund — ก่อนหน้านี้ไม่มีทั้งคู่
-- ============================================================

CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_user_id              UUID,
  p_reward_id            UUID,
  p_shipping_name        VARCHAR,
  p_shipping_phone       VARCHAR,
  p_shipping_address     TEXT,
  p_shipping_subdistrict VARCHAR,
  p_shipping_district    VARCHAR,
  p_shipping_province    VARCHAR,
  p_shipping_postcode    VARCHAR,
  p_shipping_note        TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user    public.users%ROWTYPE;
  v_reward  public.rewards%ROWTYPE;
  v_now     TIMESTAMPTZ := NOW();
  v_count   INTEGER;
  v_red_id  UUID;
  v_needs_shipping BOOLEAN;
  v_init_status VARCHAR;
  v_new_balance INTEGER;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'user not found'); END IF;
  IF NOT v_user.is_active THEN RETURN jsonb_build_object('error', 'user inactive'); END IF;

  SELECT * INTO v_reward FROM public.rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'reward not found'); END IF;

  IF v_reward.status <> 'active' THEN RETURN jsonb_build_object('error', 'reward ไม่พร้อมแลกขณะนี้'); END IF;
  IF v_reward.starts_at IS NOT NULL AND v_now < v_reward.starts_at THEN
    RETURN jsonb_build_object('error', 'ยังไม่ถึงเวลาแลก'); END IF;
  IF v_reward.ends_at IS NOT NULL AND v_now > v_reward.ends_at THEN
    RETURN jsonb_build_object('error', 'หมดเวลาแลกแล้ว'); END IF;
  IF NOT (v_user.tier = ANY(v_reward.allowed_tiers)) THEN
    RETURN jsonb_build_object('error', 'ระดับสมาชิก ' || v_user.tier::text || ' ไม่สามารถแลกได้'); END IF;
  IF v_user.total_points < v_reward.points_required THEN
    RETURN jsonb_build_object('error',
      'แต้มไม่พอ ต้องการ ' || v_reward.points_required || ' แต้ม (มี ' || v_user.total_points || ')'); END IF;
  IF v_reward.stock IS NOT NULL AND COALESCE(v_reward.stock_remaining, 0) <= 0 THEN
    RETURN jsonb_build_object('error', 'สินค้าหมด'); END IF;

  IF v_reward.redemption_limit_per_user IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
      FROM public.redemptions
     WHERE user_id = p_user_id AND reward_id = p_reward_id AND status <> 'cancelled';
    IF v_count >= v_reward.redemption_limit_per_user THEN
      RETURN jsonb_build_object('error',
        'แลกได้สูงสุด ' || v_reward.redemption_limit_per_user || ' ครั้งต่อคน'); END IF;
  END IF;

  v_needs_shipping := v_reward.redeem_type = 'PREMIUM';
  IF v_needs_shipping THEN
    IF coalesce(trim(p_shipping_name),'') = ''
    OR coalesce(trim(p_shipping_phone),'') = ''
    OR coalesce(trim(p_shipping_address),'') = ''
    OR coalesce(trim(p_shipping_district),'') = ''
    OR coalesce(trim(p_shipping_province),'') = ''
    OR coalesce(trim(p_shipping_postcode),'') = '' THEN
      RETURN jsonb_build_object('error', 'กรอกที่อยู่จัดส่งให้ครบถ้วน'); END IF;
    IF p_shipping_postcode !~ '^[0-9]{5}$' THEN
      RETURN jsonb_build_object('error', 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก'); END IF;
  END IF;

  -- หัก points
  v_new_balance := v_user.total_points - v_reward.points_required;
  UPDATE public.users SET total_points = v_new_balance WHERE id = p_user_id;

  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.rewards SET stock_remaining = COALESCE(stock_remaining, stock) - 1
     WHERE id = p_reward_id;
  END IF;

  v_init_status := CASE v_reward.redeem_type WHEN 'PREMIUM' THEN 'pending' ELSE 'redeemed' END;

  INSERT INTO public.redemptions (
    user_id, reward_id, points_used, reward_snapshot,
    shipping_name, shipping_phone, shipping_address,
    shipping_subdistrict, shipping_district, shipping_province,
    shipping_postcode, shipping_note, status
  ) VALUES (
    p_user_id, p_reward_id, v_reward.points_required,
    jsonb_build_object(
      'name', v_reward.name, 'image_url', v_reward.image_url,
      'points_required', v_reward.points_required, 'model_id', v_reward.model_id,
      'redeem_type', v_reward.redeem_type, 'cash_top_up_thb', v_reward.cash_top_up_thb,
      'original_price_thb', v_reward.original_price_thb,
      'voucher_value_thb', v_reward.voucher_value_thb,
      'shopify_product_url', v_reward.shopify_product_url,
      'code_validity_days', v_reward.code_validity_days
    ),
    COALESCE(NULLIF(trim(p_shipping_name),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_phone),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_address),''), '-'),
    nullif(trim(p_shipping_subdistrict),''),
    COALESCE(NULLIF(trim(p_shipping_district),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_province),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_postcode),''), '00000'),
    nullif(trim(p_shipping_note),''),
    v_init_status
  ) RETURNING id INTO v_red_id;

  -- ── สำคัญ: เขียน points_log ──
  INSERT INTO public.points_log (
    user_id, points_delta, balance_after, type, description
  ) VALUES (
    p_user_id, -v_reward.points_required, v_new_balance, 'REDEEMED',
    'แลก: ' || v_reward.name
  );

  RETURN jsonb_build_object(
    'success', true, 'redemption_id', v_red_id,
    'points_after', v_new_balance,
    'redeem_type', v_reward.redeem_type,
    'cash_top_up_thb', v_reward.cash_top_up_thb,
    'voucher_value_thb', v_reward.voucher_value_thb,
    'shopify_product_url', v_reward.shopify_product_url,
    'reward_name', v_reward.name,
    'needs_code_generation', v_reward.redeem_type IN ('POINTS_CASH', 'VOUCHER')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Refund — คืน points → เขียน points_log ──
CREATE OR REPLACE FUNCTION public.refund_redemption(
  p_redemption_id UUID, p_admin_id UUID, p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_red          public.redemptions%ROWTYPE;
  v_user_total   INTEGER;
  v_new_balance  INTEGER;
  v_reward_name  TEXT;
BEGIN
  SELECT * INTO v_red FROM public.redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'redemption not found'); END IF;
  IF v_red.status = 'cancelled' THEN RETURN jsonb_build_object('error', 'ยกเลิกไปแล้ว'); END IF;
  IF v_red.status = 'delivered' THEN
    RETURN jsonb_build_object('error', 'ใช้ code/ส่งของแล้ว ไม่สามารถ refund ได้'); END IF;

  -- คืน points
  SELECT total_points INTO v_user_total FROM public.users WHERE id = v_red.user_id FOR UPDATE;
  v_new_balance := v_user_total + v_red.points_used;
  UPDATE public.users SET total_points = v_new_balance WHERE id = v_red.user_id;

  -- คืน stock
  UPDATE public.rewards SET stock_remaining = COALESCE(stock_remaining, 0) + 1
   WHERE id = v_red.reward_id AND stock IS NOT NULL;

  -- เปลี่ยน status
  UPDATE public.redemptions
     SET status = 'cancelled', refunded_at = NOW(),
         refunded_by = p_admin_id, refund_reason = p_reason
   WHERE id = p_redemption_id;

  -- เขียน points_log refund
  v_reward_name := (v_red.reward_snapshot->>'name');
  INSERT INTO public.points_log (
    user_id, points_delta, balance_after, type, description, adjusted_by
  ) VALUES (
    v_red.user_id, v_red.points_used, v_new_balance, 'ADMIN_ADJUST',
    'คืนแต้ม (refund): ' || COALESCE(v_reward_name, 'reward') ||
      CASE WHEN p_reason IS NOT NULL THEN ' — ' || p_reason ELSE '' END,
    p_admin_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'refunded_points', v_red.points_used,
    'was_status', v_red.status,
    'shopify_code', v_red.shopify_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- BACKFILL: เขียน points_log สำหรับ redemption ที่ทำไปก่อนหน้านี้
--
-- ตรวจ redemptions ทุกอันที่ไม่ใช่ cancelled และยังไม่มี points_log entry
-- (เทียบจาก description ที่ขึ้นต้นด้วย "แลก:")
-- → backfill ให้
-- ============================================================
DO $$
DECLARE
  r RECORD;
  v_balance INTEGER;
BEGIN
  FOR r IN
    SELECT red.id, red.user_id, red.points_used, red.created_at,
           red.reward_snapshot->>'name' AS reward_name
      FROM public.redemptions red
     WHERE red.status <> 'cancelled'
       AND NOT EXISTS (
         SELECT 1 FROM public.points_log pl
          WHERE pl.user_id = red.user_id
            AND pl.type    = 'REDEEMED'
            AND pl.created_at = red.created_at
            AND pl.points_delta = -red.points_used
       )
     ORDER BY red.created_at ASC
  LOOP
    -- ใช้ total_points ปัจจุบันแทน balance_after — เพราะ historical balance หายไป
    -- (best-effort: ใช้ค่าปัจจุบันเป็น balance_after สำหรับ entry นี้)
    SELECT total_points INTO v_balance FROM public.users WHERE id = r.user_id;
    INSERT INTO public.points_log (
      user_id, points_delta, balance_after, type, description, created_at
    ) VALUES (
      r.user_id,
      -r.points_used,
      v_balance,
      'REDEEMED',
      'แลก: ' || COALESCE(r.reward_name, 'reward'),
      r.created_at
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
