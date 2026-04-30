-- ============================================================
-- DREAME MEMBERSHIP — Database Schema (single source of truth)
-- Run this in Supabase SQL Editor on a fresh project.
-- For existing DBs, run the corresponding migrations under
-- supabase/migrations/ in numerical order.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE user_tier              AS ENUM ('SILVER', 'GOLD', 'PLATINUM');
CREATE TYPE channel_type           AS ENUM ('ONLINE', 'ONSITE');
CREATE TYPE sale_channel           AS ENUM ('STORE', 'SHOPEE', 'LAZADA', 'WEBSITE', 'TIKTOK', 'OTHER');
CREATE TYPE purchase_status        AS ENUM ('PENDING', 'BQ_VERIFIED', 'ADMIN_APPROVED', 'REJECTED');
CREATE TYPE points_type            AS ENUM ('EARNED', 'REDEEMED', 'EXPIRED', 'ADMIN_ADJUST');
CREATE TYPE coupon_discount_type   AS ENUM ('PERCENT', 'FIXED');
CREATE TYPE admin_role             AS ENUM ('SUPER_ADMIN', 'ADMIN_ONLINE', 'ADMIN_ONSITE', 'STAFF_ONSITE', 'STAFF_ONLINE');
CREATE TYPE announcement_audience  AS ENUM ('ALL', 'TIER', 'SEGMENT');

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

  -- CRM tags / flags (admin-managed)
  tags               TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_vip             BOOLEAN NOT NULL DEFAULT false,
  is_blacklisted     BOOLEAN NOT NULL DEFAULT false,
  notify_email       BOOLEAN NOT NULL DEFAULT true,
  notify_sms         BOOLEAN NOT NULL DEFAULT true,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tags ON public.users USING GIN (tags);
CREATE INDEX idx_users_vip  ON public.users(is_vip) WHERE is_vip = true;
CREATE INDEX idx_users_dob  ON public.users(date_of_birth) WHERE date_of_birth IS NOT NULL;
CREATE INDEX idx_users_created_at ON public.users(created_at DESC);
CREATE INDEX idx_users_tier       ON public.users(tier);
CREATE INDEX idx_users_phone      ON public.users(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_users_email      ON public.users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_member_id  ON public.users(member_id);

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

  -- Warranty (2-year default per Dreame Thailand policy)
  warranty_months    INTEGER DEFAULT 24,
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
CREATE INDEX idx_purchases_created     ON public.purchase_registrations(created_at DESC);

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

CREATE INDEX idx_points_log_user_id  ON public.points_log(user_id);
CREATE INDEX idx_points_log_expires  ON public.points_log(expires_at) WHERE type = 'EARNED';
CREATE INDEX idx_points_log_created  ON public.points_log(created_at DESC);

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
  theme           VARCHAR(50),  -- visual theme key (black/gold/rose/...)
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
-- PROMOTIONS / BANNERS
-- Layout values: hero | card | feed | banner
--   - banner = top auto-scrolling marquee (supports image OR video)
--   - banner_row picks which row on the home page (1 or 2)
-- ============================================================
CREATE TABLE public.promotions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             VARCHAR(300) NOT NULL,
  description       TEXT,
  image_url         TEXT,
  video_url         TEXT,
  link_url          TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  show_on_home      BOOLEAN NOT NULL DEFAULT true,
  starts_at         TIMESTAMPTZ,
  ends_at           TIMESTAMPTZ,
  target_tier       user_tier[],

  -- Pricing display
  original_price    NUMERIC(12, 2),
  discounted_price  NUMERIC(12, 2),
  discount_label    VARCHAR(120),
  badge_text        VARCHAR(60),

  -- Layout & ordering
  sort_order        INTEGER NOT NULL DEFAULT 0,
  layout            VARCHAR(20) NOT NULL DEFAULT 'card',
  banner_row        SMALLINT DEFAULT 1,  -- 1 or 2 (banner layout only)

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.promotions.layout     IS 'hero | card | feed | banner';
COMMENT ON COLUMN public.promotions.banner_row IS 'Home-page marquee row (1 or 2). Ignored for non-banner layouts.';

CREATE INDEX idx_promotions_active_sort
  ON public.promotions(is_active, sort_order DESC, created_at DESC)
  WHERE is_active = true;

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
-- ADMIN AUDIT LOG
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
-- MEMBER NOTES (CRM timeline)
-- ============================================================
CREATE TABLE public.member_notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  staff_id    UUID REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_member_notes_user ON public.member_notes(user_id, created_at DESC);

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE TABLE public.announcements (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          VARCHAR(200) NOT NULL,
  body           TEXT,
  image_url      TEXT,
  link_url       TEXT,
  badge_text     VARCHAR(60),
  audience       announcement_audience NOT NULL DEFAULT 'ALL',
  audience_tier  user_tier,           -- only used when audience = 'TIER'
  is_active      BOOLEAN NOT NULL DEFAULT true,
  starts_at      TIMESTAMPTZ,
  ends_at        TIMESTAMPTZ,
  created_by     UUID REFERENCES public.admin_staff(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_announcements_active ON public.announcements(is_active, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements          ENABLE ROW LEVEL SECURITY;

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

-- PROMOTIONS / ANNOUNCEMENTS: public read of active rows
CREATE POLICY "promotions_public_read" ON public.promotions
  FOR SELECT USING (is_active = true);

CREATE POLICY "announcements_public_read" ON public.announcements
  FOR SELECT USING (is_active = true);

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
-- TIER UPDATE FUNCTION
-- Thresholds (lifetime points): SILVER 0-79, GOLD 80-399, PLATINUM 400+
-- ============================================================
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

-- ============================================================
-- AWARD POINTS (transactional, idempotent, row-level locked)
-- Earn rate is channel-dependent:
--   WEBSITE / STORE     : 200 THB = 1 point
--   SHOPEE/LAZADA/TIKTOK: 500 THB = 1 point
-- Tier multiplier (Platinum-only VIP boost):
--   SILVER 1.0×  GOLD 1.0×  PLATINUM 1.2×
-- ============================================================
DROP FUNCTION IF EXISTS award_points_for_purchase(UUID);

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

  v_divisor := CASE UPPER(COALESCE(v_reg.channel::TEXT, 'OTHER'))
    WHEN 'WEBSITE' THEN 200
    WHEN 'STORE'   THEN 200
    WHEN 'SHOPEE'  THEN 500
    WHEN 'LAZADA'  THEN 500
    WHEN 'TIKTOK'  THEN 500
    ELSE 500
  END;
  v_base_points := FLOOR(COALESCE(v_reg.total_amount, 0) / v_divisor);

  v_multiplier := CASE v_user.tier
    WHEN 'SILVER'   THEN 1.0
    WHEN 'GOLD'     THEN 1.0
    WHEN 'PLATINUM' THEN 1.2
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

-- ============================================================
-- ADJUST USER POINTS (admin manual adjust, transactional)
-- ============================================================
DROP FUNCTION IF EXISTS adjust_user_points(UUID, INTEGER);

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

-- ============================================================
-- HELPER VIEWS (read-only, used by admin dashboards / cron)
-- ============================================================

-- Users whose birthday is today (used by /api/cron/birthday)
CREATE OR REPLACE VIEW public.v_birthdays_today AS
  SELECT id, member_id, full_name, email, phone, tier, date_of_birth
  FROM public.users
  WHERE date_of_birth IS NOT NULL
    AND is_active = true
    AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY   FROM date_of_birth) = EXTRACT(DAY   FROM CURRENT_DATE);

-- Earned points expiring within the next 90 days
CREATE OR REPLACE VIEW public.v_points_expiring AS
  SELECT
    pl.user_id,
    u.member_id,
    u.full_name,
    u.email,
    pl.points_delta AS points_remaining,
    pl.expires_at,
    (pl.expires_at - CURRENT_DATE)::INTEGER AS days_left
  FROM public.points_log pl
  JOIN public.users u ON u.id = pl.user_id
  WHERE pl.type = 'EARNED'
    AND pl.expires_at IS NOT NULL
    AND pl.expires_at >= CURRENT_DATE
    AND pl.expires_at <= CURRENT_DATE + INTERVAL '90 days'
  ORDER BY pl.expires_at ASC;

-- Per-coupon redemption stats (used by /admin/coupons)
CREATE OR REPLACE VIEW public.v_coupon_stats AS
  SELECT
    c.id, c.code, c.title, c.discount_type, c.discount_value,
    c.valid_from, c.valid_until,
    c.created_by, c.created_at,
    COUNT(*)                                            AS recipient_count,
    COUNT(*) FILTER (WHERE c.used_at IS NOT NULL)       AS used_count,
    COUNT(*) FILTER (WHERE c.used_at IS NULL AND c.valid_until < CURRENT_DATE) AS expired_count,
    ROUND(
      COUNT(*) FILTER (WHERE c.used_at IS NOT NULL)::NUMERIC
      / NULLIF(COUNT(*), 0) * 100, 1
    ) AS redemption_rate
  FROM public.coupons c
  GROUP BY c.id, c.code, c.title, c.discount_type, c.discount_value,
           c.valid_from, c.valid_until, c.created_by, c.created_at;

-- RFM-style member segmentation (Recency / Frequency / Monetary)
CREATE OR REPLACE VIEW public.v_member_rfm AS
  WITH stats AS (
    SELECT
      u.id, u.member_id, u.full_name, u.email, u.tier, u.lifetime_points,
      MAX(pr.purchase_date)                                                                AS last_purchase,
      COUNT(pr.id) FILTER (WHERE pr.status IN ('ADMIN_APPROVED','BQ_VERIFIED'))             AS frequency,
      COALESCE(SUM(pr.total_amount) FILTER (WHERE pr.status IN ('ADMIN_APPROVED','BQ_VERIFIED')), 0) AS monetary
    FROM public.users u
    LEFT JOIN public.purchase_registrations pr ON pr.user_id = u.id
    WHERE u.is_active = true
    GROUP BY u.id
  )
  SELECT
    *,
    CASE
      WHEN last_purchase IS NULL                THEN 999
      WHEN CURRENT_DATE - last_purchase <= 30   THEN 1
      WHEN CURRENT_DATE - last_purchase <= 90   THEN 2
      WHEN CURRENT_DATE - last_purchase <= 180  THEN 3
      WHEN CURRENT_DATE - last_purchase <= 365  THEN 4
      ELSE 5
    END AS recency_score,
    CASE
      WHEN frequency >= 10  THEN 1
      WHEN frequency >=  5  THEN 2
      WHEN frequency >=  3  THEN 3
      WHEN frequency >=  1  THEN 4
      ELSE 5
    END AS frequency_score,
    CASE
      WHEN monetary >= 50000  THEN 1
      WHEN monetary >= 20000  THEN 2
      WHEN monetary >= 10000  THEN 3
      WHEN monetary >=  1000  THEN 4
      ELSE 5
    END AS monetary_score
  FROM stats;
