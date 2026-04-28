-- ============================================================
-- Migration 0002: Consolidate schema, fix RLS, add missing columns
-- Run this on EXISTING databases that were initialized with the
-- old supabase/schema.sql. Safe to re-run (uses IF NOT EXISTS).
-- ============================================================

-- ── 1. Add columns referenced by code but missing in old schema ──
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_of_birth     DATE;

ALTER TABLE public.points_log
  ADD COLUMN IF NOT EXISTS adjusted_by UUID;

ALTER TABLE public.purchase_registrations
  ADD COLUMN IF NOT EXISTS item_name         VARCHAR(300),
  ADD COLUMN IF NOT EXISTS platform          VARCHAR(50),
  ADD COLUMN IF NOT EXISTS quantity          INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS points_awarded_at TIMESTAMPTZ;

-- ── 2. Audit log table (referenced by lib/audit.ts) ──
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id     UUID REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  action_type  VARCHAR(100) NOT NULL,
  target_type  VARCHAR(50),
  target_id    UUID,
  user_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  detail       JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_staff_id ON public.admin_audit_log(staff_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id  ON public.admin_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON public.admin_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON public.admin_audit_log(created_at DESC);

-- ── 3. Pending verifications queue (cron) ──
CREATE TABLE IF NOT EXISTS public.pending_verifications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_reg_id  UUID UNIQUE REFERENCES public.purchase_registrations(id) ON DELETE CASCADE,
  order_sn         VARCHAR(100) NOT NULL,
  retry_count      INTEGER NOT NULL DEFAULT 0,
  last_retry_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. TIGHTEN RLS — close the "user can edit own tier/points" hole ──
DROP POLICY IF EXISTS "users_self"       ON public.users;
DROP POLICY IF EXISTS "users_own_data"   ON public.users;
DROP POLICY IF EXISTS "purchases_self"   ON public.purchase_registrations;
DROP POLICY IF EXISTS "purchases_own_data" ON public.purchase_registrations;

-- Recreate as SELECT-only (no UPDATE — must go through API allowlist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_self_select' AND tablename = 'users') THEN
    CREATE POLICY "users_self_select" ON public.users
      FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_self_insert' AND tablename = 'users') THEN
    CREATE POLICY "users_self_insert" ON public.users
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'purchases_self_select' AND tablename = 'purchase_registrations') THEN
    CREATE POLICY "purchases_self_select" ON public.purchase_registrations
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'purchases_self_insert' AND tablename = 'purchase_registrations') THEN
    CREATE POLICY "purchases_self_insert" ON public.purchase_registrations
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── 4b. Indexes on hot-path columns (10k+ users readiness) ──
-- These match the queries in admin search, dashboard, member detail, login.
CREATE INDEX IF NOT EXISTS idx_users_created_at  ON public.users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_tier        ON public.users(tier);
CREATE INDEX IF NOT EXISTS idx_users_phone       ON public.users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email       ON public.users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_member_id   ON public.users(member_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created ON public.purchase_registrations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_log_created ON public.points_log(created_at DESC);

-- ── 5. Auto-create public.users row whenever a new auth.users row is created ──
-- This is the single source of truth for profile creation. Whatever path the
-- user signs up through (form, OAuth, magic link, admin invite, dashboard) the
-- profile row will exist before they can land on a protected page.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ── 6. Atomic point functions ──
-- Drop first because Postgres won't let CREATE OR REPLACE change a return type
-- (old version returned void; new one returns INTEGER).
DROP FUNCTION IF EXISTS award_points_for_purchase(UUID);
DROP FUNCTION IF EXISTS adjust_user_points(UUID, INTEGER);

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
          WHEN lifetime_points + v_final_points >= 2000 THEN 'PLATINUM'::user_tier
          WHEN lifetime_points + v_final_points >= 500  THEN 'GOLD'::user_tier
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
          WHEN v_new_lifetime >= 2000 THEN 'PLATINUM'::user_tier
          WHEN v_new_lifetime >= 500  THEN 'GOLD'::user_tier
          ELSE 'SILVER'::user_tier
        END
    WHERE id = p_user_id;

  RETURN v_new_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
