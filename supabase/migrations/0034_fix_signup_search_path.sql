-- ============================================================
-- Migration 0034: Fix "Database error saving new user" on signup
--
-- ปัญหา: trigger generate_member_id (BEFORE INSERT บน public.users)
--        เรียก nextval('member_id_seq') แบบ "ไม่ระบุ schema" และ function
--        ไม่ได้ตั้ง search_path ไว้
--
--        ที่ร้ายกว่านั้น: sequence member_id_seq ถูกสร้างไว้ใน schema
--        `extensions` ไม่ใช่ `public` (เพราะ schema.sql ใช้ CREATE SEQUENCE
--        แบบไม่ระบุ schema → ไปลงตาม search_path)
--
--        เมื่อ GoTrue สร้าง user มันรันในฐานะ role `supabase_auth_admin`
--        ซึ่ง search_path = 'auth' (ไม่มี public/extensions) → หา
--        member_id_seq ไม่เจอ → INSERT ล้ม → ทั้ง transaction rollback
--        → ผู้ใช้เห็น "Database error saving new user (code: 500)"
--        ทุกครั้งที่สมัคร (กระทบทั้งสมัครด้วย email และ phone)
--
-- แก้:
--   0) ย้าย member_id_seq มาที่ schema public (รักษาค่า currval ไว้)
--   1) ระบุ schema ให้ sequence ชัด → public.member_id_seq
--   2) ตั้ง SET search_path = public ให้ทุก function ใน signup path
--      (กันบั๊กคลาสเดียวกันถ้า Supabase ปรับ search_path ของ role อีก)
-- ============================================================

-- ── 0. ทำให้ public.member_id_seq มีอยู่จริง + seed ไม่ให้ชน ──
-- บน DB production ไม่มี sequence ชื่อ member_id_seq ใน pg_class เลย
-- (schema.sql ที่สร้างไว้ไม่เคยถูก apply หรือถูกลบ) → สร้างใหม่ใน public
-- แล้ว setval ให้สูงกว่าเลขสมาชิกสูงสุดที่มีอยู่ กันออก member_id ซ้ำ
DO $$
DECLARE v_max bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S' AND c.relname = 'member_id_seq' AND n.nspname = 'public'
  ) THEN
    CREATE SEQUENCE public.member_id_seq;
  END IF;

  SELECT COALESCE(MAX(NULLIF(regexp_replace(member_id, '\D', '', 'g'), ''))::bigint, 100000)
    INTO v_max
    FROM public.users
   WHERE member_id LIKE 'DRM-%';

  PERFORM setval('public.member_id_seq', GREATEST(v_max, 100000));
END $$;

-- ── 1. ตัวต้นเหตุ: generate_member_id ─────────────────────────
CREATE OR REPLACE FUNCTION public.generate_member_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_id IS NULL OR NEW.member_id = '' THEN
    NEW.member_id := 'DRM-' || LPAD(nextval('public.member_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ── 2. Hardening: function อื่นใน signup path ────────────────
-- ปัจจุบันอ้างตารางแบบ public.* ครบ จึงยังทำงานได้ แต่ใส่ search_path
-- กันเหนียวไว้ เผื่อแก้ไขภายหลังแล้วเผลอใช้ชื่อแบบไม่ระบุ schema

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.on_user_created_issue_coupons()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.issue_welcome_coupon(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.issue_welcome_coupon(p_user_id UUID)
RETURNS UUID AS $$
DECLARE v_code VARCHAR(30); v_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.coupons
              WHERE user_id = p_user_id AND auto_issue_key = 'WELCOME_SILVER') THEN
    RETURN NULL;
  END IF;
  v_code := public._gen_unique_coupon_code();
  INSERT INTO public.coupons (
    user_id, code, title, description,
    discount_type, discount_value, min_purchase, max_discount,
    valid_from, valid_until, theme, auto_issue_key
  ) VALUES (
    p_user_id, v_code,
    'Welcome Voucher 10%',
    'ส่วนลด 10% สูงสุด ฿100 สำหรับสมาชิกใหม่ Silver',
    'PERCENT', 10, 0, 100,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days',
    'rose', 'WELCOME_SILVER'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ── 3. helper ที่ welcome coupon เรียก ───────────────────────
CREATE OR REPLACE FUNCTION public._gen_unique_coupon_code()
RETURNS VARCHAR AS $$
DECLARE
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     VARCHAR(30);
  v_exists   BOOLEAN;
  i          INTEGER;
  j          INTEGER;
BEGIN
  FOR i IN 1..16 LOOP
    v_code := '';
    FOR j IN 1..8 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.coupons WHERE code = v_code) INTO v_exists;
    IF NOT v_exists THEN RETURN v_code; END IF;
  END LOOP;
  RETURN v_code || to_char(clock_timestamp(), 'SSMS');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
