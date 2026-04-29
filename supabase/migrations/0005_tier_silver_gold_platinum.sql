-- ============================================================
-- Migration 0005: Rebalance to SILVER / GOLD / PLATINUM
--
-- New rules:
--   • Earn rate is channel-dependent:
--       WEB & STORE  : 200 THB = 1 point
--       PLATFORM     : 500 THB = 1 point   (SHOPEE / LAZADA / TIKTOK / OTHER)
--   • Multiplier:
--       SILVER   = 1.0x
--       GOLD     = 1.0x
--       PLATINUM = 1.2x   (VIP)
--   • Tier thresholds (lifetime points):
--       SILVER   :   0 –  79
--       GOLD     :  80 – 399
--       PLATINUM : 400+
--
-- The user_tier enum already contains both old (PLUS/PRO/ULTRA/MASTER)
-- and SILVER/GOLD/PLATINUM values, so we don't need to touch the type;
-- we just backfill rows back to the new 3-tier system and replace
-- functions to use the new logic.
-- ============================================================

-- ── 1. Backfill tier from lifetime_points ──
UPDATE public.users SET tier = CASE
  WHEN lifetime_points >= 400 THEN 'PLATINUM'::user_tier
  WHEN lifetime_points >= 80  THEN 'GOLD'::user_tier
  ELSE 'SILVER'::user_tier
END;

-- ── 2. Replace tier functions ──
DROP FUNCTION IF EXISTS award_points_for_purchase(UUID);
DROP FUNCTION IF EXISTS adjust_user_points(UUID, INTEGER);
DROP FUNCTION IF EXISTS update_user_tier(UUID);

CREATE OR REPLACE FUNCTION update_user_tier(p_user_id UUID)
RETURNS VOID AS $$
DECLARE lp INTEGER; new_tier user_tier;
BEGIN
  SELECT lifetime_points INTO lp FROM public.users WHERE id = p_user_id;
  IF    lp >= 400 THEN new_tier := 'PLATINUM';
  ELSIF lp >=  80 THEN new_tier := 'GOLD';
  ELSE                 new_tier := 'SILVER';
  END IF;
  UPDATE public.users SET tier = new_tier WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION award_points_for_purchase(p_purchase_reg_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_reg          public.purchase_registrations%ROWTYPE;
  v_user         public.users%ROWTYPE;
  v_divisor      INTEGER;
  v_base_points  INTEGER;
  v_multiplier   NUMERIC;
  v_final_points INTEGER;
BEGIN
  SELECT * INTO v_reg FROM public.purchase_registrations
    WHERE id = p_purchase_reg_id FOR UPDATE;
  IF NOT FOUND OR v_reg.points_awarded > 0 THEN RETURN 0; END IF;

  SELECT * INTO v_user FROM public.users
    WHERE id = v_reg.user_id FOR UPDATE;

  -- Earn divisor: web & in-store = 200 THB / pt; platforms = 500 THB / pt
  v_divisor := CASE UPPER(COALESCE(v_reg.channel, 'OTHER'))
    WHEN 'WEBSITE' THEN 200
    WHEN 'STORE'   THEN 200
    WHEN 'SHOPEE'  THEN 500
    WHEN 'LAZADA'  THEN 500
    WHEN 'TIKTOK'  THEN 500
    ELSE 500
  END;
  v_base_points := FLOOR(COALESCE(v_reg.total_amount, 0) / v_divisor);

  -- Tier multiplier (Platinum-only VIP boost)
  v_multiplier := CASE v_user.tier
    WHEN 'SILVER'   THEN 1.0
    WHEN 'GOLD'     THEN 1.0
    WHEN 'PLATINUM' THEN 1.2
    -- legacy values, treat conservatively
    WHEN 'PLUS'     THEN 1.0
    WHEN 'PRO'      THEN 1.0
    WHEN 'ULTRA'    THEN 1.0
    WHEN 'MASTER'   THEN 1.2
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
          WHEN lifetime_points + v_final_points >= 400 THEN 'PLATINUM'::user_tier
          WHEN lifetime_points + v_final_points >=  80 THEN 'GOLD'::user_tier
          ELSE 'SILVER'::user_tier
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
          WHEN v_new_lifetime >= 400 THEN 'PLATINUM'::user_tier
          WHEN v_new_lifetime >=  80 THEN 'GOLD'::user_tier
          ELSE 'SILVER'::user_tier
        END
    WHERE id = p_user_id;

  RETURN v_new_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
