-- ============================================================
-- Migration 0011: Auto-issue coupons based on tier milestones
--
-- เงื่อนไขที่อิงอยู่:
--   • SILVER  ( 0– 79 pts) → Welcome Voucher 10% สูงสุด ฿100
--   • GOLD    (80–399 pts) → Upgrade Voucher ฿500 ขั้นต่ำ ฿5,000
--                          + Quarterly Gift 10% สูงสุด ฿100 ขั้นต่ำ ฿1,000
--                          + ส่งฟรี 1 ครั้ง/เดือน
--   • PLATINUM (400+ pts) → Upgrade Voucher ฿1,500 ขั้นต่ำ ฿10,000
--                          + Quarterly Gift 10% สูงสุด ฿200 ขั้นต่ำ ฿1,000
--                          + ส่งฟรีทุกออเดอร์ ขั้นต่ำ ฿1,000 (privilege, ไม่ออกเป็น coupon)
--
-- กลไกกันคูปองซ้ำใช้คอลัมน์ใหม่ `auto_issue_key`
-- (UNIQUE per user) แทนการต้องไปเก็บ state ที่อื่น
-- ============================================================

-- ── 0. Guard: extension ที่ต้องใช้ ─────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 0a. Guard: enums ที่ต้องใช้ ────────────────────────────
-- ⚠️ ไม่ใช้ ALTER TYPE ADD VALUE ที่นี่ เพราะ Postgres ห้ามใช้ค่า enum ใหม่
-- ใน transaction เดียวกับที่ถูกเพิ่ม
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_tier') THEN
    CREATE TYPE user_tier AS ENUM ('SILVER', 'GOLD', 'PLATINUM');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coupon_discount_type') THEN
    CREATE TYPE coupon_discount_type AS ENUM ('PERCENT', 'FIXED');
  END IF;
END $$;

-- ── 0b. Guard: ตาราง public.users ───────────────────────────
-- สร้างทั้งตารางถ้ายังไม่มีเลย (FK ผูก auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id          VARCHAR(20),
  phone              VARCHAR(20),
  email              VARCHAR(255),
  full_name          VARCHAR(200),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- เติมคอลัมน์ที่ migration นี้ (และ trigger) ต้องใช้ — เผื่อตารางมีอยู่แต่ขาดบางคอลัมน์
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tier            user_tier NOT NULL DEFAULT 'SILVER',
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS total_points    INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_points INTEGER   NOT NULL DEFAULT 0;

-- หมายเหตุ:
-- - ถ้าคอลัมน์ tier มีอยู่แล้วแต่ยังเป็นชนิดอื่น (เช่น VARCHAR) จะไม่แตะ —
--   ปล่อยให้ admin จัดการเอง เพราะแปลงชนิดข้อมูลมีความเสี่ยงสูง
-- - DEFAULT บน ADD COLUMN ครอบ rows เดิมอัตโนมัติ (PG 11+) จึงไม่ต้อง UPDATE ซ้ำ

-- ── 0c. BEFORE UPDATE: sync tier จาก lifetime_points อัตโนมัติ ─
-- ปัญหาที่แก้: บาง path (เช่น admin อัปเดตคะแนนตรงๆ) อาจไม่ได้ SET tier
-- → trigger AFTER UPDATE OF tier ไม่ทำงาน → คูปองไม่ถูกออก
-- กลไก: ก่อน UPDATE ทุกครั้งที่ lifetime_points เปลี่ยน บังคับ recompute tier
-- ตามเงื่อนไข 80 / 400 → tier จะอัปเดตเอง → AFTER trigger ด้านล่างจะยิงคูปอง
CREATE OR REPLACE FUNCTION public.sync_tier_from_lifetime_points()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lifetime_points IS DISTINCT FROM OLD.lifetime_points THEN
    NEW.tier := CASE
      WHEN NEW.lifetime_points >= 400 THEN 'PLATINUM'::user_tier
      WHEN NEW.lifetime_points >=  80 THEN 'GOLD'::user_tier
      ELSE 'SILVER'::user_tier
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_sync_tier ON public.users;
CREATE TRIGGER trg_users_sync_tier
  BEFORE UPDATE OF lifetime_points ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_tier_from_lifetime_points();

CREATE TABLE IF NOT EXISTS public.coupons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
  code            VARCHAR(30) UNIQUE NOT NULL,
  title           VARCHAR(200),
  description     TEXT,
  discount_type   coupon_discount_type NOT NULL DEFAULT 'PERCENT',
  discount_value  NUMERIC(10, 2) NOT NULL,
  min_purchase    NUMERIC(12, 2) DEFAULT 0,
  max_discount    NUMERIC(12, 2),
  valid_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until     DATE NOT NULL,
  max_uses        INTEGER,
  used_count      INTEGER NOT NULL DEFAULT 0,
  used_at         TIMESTAMPTZ,
  theme           VARCHAR(50),
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON public.coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code    ON public.coupons(code);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'coupons_self_select' AND tablename = 'coupons'
  ) THEN
    CREATE POLICY "coupons_self_select" ON public.coupons
      FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

-- ── 1. คอลัมน์สำหรับกันคูปองซ้ำ ────────────────────────────
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS auto_issue_key VARCHAR(80);

COMMENT ON COLUMN public.coupons.auto_issue_key IS
  'NULL = ออกด้วยมือจาก admin; not-null = ออกอัตโนมัติ key ระบุ milestone (WELCOME_SILVER / UPGRADE_GOLD / UPGRADE_PLATINUM / QUARTERLY_2026Q2 / SHIP_202605 ...)';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_coupons_user_auto_key
  ON public.coupons(user_id, auto_issue_key)
  WHERE auto_issue_key IS NOT NULL;

-- ── 2. Helper: gen รหัสคูปองที่ยังไม่ชน ───────────────────
CREATE OR REPLACE FUNCTION public._gen_unique_coupon_code()
RETURNS VARCHAR AS $$
DECLARE
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- ตัด I/O/0/1 ที่อ่านสับสน
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
  -- ถ้าหา 16 ครั้งยังไม่ได้ ให้เติม timestamp suffix
  RETURN v_code || to_char(clock_timestamp(), 'SSMS');
END;
$$ LANGUAGE plpgsql;

-- ── 3. Issue: Welcome Voucher (Silver) ────────────────────
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Issue: Upgrade Voucher (Gold / Platinum) ───────────
CREATE OR REPLACE FUNCTION public.issue_upgrade_coupon(p_user_id UUID, p_tier user_tier)
RETURNS UUID AS $$
DECLARE
  v_code  VARCHAR(30);
  v_id    UUID;
  v_key   VARCHAR(80);
  v_title VARCHAR(200);
  v_desc  TEXT;
  v_value NUMERIC;
  v_min   NUMERIC;
  v_theme VARCHAR(50);
BEGIN
  IF p_tier = 'GOLD' THEN
    v_key := 'UPGRADE_GOLD'; v_value := 500;  v_min := 5000;
    v_title := 'Upgrade Voucher ฿500';
    v_desc  := 'ของขวัญต้อนรับสมาชิก Gold — ส่วนลด ฿500 เมื่อซื้อครบ ฿5,000';
    v_theme := 'gold';
  ELSIF p_tier = 'PLATINUM' THEN
    v_key := 'UPGRADE_PLATINUM'; v_value := 1500; v_min := 10000;
    v_title := 'Upgrade Voucher ฿1,500';
    v_desc  := 'ของขวัญต้อนรับสมาชิก Platinum — ส่วนลด ฿1,500 เมื่อซื้อครบ ฿10,000';
    v_theme := 'black';
  ELSE
    RETURN NULL; -- Silver ไม่มี upgrade voucher
  END IF;

  IF EXISTS (SELECT 1 FROM public.coupons
              WHERE user_id = p_user_id AND auto_issue_key = v_key) THEN
    RETURN NULL;
  END IF;

  v_code := public._gen_unique_coupon_code();
  INSERT INTO public.coupons (
    user_id, code, title, description,
    discount_type, discount_value, min_purchase,
    valid_from, valid_until, theme, auto_issue_key
  ) VALUES (
    p_user_id, v_code, v_title, v_desc,
    'FIXED', v_value, v_min,
    CURRENT_DATE, CURRENT_DATE + INTERVAL '60 days',
    v_theme, v_key
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. Issue: Quarterly Gift (Gold / Platinum) ────────────
-- key = QUARTERLY_<YYYY>Q<n> เช่น QUARTERLY_2026Q2
CREATE OR REPLACE FUNCTION public.issue_quarterly_gift(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_tier      user_tier;
  v_max_disc  NUMERIC;
  v_key       VARCHAR(80);
  v_code      VARCHAR(30);
  v_id        UUID;
  v_q         INTEGER;
  v_y         INTEGER;
  v_q_end     DATE;
BEGIN
  SELECT tier INTO v_tier FROM public.users WHERE id = p_user_id;
  IF v_tier NOT IN ('GOLD', 'PLATINUM') THEN RETURN NULL; END IF;

  v_y := EXTRACT(YEAR    FROM CURRENT_DATE)::int;
  v_q := EXTRACT(QUARTER FROM CURRENT_DATE)::int;
  v_key := 'QUARTERLY_' || v_y || 'Q' || v_q;
  -- ใช้ได้ถึงวันสุดท้ายของไตรมาส
  v_q_end := (date_trunc('quarter', CURRENT_DATE) + INTERVAL '3 months - 1 day')::date;
  v_max_disc := CASE v_tier WHEN 'GOLD' THEN 100 ELSE 200 END;

  IF EXISTS (SELECT 1 FROM public.coupons
              WHERE user_id = p_user_id AND auto_issue_key = v_key) THEN
    RETURN NULL;
  END IF;

  v_code := public._gen_unique_coupon_code();
  INSERT INTO public.coupons (
    user_id, code, title, description,
    discount_type, discount_value, min_purchase, max_discount,
    valid_from, valid_until, theme, auto_issue_key
  ) VALUES (
    p_user_id, v_code,
    'Quarterly Gift 10%',
    'ของขวัญรายไตรมาสสำหรับสมาชิก ' || v_tier::text
      || ' — ส่วนลด 10% สูงสุด ฿' || v_max_disc::text || ' เมื่อซื้อครบ ฿1,000',
    'PERCENT', 10, 1000, v_max_disc,
    CURRENT_DATE, v_q_end,
    CASE v_tier WHEN 'GOLD' THEN 'gold' ELSE 'black' END,
    v_key
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. Issue: Monthly Free Shipping (Gold = 1/เดือน) ──────
-- Platinum ส่งฟรีทุกออเดอร์อยู่แล้ว ไม่ต้องออกเป็นคูปอง
-- key = SHIP_<YYYYMM>
CREATE OR REPLACE FUNCTION public.issue_monthly_free_shipping(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_tier   user_tier;
  v_code   VARCHAR(30);
  v_id     UUID;
  v_key    VARCHAR(80);
  v_m_end  DATE;
BEGIN
  SELECT tier INTO v_tier FROM public.users WHERE id = p_user_id;
  IF v_tier <> 'GOLD' THEN RETURN NULL; END IF;

  v_key   := 'SHIP_' || to_char(CURRENT_DATE, 'YYYYMM');
  v_m_end := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date;

  IF EXISTS (SELECT 1 FROM public.coupons
              WHERE user_id = p_user_id AND auto_issue_key = v_key) THEN
    RETURN NULL;
  END IF;

  v_code := public._gen_unique_coupon_code();
  INSERT INTO public.coupons (
    user_id, code, title, description,
    discount_type, discount_value, min_purchase, max_uses,
    valid_from, valid_until, theme, auto_issue_key
  ) VALUES (
    p_user_id, v_code,
    'ส่งฟรี 1 ครั้ง',
    'สิทธิ์ส่งฟรี 1 ออเดอร์ในเดือนนี้สำหรับสมาชิก Gold',
    'FIXED', 100, 0, 1,
    CURRENT_DATE, v_m_end,
    'gold', v_key
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. Trigger: ออก welcome coupon ทันทีที่สร้าง user ─────
CREATE OR REPLACE FUNCTION public.on_user_created_issue_coupons()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.issue_welcome_coupon(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_users_welcome_coupon ON public.users;
CREATE TRIGGER trg_users_welcome_coupon
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.on_user_created_issue_coupons();

-- ── 8. Trigger: tier เปลี่ยน → ออก / เพิกถอนคูปองอัตโนมัติ ─
-- - UPGRADE (rank ใหม่สูงกว่าเก่า): ออก upgrade + quarterly + shipping
-- - DOWNGRADE (rank ใหม่ต่ำกว่าเก่า): ลบคูปอง auto-issue ที่ยังไม่ใช้
--   ซึ่ง tier ใหม่ไม่มีสิทธิ์แล้ว (WELCOME_SILVER เก็บไว้เสมอ)
CREATE OR REPLACE FUNCTION public.on_user_tier_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_new_rank INT;
  v_old_rank INT;
BEGIN
  v_new_rank := CASE NEW.tier::text
    WHEN 'SILVER'   THEN 1
    WHEN 'GOLD'     THEN 2
    WHEN 'PLATINUM' THEN 3
    ELSE 0 -- legacy enum values: เทียบเป็น 0 เพื่อความปลอดภัย
  END;
  v_old_rank := CASE OLD.tier::text
    WHEN 'SILVER'   THEN 1
    WHEN 'GOLD'     THEN 2
    WHEN 'PLATINUM' THEN 3
    ELSE 0
  END;

  IF v_new_rank > v_old_rank THEN
    -- ─── UPGRADE: ออกทุกคูปองที่ tier ใหม่มีสิทธิ์ (cumulative & idempotent)
    -- รวม Welcome + Gold voucher (ถ้าข้ามจาก SILVER → PLATINUM) + tier ปัจจุบัน
    PERFORM public.apply_tier_coupons(NEW.id);

  ELSIF v_new_rank < v_old_rank THEN
    -- ─── DOWNGRADE: เพิกถอนคูปองที่ยังไม่ใช้ และ tier ใหม่ไม่มีสิทธิ์ ─
    -- ถ้าใหม่ไม่ใช่ PLATINUM → UPGRADE_PLATINUM ไม่มีสิทธิ์แล้ว
    IF NEW.tier::text <> 'PLATINUM' THEN
      DELETE FROM public.coupons
       WHERE user_id = NEW.id
         AND auto_issue_key = 'UPGRADE_PLATINUM'
         AND used_at IS NULL
         AND used_count = 0;
    END IF;

    -- ถ้าใหม่เป็น SILVER → ไม่มีสิทธิ์ Gold upgrade / quarterly / shipping
    IF NEW.tier::text = 'SILVER' THEN
      DELETE FROM public.coupons
       WHERE user_id = NEW.id
         AND auto_issue_key IS NOT NULL
         AND auto_issue_key <> 'WELCOME_SILVER'
         AND used_at IS NULL
         AND used_count = 0;
    END IF;
    -- PLATINUM → GOLD: เก็บ quarterly + shipping ไว้ตามไตรมาส/เดือนปัจจุบัน
    -- (รอบหน้า cron จะออกของ GOLD ให้เอง)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ใช้ AFTER UPDATE ทั่วไป + WHEN clause แทน UPDATE OF tier
-- เพราะ BEFORE trigger ที่ sync จาก lifetime_points อาจปรับ NEW.tier
-- โดยที่ SET clause ไม่มี tier — UPDATE OF tier จะไม่ยิงในกรณีนี้
DROP TRIGGER IF EXISTS trg_users_tier_upgrade_coupons ON public.users;
DROP TRIGGER IF EXISTS trg_users_tier_changed         ON public.users;
CREATE TRIGGER trg_users_tier_changed
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (NEW.tier IS DISTINCT FROM OLD.tier)
  EXECUTE FUNCTION public.on_user_tier_changed();

-- ── 9. Batch: ใช้ใน cron — รัน quarterly/monthly ทุกคน ────
CREATE OR REPLACE FUNCTION public.run_quarterly_gift_batch()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER := 0; v_uid UUID;
BEGIN
  FOR v_uid IN
    SELECT id FROM public.users
     WHERE is_active = true AND tier IN ('GOLD', 'PLATINUM')
  LOOP
    IF public.issue_quarterly_gift(v_uid) IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.run_monthly_shipping_batch()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER := 0; v_uid UUID;
BEGIN
  FOR v_uid IN
    SELECT id FROM public.users
     WHERE is_active = true AND tier = 'GOLD'
  LOOP
    IF public.issue_monthly_free_shipping(v_uid) IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 9b. Helper: ออกคูปองทั้งหมดที่ user คนนึงควรมีตอนนี้ ──
-- ใช้ได้ทั้งกับ trigger (NEW row) และเรียกตรงจาก admin/cron
CREATE OR REPLACE FUNCTION public.apply_tier_coupons(p_user_id UUID)
RETURNS VOID AS $$
DECLARE v_tier user_tier;
BEGIN
  SELECT tier INTO v_tier FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Welcome (ทุก tier — function จะข้ามถ้าได้แล้ว)
  PERFORM public.issue_welcome_coupon(p_user_id);

  -- Gold ขึ้นไปได้: upgrade gold voucher (idempotent)
  IF v_tier::text IN ('GOLD', 'PLATINUM') THEN
    PERFORM public.issue_upgrade_coupon(p_user_id, 'GOLD'::user_tier);
    PERFORM public.issue_quarterly_gift(p_user_id);
  END IF;

  -- Gold เท่านั้น: monthly free shipping (Platinum ส่งฟรีอยู่แล้ว)
  IF v_tier::text = 'GOLD' THEN
    PERFORM public.issue_monthly_free_shipping(p_user_id);
  END IF;

  -- Platinum: เพิ่ม upgrade platinum voucher (สะสมจาก Gold)
  IF v_tier::text = 'PLATINUM' THEN
    PERFORM public.issue_upgrade_coupon(p_user_id, 'PLATINUM'::user_tier);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 10. Backfill: ให้ลูกค้าเดิมที่ผ่านเงื่อนไขอยู่แล้ว ───
-- (a) Re-derive tier จาก lifetime_points ก่อน
--     สำคัญ: DB เก่าอาจเคยมี user ที่ lifetime_points สูงแต่ tier ติด SILVER อยู่
--     ถ้าไม่ recompute ก่อน → backfill จะมองว่าเขาเป็น Silver แล้วออกแค่ Welcome
-- หมายเหตุ: AFTER UPDATE trigger จะ fire สำหรับแถวที่ tier เปลี่ยน → ออกคูปองอัตโนมัติ
UPDATE public.users
   SET tier = CASE
     WHEN lifetime_points >= 400 THEN 'PLATINUM'::user_tier
     WHEN lifetime_points >=  80 THEN 'GOLD'::user_tier
     ELSE 'SILVER'::user_tier
   END
 WHERE tier IS DISTINCT FROM CASE
     WHEN lifetime_points >= 400 THEN 'PLATINUM'::user_tier
     WHEN lifetime_points >=  80 THEN 'GOLD'::user_tier
     ELSE 'SILVER'::user_tier
   END;

-- (b) เรียก apply_tier_coupons ให้ทุกคน — idempotent
--     ครอบกรณีที่ trigger ไม่ fire (เช่น tier ไม่เปลี่ยน แต่ขาดคูปอง)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.users LOOP
    PERFORM public.apply_tier_coupons(r.id);
  END LOOP;
END $$;

-- ── 11. รีเฟรช PostgREST schema cache ────────────────────
NOTIFY pgrst, 'reload schema';
