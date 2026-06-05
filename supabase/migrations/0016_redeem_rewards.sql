-- ============================================================
-- Migration 0016: Redeem Rewards
--
-- ระบบให้สมาชิกแลก reward ด้วย points สะสม
--
-- ตาราง:
--   1) reward_models      → หมวด/โมเดล (เช่น D30 series, V12, ตู้เก็บของ)
--   2) rewards            → สินค้าให้แลก (image, points, ระดับขั้นต่ำ, stock, ฯลฯ)
--   3) redemptions        → ประวัติการแลก + ที่อยู่จัดส่ง + tracking
--
-- หลักการสำคัญ:
--   • แลก = หัก total_points (balance) แต่ "ไม่" หัก lifetime_points
--     เพื่อรักษา tier ไว้ (มิฉะนั้นแลก = downgrade ทันที)
--   • Stock decrement + points deduct ใน transaction เดียวกัน
--   • Refund คืน total_points แบบ idempotent
--   • Address มี check ว่าเป็นไทยเท่านั้น (เก็บ province/postcode TH)
-- ============================================================

-- ── 1. Reward models (หมวดสินค้า) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_models (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            VARCHAR(120) NOT NULL,
  slug            VARCHAR(80) UNIQUE,
  description     TEXT,
  image_url       TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.reward_models IS
  'หมวดสินค้าที่ใช้แลก เช่น "D30 Series", "อุปกรณ์เสริม"';

-- ── 2. Rewards (สินค้าที่แลกได้) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.rewards (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id                  UUID REFERENCES public.reward_models(id) ON DELETE SET NULL,

  -- รายละเอียดสินค้า
  name                      VARCHAR(200) NOT NULL,
  short_description         VARCHAR(500),
  description               TEXT,
  image_url                 TEXT,
  images                    JSONB NOT NULL DEFAULT '[]'::jsonb,  -- หลายรูป

  -- ราคา (points)
  points_required           INTEGER NOT NULL CHECK (points_required > 0),

  -- Stock
  stock                     INTEGER,                   -- NULL = unlimited
  stock_remaining           INTEGER,

  -- Tier eligibility — array ของ tier ที่แลกได้
  allowed_tiers             user_tier[] NOT NULL DEFAULT
                              ARRAY['SILVER','GOLD','PLATINUM']::user_tier[],

  -- เงื่อนไข
  terms                     TEXT,                      -- ข้อกำหนด & เงื่อนไข
  redemption_limit_per_user INTEGER,                   -- จำกัดต่อคน (NULL = unlimited)

  -- ช่วงเวลาแลก
  starts_at                 TIMESTAMPTZ,
  ends_at                   TIMESTAMPTZ,

  -- สถานะ
  status                    VARCHAR(20) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','paused','archived','draft')),

  -- Display
  is_featured               BOOLEAN NOT NULL DEFAULT false,
  display_order             INTEGER NOT NULL DEFAULT 0,

  created_by                UUID,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rewards_model       ON public.rewards(model_id);
CREATE INDEX IF NOT EXISTS idx_rewards_status      ON public.rewards(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rewards_display     ON public.rewards(display_order, created_at DESC);

COMMENT ON TABLE public.rewards IS 'สินค้าที่ลูกค้าใช้แต้มแลกได้';

-- updated_at touch
CREATE OR REPLACE FUNCTION public._touch_rewards()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rewards_touch ON public.rewards;
CREATE TRIGGER trg_rewards_touch
  BEFORE UPDATE ON public.rewards
  FOR EACH ROW EXECUTE FUNCTION public._touch_rewards();

DROP TRIGGER IF EXISTS trg_reward_models_touch ON public.reward_models;
CREATE TRIGGER trg_reward_models_touch
  BEFORE UPDATE ON public.reward_models
  FOR EACH ROW EXECUTE FUNCTION public._touch_rewards();

-- ── 3. Redemptions (รายการแลก) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.redemptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reward_id             UUID NOT NULL REFERENCES public.rewards(id) ON DELETE RESTRICT,

  -- จำ snapshot ของ reward ณ ตอนแลก (กันการเปลี่ยนชื่อ/รูปย้อนหลัง)
  reward_snapshot       JSONB NOT NULL,
  points_used           INTEGER NOT NULL CHECK (points_used > 0),

  -- Shipping (ไทยเท่านั้น)
  shipping_name         VARCHAR(120) NOT NULL,
  shipping_phone        VARCHAR(30)  NOT NULL,
  shipping_address      TEXT         NOT NULL,
  shipping_subdistrict  VARCHAR(120),
  shipping_district     VARCHAR(120) NOT NULL,
  shipping_province     VARCHAR(120) NOT NULL,
  shipping_postcode     VARCHAR(10)  NOT NULL,
  shipping_note         TEXT,

  -- สถานะการจัดส่ง
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','confirmed','shipping','delivered','cancelled')),
  tracking_number       VARCHAR(120),
  tracking_carrier      VARCHAR(60),
  shipped_at            TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  admin_note            TEXT,

  -- Refund (ยกเลิก → คืน points)
  refunded_at           TIMESTAMPTZ,
  refunded_by           UUID,
  refund_reason         TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redemptions_user    ON public.redemptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redemptions_reward  ON public.redemptions(reward_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_status  ON public.redemptions(status, created_at DESC);

DROP TRIGGER IF EXISTS trg_redemptions_touch ON public.redemptions;
CREATE TRIGGER trg_redemptions_touch
  BEFORE UPDATE ON public.redemptions
  FOR EACH ROW EXECUTE FUNCTION public._touch_rewards();

-- ── 4. RPC: redeem_reward (atomic) ────────────────────────
-- ตรวจ tier + stock + balance + ช่วงเวลา + จำกัดต่อคน → หัก points + stock
-- คืน { redemption_id, points_after } หรือ error
CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_user_id              UUID,
  p_reward_id            UUID,
  p_shipping_name        VARCHAR,
  p_shipping_phone       VARCHAR,
  p_shipping_address     TEXT,
  p_shipping_subdistrict VARCHAR,
  p_shipping_district    VARCHAR,
  p_shipping_province    VARCHAR,
  p_shipping_postcode    VARCHAR,
  p_shipping_note        TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user    public.users%ROWTYPE;
  v_reward  public.rewards%ROWTYPE;
  v_now     TIMESTAMPTZ := NOW();
  v_count   INTEGER;
  v_red_id  UUID;
BEGIN
  -- ── Lock user row + ดึงข้อมูล ──
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'user not found');
  END IF;
  IF NOT v_user.is_active THEN
    RETURN jsonb_build_object('error', 'user inactive');
  END IF;

  -- ── Lock reward row ──
  SELECT * INTO v_reward FROM public.rewards WHERE id = p_reward_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'reward not found');
  END IF;

  -- ── Validate reward status ──
  IF v_reward.status <> 'active' THEN
    RETURN jsonb_build_object('error', 'reward ไม่พร้อมแลกขณะนี้');
  END IF;
  IF v_reward.starts_at IS NOT NULL AND v_now < v_reward.starts_at THEN
    RETURN jsonb_build_object('error', 'ยังไม่ถึงเวลาแลก');
  END IF;
  IF v_reward.ends_at IS NOT NULL AND v_now > v_reward.ends_at THEN
    RETURN jsonb_build_object('error', 'หมดเวลาแลกแล้ว');
  END IF;

  -- ── Tier eligibility ──
  IF NOT (v_user.tier = ANY(v_reward.allowed_tiers)) THEN
    RETURN jsonb_build_object('error',
      'ระดับสมาชิก ' || v_user.tier::text || ' ไม่สามารถแลกได้');
  END IF;

  -- ── Points balance ──
  IF v_user.total_points < v_reward.points_required THEN
    RETURN jsonb_build_object('error',
      'แต้มไม่พอ ต้องการ ' || v_reward.points_required || ' แต้ม (มี ' || v_user.total_points || ')');
  END IF;

  -- ── Stock check ──
  IF v_reward.stock IS NOT NULL AND COALESCE(v_reward.stock_remaining, 0) <= 0 THEN
    RETURN jsonb_build_object('error', 'สินค้าหมด');
  END IF;

  -- ── จำกัดต่อคน ──
  IF v_reward.redemption_limit_per_user IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
      FROM public.redemptions
     WHERE user_id = p_user_id
       AND reward_id = p_reward_id
       AND status <> 'cancelled';
    IF v_count >= v_reward.redemption_limit_per_user THEN
      RETURN jsonb_build_object('error',
        'แลกได้สูงสุด ' || v_reward.redemption_limit_per_user || ' ครั้งต่อคน');
    END IF;
  END IF;

  -- ── Validate address ──
  IF coalesce(trim(p_shipping_name),'') = ''
  OR coalesce(trim(p_shipping_phone),'') = ''
  OR coalesce(trim(p_shipping_address),'') = ''
  OR coalesce(trim(p_shipping_district),'') = ''
  OR coalesce(trim(p_shipping_province),'') = ''
  OR coalesce(trim(p_shipping_postcode),'') = '' THEN
    RETURN jsonb_build_object('error', 'กรอกที่อยู่จัดส่งให้ครบถ้วน');
  END IF;
  IF p_shipping_postcode !~ '^[0-9]{5}$' THEN
    RETURN jsonb_build_object('error', 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
  END IF;

  -- ── ทุกอย่างพร้อม → deduct + create ──
  -- หักเฉพาะ total_points — ไม่แตะ lifetime_points (กัน tier downgrade)
  UPDATE public.users
     SET total_points = total_points - v_reward.points_required
   WHERE id = p_user_id;

  -- Decrement stock ถ้ามี
  IF v_reward.stock IS NOT NULL THEN
    UPDATE public.rewards
       SET stock_remaining = COALESCE(stock_remaining, stock) - 1
     WHERE id = p_reward_id;
  END IF;

  -- Insert redemption (snapshot reward ตอนแลก)
  INSERT INTO public.redemptions (
    user_id, reward_id, points_used, reward_snapshot,
    shipping_name, shipping_phone, shipping_address,
    shipping_subdistrict, shipping_district, shipping_province,
    shipping_postcode, shipping_note,
    status
  ) VALUES (
    p_user_id, p_reward_id, v_reward.points_required,
    jsonb_build_object(
      'name',            v_reward.name,
      'image_url',       v_reward.image_url,
      'points_required', v_reward.points_required,
      'model_id',        v_reward.model_id
    ),
    trim(p_shipping_name), trim(p_shipping_phone), trim(p_shipping_address),
    nullif(trim(p_shipping_subdistrict),''),
    trim(p_shipping_district), trim(p_shipping_province),
    trim(p_shipping_postcode), nullif(trim(p_shipping_note),''),
    'pending'
  ) RETURNING id INTO v_red_id;

  RETURN jsonb_build_object(
    'success',       true,
    'redemption_id', v_red_id,
    'points_after',  v_user.total_points - v_reward.points_required
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. RPC: refund_redemption (admin) ──────────────────────
-- ยกเลิก redemption → คืน points + คืน stock (ถ้ามี) + status = cancelled
-- Idempotent — ยกเลิกแล้วจะไม่ทำซ้ำ
CREATE OR REPLACE FUNCTION public.refund_redemption(
  p_redemption_id UUID,
  p_admin_id      UUID,
  p_reason        TEXT
) RETURNS JSONB AS $$
DECLARE
  v_red    public.redemptions%ROWTYPE;
BEGIN
  SELECT * INTO v_red FROM public.redemptions WHERE id = p_redemption_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'redemption not found');
  END IF;
  IF v_red.status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'ยกเลิกไปแล้ว');
  END IF;
  IF v_red.status = 'delivered' THEN
    RETURN jsonb_build_object('error', 'ส่งของแล้ว ไม่สามารถ refund ได้');
  END IF;

  -- คืน points
  UPDATE public.users
     SET total_points = total_points + v_red.points_used
   WHERE id = v_red.user_id;

  -- คืน stock ถ้า reward นั้นเป็น limited stock
  UPDATE public.rewards
     SET stock_remaining = COALESCE(stock_remaining, 0) + 1
   WHERE id = v_red.reward_id
     AND stock IS NOT NULL;

  UPDATE public.redemptions
     SET status        = 'cancelled',
         refunded_at   = NOW(),
         refunded_by   = p_admin_id,
         refund_reason = p_reason
   WHERE id = p_redemption_id;

  RETURN jsonb_build_object('success', true, 'refunded_points', v_red.points_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. View: rewards ที่ user คนนึงแลกได้ตอนนี้ ────────────
CREATE OR REPLACE VIEW public.v_rewards_available AS
SELECT
  r.*,
  m.name AS model_name,
  m.slug AS model_slug
FROM public.rewards r
LEFT JOIN public.reward_models m ON m.id = r.model_id
WHERE r.status = 'active'
  AND (r.starts_at IS NULL OR r.starts_at <= NOW())
  AND (r.ends_at   IS NULL OR r.ends_at   >= NOW())
  AND (r.stock IS NULL OR COALESCE(r.stock_remaining, r.stock) > 0)
ORDER BY r.is_featured DESC, r.display_order ASC, r.created_at DESC;

-- ── 7. RLS ─────────────────────────────────────────────────
ALTER TABLE public.reward_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions   ENABLE ROW LEVEL SECURITY;

-- Reward models: ทุก authenticated user อ่านได้ (browse rewards)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'reward_models_read'
                  AND tablename = 'reward_models') THEN
    CREATE POLICY "reward_models_read" ON public.reward_models
      FOR SELECT USING (is_active = true OR auth.role() = 'service_role');
  END IF;
END $$;

-- Rewards: เห็นเฉพาะ active (admin ผ่าน service role bypass)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'rewards_read'
                  AND tablename = 'rewards') THEN
    CREATE POLICY "rewards_read" ON public.rewards
      FOR SELECT USING (status = 'active' OR auth.role() = 'service_role');
  END IF;
END $$;

-- Redemptions: เฉพาะของตัวเองอ่านได้
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'redemptions_self_select'
                  AND tablename = 'redemptions') THEN
    CREATE POLICY "redemptions_self_select" ON public.redemptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
