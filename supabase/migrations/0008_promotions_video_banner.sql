-- ============================================================
-- Migration 0008: Brand banner support
--
-- Adds `video_url` column for promo records that show a video
-- instead of (or alongside) an image. The `layout` column stays
-- as varchar — we just start accepting 'banner' as a valid value
-- in application code.
-- ============================================================

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS video_url TEXT;

COMMENT ON COLUMN public.promotions.layout IS 'hero | card | feed | banner';

-- Refresh PostgREST schema cache so the new column is visible immediately.
NOTIFY pgrst, 'reload schema';
