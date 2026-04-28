-- ============================================================
-- DREAME MEMBERSHIP — Database Schema (single source of truth)
-- Run this in Supabase SQL Editor on a fresh project.
-- For existing DB use supabase/migrations/0002_consolidate.sql
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_tier            AS ENUM ('SILVER', 'GOLD', 'PLATINUM');
CREATE TYPE channel_type         AS ENUM ('ONLINE', 'ONSITE');
CREATE TYPE sale_channel         AS ENUM ('STORE', 'SHOPEE', 'LAZADA', 'WEBSITE', 'TIKTOK', 'OTHER');
CREATE TYPE purchase_status      AS ENUM ('PENDING', 'BQ_VERIFIED', 'ADMIN_APPROVED', 'REJECTED');
CREATE TYPE points_type          AS ENUM ('EARNED', 'REDEEMED', 'EXPIRED', 'ADMIN_ADJUST');
CREATE TYPE coupon_discount_type AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE admin_role           AS ENUM ('SUPER_ADMIN', 'ADMIN_ONLINE', 'ADMIN_ONSITE', 'STAFF_ONSITE', 'STAFF_ONLINE');

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE public.users (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id          VARCHAR(20) UNIQUE NOT NULL,
  phone              VARCHAR(20),
  email              VARCHAR(255),
  full_name          VARCHAR(200),
  profile_image_url  TEXT,
  address            TEXT,
  date_of_birth      DATE,
  total_points       INTEGER NOT NULL DEFAULT 0,
  lifetime_points    INTEGER NOT NULL DEFAULT 0,
  tier               user_tier NOT NULL DEFAULT 'SILVER',
  is_active          BOOLEAN NOT NULL DEFAULT true,
  terms_accepted_at  TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS member_id_seq START 100000;

CREATE OR REPLACE FUNCTION generate_member_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_id IS NULL OR NEW.member_id = '' THEN
    NEW.member_id := 'DRM-' || LPAD(nextval('member_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_member_id
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION generate_member_id();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_upd
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PURCHASE REGISTRATIONS
-- ============================================================
CREATE TABLE public.purchase_registrations (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_sn           VARCHAR(100) NOT NULL,
  invoice_no         VARCHAR(100),
  channel            sale_channel NOT NULL DEFAULT 'OTHER',
  channel_type       channel_type NOT NULL DEFAULT 'ONLINE',

  -- Product info
  sku                VARCHAR(100),
  model_name         VARCHAR(300),
  item_name          VARCHAR(300),
  platform           VARCHAR(50),
  quantity           INTEGER DEFAULT 1,
  serial_number      VARCHAR(150),
  purchase_date      DATE,
  total_amount       NUMERIC(12, 2) DEFAULT 0,
  receipt_image_url  TEXT,

  -- Verification
  bq_verified        BOOLEAN NOT NULL DEFAULT false,
  bq_verified_at     TIMESTAMPTZ,
  bq_raw_data        JSONB,

  -- Status / approval
  status             purchase_status NOT NULL DEFAULT 'PENDING',
  admin_note         TEXT,
  approved_by        UUID,                  -- admin_staff.id
  approved_at        TIMESTAMPTZ,

  -- Points
  points_awarded     INTEGER NOT NULL DEFAULT 0,
  points_awarded_at  TIMESTAMPTZ,

  -- Warranty
  warranty_months    INTEGER DEFAULT 12,
  warranty_start     DATE,
  warranty_end       DATE,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(order_sn, user_id)
);

CREATE INDEX idx_purchase_order_sn     ON public.purchase_registrations(order_sn);
CREATE INDEX idx_purchase_user_id      ON public.purchase_registrations(user_id);
CREATE INDEX idx_purchase_status       ON public.purchase_registrations(status);
CREATE INDEX idx_purchase_channel_type ON public.purchase_registrations(channel_type);
CREATE INDEX idx_purchase_bq_pending   ON public.purchase_registrations(bq_verified) WHERE bq_verified = false;

CREATE TRIGGER trg_purchase_upd
  BEFORE UPDATE ON public.purchase_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- POINTS LOG
-- ============================================================
CREATE TABLE public.points_log (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purchase_reg_id    UUID REFERENCES public.purchase_registrations(id) ON DELETE SET NULL,
  points_delta       INTEGER NOT NULL,
  balance_after      INTEGER NOT NULL,
  type               points_type NOT NULL,
  description        TEXT,
  expires_at         DATE,
  adjusted_by        UUID,                  -- admin_staff.id (when ADMIN_ADJUST)
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_points_log_user_id ON public.points_log(user_id);
CREATE INDEX idx_points_log_expires ON public.points_log(expires_at) WHERE type = 'EARNED';

-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE public.coupons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
  code            VARCHAR(30) UNIQUE NOT NULL,
  title           VARCHAR(200),
  description     TEXT,
  discount_type   coupon_discount_type NOT NULL DEFAULT 'PERCENT',
  discount_value  NUMERIC(10, 2) NOT NULL,
  min_purchase    NUMERIC(12, 2) DEFAULT 0,
  max_discount    NUMERIC(12, 2),
  valid_from      DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until     DATE NOT NULL,
  max_uses        INTEGER,
  used_count      INTEGER NOT NULL DEFAULT 0,
  used_at         TIMESTAMPTZ,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_user_id ON public.coupons(user_id);
CREATE INDEX idx_coupons_code    ON public.coupons(code);

-- ============================================================
-- PENDING VERIFICATIONS (cron retry queue)
-- ============================================================
CREATE TABLE public.pending_verifications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_reg_id  UUID UNIQUE REFERENCES public.purchase_registrations(id) ON DELETE CASCADE,
  order_sn         VARCHAR(100) NOT NULL,
  retry_count      INTEGER NOT NULL DEFAULT 0,
  last_retry_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROMOTIONS
-- ============================================================
CREATE TABLE public.promotions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(300) NOT NULL,
  description  TEXT,
  image_url    TEXT,
  link_url     TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  starts_at    TIMESTAMPTZ,
  ends_at      TIMESTAMPTZ,
  target_tier  user_tier[],
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADMIN STAFF
-- ============================================================
CREATE TABLE public.admin_staff (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id    UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  email           VARCHAR(255),
  role            admin_role NOT NULL DEFAULT 'STAFF_ONLINE',
  channel_access  TEXT[] NOT NULL DEFAULT ARRAY['ONLINE'],
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_staff_upd
  BEFORE UPDATE ON public.admin_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ADMIN AUDIT LOG (referenced by lib/audit.ts)
-- ============================================================
CREATE TABLE public.admin_audit_log (
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

CREATE INDEX idx_audit_staff_id  ON public.admin_audit_log(staff_id);
CREATE INDEX idx_audit_user_id   ON public.admin_audit_log(user_id);
CREATE INDEX idx_audit_action    ON public.admin_audit_log(action_type);
CREATE INDEX idx_audit_created   ON public.admin_audit_log(created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons                ENABLE ROW LEVEL SECURITY;

-- USERS: SELECT only via RLS. UPDATE/DELETE must go through service-role API
-- (server allowlists fields so the user cannot tamper with tier / points).
CREATE POLICY "users_self_select" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_self_insert" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- PURCHASES: user can read own + insert own (server still authoritative on status)
CREATE POLICY "purchases_self_select" ON public.purchase_registrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "purchases_self_insert" ON public.purchase_registrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- POINTS LOG: read-only for owner
CREATE POLICY "points_self_select" ON public.points_log
  FOR SELECT USING (auth.uid() = user_id);

-- COUPONS: read own + global (NULL user_id)
CREATE POLICY "coupons_self_select" ON public.coupons
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================
-- AUTO-CREATE PROFILE WHEN auth.users IS CREATED
-- Single source of truth for profile creation across every auth path.
-- ============================================================
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

-- ============================================================
-- TIER UPDATE FUNCTION (helper)
-- ============================================================
CREATE OR REPLACE FUNCTION update_user_tier(p_user_id UUID)
RETURNS VOID AS $$
DECLARE lp INTEGER; new_tier user_tier;
BEGIN
  SELECT lifetime_points INTO lp FROM public.users WHERE id = p_user_id;
  IF lp >= 2000 THEN new_tier := 'PLATINUM';
  ELSIF lp >= 500 THEN new_tier := 'GOLD';
  ELSE new_tier := 'SILVER';
  END IF;
  UPDATE public.users SET tier = new_tier WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- AWARD POINTS (transactional, idempotent, row-level locked)
-- Call from API:  await supabase.rpc('award_points_for_purchase', { p_purchase_reg_id })
-- ============================================================
-- DROP first so we can change return type if an older version exists
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

-- ============================================================
-- ADJUST USER POINTS (admin manual adjust, transactional)
-- ============================================================
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
