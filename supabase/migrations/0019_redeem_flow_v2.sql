-- ============================================================
-- Migration 0019: Reward Redemption flow v2
--
-- เปลี่ยน:
--   1. POINTS_CASH ไม่ต้องกรอกที่อยู่ในระบบเรา (user ใส่ใน Shopify)
--   2. VOUCHER เหมือนเดิม ไม่ต้องที่อยู่
--   3. PREMIUM ยังคงต้องกรอกที่อยู่
--   4. เพิ่ม status 'redeemed' (= code ออกแล้วรอใช้) แยกจาก 'delivered' (= ใช้ checkout แล้ว)
--   5. Trigger: เมื่อ coupon ของ redemption ถูก mark used_at →
--      อัพเดต redemption.status เป็น 'delivered' อัตโนมัติ
-- ============================================================

-- ── 1. ขยาย status enum ของ redemptions ──
ALTER TABLE public.redemptions
  DROP CONSTRAINT IF EXISTS redemptions_status_check;
ALTER TABLE public.redemptions
  ADD CONSTRAINT redemptions_status_check
    CHECK (status IN ('pending','redeemed','confirmed','shipping','delivered','cancelled','expired'));

-- redeemed = code ออกแล้ว user ยังไม่ใช้
-- delivered = user ใช้แล้วที่ Shopify (auto จาก webhook)
-- expired  = code หมดอายุ (cron จะ flag)

COMMENT ON COLUMN public.redemptions.status IS
  'pending = รอ admin confirm (PREMIUM) | redeemed = code ออกแล้วรอใช้ | confirmed = admin ยืนยัน (PREMIUM) | shipping/delivered = ส่งของ/checkout เสร็จ | cancelled = ยกเลิก | expired = code หมดอายุ';

-- ── 2. ปรับ RPC redeem_reward ──
-- POINTS_CASH + VOUCHER ไม่ validate address
-- POINTS_CASH ใหม่: status เริ่มต้น 'redeemed' (รอ user ใช้)
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
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'user not found'); END IF;
  IF NOT v_user.is_active THEN RETURN jsonb_build_object('error', 'user inactive'); END IF;

  SELECT * INTO v_reward FROM public.rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'reward not found'); END IF;

  IF v_reward.status <> 'active' THEN
    RETURN jsonb_build_object('error', 'reward ไม่พร้อมแลกขณะนี้');
  END IF;
  IF v_reward.starts_at IS NOT NULL AND v_now < v_reward.starts_at THEN
    RETURN jsonb_build_object('error', 'ยังไม่ถึงเวลาแลก');
  END IF;
  IF v_reward.ends_at IS NOT NULL AND v_now > v_reward.ends_at THEN
    RETURN jsonb_build_object('error', 'หมดเวลาแลกแล้ว');
  END IF;
  IF NOT (v_user.tier = ANY(v_reward.allowed_tiers)) THEN
    RETURN jsonb_build_object('error',
      'ระดับสมาชิก ' || v_user.tier::text || ' ไม่สามารถแลกได้');
  END IF;
  IF v_user.total_points < v_reward.points_required THEN
    RETURN jsonb_build_object('error',
      'แต้มไม่พอ ต้องการ ' || v_reward.points_required || ' แต้ม (มี ' || v_user.total_points || ')');
  END IF;
  IF v_reward.stock IS NOT NULL AND COALESCE(v_reward.stock_remaining, 0) <= 0 THEN
    RETURN jsonb_build_object('error', 'สินค้าหมด');
  END IF;

  IF v_reward.redemption_limit_per_user IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
      FROM public.redemptions
     WHERE user_id = p_user_id
       AND reward_id = p_reward_id
       AND status <> 'cancelled';
    IF v_count >= v_reward.redemption_limit_per_user THEN
      RETURN jsonb_build_object('error',
        'แลกได้สูงสุด ' || v_reward.redemption_limit_per_user || ' ครั้งต่อคน');
    END IF;
  END IF;

  -- ── Shipping address: บังคับเฉพาะ PREMIUM ──
  -- POINTS_CASH = user กรอกที่อยู่ตอน checkout Shopify
  -- VOUCHER     = ไม่ต้องส่งของ
  v_needs_shipping := v_reward.redeem_type = 'PREMIUM';

  IF v_needs_shipping THEN
    IF coalesce(trim(p_shipping_name),'') = ''
    OR coalesce(trim(p_shipping_phone),'') = ''
    OR coalesce(trim(p_shipping_address),'') = ''
    OR coalesce(trim(p_shipping_district),'') = ''
    OR coalesce(trim(p_shipping_province),'') = ''
    OR coalesce(trim(p_shipping_postcode),'') = '' THEN
      RETURN jsonb_build_object('error', 'กรอกที่อยู่จัดส่งให้ครบถ้วน');
    END IF;
    IF p_shipping_postcode !~ '^[0-9]{5}$' THEN
      RETURN jsonb_build_object('error', 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
    END IF;
  END IF;

  -- หัก points
  UPDATE public.users
     SET total_points = total_points - v_reward.points_required
   WHERE id = p_user_id;

  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.rewards
       SET stock_remaining = COALESCE(stock_remaining, stock) - 1
     WHERE id = p_reward_id;
  END IF;

  -- กำหนด init status:
  --   POINTS_CASH / VOUCHER → 'redeemed' (code ออกแล้วรอใช้)
  --   PREMIUM → 'pending' (รอ admin confirm + ship)
  v_init_status := CASE v_reward.redeem_type
    WHEN 'PREMIUM' THEN 'pending'
    ELSE 'redeemed'
  END;

  INSERT INTO public.redemptions (
    user_id, reward_id, points_used, reward_snapshot,
    shipping_name, shipping_phone, shipping_address,
    shipping_subdistrict, shipping_district, shipping_province,
    shipping_postcode, shipping_note,
    status
  ) VALUES (
    p_user_id, p_reward_id, v_reward.points_required,
    jsonb_build_object(
      'name',                v_reward.name,
      'image_url',           v_reward.image_url,
      'points_required',     v_reward.points_required,
      'model_id',            v_reward.model_id,
      'redeem_type',         v_reward.redeem_type,
      'cash_top_up_thb',     v_reward.cash_top_up_thb,
      'original_price_thb',  v_reward.original_price_thb,
      'voucher_value_thb',   v_reward.voucher_value_thb,
      'shopify_product_url', v_reward.shopify_product_url,
      'code_validity_days',  v_reward.code_validity_days
    ),
    -- ใส่ '-' กันชน NOT NULL constraint สำหรับ PREMIUM ก็ผ่าน address validation ข้างบนแล้ว
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

  RETURN jsonb_build_object(
    'success',          true,
    'redemption_id',    v_red_id,
    'points_after',     v_user.total_points - v_reward.points_required,
    'redeem_type',      v_reward.redeem_type,
    'cash_top_up_thb',  v_reward.cash_top_up_thb,
    'voucher_value_thb', v_reward.voucher_value_thb,
    'shopify_product_url', v_reward.shopify_product_url,
    'reward_name',      v_reward.name,
    'needs_code_generation', v_reward.redeem_type IN ('POINTS_CASH', 'VOUCHER')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Cascade trigger: เมื่อ coupon ถูก mark used_at → ปรับ redemption status ──
-- ใช้ shopify_code ใน redemption เป็นตัวเชื่อม
CREATE OR REPLACE FUNCTION public.cascade_coupon_used_to_redemption()
RETURNS TRIGGER AS $$
BEGIN
  -- เฉพาะตอน used_at เปลี่ยนจาก NULL → not null
  IF OLD.used_at IS NULL AND NEW.used_at IS NOT NULL AND NEW.code IS NOT NULL THEN
    UPDATE public.redemptions
       SET status = 'delivered',
           delivered_at = NEW.used_at
     WHERE shopify_code = NEW.code
       AND status IN ('redeemed', 'pending', 'confirmed');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_coupons_used_cascade ON public.coupons;
CREATE TRIGGER trg_coupons_used_cascade
  AFTER UPDATE OF used_at ON public.coupons
  FOR EACH ROW
  WHEN (NEW.used_at IS DISTINCT FROM OLD.used_at)
  EXECUTE FUNCTION public.cascade_coupon_used_to_redemption();

-- ── 4. Cron helper: flag expired codes ──
CREATE OR REPLACE FUNCTION public.flag_expired_redemption_codes()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.redemptions
     SET status = 'expired'
   WHERE status = 'redeemed'
     AND code_expires_at IS NOT NULL
     AND code_expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
