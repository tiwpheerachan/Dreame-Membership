-- ============================================================
-- Migration 0018: 3 Reward Redemption Models
--
-- 1) POINTS_CASH  → ใช้แต้ม + จ่ายเงินเพิ่ม (เช่น 400 pts + ฿4,809 → Dreame F20)
-- 2) VOUCHER      → ใช้แต้ม → ได้คูปองส่วนลด (เช่น 100 pts → ฿200 off)
-- 3) PREMIUM      → ใช้แต้มล้วน (พรีเมียม/ของแถม, admin ส่งของเอง)
--
-- เพิ่มคอลัมน์ใหม่ + ปรับ RPC redeem_reward ให้:
--   • คืน apply_url + shopify_code ตอน type = POINTS_CASH / VOUCHER
--   • Premium ใช้ flow เดิม (admin ส่งของ)
--
-- Shopify code จะถูกสร้างฝั่ง Node ใน /api/rewards/[id]/redeem
-- (ที่นี่แค่ schema)
-- ============================================================

ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS redeem_type VARCHAR(20) NOT NULL DEFAULT 'PREMIUM'
    CHECK (redeem_type IN ('POINTS_CASH','VOUCHER','PREMIUM')),

  -- POINTS_CASH: เงินสดที่ user ต้องจ่ายเพิ่ม (จะ generate code ส่วนลด = original_price - cash_top_up)
  ADD COLUMN IF NOT EXISTS cash_top_up_thb     NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS original_price_thb  NUMERIC(12, 2),

  -- VOUCHER: มูลค่า voucher ที่จะออกให้ (fixed amount off)
  ADD COLUMN IF NOT EXISTS voucher_value_thb   NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS voucher_min_purchase_thb NUMERIC(12, 2) DEFAULT 0,

  -- POINTS_CASH: link ไป product จริงใน Shopify
  ADD COLUMN IF NOT EXISTS shopify_product_url  TEXT,
  ADD COLUMN IF NOT EXISTS shopify_product_id   BIGINT,
  ADD COLUMN IF NOT EXISTS shopify_variant_id   BIGINT,

  -- POINTS_CASH/VOUCHER: หมดอายุ code (วันหลังแลก)
  ADD COLUMN IF NOT EXISTS code_validity_days INTEGER DEFAULT 30;

COMMENT ON COLUMN public.rewards.redeem_type IS
  'POINTS_CASH = แต้ม + เงินสด, VOUCHER = แลกเป็นคูปอง, PREMIUM = แลกล้วน (admin ส่งของ)';
COMMENT ON COLUMN public.rewards.cash_top_up_thb IS
  'POINTS_CASH only — ยอดเงินสดที่ user ต้องจ่ายตอน checkout';
COMMENT ON COLUMN public.rewards.original_price_thb IS
  'POINTS_CASH only — ราคาสินค้าจริงใน Shopify (ใช้คำนวณส่วนลด)';
COMMENT ON COLUMN public.rewards.voucher_value_thb IS
  'VOUCHER only — มูลค่าคูปองที่จะออกเป็น fixed_amount off';
COMMENT ON COLUMN public.rewards.shopify_product_url IS
  'POINTS_CASH only — link ไป product page ใน Shopify ที่ user จะกดเพื่อใช้ code';

-- ── ปรับ RPC redeem_reward รองรับ 3 modes ───────────────────
-- คืน JSON เพิ่ม redeem_type + cash_top_up + product_url
-- + จองช่อง shopify_code/apply_url (จะถูก fill ฝั่ง Node หลัง RPC)
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

  -- ── Shipping address validation: บังคับเฉพาะ POINTS_CASH + PREMIUM ──
  -- VOUCHER ไม่ต้องมีที่อยู่ (เป็น code ใช้ในเว็บ)
  v_needs_shipping := v_reward.redeem_type IN ('POINTS_CASH', 'PREMIUM');

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

  -- Insert redemption (snapshot reward เผื่อ admin แก้ทีหลัง)
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
    COALESCE(NULLIF(trim(p_shipping_name),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_phone),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_address),''), '-'),
    nullif(trim(p_shipping_subdistrict),''),
    COALESCE(NULLIF(trim(p_shipping_district),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_province),''), '-'),
    COALESCE(NULLIF(trim(p_shipping_postcode),''), '00000'),
    nullif(trim(p_shipping_note),''),
    CASE
      -- VOUCHER + POINTS_CASH ต้องสร้าง code → admin อาจไม่ต้อง confirm ก็ได้
      -- แต่เพื่อ audit เรา auto-confirm หลัง generate code สำเร็จ
      WHEN v_reward.redeem_type = 'VOUCHER' THEN 'confirmed'
      ELSE 'pending'
    END
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
    -- ฝั่ง Node จะ generate code แล้ว update row นี้ — return id ให้
    'needs_code_generation', v_reward.redeem_type IN ('POINTS_CASH', 'VOUCHER')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── เพิ่มคอลัมน์ในตาราง redemptions เก็บ code ที่ generate ────
ALTER TABLE public.redemptions
  ADD COLUMN IF NOT EXISTS shopify_code        VARCHAR(120),
  ADD COLUMN IF NOT EXISTS shopify_apply_url   TEXT,
  ADD COLUMN IF NOT EXISTS shopify_price_rule_id BIGINT,
  ADD COLUMN IF NOT EXISTS code_expires_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_redemptions_code
  ON public.redemptions(shopify_code) WHERE shopify_code IS NOT NULL;

NOTIFY pgrst, 'reload schema';
