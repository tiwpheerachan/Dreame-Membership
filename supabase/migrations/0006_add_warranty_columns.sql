-- ============================================================
-- Migration 0006: Ensure warranty columns exist on purchase_registrations
--
-- Older databases that were initialised before the warranty fields
-- were merged into the canonical schema can be missing these columns,
-- which surfaces as PostgREST PGRST204:
--   "Could not find the 'warranty_end' column of 'purchase_registrations'
--    in the schema cache"
-- This migration adds them defensively + backfills sensible defaults.
-- ============================================================

ALTER TABLE public.purchase_registrations
  ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS warranty_start  DATE,
  ADD COLUMN IF NOT EXISTS warranty_end    DATE;

-- Backfill existing rows: assume 12-month warranty starting from
-- purchase_date (or created_at if no purchase_date).
UPDATE public.purchase_registrations
   SET warranty_start = COALESCE(warranty_start, purchase_date, created_at::date)
 WHERE warranty_start IS NULL;

UPDATE public.purchase_registrations
   SET warranty_end = COALESCE(
         warranty_end,
         (warranty_start + INTERVAL '12 months')::date
       )
 WHERE warranty_end IS NULL AND warranty_start IS NOT NULL;

UPDATE public.purchase_registrations
   SET warranty_months = COALESCE(warranty_months, 12)
 WHERE warranty_months IS NULL;

-- Refresh PostgREST schema cache so the new columns become visible
-- to the API layer immediately (otherwise you have to wait or restart).
NOTIFY pgrst, 'reload schema';
