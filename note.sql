-- ============================================================
-- วิธีใช้: เปลี่ยน email ให้ตรงกับที่ Login เข้าระบบแล้ว
-- ต้อง Login ผ่านหน้าเว็บก่อน แล้วค่อยรัน SQL นี้
-- ============================================================

-- ----------------------------------------------------------------
-- ระดับที่ 1: SUPER_ADMIN
-- เข้าถึงได้ทุกอย่าง ทั้ง Online และ Onsite
-- ----------------------------------------------------------------
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Super Admin', email, 'SUPER_ADMIN', ARRAY['ONLINE', 'ONSITE']
FROM auth.users WHERE email = 'superadmin@email.com';

-- ----------------------------------------------------------------
-- ระดับที่ 2: ADMIN_ONLINE
-- จัดการคำสั่งซื้อ Online (Shopee, Lazada, Website, TikTok)
-- อนุมัติ/ปฏิเสธ, จัดการสมาชิก, สร้างคูปอง
-- ----------------------------------------------------------------
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Admin Online', email, 'ADMIN_ONLINE', ARRAY['ONLINE']
FROM auth.users WHERE email = 'adminonline@email.com';

-- ----------------------------------------------------------------
-- ระดับที่ 3: ADMIN_ONSITE
-- จัดการคำสั่งซื้อ Onsite (หน้าร้าน)
-- อนุมัติ/ปฏิเสธ, จัดการสมาชิก, สร้างคูปอง
-- ----------------------------------------------------------------
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Admin Onsite', email, 'ADMIN_ONSITE', ARRAY['ONSITE']
FROM auth.users WHERE email = 'adminonsite@email.com';

-- ----------------------------------------------------------------
-- ระดับที่ 4: STAFF_ONLINE
-- ดูและจัดการ Pending Queue ของ Online เท่านั้น
-- ไม่สามารถจัดการสมาชิกหรือสร้างคูปองได้
-- ----------------------------------------------------------------
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Staff Online', email, 'STAFF_ONLINE', ARRAY['ONLINE']
FROM auth.users WHERE email = 'staffonline@email.com';

-- ----------------------------------------------------------------
-- ระดับที่ 5: STAFF_ONSITE
-- ดูและจัดการ Pending Queue ของ Onsite เท่านั้น
-- ไม่สามารถจัดการสมาชิกหรือสร้างคูปองได้
-- ----------------------------------------------------------------
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Staff Onsite', email, 'STAFF_ONSITE', ARRAY['ONSITE']
FROM auth.users WHERE email = 'staffonsite@email.com';

-- ----------------------------------------------------------------
-- Admin ที่ดูแลทั้ง Online + Onsite (ไม่ใช่ Super)
-- ----------------------------------------------------------------
INSERT INTO admin_staff (auth_user_id, name, email, role, channel_access)
SELECT id, 'ชื่อ Admin ทั้งสองช่องทาง', email, 'ADMIN_ONLINE', ARRAY['ONLINE', 'ONSITE']
FROM auth.users WHERE email = 'adminboth@email.com';

-- ================================================================
-- ตรวจสอบ admin ทั้งหมด
-- ================================================================
SELECT 
  s.name,
  s.email,
  s.role,
  s.channel_access,
  s.is_active,
  s.created_at
FROM admin_staff s
ORDER BY 
  CASE s.role
    WHEN 'SUPER_ADMIN'   THEN 1
    WHEN 'ADMIN_ONLINE'  THEN 2
    WHEN 'ADMIN_ONSITE'  THEN 3
    WHEN 'STAFF_ONLINE'  THEN 4
    WHEN 'STAFF_ONSITE'  THEN 5
  END;

-- ================================================================
-- ปิดการใช้งาน Admin (ถ้าต้องการ)
-- ================================================================
-- UPDATE admin_staff SET is_active = false WHERE email = 'someone@email.com';

-- ================================================================
-- ลบ Admin (ถ้าต้องการ)
-- ================================================================
-- DELETE FROM admin_staff WHERE email = 'someone@email.com';

5. กด Deploy
กด "Deploy site" รอประมาณ 2-3 นาที
เว็บจะได้ชื่อแบบนี้: https://dreame-xxx.netlify.app

6. แก้ Supabase ให้รับ Domain ใหม่
ไปที่ Supabase → Authentication → URL Configuration
Site URL:      https://dreame-xxx.netlify.app
Redirect URLs: https://dreame-xxx.netlify.app/**
กด Save แล้วทดสอบ login ได้เลยครับ ✅


💡 ต่อไปนี้ ทุกครั้งที่ git push เว็บจะ deploy ใหม่อัตโนมัติเลย ไม่ต้องทำอะไรเพิ่ม