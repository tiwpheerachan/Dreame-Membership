-- ============================================================
-- Migration 0021: Track code generation failure
--
-- กรณีที่ user กด redeem แต่ Shopify code gen ล้มเหลว →
-- ระบบหัก points ไปแล้ว, redemption row มี แต่ shopify_code = NULL
--
-- ตอนนี้ admin มอง admin_note อย่างเดียวจึงรู้ — เราเพิ่ม
-- generation_failed_at + last_generation_error เพื่อให้ admin
-- filter เจอง่าย + มีปุ่ม regenerate
-- ============================================================

ALTER TABLE public.redemptions
  ADD COLUMN IF NOT EXISTS generation_failed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_generation_error TEXT;

COMMENT ON COLUMN public.redemptions.generation_failed_at IS
  'ถ้าไม่ null = Shopify code gen ล้มเหลวรอ admin regenerate';
COMMENT ON COLUMN public.redemptions.last_generation_error IS
  'ข้อความ error ล่าสุดของการ generate code';

CREATE INDEX IF NOT EXISTS idx_redemptions_gen_failed
  ON public.redemptions(generation_failed_at DESC)
  WHERE generation_failed_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
