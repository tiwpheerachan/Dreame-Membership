-- ============================================================
-- Migration 0042: Points rate per channel (Brand Shop + Website = 2×)
--
-- อัตราใหม่ (ยืนยันโดยเจ้าของ 2026-07-14):
--   Brand Shop : 500฿ = 2 แต้ม  (divisor 250)
--   Website    : 500฿ = 2 แต้ม  (divisor 250)
--   นอกนั้น     : 500฿ = 1 แต้ม  (divisor 500)
--     → Shopee / Lazada / TikTok / หน้าร้าน (STORE) / OTHER
--
-- ⚠️ เปลี่ยนจากสูตรเดิม (0035): เดิม WEBSITE=200฿/แต้ม, STORE=200฿/แต้ม
--    ใหม่: WEBSITE=250฿/แต้ม, STORE=500฿/แต้ม (คิดแต้มไปข้างหน้าเท่านั้น
--    — แต้มเก่าที่ award แล้วไม่ถูกแตะ)
--
-- ต้องรัน 0041 (เพิ่มค่า enum BRANDSHOP) ให้ commit ก่อนไฟล์นี้
-- (ฟังก์ชันนี้อ้าง 'BRANDSHOP' เป็น text literal จึงไม่บังคับ แต่ order นี้ปลอดภัยสุด)
-- ============================================================

CREATE OR REPLACE FUNCTION award_points_for_purchase(p_purchase_reg_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_reg          public.purchase_registrations%ROWTYPE;
  v_user         public.users%ROWTYPE;
  v_divisor      INTEGER;
  v_base_points  INTEGER;
  v_multiplier   NUMERIC;
  v_final_points INTEGER;
BEGIN
  SELECT * INTO v_reg FROM public.purchase_registrations
    WHERE id = p_purchase_reg_id FOR UPDATE;
  IF NOT FOUND OR v_reg.points_awarded > 0 THEN RETURN 0; END IF;

  SELECT * INTO v_user FROM public.users
    WHERE id = v_reg.user_id FOR UPDATE;

  -- Earn divisor: Brand Shop & Website = 250 THB / pt (500฿ = 2 pts);
  -- ทุกช่องทางอื่น = 500 THB / pt (500฿ = 1 pt).
  -- channel เป็น enum sale_channel → ต้อง cast ::text ก่อน UPPER
  -- (ไม่งั้น error: function upper(sale_channel) does not exist → award พังเงียบ)
  v_divisor := CASE UPPER(COALESCE(v_reg.channel::text, 'OTHER'))
    WHEN 'BRANDSHOP' THEN 250
    WHEN 'WEBSITE'   THEN 250
    ELSE 500
  END;
  v_base_points := FLOOR(COALESCE(v_reg.total_amount, 0) / v_divisor);

  -- Tier multiplier (Platinum-only VIP boost)
  v_multiplier := CASE v_user.tier
    WHEN 'SILVER'   THEN 1.0
    WHEN 'GOLD'     THEN 1.0
    WHEN 'PLATINUM' THEN 1.2
    WHEN 'PLUS'     THEN 1.0
    WHEN 'PRO'      THEN 1.0
    WHEN 'ULTRA'    THEN 1.0
    WHEN 'MASTER'   THEN 1.2
    ELSE 1.0
  END;
  v_final_points := FLOOR(v_base_points * v_multiplier);
  IF v_final_points <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.points_log (user_id, purchase_reg_id, points_delta, balance_after, type, description, expires_at)
  VALUES (
    v_reg.user_id, p_purchase_reg_id, v_final_points,
    v_user.total_points + v_final_points,
    'EARNED',
    'ซื้อสินค้า: ' || COALESCE(v_reg.model_name, v_reg.item_name, v_reg.order_sn),
    CURRENT_DATE + INTERVAL '1 year'
  );

  UPDATE public.users
    SET total_points    = total_points    + v_final_points,
        lifetime_points = lifetime_points + v_final_points,
        tier = CASE
          WHEN lifetime_points + v_final_points >= 400 THEN 'PLATINUM'::user_tier
          WHEN lifetime_points + v_final_points >=  80 THEN 'GOLD'::user_tier
          ELSE 'SILVER'::user_tier
        END
    WHERE id = v_reg.user_id;

  UPDATE public.purchase_registrations
    SET points_awarded = v_final_points, points_awarded_at = NOW()
    WHERE id = p_purchase_reg_id;

  RETURN v_final_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

NOTIFY pgrst, 'reload schema';
