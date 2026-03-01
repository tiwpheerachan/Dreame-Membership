-- ============================================================
-- DREAME MEMBERSHIP — Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE member_tier AS ENUM ('SILVER', 'GOLD', 'PLATINUM');
CREATE TYPE sale_channel AS ENUM ('STORE', 'SHOPEE', 'LAZADA', 'WEBSITE', 'TIKTOK', 'OTHER');
CREATE TYPE channel_type AS ENUM ('ONLINE', 'ONSITE');
CREATE TYPE purchase_status AS ENUM ('PENDING', 'BQ_VERIFIED', 'ADMIN_APPROVED', 'REJECTED');
CREATE TYPE points_type AS ENUM ('EARNED', 'REDEEMED', 'EXPIRED', 'ADMIN_ADJUST');
CREATE TYPE coupon_discount_type AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE staff_role AS ENUM ('SUPER_ADMIN', 'ADMIN_ONLINE', 'ADMIN_ONSITE', 'STAFF_ONSITE', 'STAFF_ONLINE');

CREATE TABLE admin_staff (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  email           VARCHAR(255),
  role            staff_role NOT NULL DEFAULT 'STAFF_ONLINE',
  channel_access  TEXT[] NOT NULL DEFAULT ARRAY['ONLINE'],
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE member_id_seq START 1000;

CREATE TABLE users (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id         VARCHAR(20) UNIQUE,
  phone             VARCHAR(20),
  email             VARCHAR(255),
  full_name         VARCHAR(200),
  profile_image_url TEXT,
  address           TEXT,
  total_points      INTEGER NOT NULL DEFAULT 0,
  lifetime_points   INTEGER NOT NULL DEFAULT 0,
  tier              member_tier NOT NULL DEFAULT 'SILVER',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION generate_member_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.member_id IS NULL THEN
    NEW.member_id := 'DRM-' || LPAD(nextval('member_id_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_member_id
  BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION generate_member_id();

CREATE TABLE purchase_registrations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_sn          VARCHAR(100) NOT NULL,
  invoice_no        VARCHAR(100),
  channel           sale_channel NOT NULL DEFAULT 'OTHER',
  channel_type      channel_type NOT NULL DEFAULT 'ONLINE',
  sku               VARCHAR(100),
  model_name        VARCHAR(300),
  serial_number     VARCHAR(100),
  purchase_date     DATE,
  total_amount      NUMERIC(12,2) DEFAULT 0,
  receipt_image_url TEXT,
  warranty_months   INTEGER DEFAULT 12,
  warranty_start    DATE,
  warranty_end      DATE,
  bq_verified       BOOLEAN NOT NULL DEFAULT FALSE,
  bq_verified_at    TIMESTAMPTZ,
  bq_raw_data       JSONB,
  status            purchase_status NOT NULL DEFAULT 'PENDING',
  admin_note        TEXT,
  approved_by       UUID,
  approved_at       TIMESTAMPTZ,
  points_awarded    INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_order_sn ON purchase_registrations(order_sn);
CREATE INDEX idx_purchase_user_id ON purchase_registrations(user_id);
CREATE INDEX idx_purchase_status ON purchase_registrations(status);
CREATE INDEX idx_purchase_bq_pending ON purchase_registrations(bq_verified) WHERE bq_verified = FALSE;

CREATE TABLE points_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_reg_id   UUID REFERENCES purchase_registrations(id),
  points_delta      INTEGER NOT NULL,
  type              points_type NOT NULL,
  description       TEXT,
  balance_after     INTEGER NOT NULL DEFAULT 0,
  expires_at        DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_points_user_id ON points_log(user_id);

CREATE TABLE coupons (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  code              VARCHAR(30) UNIQUE NOT NULL,
  title             VARCHAR(200),
  description       TEXT,
  discount_type     coupon_discount_type NOT NULL DEFAULT 'PERCENT',
  discount_value    NUMERIC(10,2) NOT NULL,
  min_purchase      NUMERIC(12,2) DEFAULT 0,
  valid_from        DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until       DATE NOT NULL,
  used_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_user_id ON coupons(user_id);

CREATE TABLE pending_verifications (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_reg_id   UUID UNIQUE REFERENCES purchase_registrations(id) ON DELETE CASCADE,
  order_sn          VARCHAR(100) NOT NULL,
  retry_count       INTEGER DEFAULT 0,
  last_retry_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE promotions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR(300) NOT NULL,
  description TEXT,
  image_url   TEXT,
  link_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_upd BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_purchase_upd BEFORE UPDATE ON purchase_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tier update function
CREATE OR REPLACE FUNCTION update_user_tier(p_user_id UUID)
RETURNS VOID AS $$
DECLARE lp INTEGER; new_tier member_tier;
BEGIN
  SELECT lifetime_points INTO lp FROM users WHERE id = p_user_id;
  IF lp >= 2000 THEN new_tier := 'PLATINUM';
  ELSIF lp >= 500 THEN new_tier := 'GOLD';
  ELSE new_tier := 'SILVER';
  END IF;
  UPDATE users SET tier = new_tier WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_self" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "purchases_self" ON purchase_registrations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "points_self" ON points_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "coupons_self" ON coupons FOR SELECT USING (auth.uid() = user_id);
