-- ============================================================
-- Migration 0007: Ensure purchase_status enum has all 4 values
--
-- Older databases initialised before the canonical schema was
-- finalised may be missing one or more of the enum values, which
-- surfaces at insert time as Postgres 22P02:
--   "invalid input value for enum purchase_status: \"PENDING\""
-- This migration adds the four canonical values defensively.
--
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- block alongside code that uses the new value. Each ADD VALUE
-- here is on its own statement so Supabase / psql commits between
-- them. The IF NOT EXISTS guard makes this safe to re-run.
-- ============================================================

ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'BQ_VERIFIED';
ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'ADMIN_APPROVED';
ALTER TYPE purchase_status ADD VALUE IF NOT EXISTS 'REJECTED';

-- Refresh PostgREST schema cache so the new enum values are visible
-- to the API layer immediately.
NOTIFY pgrst, 'reload schema';
