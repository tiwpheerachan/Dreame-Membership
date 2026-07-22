-- ============================================================
-- Migration 0046: ใบเสร็จหลายรูปต่อ 1 การลงทะเบียน
--
-- เดิม receipt_image_url เก็บได้รูปเดียว. เพิ่ม receipt_image_urls (array) เพื่อ
-- เก็บใบเสร็จหลายรูป (ใบยาว/หลายหน้า). receipt_image_url ยังใช้อยู่ = รูปแรก
-- (back-compat กับหน้าจอเดิมที่ยังอ่านคอลัมน์เดียว).
-- ============================================================

ALTER TABLE public.purchase_registrations
  ADD COLUMN IF NOT EXISTS receipt_image_urls text[];

COMMENT ON COLUMN public.purchase_registrations.receipt_image_urls IS
  'ใบเสร็จหลายรูป; receipt_image_url = urls[0] (back-compat)';

NOTIFY pgrst, 'reload schema';
