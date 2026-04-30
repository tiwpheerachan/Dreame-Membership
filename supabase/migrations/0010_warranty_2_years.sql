-- ============================================================
-- Migration 0010: Extend warranty period to 2 years
--
-- Dreame Thailand's official warranty is now 2 years from delivery
-- date (was 1 year). This migration:
--   1) Bumps the column default from 12 → 24 months for new inserts
--      that don't specify warranty_months explicitly
--   2) Recomputes warranty_end on existing rows that were created
--      under the old 12-month assumption — adds 12 more months
--      so they get the full 2-year benefit retroactively
-- ============================================================

-- 1) New default for fresh inserts
ALTER TABLE public.purchase_registrations
  ALTER COLUMN warranty_months SET DEFAULT 24;

-- 2) Retroactive bump for rows still on the 12-month plan.
--    We only touch rows that:
--      - have warranty_months = 12 (the legacy default), AND
--      - have warranty_start set (so we can recompute deterministically)
--    Rows with custom warranty_months are left alone.
UPDATE public.purchase_registrations
   SET warranty_months = 24,
       warranty_end    = (warranty_start + INTERVAL '24 months')::date
 WHERE warranty_months = 12
   AND warranty_start IS NOT NULL;

-- For rows where warranty_start is NULL but warranty_end exists, just
-- extend warranty_end by 12 months — best-effort upgrade.
UPDATE public.purchase_registrations
   SET warranty_months = 24,
       warranty_end    = (warranty_end + INTERVAL '12 months')::date
 WHERE warranty_months = 12
   AND warranty_start IS NULL
   AND warranty_end IS NOT NULL;

-- Refresh PostgREST schema cache so any clients picking up the new
-- default see it without a server restart.
NOTIFY pgrst, 'reload schema';
