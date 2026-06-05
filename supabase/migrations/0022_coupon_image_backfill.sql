-- ============================================================
-- Migration 0022: Coupon image + backfill missing reward coupons
--
-- ปัญหาที่เจอ: user แลก reward ซ้ำ 5 ครั้งแต่ /coupons เห็นแค่ 3
-- สาเหตุ: โค้ดเก่าใช้ auto_issue_key = "REWARD_<reward_id>" (เหมือนกันทุกครั้ง)
--         → unique index uniq_coupons_user_auto_key block ครั้งที่ 2+
-- โค้ดใหม่ใช้ "REWARD_<reward_id>_<redemption_id>" → unique ทุกครั้ง
--
-- Migration นี้:
--   1. เพิ่ม image_url column ใน coupons (สำหรับโชว์รูปสินค้าบนการ์ด)
--   2. Backfill: หา redemption ที่มี shopify_code แต่ไม่มี coupon row →
--      insert coupon row ที่ขาด พร้อมรูปจาก reward_snapshot
-- ============================================================

-- ── 1. เพิ่ม image_url column ─────────────────────────────
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.coupons.image_url IS
  'รูปสินค้าหรือ banner ที่จะแสดงบน coupon card (เช่นรูป reward)';

-- ── 2. Backfill missing reward coupons ────────────────────
-- หาทุก redemption ที่:
--   • มี shopify_code (= code gen สำเร็จ)
--   • status ไม่ใช่ cancelled
--   • ยังไม่มี coupon row ที่ code ตรงกัน
-- → insert coupon row โดยใช้ unique auto_issue_key (รวม redemption_id)
INSERT INTO public.coupons (
  user_id, code, title, description,
  discount_type, discount_value, min_purchase,
  valid_from, valid_until, theme, image_url,
  shopify_shop_id, shopify_price_rule_id, apply_url,
  shopify_synced_at, auto_issue_key
)
SELECT
  r.user_id,
  r.shopify_code,
  '🎁 ' || COALESCE(r.reward_snapshot->>'name', 'Reward'),
  CASE
    WHEN r.reward_snapshot->>'redeem_type' = 'POINTS_CASH'
      THEN 'ส่วนลดสำหรับสินค้าที่แลกไว้ — จ่ายเพิ่ม ฿' ||
           to_char(COALESCE((r.reward_snapshot->>'cash_top_up_thb')::numeric, 0), 'FM999,999,999') ||
           ' ที่ Shopify'
    ELSE 'ส่วนลดคูปอง ฿' ||
         to_char(COALESCE((r.reward_snapshot->>'voucher_value_thb')::numeric, 0), 'FM999,999,999')
  END,
  'FIXED',
  -- discount_value: ถ้าเป็น POINTS_CASH ใช้ original - cash, ถ้า VOUCHER ใช้ voucher_value
  CASE
    WHEN r.reward_snapshot->>'redeem_type' = 'POINTS_CASH'
      THEN GREATEST(
        COALESCE((r.reward_snapshot->>'original_price_thb')::numeric, 0)
        - COALESCE((r.reward_snapshot->>'cash_top_up_thb')::numeric, 0),
        0
      )
    ELSE COALESCE((r.reward_snapshot->>'voucher_value_thb')::numeric, 0)
  END,
  -- min_purchase
  CASE
    WHEN r.reward_snapshot->>'redeem_type' = 'POINTS_CASH'
      THEN COALESCE((r.reward_snapshot->>'cash_top_up_thb')::numeric, 0)
    ELSE 0
  END,
  CURRENT_DATE,
  COALESCE(r.code_expires_at::date, CURRENT_DATE + INTERVAL '30 days'),
  CASE WHEN r.reward_snapshot->>'redeem_type' = 'POINTS_CASH' THEN 'gold' ELSE 'rose' END,
  -- image_url จาก reward_snapshot
  r.reward_snapshot->>'image_url',
  'dreame-thailand.myshopify.com',
  r.shopify_price_rule_id,
  COALESCE(r.reward_snapshot->>'shopify_product_url', r.shopify_apply_url),
  NOW(),
  'REWARD_' || r.reward_id::text || '_' || r.id::text
FROM public.redemptions r
WHERE r.shopify_code IS NOT NULL
  AND r.status NOT IN ('cancelled')
  AND NOT EXISTS (
    SELECT 1 FROM public.coupons c
     WHERE c.code = r.shopify_code
  )
ON CONFLICT DO NOTHING;

-- ── 3. Backfill image_url สำหรับ reward coupons ที่มีอยู่แล้ว ──
UPDATE public.coupons c
   SET image_url = r.reward_snapshot->>'image_url'
  FROM public.redemptions r
 WHERE c.code = r.shopify_code
   AND r.reward_snapshot->>'image_url' IS NOT NULL
   AND c.image_url IS NULL;

NOTIFY pgrst, 'reload schema';
