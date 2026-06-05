-- ============================================================
-- Migration 0012: Link coupons table to Shopify Discount API
--
-- Each coupon row can optionally point at a Shopify price rule + code.
-- When set, the user sees an "ใช้ที่ Shopify" button that opens
-- https://<shop>/discount/<code> and Shopify applies it at checkout.
--
-- The webhook + cron pipeline marks `used_at` once Shopify reports
-- the code was used.
-- ============================================================

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS shopify_shop_id        VARCHAR(120),
  ADD COLUMN IF NOT EXISTS shopify_price_rule_id  BIGINT,
  ADD COLUMN IF NOT EXISTS shopify_code_id        BIGINT,
  ADD COLUMN IF NOT EXISTS apply_url              TEXT,
  ADD COLUMN IF NOT EXISTS shopify_synced_at      TIMESTAMPTZ;

COMMENT ON COLUMN public.coupons.shopify_shop_id IS
  'Shopify shop domain e.g. dreame-thailand.myshopify.com — set when coupon is backed by a real Shopify discount code';
COMMENT ON COLUMN public.coupons.shopify_price_rule_id IS
  'Campaign id at Shopify (price rule). Many coupon rows share one price_rule_id (= one batch).';
COMMENT ON COLUMN public.coupons.shopify_code_id IS
  'Individual discount code id at Shopify. Unique per coupon row when set.';
COMMENT ON COLUMN public.coupons.apply_url IS
  'Pre-built apply URL: https://<shop>/discount/<code>. Click → checkout with code applied.';
COMMENT ON COLUMN public.coupons.shopify_synced_at IS
  'Last time this coupon usage status was sync-fetched from Shopify (for diagnostics).';

-- Indexes used by webhook + sync flows
CREATE INDEX IF NOT EXISTS idx_coupons_shopify_price_rule
  ON public.coupons(shopify_price_rule_id)
  WHERE shopify_price_rule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coupons_shopify_code_id
  ON public.coupons(shopify_code_id)
  WHERE shopify_code_id IS NOT NULL;

-- ── PostgREST schema reload ──
NOTIFY pgrst, 'reload schema';
