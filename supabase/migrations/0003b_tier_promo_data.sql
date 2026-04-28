-- ============================================================
-- Migration 0003b: Backfill tier data + functions + promotion ad fields
-- ============================================================
-- ⚠️ ต้องรัน 0003a_tier_enums.sql ก่อน (commit ALTER TYPE)
-- ============================================================

-- ── 1. Backfill tier from lifetime_points ──
UPDATE public.users SET tier = CASE
  WHEN lifetime_points >= 3500 THEN 'MASTER'::user_tier
  WHEN lifetime_points >= 1501 THEN 'ULTRA'::user_tier
  WHEN lifetime_points >= 501  THEN 'PRO'::user_tier
  ELSE 'PLUS'::user_tier
END;

-- ── 2. Functions (drop first because return type changes) ──
DROP FUNCTION IF EXISTS award_points_for_purchase(UUID);
DROP FUNCTION IF EXISTS adjust_user_points(UUID, INTEGER);
DROP FUNCTION IF EXISTS update_user_tier(UUID);

CREATE OR REPLACE FUNCTION update_user_tier(p_user_id UUID)
RETURNS VOID AS $$
DECLARE lp INTEGER; new_tier user_tier;
BEGIN
  SELECT lifetime_points INTO lp FROM public.users WHERE id = p_user_id;
  IF lp >= 3500 THEN new_tier := 'MASTER';
  ELSIF lp >= 1501 THEN new_tier := 'ULTRA';
  ELSIF lp >= 501  THEN new_tier := 'PRO';
  ELSE new_tier := 'PLUS';
  END IF;
  UPDATE public.users SET tier = new_tier WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION award_points_for_purchase(p_purchase_reg_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_reg          public.purchase_registrations%ROWTYPE;
  v_user         public.users%ROWTYPE;
  v_base_points  INTEGER;
  v_multiplier   NUMERIC;
  v_final_points INTEGER;
BEGIN
  SELECT * INTO v_reg FROM public.purchase_registrations
    WHERE id = p_purchase_reg_id FOR UPDATE;
  IF NOT FOUND OR v_reg.points_awarded > 0 THEN RETURN 0; END IF;

  SELECT * INTO v_user FROM public.users
    WHERE id = v_reg.user_id FOR UPDATE;

  v_base_points := FLOOR(COALESCE(v_reg.total_amount, 0) / 100);
  v_multiplier  := CASE v_user.tier
    WHEN 'PLUS'   THEN 1.0
    WHEN 'PRO'    THEN 1.25
    WHEN 'ULTRA'  THEN 1.5
    WHEN 'MASTER' THEN 2.0
    WHEN 'SILVER'   THEN 1.0
    WHEN 'GOLD'     THEN 1.5
    WHEN 'PLATINUM' THEN 2.0
    ELSE 1.0
  END;
  v_final_points := FLOOR(v_base_points * v_multiplier);
  IF v_final_points <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.points_log (user_id, purchase_reg_id, points_delta, balance_after, type, description, expires_at)
  VALUES (
    v_reg.user_id, p_purchase_reg_id, v_final_points,
    v_user.total_points + v_final_points,
    'EARNED',
    'ซื้อสินค้า: ' || COALESCE(v_reg.model_name, v_reg.item_name, v_reg.order_sn),
    CURRENT_DATE + INTERVAL '1 year'
  );

  UPDATE public.users
    SET total_points    = total_points    + v_final_points,
        lifetime_points = lifetime_points + v_final_points,
        tier = CASE
          WHEN lifetime_points + v_final_points >= 3500 THEN 'MASTER'::user_tier
          WHEN lifetime_points + v_final_points >= 1501 THEN 'ULTRA'::user_tier
          WHEN lifetime_points + v_final_points >= 501  THEN 'PRO'::user_tier
          ELSE 'PLUS'::user_tier
        END
    WHERE id = v_reg.user_id;

  UPDATE public.purchase_registrations
    SET points_awarded = v_final_points, points_awarded_at = NOW()
    WHERE id = p_purchase_reg_id;

  RETURN v_final_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION adjust_user_points(p_user_id UUID, p_delta INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_user         public.users%ROWTYPE;
  v_new_total    INTEGER;
  v_new_lifetime INTEGER;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_new_total    := GREATEST(0, v_user.total_points    + p_delta);
  v_new_lifetime := GREATEST(0, v_user.lifetime_points + p_delta);

  UPDATE public.users
    SET total_points    = v_new_total,
        lifetime_points = v_new_lifetime,
        tier = CASE
          WHEN v_new_lifetime >= 3500 THEN 'MASTER'::user_tier
          WHEN v_new_lifetime >= 1501 THEN 'ULTRA'::user_tier
          WHEN v_new_lifetime >= 501  THEN 'PRO'::user_tier
          ELSE 'PLUS'::user_tier
        END
    WHERE id = p_user_id;

  RETURN v_new_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Promotion ad fields + ensure base columns exist ──
-- (Some old DBs were created from migrations.sql that lacked link_url, starts_at, ends_at)
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS link_url         TEXT,
  ADD COLUMN IF NOT EXISTS starts_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ends_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_price   NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS discounted_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS discount_label   VARCHAR(120),
  ADD COLUMN IF NOT EXISTS badge_text       VARCHAR(60),
  ADD COLUMN IF NOT EXISTS sort_order       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS layout           VARCHAR(20) NOT NULL DEFAULT 'card';

-- Backfill from legacy start_date/end_date if those columns exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='promotions' AND column_name='start_date') THEN
    UPDATE public.promotions
       SET starts_at = COALESCE(starts_at, start_date::timestamptz),
           ends_at   = COALESCE(ends_at,   end_date::timestamptz);
  END IF;
END $$;

COMMENT ON COLUMN public.promotions.layout IS 'hero | card | feed';

CREATE INDEX IF NOT EXISTS idx_promotions_active_sort
  ON public.promotions(is_active, sort_order DESC, created_at DESC)
  WHERE is_active = true;

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promotions_public_read" ON public.promotions;
CREATE POLICY "promotions_public_read" ON public.promotions
  FOR SELECT USING (is_active = true);
