-- ============================================================
-- Migration 0043: Per-tab admin permissions (RBAC)
--
-- admin_staff.tab_access — JSONB map { tabKey: 'view' | 'edit' }.
--   absent key → no access · 'view' → read-only · 'edit' → full.
-- SUPER_ADMIN ignores this column (always full access).
--
-- Rollout safety: back-fill EXISTING non-super staff with 'edit' on every tab
-- so nobody loses access on deploy. NEW staff default to {} (see nothing until
-- a Super Admin grants tabs) — matches the agreed policy.
-- ============================================================

ALTER TABLE public.admin_staff
  ADD COLUMN IF NOT EXISTS tab_access JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Back-fill only rows still at the default '{}' so re-running is idempotent.
UPDATE public.admin_staff
SET tab_access = '{
  "dashboard":"edit","members":"edit","segments":"edit","purchases":"edit",
  "pending":"edit","import":"edit","coupons":"edit","promotions":"edit",
  "branches":"edit","announcements":"edit","campaigns":"edit","tier-up":"edit",
  "rewards":"edit","redemptions":"edit","privileges":"edit","points-expiring":"edit",
  "staff":"edit","audit":"edit","health":"edit","my-activity":"edit"
}'::jsonb
WHERE role <> 'SUPER_ADMIN' AND tab_access = '{}'::jsonb;

COMMENT ON COLUMN public.admin_staff.tab_access IS
  'RBAC per-tab: {tabKey: view|edit}. SUPER_ADMIN bypasses. Empty = no access.';

NOTIFY pgrst, 'reload schema';
