-- ============================================================
-- Migration 0048: ลบ FK เก่าที่ผิดของ approved_by (แอดมินอนุมัติไม่ได้)
--
-- อาการ: กดอนุมัติแล้ว error
--   insert or update ... violates foreign key constraint
--   "purchase_registrations_approved_by_fkey"
--
-- สาเหตุ: DB เก่ามี FK approved_by → users(id) หลงเหลืออยู่ (schema drift)
--   แต่แอปเก็บ approved_by = admin_staff.id (resolve เป็นชื่อผ่าน staffMap)
--   → staff.id ไม่มีใน users → FK พัง ทุกการอนุมัติล้ม
--
-- แก้: ลบ FK เก่าทิ้ง (approved_by ใช้เป็น admin_staff.id, ไม่ต้อง FK ไป users)
-- ============================================================

ALTER TABLE public.purchase_registrations
  DROP CONSTRAINT IF EXISTS purchase_registrations_approved_by_fkey;

COMMENT ON COLUMN public.purchase_registrations.approved_by IS
  'admin_staff.id ของแอดมินที่อนุมัติ (resolve ชื่อผ่าน staffMap ในแอป) — ไม่ผูก FK';

NOTIFY pgrst, 'reload schema';
