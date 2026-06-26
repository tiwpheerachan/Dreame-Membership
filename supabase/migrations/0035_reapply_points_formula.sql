-- ============================================================
-- Migration 0035: Re-apply correct points formula (migration drift fix)
--
-- ปัญหา: production ยังรัน award_points_for_purchase เวอร์ชันเก่า
--        (÷100, GOLD ×1.5, PLATINUM ×2.0) จาก migration 0002/0003b
--        → migration 0005 (÷500/200, ×1.0/1.0/1.2) "ไม่เคยถูก apply"
--
-- หลักฐาน: order 15,990฿ ช่อง TIKTOK
--          เก่า  : FLOOR(15990/100)=159 → PLATINUM ×2.0 = 318  ← ที่ได้จริง
--          ถูก   : FLOOR(15990/500)=31  → PLATINUM ×1.2 = 37   ← ที่ UI โชว์
--
-- แก้: re-apply สูตรถูกต้อง (เหมือน 0005) + ใส่ SET search_path = public
--      ให้ทุก function กันปัญหา drift แบบเดียวกับ generate_member_id
--
-- ⚠️ นี่แก้แต้ม "ไปข้างหน้า" เท่านั้น — แต้มเก่าที่คิดด้วยสูตรเก่ายัง
--    เกินจริงอยู่ ต้อง recompute แยกถ้าต้องการ (ดู note ท้ายไฟล์)
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_tier(p_user_id UUID)
RETURNS VOID AS $$
DECLARE lp INTEGER; new_tier user_tier;
BEGIN
  SELECT lifetime_points INTO lp FROM public.users WHERE id = p_user_id;
  IF    lp >= 400 THEN new_tier := 'PLATINUM';
  ELSIF lp >=  80 THEN new_tier := 'GOLD';
  ELSE                 new_tier := 'SILVER';
  END IF;
  UPDATE public.users SET tier = new_tier WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

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

  -- Earn divisor: web & in-store = 200 THB / pt; platforms = 500 THB / pt
  -- channel เป็น enum sale_channel → ต้อง cast ::text ก่อน UPPER
  -- (ไม่งั้น error: function upper(sale_channel) does not exist → award พังเงียบ)
  v_divisor := CASE UPPER(COALESCE(v_reg.channel::text, 'OTHER'))
    WHEN 'WEBSITE' THEN 200
    WHEN 'STORE'   THEN 200
    WHEN 'SHOPEE'  THEN 500
    WHEN 'LAZADA'  THEN 500
    WHEN 'TIKTOK'  THEN 500
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

CREATE OR REPLACE FUNCTION adjust_user_points(p_user_id UUID, p_delta INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_user         public.users%ROWTYPE;
  v_new_total    INTEGER;
  v_new_lifetime INTEGER;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_new_total    := GREATEST(0, v_user.total_points    + p_delta);
  v_new_lifetime := GREATEST(0, v_user.lifetime_points + p_delta);

  UPDATE public.users
    SET total_points    = v_new_total,
        lifetime_points = v_new_lifetime,
        tier = CASE
          WHEN v_new_lifetime >= 400 THEN 'PLATINUM'::user_tier
          WHEN v_new_lifetime >=  80 THEN 'GOLD'::user_tier
          ELSE 'SILVER'::user_tier
        END
    WHERE id = p_user_id;

  RETURN v_new_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

NOTIFY pgrst, 'reload schema';

-- ── หมายเหตุ: recompute แต้มเก่า (รันแยกหลังตรวจสอบ) ─────────
-- ดู registration ที่ award ด้วยสูตรเก่า (points_awarded ไม่ตรงสูตรใหม่):
--   SELECT pr.id, pr.order_sn, pr.channel, pr.total_amount, pr.points_awarded,
--          FLOOR(pr.total_amount / CASE UPPER(pr.channel)
--            WHEN 'WEBSITE' THEN 200 WHEN 'STORE' THEN 200 ELSE 500 END)
--          * CASE u.tier WHEN 'PLATINUM' THEN 1.2 ELSE 1.0 END AS should_be
--     FROM public.purchase_registrations pr
--     JOIN public.users u ON u.id = pr.user_id
--    WHERE pr.points_awarded > 0;
