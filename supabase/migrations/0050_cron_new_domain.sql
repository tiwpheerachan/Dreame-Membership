-- ============================================================
-- Migration 0050: ชี้ cron jobs ไป domain ใหม่ membership.th.dreametech.com
--
-- เดิม (0038/0039) cron http_get ไปที่ dreame-membership.onrender.com
-- เพิ่ม custom domain ใหม่แล้ว → ย้าย cron มาใช้ domain canonical เพื่อความเสถียร
-- (ถ้า onrender.com ยังตอบอยู่ cron เดิมก็ยังทำงาน — migration นี้เป็น optional
--  แต่แนะนำ เผื่ออนาคตเลิกใช้ onrender)
--
-- ⚠️ แทนที่ YOUR_CRON_SECRET ด้วยค่า CRON_SECRET จริง (เหมือน 0038)
-- ============================================================

DO $$
DECLARE
  base text := 'https://membership.th.dreametech.com';
  secret text := 'YOUR_CRON_SECRET';   -- ★ แก้เป็นค่าจริงก่อนรัน
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron ไม่ได้ติดตั้ง — ข้าม';
    RETURN;
  END IF;

  -- ลบของเดิมทั้งหมดก่อน กันซ้ำ
  PERFORM cron.unschedule(jobname) FROM cron.job
   WHERE jobname IN ('verify-pending','birthday','tier-batch','flag-expired-codes',
                     'sync-shopify-discounts','refill-reminders');

  PERFORM cron.schedule('verify-pending', '0 * * * *', format($f$
    SELECT net.http_get(url := '%s/api/cron/verify-pending',
      headers := jsonb_build_object('Authorization', 'Bearer %s')); $f$, base, secret));

  PERFORM cron.schedule('birthday', '0 1 * * *', format($f$
    SELECT net.http_get(url := '%s/api/cron/birthday',
      headers := jsonb_build_object('Authorization', 'Bearer %s')); $f$, base, secret));

  PERFORM cron.schedule('flag-expired-codes', '0 2 * * *', format($f$
    SELECT net.http_get(url := '%s/api/cron/flag-expired-codes',
      headers := jsonb_build_object('Authorization', 'Bearer %s')); $f$, base, secret));

  PERFORM cron.schedule('tier-batch', '0 3 * * *', format($f$
    SELECT net.http_get(url := '%s/api/cron/tier-batch',
      headers := jsonb_build_object('Authorization', 'Bearer %s')); $f$, base, secret));

  PERFORM cron.schedule('sync-shopify-discounts', '0 */6 * * *', format($f$
    SELECT net.http_get(url := '%s/api/cron/sync-shopify-discounts',
      headers := jsonb_build_object('Authorization', 'Bearer %s')); $f$, base, secret));

  PERFORM cron.schedule('refill-reminders', '0 9 * * *', format($f$
    SELECT net.http_get(url := '%s/api/cron/refill-reminders',
      headers := jsonb_build_object('Authorization', 'Bearer %s')); $f$, base, secret));
END $$;

-- ตรวจ: SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
