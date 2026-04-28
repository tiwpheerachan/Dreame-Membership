-- ============================================================
-- Migration 0004: Admin Phase 1-4 features
-- - Tags & notes for members
-- - VIP/blacklist flags
-- - Announcements system
-- - Birthday tracking helpers
-- - Points expiry view
-- - Coupon usage analytics view
-- ============================================================

-- ── 1. Tags + flags on users ──
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tags             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS is_vip           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blacklisted   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_email     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms       BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_users_tags ON public.users USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_users_vip ON public.users(is_vip) WHERE is_vip = true;
CREATE INDEX IF NOT EXISTS idx_users_dob ON public.users(date_of_birth) WHERE date_of_birth IS NOT NULL;

-- ── 2. Member notes (CRM timeline) ──
CREATE TABLE IF NOT EXISTS public.member_notes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  staff_id    UUID REFERENCES public.admin_staff(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_member_notes_user ON public.member_notes(user_id, created_at DESC);

-- ── 3. Announcements ──
CREATE TYPE announcement_audience AS ENUM ('ALL', 'TIER', 'SEGMENT');

CREATE TABLE IF NOT EXISTS public.announcements (
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
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active, created_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_public_read" ON public.announcements;
CREATE POLICY "announcements_public_read" ON public.announcements
  FOR SELECT USING (is_active = true);

-- ── 4. Birthday helper view (cron-ready) ──
CREATE OR REPLACE VIEW public.v_birthdays_today AS
  SELECT id, member_id, full_name, email, phone, tier, date_of_birth
  FROM public.users
  WHERE date_of_birth IS NOT NULL
    AND is_active = true
    AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE);

-- ── 5. Points expiry view (next 30/60/90 days) ──
-- Note: DATE - DATE returns INTEGER (number of days) directly in Postgres,
-- no need for EXTRACT.
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

-- ── 6. Coupon analytics view ──
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

-- ── 7. Member segments (RFM-style helper view) ──
-- Recency = days since last purchase
-- Frequency = total purchases
-- Monetary = total spend
CREATE OR REPLACE VIEW public.v_member_rfm AS
  WITH stats AS (
    SELECT
      u.id, u.member_id, u.full_name, u.email, u.tier, u.lifetime_points,
      MAX(pr.purchase_date) AS last_purchase,
      COUNT(pr.id) FILTER (WHERE pr.status IN ('ADMIN_APPROVED','BQ_VERIFIED')) AS frequency,
      COALESCE(SUM(pr.total_amount) FILTER (WHERE pr.status IN ('ADMIN_APPROVED','BQ_VERIFIED')), 0) AS monetary
    FROM public.users u
    LEFT JOIN public.purchase_registrations pr ON pr.user_id = u.id
    WHERE u.is_active = true
    GROUP BY u.id
  )
  SELECT
    *,
    CASE
      WHEN last_purchase IS NULL                                          THEN 999
      WHEN CURRENT_DATE - last_purchase <= 30                             THEN 1
      WHEN CURRENT_DATE - last_purchase <= 90                             THEN 2
      WHEN CURRENT_DATE - last_purchase <= 180                            THEN 3
      WHEN CURRENT_DATE - last_purchase <= 365                            THEN 4
      ELSE 5
    END AS recency_score,
    CASE
      WHEN frequency >= 10                                                THEN 1
      WHEN frequency >= 5                                                 THEN 2
      WHEN frequency >= 3                                                 THEN 3
      WHEN frequency >= 1                                                 THEN 4
      ELSE 5
    END AS frequency_score,
    CASE
      WHEN monetary >= 50000                                              THEN 1
      WHEN monetary >= 20000                                              THEN 2
      WHEN monetary >= 10000                                              THEN 3
      WHEN monetary >= 1000                                               THEN 4
      ELSE 5
    END AS monetary_score
  FROM stats;
