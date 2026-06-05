-- ============================================================
-- Migration 0017: Coupon Revenue tracking
--
-- เพิ่มข้อมูล revenue ที่ผูกกับ coupon ตอนถูกใช้จริง
-- Shopify จะส่ง webhook `orders/paid` มา → match discount code → update row นี้
--
-- หลังจาก apply migration นี้แล้ว admin จะเห็น:
--   • Revenue ต่อ campaign (สรุปยอดขายที่เกิดจาก code ใน campaign นั้น)
--   • AOV (average order value)
--   • Channel (web / POS / mobile / draft) — ดึงจาก Shopify
--   • Conversion rate (used / total codes)
-- ============================================================

ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS redeemed_revenue_thb NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS redeemed_discount_thb NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS redeemed_order_id BIGINT,
  ADD COLUMN IF NOT EXISTS redeemed_order_name VARCHAR(40),   -- "#1001"
  ADD COLUMN IF NOT EXISTS redeemed_channel VARCHAR(40),       -- "web", "pos", "mobile_app", "draft_orders"
  ADD COLUMN IF NOT EXISTS redeemed_currency VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_coupons_redeemed_order
  ON public.coupons(redeemed_order_id)
  WHERE redeemed_order_id IS NOT NULL;

COMMENT ON COLUMN public.coupons.redeemed_revenue_thb IS
  'Order total (after discount) จาก Shopify orders/paid webhook — THB';
COMMENT ON COLUMN public.coupons.redeemed_order_id IS
  'Shopify order ID (numeric) — สำหรับ join กับ orders table ถ้ามีในอนาคต';
COMMENT ON COLUMN public.coupons.redeemed_channel IS
  'Sales channel ที่ใช้ code — web, pos, mobile_app, draft_orders';

-- ── Aggregate view: campaign revenue summary ─────────────
CREATE OR REPLACE VIEW public.v_shopify_campaign_revenue AS
SELECT
  shopify_shop_id        AS shop_id,
  shopify_price_rule_id  AS price_rule_id,
  COUNT(*)                                                     AS total_codes,
  COUNT(*) FILTER (WHERE used_at IS NOT NULL)                  AS used_codes,
  COALESCE(SUM(redeemed_revenue_thb), 0)                       AS revenue_thb,
  COALESCE(SUM(redeemed_discount_thb), 0)                      AS discount_thb,
  COUNT(*) FILTER (WHERE redeemed_revenue_thb IS NOT NULL)     AS orders_count,
  CASE
    WHEN COUNT(*) FILTER (WHERE redeemed_revenue_thb IS NOT NULL) > 0
      THEN ROUND(SUM(redeemed_revenue_thb)::numeric
                 / COUNT(*) FILTER (WHERE redeemed_revenue_thb IS NOT NULL), 2)
    ELSE NULL
  END                                                          AS aov_thb,
  -- Most common channel (mode) — ใช้ unnest แบบนี้ง่ายกว่า array_agg+sort
  (
    SELECT redeemed_channel FROM public.coupons c2
     WHERE c2.shopify_shop_id       = c.shopify_shop_id
       AND c2.shopify_price_rule_id = c.shopify_price_rule_id
       AND c2.redeemed_channel IS NOT NULL
     GROUP BY redeemed_channel
     ORDER BY COUNT(*) DESC
     LIMIT 1
  )                                                            AS top_channel
FROM public.coupons c
WHERE shopify_price_rule_id IS NOT NULL
GROUP BY shopify_shop_id, shopify_price_rule_id;

COMMENT ON VIEW public.v_shopify_campaign_revenue IS
  'Revenue + AOV summary per Shopify campaign — populated by orders/paid webhook';

-- ── Webhook event log ขยายเพื่อเก็บ order events ─────────
-- (table shopify_webhook_events มีอยู่แล้วจาก 0014 — เพิ่ม column event_type ถ้ายังไม่มี)
ALTER TABLE public.shopify_webhook_events
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(40),    -- 'discount_used' | 'order_paid' | ...
  ADD COLUMN IF NOT EXISTS order_id BIGINT,
  ADD COLUMN IF NOT EXISTS order_total NUMERIC(12, 2);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type
  ON public.shopify_webhook_events(event_type, received_at DESC)
  WHERE event_type IS NOT NULL;

NOTIFY pgrst, 'reload schema';
