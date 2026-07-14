-- ============================================================
-- Migration 0041: Add BRANDSHOP to the sale_channel enum
--
-- Brand Shop = ร้านค้าอย่างเป็นทางการของแบรนด์ (direct retail) เพิ่มเป็น
-- ช่องทางที่ 6 ในหน้าลงทะเบียน — เดิม enum ไม่มีค่านี้ทำให้ insert error:
--   invalid input value for enum sale_channel: "BRANDSHOP"
--
-- ⚠️ ALTER TYPE ... ADD VALUE ต้องอยู่ไฟล์เดี่ยว — ใช้ค่าใหม่ใน transaction
-- เดียวกับที่เพิ่งเพิ่มไม่ได้ และ tooling บางตัวไม่ยอมรัน ADD VALUE ใน
-- transaction block (ดู 0007). ฟังก์ชันที่อ้าง 'BRANDSHOP' อยู่ใน 0042.
-- ============================================================

ALTER TYPE sale_channel ADD VALUE IF NOT EXISTS 'BRANDSHOP';

NOTIFY pgrst, 'reload schema';
