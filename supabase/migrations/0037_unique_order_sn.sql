-- ============================================================
-- Migration 0037: Enforce "1 order = 1 claim" at the database level
--
-- ปัญหา: เดิมกันออเดอร์ซ้ำแค่ระดับ application + per-user (UNIQUE(order_sn,user_id))
--        → user คนละคนเอา order_sn เดียวกันมาลงทะเบียนรับแต้มซ้ำได้
--
-- แก้: partial UNIQUE index บน order_sn ระดับ global
--      ยกเว้น status='REJECTED' (ออเดอร์ที่โดนปฏิเสธให้ลงใหม่ได้)
--
-- ⚠️ ต้องเคลียร์ duplicate ที่ค้างอยู่ก่อน (ทำผ่าน service role แล้ว — reject
--    รายการที่ลงทีหลัง + reverse แต้ม) ไม่งั้น CREATE UNIQUE INDEX จะ fail
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uniq_purchase_order_sn_active
  ON public.purchase_registrations (order_sn)
  WHERE status <> 'REJECTED';

COMMENT ON INDEX public.uniq_purchase_order_sn_active IS
  '1 order = 1 claim ทั่วทั้งระบบ — กันลงทะเบียน order_sn ซ้ำข้าม user (REJECTED ลงใหม่ได้)';
