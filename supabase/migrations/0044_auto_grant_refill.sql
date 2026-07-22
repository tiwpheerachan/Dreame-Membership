-- ============================================================
-- Migration 0044: Auto-grant สิทธิน้ำยาฟรี เมื่อยืนยันออเดอร์หุ่นยนต์ ≥ 30,000
--
-- กติกา (ยืนยันโดยเจ้าของ 2026-07-22):
--   ยอดออเดอร์ ≥ 30,000  AND  มีสินค้าเป็น "หุ่นยนต์"  → สร้างสิทธิน้ำยาฟรี
--   อัตโนมัติ (4 รอบ/2 ปี) "ตอนออเดอร์ถูกยืนยันแล้ว" ทุกช่องทาง
--
--   ยืนยัน = status ∈ (BQ_VERIFIED, ADMIN_APPROVED)
--   → ครอบทุกทางที่ยืนยันออเดอร์: ลงทะเบียนออนไลน์ (auto), cron, admin recheck,
--     admin approve หน้าร้าน/Brand Shop — ทำเป็น trigger ที่เดียวจึงไม่พลาด path
--
-- ทำไมต้องเช็ค "หุ่นยนต์" ไม่ใช่แค่ยอด: สินค้า ≥30,000 มีทั้งที่ไม่ใช่หุ่นยนต์
--   (Hair Gleam ฿55k, PM30 เครื่องฟอกอากาศ ฿30k, H13/H15 เครื่องดูดฝุ่นถูพื้น).
--   หุ่นยนต์จริงชื่อจะมีคำว่า robot / หุ่นยนต์ / 机器人 เสมอ (calibrate จาก BQ แล้ว).
-- ============================================================

-- ── 1. ผูกสิทธิกับ registration (ลิงก์ + กันสร้างซ้ำ) ──────────
ALTER TABLE public.refill_privileges
  ADD COLUMN IF NOT EXISTS purchase_reg_id uuid
  REFERENCES public.purchase_registrations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_refill_priv_reg
  ON public.refill_privileges(purchase_reg_id) WHERE purchase_reg_id IS NOT NULL;

COMMENT ON COLUMN public.refill_privileges.purchase_reg_id IS
  'ออเดอร์ที่ทำให้ได้สิทธินี้ (auto-grant); NULL = มาจาก CSV/แอดมิน';

-- ── 2. ตัวจำแนก "หุ่นยนต์" จากชื่อสินค้า (calibrate จาก BQ จริงแล้ว) ──
-- (A) มีคำว่า robot / หุ่นยนต์ / 机器人 ตรงๆ — precise, ครอบ listing ที่มีคำบรรยาย
-- (B) ชื่อเป็นรหัสรุ่นล้วน (เครื่องโชว์/ชำรุด/POS: "Dreame X50 Ultra White") —
--     ต้องเป็นสินค้า Dreame/追觅 + รหัสรุ่นหุ่นยนต์ (Aqua10 / X10–X60 / L10–L50)
--     + ไม่ใช่อะไหล่/ของสิ้นเปลือง (กัน "Side Brush", "Anker Sport X20", น้ำยา ฯลฯ)
-- ราคา ≥30,000 (เช็คใน trigger) กรองอะไหล่ราคาถูกที่ยังหลุดผ่าน (A) ออกอีกชั้น
CREATE OR REPLACE FUNCTION public.is_dreame_robot(txt text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT txt IS NOT NULL AND (
    -- (A) คำบ่งชี้หุ่นยนต์ตรงๆ
    lower(txt) ~ 'robot'
    OR txt LIKE '%หุ่นยนต์%'
    OR txt LIKE '%机器人%'
    -- (B) รหัสรุ่นหุ่นยนต์ Dreame ล้วน (ไม่ใช่อะไหล่)
    OR (
      (lower(txt) ~ 'dreame' OR txt LIKE '%追觅%')
      AND lower(txt) ~ '(^|[^a-z0-9])(aqua ?10|x[1-6]0|l[1-5]0s?)([^0-9]|$)'
      AND lower(txt) !~ 'brush|filter|กรอง|แปรง|ผ้า|mop|อะไหล่|accessor|อุปกรณ์เสริม|配件|套装|滤网|尘袋|边刷|cleaner|solution|น้ำยา|hookup|rubber|dust|bag| set|ขั้วชาร์จ|ฐาน|บอดี้'
    )
  );
$$;

-- ── 3. Trigger function: ยืนยันออเดอร์หุ่นยนต์ ≥30,000 → สร้างสิทธิ ──
CREATE OR REPLACE FUNCTION public.auto_grant_refill()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone     text;
  v_name      text;
  v_has_robot boolean := false;
  v_item      jsonb;
BEGIN
  -- ยืนยันแล้วเท่านั้น
  IF NEW.status NOT IN ('BQ_VERIFIED','ADMIN_APPROVED') THEN RETURN NEW; END IF;
  -- UPDATE: ทำเฉพาะตอน "เพิ่งเปลี่ยนเป็นยืนยัน" (กัน re-fire ตอน update คอลัมน์อื่น)
  IF TG_OP = 'UPDATE' AND OLD.status IN ('BQ_VERIFIED','ADMIN_APPROVED') THEN RETURN NEW; END IF;
  -- ยอด ≥ 30,000
  IF COALESCE(NEW.total_amount, 0) < 30000 THEN RETURN NEW; END IF;
  -- เคยให้สิทธิจากออเดอร์นี้แล้ว?
  IF EXISTS (SELECT 1 FROM public.refill_privileges WHERE purchase_reg_id = NEW.id) THEN RETURN NEW; END IF;

  -- เป็นหุ่นยนต์ไหม — เช็คทั้ง model_name และทุก item ใน bq_raw_data
  v_has_robot := public.is_dreame_robot(NEW.model_name);
  IF NOT v_has_robot AND NEW.bq_raw_data IS NOT NULL THEN
    FOR v_item IN
      SELECT jsonb_array_elements(COALESCE(NEW.bq_raw_data->'items', '[]'::jsonb))
    LOOP
      IF public.is_dreame_robot(v_item->>'item_name')
         OR public.is_dreame_robot(v_item->>'model_name') THEN
        v_has_robot := true;
        EXIT;
      END IF;
    END LOOP;
  END IF;
  IF NOT v_has_robot THEN RETURN NEW; END IF;

  -- เบอร์ (จำเป็น NOT NULL) — ดึงจาก users, normalize เป็น last-9 ตัด 0 หน้า
  SELECT NULLIF(right(regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g'), 9), ''),
         u.full_name
    INTO v_phone, v_name
  FROM public.users u WHERE u.id = NEW.user_id;
  IF v_phone IS NULL OR length(v_phone) < 9 THEN
    RAISE WARNING 'auto_grant_refill: reg % qualifies but user % has no valid phone — skipped', NEW.id, NEW.user_id;
    RETURN NEW;
  END IF;

  -- สร้างสิทธิ (trigger gen_refill_rounds จะสร้าง 4 รอบให้เอง)
  -- ห่อ EXCEPTION ไว้ — การให้สิทธิห้ามทำให้ "การยืนยันออเดอร์/ให้แต้ม" ล้ม
  BEGIN
    INSERT INTO public.refill_privileges (
      user_id, phone, customer_name, transaction_id, model, order_amount,
      purchased_at, source, purchase_reg_id, note
    ) VALUES (
      NEW.user_id, v_phone, v_name, NEW.order_sn, NEW.model_name, NEW.total_amount,
      COALESCE(NEW.purchase_date::timestamptz, NEW.created_at, now()),
      'AUTO_PURCHASE', NEW.id,
      'auto: robot ≥30,000 (' || NEW.channel::text || ')'
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- ออเดอร์นี้/transaction นี้เคยได้สิทธิแล้ว (เช่น import CSV มาก่อน) — ข้าม
      NULL;
    WHEN others THEN
      RAISE WARNING 'auto_grant_refill failed for reg %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_grant_refill ON public.purchase_registrations;
CREATE TRIGGER trg_auto_grant_refill
  AFTER INSERT OR UPDATE ON public.purchase_registrations
  FOR EACH ROW EXECUTE FUNCTION public.auto_grant_refill();

-- ── 4. (ทางเลือก) Backfill ออเดอร์ที่ยืนยันไปแล้ว ─────────────
-- เปิดใช้ถ้าต้องการย้อนหลังให้ออเดอร์เก่าที่เข้าเงื่อนไข (ระวัง: รอบที่ครบกำหนด
-- ไปแล้วจะขึ้นเป็น claimable/expired ทันที). ตรวจจำนวนก่อนด้วย SELECT COUNT(*)
-- ที่มี WHERE เดียวกัน แล้วค่อยเอา comment ออก:
--
-- INSERT INTO public.refill_privileges (
--   user_id, phone, customer_name, transaction_id, model, order_amount,
--   purchased_at, source, purchase_reg_id, note)
-- SELECT pr.user_id,
--        NULLIF(right(regexp_replace(COALESCE(u.phone,''), '\D','','g'), 9), ''),
--        u.full_name, pr.order_sn, pr.model_name, pr.total_amount,
--        COALESCE(pr.purchase_date::timestamptz, pr.created_at, now()),
--        'AUTO_PURCHASE', pr.id, 'auto backfill'
--   FROM public.purchase_registrations pr
--   JOIN public.users u ON u.id = pr.user_id
--  WHERE pr.status IN ('BQ_VERIFIED','ADMIN_APPROVED')
--    AND COALESCE(pr.total_amount,0) >= 30000
--    AND length(NULLIF(right(regexp_replace(COALESCE(u.phone,''), '\D','','g'),9),'')) = 9
--    AND (public.is_dreame_robot(pr.model_name)
--         OR EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(pr.bq_raw_data->'items','[]'::jsonb)) it
--                    WHERE public.is_dreame_robot(it->>'item_name') OR public.is_dreame_robot(it->>'model_name')))
--    AND NOT EXISTS (SELECT 1 FROM public.refill_privileges rp WHERE rp.purchase_reg_id = pr.id)
-- ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
