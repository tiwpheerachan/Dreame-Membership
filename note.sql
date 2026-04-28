-- ============================================================
-- ADMIN BOOTSTRAP — sample inserts for admin_staff table
-- วิธีใช้: เปลี่ยน email ให้ตรงกับที่ Login เข้าระบบแล้ว
-- ต้อง Login ผ่านหน้าเว็บก่อน แล้วค่อยรัน SQL นี้
-- ============================================================

-- ระดับที่ 1: SUPER_ADMIN (เข้าถึงได้ทุกอย่าง)
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Super Admin', email, 'SUPER_ADMIN', ARRAY['ONLINE', 'ONSITE']
FROM auth.users WHERE email = 'superadmin@email.com';

-- ระดับที่ 2: ADMIN_ONLINE (Shopee, Lazada, Website, TikTok)
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Admin Online', email, 'ADMIN_ONLINE', ARRAY['ONLINE']
FROM auth.users WHERE email = 'adminonline@email.com';

-- ระดับที่ 3: ADMIN_ONSITE (หน้าร้าน)
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Admin Onsite', email, 'ADMIN_ONSITE', ARRAY['ONSITE']
FROM auth.users WHERE email = 'adminonsite@email.com';

-- ระดับที่ 4: STAFF_ONLINE (เฉพาะ Pending Queue Online)
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Staff Online', email, 'STAFF_ONLINE', ARRAY['ONLINE']
FROM auth.users WHERE email = 'staffonline@email.com';

-- ระดับที่ 5: STAFF_ONSITE (เฉพาะ Pending Queue Onsite)
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Staff Onsite', email, 'STAFF_ONSITE', ARRAY['ONSITE']
FROM auth.users WHERE email = 'staffonsite@email.com';

-- Admin ดูแลทั้ง Online + Onsite (ไม่ใช่ Super)
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Admin ทั้งสองช่องทาง', email, 'ADMIN_ONLINE', ARRAY['ONLINE', 'ONSITE']
FROM auth.users WHERE email = 'adminboth@email.com';

-- ────────────────────────────────────────────────────────────
-- ตรวจสอบ admin ทั้งหมด
-- ────────────────────────────────────────────────────────────
SELECT
  s.name, s.email, s.role, s.channel_access, s.is_active, s.created_at
FROM admin_staff s
ORDER BY
  CASE s.role
    WHEN 'SUPER_ADMIN'   THEN 1
    WHEN 'ADMIN_ONLINE'  THEN 2
    WHEN 'ADMIN_ONSITE'  THEN 3
    WHEN 'STAFF_ONLINE'  THEN 4
    WHEN 'STAFF_ONSITE'  THEN 5
  END;

-- ปิดการใช้งาน Admin
-- UPDATE admin_staff SET is_active = false WHERE email = 'someone@email.com';

-- ลบ Admin
-- DELETE FROM admin_staff WHERE email = 'someone@email.com';
