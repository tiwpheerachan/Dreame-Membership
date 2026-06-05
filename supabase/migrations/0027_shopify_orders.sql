-- ============================================================
-- Migration 0027: Shopify orders + tracking
--
-- เก็บข้อมูล order ที่มาจาก Shopify webhook → user track สถานะได้
--
-- Flow:
--   1. user ทำคำสั่งซื้อใน Shopify
--   2. Shopify ส่ง webhook (orders/paid + orders/fulfilled + orders/updated)
--   3. /api/webhooks/shopify-order upsert row นี้
--   4. ถ้า order ใช้ discount code ที่ผูกกับ user ในระบบเรา → auto-link
--   5. user เข้าหน้า /track หรือดูที่ home → เห็นสถานะ
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shopify_orders (
  id                 BIGINT PRIMARY KEY,                    -- Shopify order id (unique)
  shop_id            VARCHAR(120) NOT NULL,
  order_number       VARCHAR(40)  NOT NULL,                 -- "#1001"
  name               VARCHAR(40),                           -- "#1001" or "1001"
  user_id            UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Contact (เผื่อ user ไม่ได้ login แต่ track ผ่าน email/phone + order#)
  email              VARCHAR(255),
  phone              VARCHAR(30),
  customer_name      VARCHAR(200),

  -- Money
  total_price        NUMERIC(12, 2),
  subtotal_price     NUMERIC(12, 2),
  total_discounts    NUMERIC(12, 2),
  currency           VARCHAR(10),

  -- Status
  financial_status   VARCHAR(30),                           -- paid / pending / refunded / partial_refunded
  fulfillment_status VARCHAR(30),                           -- fulfilled / unfulfilled / partial / restocked / null
  cancel_reason      VARCHAR(30),
  cancelled_at       TIMESTAMPTZ,

  -- Order status page (Shopify hosted)
  order_status_url   TEXT,

  -- Tracking (จาก fulfillments — เก็บอันแรกที่มี)
  tracking_company   VARCHAR(120),
  tracking_number    VARCHAR(120),
  tracking_url       TEXT,
  fulfillments       JSONB,                                 -- เก็บ fulfillment[] ทั้งหมด

  -- Address (snapshot)
  shipping_address   JSONB,
  line_items         JSONB,
  discount_codes     JSONB,                                 -- [{code, amount, type}]

  -- Timestamps
  shopify_created_at TIMESTAMPTZ,
  shipped_at         TIMESTAMPTZ,
  delivered_at       TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,

  synced_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shopify_orders_user
  ON public.shopify_orders(user_id, shopify_created_at DESC NULLS LAST)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shopify_orders_number
  ON public.shopify_orders(order_number);

CREATE INDEX IF NOT EXISTS idx_shopify_orders_active_shipping
  ON public.shopify_orders(user_id, fulfillment_status, shopify_created_at DESC)
  WHERE user_id IS NOT NULL
    AND fulfillment_status IS DISTINCT FROM 'fulfilled'
    AND cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shopify_orders_email
  ON public.shopify_orders(LOWER(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shopify_orders_phone
  ON public.shopify_orders(phone)
  WHERE phone IS NOT NULL;

COMMENT ON TABLE public.shopify_orders IS
  'Snapshot of Shopify orders for in-app tracking. Upserted by /api/webhooks/shopify-order';

-- ── Touch trigger ──
CREATE OR REPLACE FUNCTION public._touch_shopify_orders()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shopify_orders_touch ON public.shopify_orders;
CREATE TRIGGER trg_shopify_orders_touch
  BEFORE UPDATE ON public.shopify_orders
  FOR EACH ROW EXECUTE FUNCTION public._touch_shopify_orders();

-- ── RLS ──
ALTER TABLE public.shopify_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE policyname = 'shopify_orders_self_select' AND tablename = 'shopify_orders') THEN
    CREATE POLICY "shopify_orders_self_select" ON public.shopify_orders
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── View: user's active shipments (สำหรับ home banner) ──
CREATE OR REPLACE VIEW public.v_user_active_orders AS
SELECT
  o.id,
  o.user_id,
  o.order_number,
  o.name,
  o.total_price,
  o.currency,
  o.financial_status,
  o.fulfillment_status,
  o.tracking_number,
  o.tracking_company,
  o.tracking_url,
  o.order_status_url,
  o.shopify_created_at,
  o.shipped_at,
  -- Status สำหรับ UI
  CASE
    WHEN o.cancelled_at IS NOT NULL                          THEN 'cancelled'
    WHEN o.fulfillment_status = 'fulfilled'                  THEN 'delivered'
    WHEN o.tracking_number IS NOT NULL                       THEN 'in_transit'
    WHEN o.fulfillment_status = 'partial'                    THEN 'partial'
    WHEN o.financial_status   = 'paid'                       THEN 'paid'
    ELSE 'processing'
  END AS display_status,
  jsonb_array_length(COALESCE(o.line_items, '[]'::jsonb)) AS items_count
FROM public.shopify_orders o
WHERE o.user_id IS NOT NULL
  AND o.cancelled_at IS NULL
  AND (o.fulfillment_status IS DISTINCT FROM 'fulfilled' OR
       o.shopify_created_at > NOW() - INTERVAL '30 days');

COMMENT ON VIEW public.v_user_active_orders IS
  'Active orders (in-transit or recent) per user — driving home banner + /track';

NOTIFY pgrst, 'reload schema';
