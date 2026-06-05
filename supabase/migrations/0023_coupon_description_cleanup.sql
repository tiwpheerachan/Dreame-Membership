-- ============================================================
-- Migration 0023: Cleanup description + discount_value mismatch
--
-- ปัญหา: coupons ที่ถูก backfill จาก migration 0022 มี discount_value
-- คำนวณจาก reward_snapshot.original_price_thb ซึ่งเป็นค่า admin ตั้งไว้
-- (อาจไม่ตรงกับราคา Shopify ปัจจุบัน) → เลขลดบนป้ายไม่ตรง
--
-- Approach: ปรับ description ให้ใช้รูปแบบเดียวกัน (1,000 ไม่ใช่ 1000.00)
-- + อัปเดต discount_value ใช้ค่าล่าสุดจาก rewards table (original - cash)
-- โดยจะ sync realtime จาก Shopify ผ่าน live-price ฝั่ง client อยู่แล้ว
-- ============================================================

-- Re-write description for any reward coupon ที่ format ผิด
UPDATE public.coupons c
   SET description = REGEXP_REPLACE(
         c.description,
         '฿([0-9]+)\.00',
         '฿' || to_char(
           CASE WHEN c.min_purchase > 0 THEN c.min_purchase ELSE c.discount_value END,
           'FM999,999,999'
         ),
         'g'
       )
 WHERE c.auto_issue_key LIKE 'REWARD_%'
   AND c.description ~ '฿[0-9]+\.00';

-- Update discount_value ของ POINTS_CASH coupons:
-- ใช้ original_price - cash_top_up จาก rewards table ปัจจุบัน
-- (ถ้า admin แก้ราคาก็จะ sync มาด้วย)
UPDATE public.coupons c
   SET discount_value = GREATEST(
         COALESCE(rw.original_price_thb, 0) - COALESCE(rw.cash_top_up_thb, 0),
         c.discount_value
       )
  FROM public.redemptions r
  JOIN public.rewards rw ON rw.id = r.reward_id
 WHERE c.code = r.shopify_code
   AND c.auto_issue_key LIKE 'REWARD_%'
   AND rw.redeem_type = 'POINTS_CASH'
   AND rw.original_price_thb IS NOT NULL
   AND rw.cash_top_up_thb IS NOT NULL
   -- เฉพาะที่ snapshot discount_value น้อยกว่าค่าใหม่
   AND c.discount_value < (rw.original_price_thb - rw.cash_top_up_thb);

NOTIFY pgrst, 'reload schema';
