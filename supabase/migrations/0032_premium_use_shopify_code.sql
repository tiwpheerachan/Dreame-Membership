-- ============================================================
-- Migration 0032: PREMIUM rewards → use Shopify code (เหมือน POINTS_CASH)
--
-- เปลี่ยน flow ของ PREMIUM:
--   ก่อน: ต้องกรอกที่อยู่ → admin ส่งของเอง (status='pending')
--   หลัง: ไม่ต้องกรอกที่อยู่ → ออก Shopify code → user ใช้ที่ Shopify
--         (status='redeemed', needs_code_generation=true)
--         Shopify จัดการจัดส่งตามที่อยู่ที่ user กรอกตอน checkout
--
-- เหตุผล: unified UX — ทุก reward ใช้ flow เดียวกัน, ลด workload admin,
--         ใช้ระบบจัดส่งของ Shopify ที่มี tracking อยู่แล้ว
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

  -- ── REMOVED: shipping validation ──
  -- ทุก type ใช้ Shopify code → ไม่ต้อง validate shipping ตอนแลก
  -- ลูกค้าจะกรอกที่อยู่จัดส่งตอน checkout ที่ Shopify เอง

  -- หัก points
  v_new_balance := v_user.total_points - v_reward.points_required;
  UPDATE public.users SET total_points = v_new_balance WHERE id = p_user_id;

  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.rewards SET stock_remaining = COALESCE(stock_remaining, stock) - 1
     WHERE id = p_reward_id;
  END IF;

  -- ── ทุก type ใช้ status='redeemed' ───
  -- API จะ gen Shopify code → update เป็น 'confirmed'
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
    -- shipping fields เก็บไว้กัน schema break แต่ใส่ '-' (จะกรอกที่ Shopify)
    COALESCE(NULLIF(trim(p_shipping_name),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_phone),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_address),''), '-'),
    nullif(trim(p_shipping_subdistrict),''),
    COALESCE(NULLIF(trim(p_shipping_district),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_province),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_postcode),''), '00000'),
    nullif(trim(p_shipping_note),''),
    'redeemed'
  ) RETURNING id INTO v_red_id;

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
    -- ── ทุก type ออก code ──
    'needs_code_generation', TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
