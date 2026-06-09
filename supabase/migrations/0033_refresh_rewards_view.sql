-- ============================================================
-- Migration 0033: Refresh v_rewards_available view
--
-- ปัญหา: view สร้างใน migration 0016 ด้วย r.* ก่อนที่เพิ่ม columns
--        redeem_type, cash_top_up_thb, original_price_thb, voucher_value_thb,
--        shopify_product_url, code_validity_days ฯลฯ
--        → view ไม่ include columns ใหม่ (Postgres snapshots schema ตอน create)
--
-- ผล: API /api/rewards ดึงข้อมูลจาก view → ไม่ได้ redeem_type
--     → conditional ใน RewardCard เป็น undefined → pill "+ จ่ายเพิ่ม ฿X" ไม่ขึ้น
--
-- แก้: DROP + CREATE view ใหม่ → re-snapshot กับ schema ปัจจุบัน
-- ============================================================

DROP VIEW IF EXISTS public.v_rewards_available;

CREATE VIEW public.v_rewards_available AS
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

NOTIFY pgrst, 'reload schema';
