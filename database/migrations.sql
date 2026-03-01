-- ============================================================
-- DREAME MEMBERSHIP — PostgreSQL Schema (Supabase)
-- Run this in Supabase SQL Editor in order
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_tier AS ENUM ('SILVER', 'GOLD', 'PLATINUM');
CREATE TYPE channel_type AS ENUM ('ONLINE', 'ONSITE');
CREATE TYPE sale_channel AS ENUM ('STORE', 'SHOPEE', 'LAZADA', 'WEBSITE', 'TIKTOK', 'OTHER');
CREATE TYPE purchase_status AS ENUM ('PENDING_BQ', 'BQ_VERIFIED', 'PENDING_ADMIN', 'ADMIN_APPROVED', 'REJECTED');
CREATE TYPE points_type AS ENUM ('EARNED', 'REDEEMED', 'EXPIRED', 'ADMIN_ADJUST');
CREATE TYPE coupon_discount_type AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE admin_role AS ENUM ('SUPER_ADMIN', 'ADMIN_ONLINE', 'ADMIN_ONSITE', 'STAFF_ONSITE', 'STAFF_ONLINE');

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE public.users (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id          VARCHAR(12) UNIQUE NOT NULL,
  phone              VARCHAR(20) UNIQUE,
  email              VARCHAR(255) UNIQUE,
  full_name          VARCHAR(200),
  profile_image_url  TEXT,
  address            TEXT,
  date_of_birth      DATE,
  total_points       INTEGER NOT NULL DEFAULT 0,
  lifetime_points    INTEGER NOT NULL DEFAULT 0,  -- never decreases, used for tier
  tier               user_tier NOT NULL DEFAULT 'SILVER',
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate member_id: DRM-XXXXXX
CREATE OR REPLACE FUNCTION generate_member_id()
RETURNS TRIGGER AS $$
DECLARE
  new_id VARCHAR(12);
  counter INT := 0;
BEGIN
  LOOP
    new_id := 'DRM-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE member_id = new_id);
    counter := counter + 1;
    IF counter > 100 THEN RAISE EXCEPTION 'Cannot generate unique member_id'; END IF;
  END LOOP;
  NEW.member_id := new_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_member_id
  BEFORE INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.member_id IS NULL OR NEW.member_id = '')
  EXECUTE FUNCTION generate_member_id();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- PURCHASE REGISTRATIONS TABLE
-- ============================================================
CREATE TABLE public.purchase_registrations (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_sn           VARCHAR(100) NOT NULL,
  invoice_no         VARCHAR(100),
  channel            sale_channel NOT NULL DEFAULT 'OTHER',
  channel_type       channel_type NOT NULL DEFAULT 'ONLINE',
  
  -- Product info (auto-filled from BigQuery after verify)
  sku                VARCHAR(100),
  model_name         VARCHAR(300),
  item_name          VARCHAR(300),
  platform           VARCHAR(50),
  quantity           INTEGER DEFAULT 1,
  
  -- User-entered fields
  serial_number      VARCHAR(150),
  purchase_date      DATE,
  total_amount       NUMERIC(12, 2),
  
  -- Files
  receipt_image_url  TEXT,
  
  -- Verification
  bq_verified        BOOLEAN NOT NULL DEFAULT false,
  bq_verified_at     TIMESTAMPTZ,
  bq_raw_data        JSONB,  -- full BQ response
  
  -- Status
  status             purchase_status NOT NULL DEFAULT 'PENDING_BQ',
  admin_note         TEXT,
  approved_by        UUID REFERENCES public.users(id),
  approved_at        TIMESTAMPTZ,
  
  -- Points
  points_awarded     INTEGER NOT NULL DEFAULT 0,
  points_awarded_at  TIMESTAMPTZ,
  
  -- Warranty (calculated from purchase_date + product warranty period)
  warranty_months    INTEGER DEFAULT 12,
  warranty_expires_at DATE,
  
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(order_sn, user_id)
);

CREATE INDEX idx_purchase_order_sn ON public.purchase_registrations(order_sn);
CREATE INDEX idx_purchase_user_id ON public.purchase_registrations(user_id);
CREATE INDEX idx_purchase_status ON public.purchase_registrations(status);
CREATE INDEX idx_purchase_channel_type ON public.purchase_registrations(channel_type);
CREATE INDEX idx_purchase_bq_verified ON public.purchase_registrations(bq_verified) WHERE bq_verified = false;

CREATE TRIGGER trg_purchase_updated_at
  BEFORE UPDATE ON public.purchase_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- POINTS LOG TABLE
-- ============================================================
CREATE TABLE public.points_log (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  purchase_reg_id    UUID REFERENCES public.purchase_registrations(id),
  points_delta       INTEGER NOT NULL,  -- positive = earned, negative = spent/expired
  balance_after      INTEGER NOT NULL,
  type               points_type NOT NULL,
  description        TEXT,
  expires_at         DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_points_log_user_id ON public.points_log(user_id);
CREATE INDEX idx_points_log_expires ON public.points_log(expires_at) WHERE type = 'EARNED';

-- ============================================================
-- COUPONS TABLE
-- ============================================================
CREATE TABLE public.coupons (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            UUID REFERENCES public.users(id) ON DELETE CASCADE,  -- NULL = global
  code               VARCHAR(30) UNIQUE NOT NULL,
  title              VARCHAR(200),
  description        TEXT,
  discount_type      coupon_discount_type NOT NULL DEFAULT 'PERCENT',
  discount_value     NUMERIC(10, 2) NOT NULL,
  min_purchase       NUMERIC(12, 2) DEFAULT 0,
  max_discount       NUMERIC(12, 2),  -- cap for percent discounts
  valid_from         DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until        DATE NOT NULL,
  max_uses           INTEGER,  -- NULL = unlimited
  used_count         INTEGER NOT NULL DEFAULT 0,
  used_at            TIMESTAMPTZ,  -- when user_id specific coupon was used
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_user_id ON public.coupons(user_id);
CREATE INDEX idx_coupons_code ON public.coupons(code);

-- ============================================================
-- PROMOTIONS TABLE
-- ============================================================
CREATE TABLE public.promotions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title              VARCHAR(200) NOT NULL,
  description        TEXT,
  image_url          TEXT,
  start_date         DATE NOT NULL,
  end_date           DATE NOT NULL,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  target_tier        user_tier[],  -- NULL = all tiers
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ADMIN STAFF TABLE
-- ============================================================
CREATE TABLE public.admin_staff (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id       UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               VARCHAR(200) NOT NULL,
  email              VARCHAR(255) NOT NULL,
  role               admin_role NOT NULL DEFAULT 'STAFF_ONLINE',
  channel_access     channel_type[] NOT NULL DEFAULT ARRAY['ONLINE']::channel_type[],
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON public.admin_staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUDIT LOG TABLE (Admin actions)
-- ============================================================
CREATE TABLE public.audit_logs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id           UUID REFERENCES public.admin_staff(id),
  action             VARCHAR(100) NOT NULL,
  target_table       VARCHAR(50),
  target_id          UUID,
  changes            JSONB,
  ip_address         INET,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own data
CREATE POLICY "users_own_data" ON public.users
  FOR ALL USING (auth.uid() = id);

-- Users can read/insert their own purchases
CREATE POLICY "purchases_own_data" ON public.purchase_registrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "purchases_insert_own" ON public.purchase_registrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own points log
CREATE POLICY "points_own_data" ON public.points_log
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own coupons
CREATE POLICY "coupons_own_data" ON public.coupons
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function: Award points after purchase verified
CREATE OR REPLACE FUNCTION award_points_for_purchase(p_purchase_reg_id UUID)
RETURNS void AS $$
DECLARE
  v_reg public.purchase_registrations%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_base_points INTEGER;
  v_multiplier NUMERIC;
  v_final_points INTEGER;
BEGIN
  SELECT * INTO v_reg FROM public.purchase_registrations WHERE id = p_purchase_reg_id;
  SELECT * INTO v_user FROM public.users WHERE id = v_reg.user_id;
  
  IF v_reg.points_awarded > 0 THEN RETURN; END IF;  -- Already awarded
  
  -- Base: floor(amount / 100)
  v_base_points := FLOOR(COALESCE(v_reg.total_amount, 0) / 100);
  
  -- Multiplier by tier
  v_multiplier := CASE v_user.tier
    WHEN 'SILVER'   THEN 1.0
    WHEN 'GOLD'     THEN 1.5
    WHEN 'PLATINUM' THEN 2.0
    ELSE 1.0
  END;
  
  v_final_points := FLOOR(v_base_points * v_multiplier);
  IF v_final_points < 0 THEN v_final_points := 0; END IF;
  
  -- Insert points log
  INSERT INTO public.points_log (user_id, purchase_reg_id, points_delta, balance_after, type, description, expires_at)
  VALUES (
    v_reg.user_id,
    p_purchase_reg_id,
    v_final_points,
    v_user.total_points + v_final_points,
    'EARNED',
    'ซื้อสินค้า: ' || COALESCE(v_reg.model_name, v_reg.item_name, v_reg.order_sn),
    CURRENT_DATE + INTERVAL '1 year'
  );
  
  -- Update user totals
  UPDATE public.users
  SET
    total_points    = total_points + v_final_points,
    lifetime_points = lifetime_points + v_final_points,
    tier = CASE
      WHEN lifetime_points + v_final_points >= 2000 THEN 'PLATINUM'::user_tier
      WHEN lifetime_points + v_final_points >= 500  THEN 'GOLD'::user_tier
      ELSE 'SILVER'::user_tier
    END
  WHERE id = v_reg.user_id;
  
  -- Mark points as awarded on purchase
  UPDATE public.purchase_registrations
  SET points_awarded = v_final_points, points_awarded_at = NOW()
  WHERE id = p_purchase_reg_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================

-- Insert a sample promotion
INSERT INTO public.promotions (title, description, start_date, end_date, is_active)
VALUES 
  ('Summer Sale 2025', 'ลดสูงสุด 30% สำหรับสมาชิก', '2025-06-01', '2025-08-31', true),
  ('สมาชิกใหม่รับโบนัส', 'สมัครวันนี้รับ 50 คะแนนฟรี', '2025-01-01', '2025-12-31', true);
