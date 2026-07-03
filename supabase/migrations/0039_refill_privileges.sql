-- ============================================================
-- Migration 0039: สิทธิพิเศษลูกค้า — รับน้ำยาฟรีทุก 6 เดือน เป็นเวลา 2 ปี
--
-- ที่มา: ลูกค้าที่ซื้อเครื่อง (Aqua10 / X50 / X60 ฯลฯ) หน้าร้าน ได้สิทธิ
--        รับน้ำยาทำความสะอาดฟรี "ทุก 6 เดือน เป็นเวลา 2 ปี" = 4 รอบ/ออเดอร์
--        อ้างอิงจาก Create date (วันซื้อ) และ Expiration date จากไฟล์ POS
--
-- โมเดล:
--   refill_privileges — 1 แถว = 1 ออเดอร์ (Transaction ID) ที่ได้สิทธิ
--                        ผูกลูกค้าด้วย "เบอร์โทร" (last-9 digits) — user_id ว่างได้
--                        เพราะลูกค้าหน้าร้านอาจยังไม่สมัครแอป (ลิงก์ทีหลังได้)
--   refill_rounds     — 4 รอบต่อออเดอร์ สร้างอัตโนมัติด้วย trigger
--                        รอบ n ครบกำหนด = วันซื้อ + (interval_months × n) เดือน
--                        รับได้ภายใน claim_window_days วันจากวันครบกำหนด
--
-- สถานะรอบ: upcoming (ยังไม่ถึง/กำลังเปิดรับ) → claimed (รับแล้ว) | expired (เลยกำหนด)
--           "claimable" (เปิดรับตอนนี้) คำนวณสด: status=upcoming AND today ∈ [open,close]
--
-- config ต่อออเดอร์ (แก้ได้): total_rounds=4, interval_months=6, claim_window_days=30
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. ตารางสิทธิ (1 ออเดอร์ = 1 สิทธิ) ──────────────────────
CREATE TABLE IF NOT EXISTS public.refill_privileges (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid REFERENCES public.users(id) ON DELETE SET NULL,  -- ลิงก์เมื่อ match เบอร์
  phone             varchar(20) NOT NULL,          -- national number (last-9 digits) เช่น 952246276
  customer_name     text,
  member_type       text,
  transaction_id    varchar(50),                   -- Order/Transaction ID จาก POS
  model             text,
  branch            text,
  order_amount      numeric(12,2),
  purchased_at      timestamptz NOT NULL,          -- Create date
  expires_at        timestamptz,                   -- Expiration date (สิ้นสุดโครงการ/แต้ม)
  total_rounds      int  NOT NULL DEFAULT 4,
  interval_months   int  NOT NULL DEFAULT 6,
  claim_window_days int  NOT NULL DEFAULT 30,
  benefit_label     text NOT NULL DEFAULT 'น้ำยาทำความสะอาดฟรี',
  source            varchar(20) NOT NULL DEFAULT 'CSV_IMPORT',  -- CSV_IMPORT | ADMIN
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 1 ออเดอร์ = 1 สิทธิ (กัน import ซ้ำ) — partial เพื่อยอมให้ transaction_id ว่างได้
CREATE UNIQUE INDEX IF NOT EXISTS uniq_refill_priv_txn
  ON public.refill_privileges(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refill_priv_user
  ON public.refill_privileges(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refill_priv_phone ON public.refill_privileges(phone);

COMMENT ON TABLE  public.refill_privileges IS 'สิทธิรับน้ำยาฟรี 1 ออเดอร์ = 1 สิทธิ (4 รอบ/2 ปี) ผูกลูกค้าด้วยเบอร์';
COMMENT ON COLUMN public.refill_privileges.phone IS 'เบอร์แบบ national (ตัด 0 หน้า, 9 หลัก) ใช้ match users.phone last-9';
COMMENT ON COLUMN public.refill_privileges.user_id IS 'NULL = ลูกค้ายังไม่สมัครแอป; ลิงก์เมื่อ match เบอร์';

-- ── 2. ตารางรอบรับของ (สร้างอัตโนมัติจาก trigger) ─────────────
CREATE TABLE IF NOT EXISTS public.refill_rounds (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  privilege_id uuid NOT NULL REFERENCES public.refill_privileges(id) ON DELETE CASCADE,
  round_no     int  NOT NULL,
  due_date     date NOT NULL,                      -- วันครบกำหนด/เริ่มรับรอบนี้
  claim_open   date NOT NULL,                      -- = due_date
  claim_close  date NOT NULL,                      -- = due_date + claim_window_days
  status       varchar(20) NOT NULL DEFAULT 'upcoming',
  claimed_at   timestamptz,
  claimed_by   uuid REFERENCES public.admin_staff(id),  -- พนักงานที่ติ๊กรับ
  claim_note   text,
  reminded_at  timestamptz,                        -- เตือน 5 วันล่วงหน้าแล้ว
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refill_rounds_status_chk CHECK (status IN ('upcoming','claimed','expired')),
  CONSTRAINT uniq_refill_round UNIQUE (privilege_id, round_no)
);
CREATE INDEX IF NOT EXISTS idx_refill_rounds_due  ON public.refill_rounds(due_date, status);
CREATE INDEX IF NOT EXISTS idx_refill_rounds_priv ON public.refill_rounds(privilege_id);

COMMENT ON TABLE  public.refill_rounds IS 'รอบรับน้ำยา 4 รอบ/สิทธิ; claimable = upcoming AND today ∈ [open,close]';

-- ── 3. Trigger: สร้าง 4 รอบอัตโนมัติเมื่อเพิ่มสิทธิใหม่ ──────────
CREATE OR REPLACE FUNCTION public.gen_refill_rounds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  d date;
BEGIN
  FOR n IN 1..NEW.total_rounds LOOP
    d := (NEW.purchased_at + ((NEW.interval_months * n) || ' months')::interval)::date;
    INSERT INTO public.refill_rounds (privilege_id, round_no, due_date, claim_open, claim_close)
    VALUES (
      NEW.id, n, d, d,
      (d + (NEW.claim_window_days || ' days')::interval)::date
    )
    ON CONFLICT (privilege_id, round_no) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gen_refill_rounds ON public.refill_privileges;
CREATE TRIGGER trg_gen_refill_rounds
  AFTER INSERT ON public.refill_privileges
  FOR EACH ROW EXECUTE FUNCTION public.gen_refill_rounds();

-- ── 4. RLS: ลูกค้าเห็นเฉพาะสิทธิของตัวเอง; เขียนผ่าน service role ──
ALTER TABLE public.refill_privileges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refill_priv_self_select ON public.refill_privileges;
CREATE POLICY refill_priv_self_select ON public.refill_privileges
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.refill_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refill_rounds_self_select ON public.refill_rounds;
CREATE POLICY refill_rounds_self_select ON public.refill_rounds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.refill_privileges p
      WHERE p.id = refill_rounds.privilege_id AND p.user_id = auth.uid()
    )
  );
-- หมายเหตุ: แถวที่ user_id ว่าง (ลูกค้าหน้าร้านยังไม่สมัคร) จะไม่ผ่าน RLS
--          → /api/privileges/me ใช้ service client filter ตามเบอร์ของ user เอง

-- ── 5. Cron: ดูแลรอบรับน้ำยา (expire + เตือน 5 วัน) — แพทเทิร์นเดียวกับ 0038 ──
--    ⚠️ แทนที่ YOUR_CRON_SECRET ด้วยค่า CRON_SECRET จริงบน Render ก่อนรัน
--    ต้องมี pg_cron + pg_net (ติดตั้งแล้วใน 0038)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refill-reminders')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refill-reminders');
    PERFORM cron.schedule('refill-reminders', '0 9 * * *', $CRON$
      SELECT net.http_get(
        url := 'https://dreame-membership.onrender.com/api/cron/refill-reminders',
        headers := jsonb_build_object('Authorization', 'Bearer ' || 'YOUR_CRON_SECRET')
      );
    $CRON$);
  END IF;
END $$;

-- ── 6. รีเฟรช PostgREST schema cache ──
NOTIFY pgrst, 'reload schema';
