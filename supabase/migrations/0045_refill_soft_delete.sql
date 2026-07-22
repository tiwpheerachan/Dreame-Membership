-- ============================================================
-- Migration 0045: soft-delete + กู้คืน สิทธิน้ำยาฟรี
--
-- ให้แอดมิน ลบ / กู้คืน สิทธิได้ (เพิ่มเองมีอยู่แล้วผ่าน source='ADMIN').
-- ลบแบบ soft-delete (ตั้ง deleted_at) แทนลบจริง → กู้คืนได้ + เก็บประวัติรอบไว้
--   deleted_at NULL = ใช้งาน · มีค่า = อยู่ถังขยะ (กู้คืนได้)
-- ============================================================

ALTER TABLE public.refill_privileges
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.admin_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_refill_priv_deleted
  ON public.refill_privileges(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN public.refill_privileges.deleted_at IS
  'soft-delete: NULL = ใช้งาน, มีค่า = ถูกลบ (กู้คืนได้ผ่านแอดมิน)';

NOTIFY pgrst, 'reload schema';
