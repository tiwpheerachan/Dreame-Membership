-- ============================================================
-- Migration 0009: Banner row selector
--
-- The home page can show banners in two horizontally-scrolling
-- marquee rows. `banner_row` lets admins assign each banner to
-- row 1 (top) or row 2 (bottom). The promotions page ignores
-- this field and merges everything into a single marquee.
-- ============================================================

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS banner_row SMALLINT DEFAULT 1;

-- Sanity-check: only 1 or 2 are valid. Old rows default to 1.
UPDATE public.promotions
   SET banner_row = 1
 WHERE banner_row IS NULL OR banner_row NOT IN (1, 2);

NOTIFY pgrst, 'reload schema';
