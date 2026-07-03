-- ============================================================
-- Migration 0040: Store branches ("รวมสาขาของเรา")
--
-- Public marketing content — a list of physical Dreame branches
-- shown as a carousel on the home page and a full list on /branches.
-- Each branch has a cover image (used in the home carousel), a name tag,
-- an address and a Google Maps link so members can navigate to the store.
-- `gallery_urls` holds extra photos shown as a tap-to-view gallery on the
-- /branches page.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branches (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,                 -- shown as the tag on the top-right of the image
  image_url    TEXT,                          -- cover photo — used in the home carousel
  gallery_urls TEXT[] NOT NULL DEFAULT '{}',  -- extra photos, viewable as a gallery on /branches
  address      TEXT,                          -- full address, shown on /branches
  map_url      TEXT,                          -- Google Maps link ("นำทาง")
  phone        VARCHAR(40),
  hours        VARCHAR(120),                  -- e.g. "10:00 – 22:00 ทุกวัน"
  badge_text   VARCHAR(60),                   -- optional highlight chip, e.g. "เปิดใหม่"
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  show_on_home BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For DBs where the table was already created from an earlier copy of this
-- migration (before gallery support), add the column idempotently.
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_branches_active_sort
  ON public.branches(is_active, sort_order DESC, created_at DESC)
  WHERE is_active = true;

-- Public read: active branches are marketing content, readable by anyone.
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branches_public_read" ON public.branches;
CREATE POLICY "branches_public_read" ON public.branches
  FOR SELECT USING (is_active = true);

-- Refresh PostgREST schema cache so the new table is visible immediately.
NOTIFY pgrst, 'reload schema';
