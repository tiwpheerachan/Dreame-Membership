-- ============================================================
-- Migration 0025: Scale indexes + RLS split (10,000+ users)
--
-- จาก audit: หลาย table ขนาดใหญ่ขาด index ที่จะใช้ใน query ที่ใช้บ่อย
-- - coupons (100k+ rows)
-- - points_log (500k+ rows)
-- - redemptions (10k+ rows)
-- + RLS policy ของ coupons OR user_id IS NULL ทำให้ query slow → split
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- สำหรับ ILIKE search (admin)

-- ── coupons ──
-- ใช้ใน flag-expired cron + admin list + redeem flow
CREATE INDEX IF NOT EXISTS idx_coupons_used_at
  ON public.coupons(used_at NULLS FIRST);

-- composite สำหรับ /coupons user query: WHERE user_id = X ORDER BY valid_until
CREATE INDEX IF NOT EXISTS idx_coupons_user_valid_until
  ON public.coupons(user_id, valid_until ASC NULLS LAST)
  WHERE user_id IS NOT NULL;

-- active code lookup (admin distribute pool)
CREATE INDEX IF NOT EXISTS idx_coupons_pool_lookup
  ON public.coupons(shopify_shop_id, shopify_price_rule_id, created_at ASC)
  WHERE user_id IS NULL AND used_at IS NULL AND shopify_price_rule_id IS NOT NULL;

-- created_by FK (audit: ใครสร้าง batch)
CREATE INDEX IF NOT EXISTS idx_coupons_created_by
  ON public.coupons(created_by)
  WHERE created_by IS NOT NULL;

-- ── points_log ──
-- /points page query (top 80 by user, by created_at desc)
CREATE INDEX IF NOT EXISTS idx_points_log_user_created
  ON public.points_log(user_id, created_at DESC);

-- expiry cron (find pending expirations by type)
CREATE INDEX IF NOT EXISTS idx_points_log_expires_pending
  ON public.points_log(expires_at)
  WHERE type = 'EARNED' AND expires_at IS NOT NULL;

-- ── redemptions ──
-- composite (reward_id, status) สำหรับ admin reward detail
CREATE INDEX IF NOT EXISTS idx_redemptions_reward_status
  ON public.redemptions(reward_id, status);

-- shopify_code lookup (webhook cascade)
CREATE INDEX IF NOT EXISTS idx_redemptions_shopify_code_lookup
  ON public.redemptions(shopify_code)
  WHERE shopify_code IS NOT NULL;

-- ── purchase_registrations ──
-- ใครอนุมัติ purchase
CREATE INDEX IF NOT EXISTS idx_purchase_approved_by
  ON public.purchase_registrations(approved_by)
  WHERE approved_by IS NOT NULL;

-- pending review (admin worklist) — enum values: PENDING / BQ_VERIFIED / ADMIN_APPROVED / REJECTED
CREATE INDEX IF NOT EXISTS idx_purchase_pending
  ON public.purchase_registrations(status, created_at DESC)
  WHERE status IN ('PENDING', 'BQ_VERIFIED');

-- ── users ──
-- ใช้ใน admin search: ILIKE %name%, phone, email
CREATE INDEX IF NOT EXISTS idx_users_full_name_gin
  ON public.users USING GIN (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_email_gin
  ON public.users USING GIN (email gin_trgm_ops)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_phone_gin
  ON public.users USING GIN (phone gin_trgm_ops)
  WHERE phone IS NOT NULL;

-- tier + lifetime composite (admin segment query)
CREATE INDEX IF NOT EXISTS idx_users_tier_lifetime
  ON public.users(tier, lifetime_points DESC)
  WHERE is_active = true;

-- ── admin_audit_log ──
-- เรียงตามเวลา (admin audit page)
CREATE INDEX IF NOT EXISTS idx_audit_log_created_desc
  ON public.admin_audit_log(created_at DESC);

-- by staff (filter "actions by this admin")
CREATE INDEX IF NOT EXISTS idx_audit_log_staff_created
  ON public.admin_audit_log(staff_id, created_at DESC)
  WHERE staff_id IS NOT NULL;

-- ── shopify_webhook_events ──
-- หมายเหตุ: index ปกติของ received_at มีอยู่แล้วใน migration 0014
-- (idx_webhook_events_received_at) — cron cleanup query ใช้ได้
-- ⚠️ ห้ามใส่ NOW() ใน WHERE predicate ของ partial index — ไม่ IMMUTABLE

-- ============================================================
-- RLS split — เดิม OR user_id IS NULL ทำให้ query slow
-- (Postgres ต้อง evaluate ทั้ง 2 branch ทุก row)
-- → แยกเป็น 2 policy
-- ============================================================

DROP POLICY IF EXISTS coupons_self_select ON public.coupons;
DROP POLICY IF EXISTS coupons_global_select ON public.coupons;

CREATE POLICY "coupons_self_select" ON public.coupons
  FOR SELECT USING (auth.uid() = user_id);

-- ⚠️ ไม่เปิด global select เพื่อกัน user เห็น pool codes
-- ถ้าต้องการ global → uncomment + add filter (status only)
-- CREATE POLICY "coupons_global_select" ON public.coupons
--   FOR SELECT USING (user_id IS NULL AND status = 'active');

NOTIFY pgrst, 'reload schema';
