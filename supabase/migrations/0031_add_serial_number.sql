-- ============================================================
-- Migration 0031: Add serial_number to purchase_registrations
--
-- ลูกค้ากรอก SN (serial number) ตอนลงทะเบียนสินค้า
-- → ใช้สำหรับ warranty tracking, ค้นหาประวัติ, customer service
--
-- Optional field (nullable) — บาง category ไม่มี SN
-- ============================================================

ALTER TABLE public.purchase_registrations
  ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);

COMMENT ON COLUMN public.purchase_registrations.serial_number IS
  'เลขเครื่อง (SN) ของสินค้า — ลูกค้ากรอกตอนลงทะเบียน, ใช้สำหรับ warranty + service';

-- Index สำหรับค้นหา (admin support / cs lookup)
CREATE INDEX IF NOT EXISTS idx_purchase_reg_serial
  ON public.purchase_registrations(serial_number)
  WHERE serial_number IS NOT NULL;

NOTIFY pgrst, 'reload schema';
