-- ============================================================
-- Migration 0038: Schedule cron jobs via Supabase pg_cron + pg_net
--
-- ปัญหา: crons นิยามใน vercel.json แต่แอป deploy บน Render → ไม่เคยรัน
--        → ออเดอร์ที่เข้าคิว pending_verifications ไม่เคยถูก verify
--        → แต้มไม่เข้าอัตโนมัติ (พบออเดอร์ค้าง 2 เดือน retry_count=0)
--
-- แก้: ใช้ pg_cron เรียก API cron endpoint ผ่าน pg_net (HTTP) — hosting-agnostic
--
-- ⚠️ แทนที่ YOUR_CRON_SECRET ด้วยค่า CRON_SECRET ที่ตั้งไว้บน Render
--    (Render Dashboard → Environment → CRON_SECRET)
--    ถ้าต้องการ secure กว่านี้ ย้ายไปเก็บใน Supabase Vault แล้วอ้างผ่าน
--    vault.decrypted_secrets ภายหลัง
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ลบ job เดิมก่อน (กันซ้ำเวลารันใหม่)
SELECT cron.unschedule(jobname) FROM cron.job
 WHERE jobname IN ('verify-pending','birthday','tier-batch','flag-expired-codes','sync-shopify-discounts');

-- verify-pending: ทุกชั่วโมง (ตัวที่ทำให้แต้มไม่เข้า)
SELECT cron.schedule('verify-pending', '0 * * * *', $$
  SELECT net.http_get(
    url := 'https://dreame-membership.onrender.com/api/cron/verify-pending',
    headers := jsonb_build_object('Authorization', 'Bearer ' || 'YOUR_CRON_SECRET')
  );
$$);

-- birthday: ทุกวัน 01:00
SELECT cron.schedule('birthday', '0 1 * * *', $$
  SELECT net.http_get(
    url := 'https://dreame-membership.onrender.com/api/cron/birthday',
    headers := jsonb_build_object('Authorization', 'Bearer ' || 'YOUR_CRON_SECRET')
  );
$$);

-- flag-expired-codes: ทุกวัน 02:00 (mark coupon/redeem code หมดอายุ)
SELECT cron.schedule('flag-expired-codes', '0 2 * * *', $$
  SELECT net.http_get(
    url := 'https://dreame-membership.onrender.com/api/cron/flag-expired-codes',
    headers := jsonb_build_object('Authorization', 'Bearer ' || 'YOUR_CRON_SECRET')
  );
$$);

-- tier-batch: ทุกวัน 03:00 (recompute tier / ออกคูปอง tier)
SELECT cron.schedule('tier-batch', '0 3 * * *', $$
  SELECT net.http_get(
    url := 'https://dreame-membership.onrender.com/api/cron/tier-batch',
    headers := jsonb_build_object('Authorization', 'Bearer ' || 'YOUR_CRON_SECRET')
  );
$$);

-- sync-shopify-discounts: ทุก 6 ชั่วโมง
SELECT cron.schedule('sync-shopify-discounts', '0 */6 * * *', $$
  SELECT net.http_get(
    url := 'https://dreame-membership.onrender.com/api/cron/sync-shopify-discounts',
    headers := jsonb_build_object('Authorization', 'Bearer ' || 'YOUR_CRON_SECRET')
  );
$$);

-- ตรวจ: SELECT jobname, schedule, active FROM cron.job;
-- ดู log:  SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
