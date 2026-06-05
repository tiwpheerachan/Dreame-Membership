-- ============================================================
-- Migration 0013: Shopify auto-rules (pool top-up + tier auto-assign)
--
-- เพิ่มกลไก 2 ตัว ที่ต่อยอดจาก migration 0012:
--
-- 1) AUTO POOL TOP-UP
--    เมื่อโค้ดในแคมเปญหนึ่งใกล้หมด (free pool < threshold) ระบบจะ
--    เรียก Shopify generate เพิ่มอัตโนมัติ (รันใน cron ทุก 5–15 นาที)
--
-- 2) AUTO TIER ASSIGNMENT
--    ผูก Shopify campaign กับ tier — เมื่อ user สมัครใหม่หรือเลื่อน
--    ระดับถึง tier ที่ผูกไว้ ระบบจะดึงโค้ดจาก pool มา assign ให้ทันที
--    (idempotent ด้วย auto_issue_key — UNIQUE per user)
--
-- ทุก operation safe จาก concurrency:
--   - claim_shopify_code() ใช้ SELECT ... FOR UPDATE SKIP LOCKED
--   - กัน top-up รันซ้ำซ้อนด้วย pg_try_advisory_lock
-- ============================================================

-- ── 1. ตาราง config — 1 row ต่อ price rule ─────────────────
CREATE TABLE IF NOT EXISTS public.shopify_campaign_config (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id                VARCHAR(120) NOT NULL,
  price_rule_id          BIGINT       NOT NULL,
  title                  VARCHAR(200),

  -- Auto pool top-up
  low_pool_threshold     INTEGER,                       -- NULL = ปิดฟีเจอร์ top-up
  topup_batch_size       INTEGER NOT NULL DEFAULT 100,  -- generate ครั้งละกี่โค้ด
  topup_paused           BOOLEAN NOT NULL DEFAULT false,
  last_topup_at          TIMESTAMPTZ,
  last_topup_count       INTEGER,
  last_topup_error       TEXT,

  -- Auto tier assignment
  auto_assign_tier       user_tier,                     -- NULL = ปิดฟีเจอร์
  auto_assign_on_signup  BOOLEAN NOT NULL DEFAULT false,
  auto_assign_on_upgrade BOOLEAN NOT NULL DEFAULT true,
  -- คีย์ idempotency ที่จะใช้ในตาราง coupons (เช่น "SHOPIFY_CAMP_<id>")
  -- กันออกซ้ำให้ user คนเดิมที่ campaign เดียวกัน
  auto_issue_key         VARCHAR(80),

  -- ค่าที่จะ replicate ใน Shopify เมื่อ top-up
  -- (ดึงครั้งแรกจาก Shopify performance() ถ้าไม่ระบุ)
  default_value_type     VARCHAR(20),                   -- 'percentage' | 'fixed_amount'
  default_value          NUMERIC(10, 2),
  default_min_purchase   NUMERIC(12, 2),
  default_code_prefix    VARCHAR(40),
  default_ends_at        TIMESTAMPTZ,

  created_by             UUID,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (shop_id, price_rule_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_camp_cfg_tier
  ON public.shopify_campaign_config(auto_assign_tier)
  WHERE auto_assign_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shopify_camp_cfg_topup
  ON public.shopify_campaign_config(low_pool_threshold)
  WHERE low_pool_threshold IS NOT NULL AND topup_paused = false;

COMMENT ON TABLE public.shopify_campaign_config IS
  'Per-Shopify-campaign automation rules: pool top-up + tier auto-assign';

-- updated_at touch trigger
CREATE OR REPLACE FUNCTION public._touch_shopify_camp_cfg()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shopify_camp_cfg_touch ON public.shopify_campaign_config;
CREATE TRIGGER trg_shopify_camp_cfg_touch
  BEFORE UPDATE ON public.shopify_campaign_config
  FOR EACH ROW EXECUTE FUNCTION public._touch_shopify_camp_cfg();

-- ── 2. Function: claim โค้ดจาก pool แบบ atomic ─────────────
-- คืน coupon.id ที่เพิ่ง claim สำเร็จ หรือ NULL ถ้า pool ว่างหมด
-- ใช้ SKIP LOCKED เพื่อให้ session อื่นไม่ติด lock
CREATE OR REPLACE FUNCTION public.claim_shopify_code_for_user(
  p_user_id       UUID,
  p_shop_id       VARCHAR,
  p_price_rule_id BIGINT,
  p_issue_key     VARCHAR
) RETURNS UUID AS $$
DECLARE
  v_coupon_id UUID;
BEGIN
  -- กันออกซ้ำให้ user คนนี้ใน campaign เดียวกัน
  IF p_issue_key IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.coupons
        WHERE user_id = p_user_id
          AND auto_issue_key = p_issue_key
     ) THEN
    RETURN NULL;
  END IF;

  -- ล็อกแถว pool แรกที่ว่าง (SKIP LOCKED กัน concurrent claim ซ้อน)
  SELECT id INTO v_coupon_id
    FROM public.coupons
   WHERE shopify_shop_id       = p_shop_id
     AND shopify_price_rule_id = p_price_rule_id
     AND user_id  IS NULL
     AND used_at  IS NULL
     AND used_count = 0
   ORDER BY created_at ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF v_coupon_id IS NULL THEN
    RETURN NULL;          -- pool ว่างหมด — caller (cron) จะ trigger top-up
  END IF;

  UPDATE public.coupons
     SET user_id        = p_user_id,
         auto_issue_key = p_issue_key
   WHERE id = v_coupon_id;

  RETURN v_coupon_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Function: apply Shopify campaigns ตาม tier ของ user ─
-- เรียกตอน signup หรือ tier upgrade — ดึงทุก config ที่ match แล้ว claim
CREATE OR REPLACE FUNCTION public.apply_shopify_tier_campaigns(
  p_user_id   UUID,
  p_event     TEXT       -- 'signup' | 'upgrade'
) RETURNS INTEGER AS $$
DECLARE
  v_tier   user_tier;
  v_count  INTEGER := 0;
  v_cfg    RECORD;
  v_cid    UUID;
  v_key    VARCHAR;
BEGIN
  SELECT tier INTO v_tier FROM public.users WHERE id = p_user_id;
  IF v_tier IS NULL THEN RETURN 0; END IF;

  FOR v_cfg IN
    SELECT *
      FROM public.shopify_campaign_config
     WHERE auto_assign_tier = v_tier
       AND (
         (p_event = 'signup'  AND auto_assign_on_signup  = true) OR
         (p_event = 'upgrade' AND auto_assign_on_upgrade = true)
       )
  LOOP
    v_key := COALESCE(v_cfg.auto_issue_key, 'SHOPIFY_CAMP_' || v_cfg.price_rule_id);
    v_cid := public.claim_shopify_code_for_user(
      p_user_id, v_cfg.shop_id, v_cfg.price_rule_id, v_key
    );
    IF v_cid IS NOT NULL THEN v_count := v_count + 1; END IF;
    -- ถ้า claim คืน NULL = pool หมด → cron จะ top-up รอบถัดไปแล้วตอน upgrade
    -- รอบหน้าจะได้ (idempotent — เพราะ auto_issue_key ยังไม่ถูกใช้)
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Patch trigger: ออก welcome + Shopify ตอน user สร้างใหม่ ─
-- ต่อยอด on_user_created_issue_coupons เดิม (migration 0011)
CREATE OR REPLACE FUNCTION public.on_user_created_issue_coupons()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.issue_welcome_coupon(NEW.id);
  PERFORM public.apply_shopify_tier_campaigns(NEW.id, 'signup');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. Patch trigger: tier upgrade → ออก native + Shopify ──
-- ต่อยอด on_user_tier_changed เดิม
CREATE OR REPLACE FUNCTION public.on_user_tier_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_new_rank INT;
  v_old_rank INT;
BEGIN
  v_new_rank := CASE NEW.tier::text
    WHEN 'SILVER'   THEN 1
    WHEN 'GOLD'     THEN 2
    WHEN 'PLATINUM' THEN 3
    ELSE 0
  END;
  v_old_rank := CASE OLD.tier::text
    WHEN 'SILVER'   THEN 1
    WHEN 'GOLD'     THEN 2
    WHEN 'PLATINUM' THEN 3
    ELSE 0
  END;

  IF v_new_rank > v_old_rank THEN
    -- UPGRADE: native coupons + Shopify pool claim
    PERFORM public.apply_tier_coupons(NEW.id);
    PERFORM public.apply_shopify_tier_campaigns(NEW.id, 'upgrade');

  ELSIF v_new_rank < v_old_rank THEN
    -- DOWNGRADE: revoke (เหมือนเดิม)
    IF NEW.tier::text <> 'PLATINUM' THEN
      DELETE FROM public.coupons
       WHERE user_id = NEW.id
         AND auto_issue_key = 'UPGRADE_PLATINUM'
         AND used_at IS NULL
         AND used_count = 0;
    END IF;
    IF NEW.tier::text = 'SILVER' THEN
      DELETE FROM public.coupons
       WHERE user_id = NEW.id
         AND auto_issue_key IS NOT NULL
         AND auto_issue_key <> 'WELCOME_SILVER'
         AND auto_issue_key NOT LIKE 'SHOPIFY_CAMP_%'   -- เก็บ Shopify ที่ยังไม่ใช้ไว้ก่อน
         AND used_at IS NULL
         AND used_count = 0;
    END IF;

    -- เพิกถอน Shopify codes ที่ tier ใหม่ไม่มีสิทธิ์แล้ว
    -- (campaign ที่ผูกกับ tier เดิมเท่านั้น — ไม่แตะของ tier ที่ user ยังควรได้)
    DELETE FROM public.coupons c
     USING public.shopify_campaign_config cfg
     WHERE c.user_id = NEW.id
       AND c.shopify_price_rule_id = cfg.price_rule_id
       AND c.shopify_shop_id       = cfg.shop_id
       AND cfg.auto_assign_tier::text = OLD.tier::text
       AND cfg.auto_assign_tier::text <> NEW.tier::text
       AND c.used_at  IS NULL
       AND c.used_count = 0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. Backfill: เรียก apply_shopify_tier_campaigns ให้ทุก user ─
-- (no-op ถ้ายังไม่มี config) — รัน idempotent
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.users WHERE is_active = true LOOP
    PERFORM public.apply_shopify_tier_campaigns(r.id, 'signup');
  END LOOP;
END $$;

-- ── 7. View: pool snapshot ต่อ campaign (ใช้โดย cron ตรวจ top-up) ─
CREATE OR REPLACE VIEW public.v_shopify_campaign_pool AS
SELECT
  cfg.id                       AS config_id,
  cfg.shop_id,
  cfg.price_rule_id,
  cfg.title,
  cfg.low_pool_threshold,
  cfg.topup_batch_size,
  cfg.topup_paused,
  cfg.last_topup_at,
  cfg.auto_assign_tier,
  cfg.default_value_type,
  cfg.default_value,
  cfg.default_min_purchase,
  cfg.default_code_prefix,
  cfg.default_ends_at,
  COUNT(c.*) FILTER (WHERE c.user_id IS NULL AND c.used_at IS NULL)              AS pool_free,
  COUNT(c.*) FILTER (WHERE c.user_id IS NOT NULL AND c.used_at IS NULL)          AS pool_assigned,
  COUNT(c.*) FILTER (WHERE c.used_at IS NOT NULL OR c.used_count > 0)            AS pool_used,
  COUNT(c.*)                                                                     AS pool_total
FROM public.shopify_campaign_config cfg
LEFT JOIN public.coupons c
       ON c.shopify_shop_id       = cfg.shop_id
      AND c.shopify_price_rule_id = cfg.price_rule_id
GROUP BY cfg.id;

COMMENT ON VIEW public.v_shopify_campaign_pool IS
  'Live snapshot of pool depth for each configured Shopify campaign — used by top-up cron';

-- ── 8. RLS: config ตาราง — admin only ──────────────────────
ALTER TABLE public.shopify_campaign_config ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'shopify_camp_cfg_admin'
      AND tablename = 'shopify_campaign_config'
  ) THEN
    -- service_role ใช้ในทุก server route — bypass RLS อยู่แล้ว
    -- policy นี้แค่กัน anon/authenticated มอง
    CREATE POLICY "shopify_camp_cfg_admin" ON public.shopify_campaign_config
      FOR ALL USING (false) WITH CHECK (false);
  END IF;
END $$;

-- ── 9. Audit action enum (เผื่อมี enum อยู่) — ผ่อนเป็น NOTIFY ─
NOTIFY pgrst, 'reload schema';
