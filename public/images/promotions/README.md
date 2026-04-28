# Promotion Banner Images

ใช้สำหรับโปรโมชั่นที่ admin upload ผ่านหน้า /admin/coupons (ฝั่ง promotion management)

## ขนาดแนะนำ
- **Hero promo (full width)**: 1200 × 600 px (2:1)
- **Card promo (carousel)**: 800 × 600 px (4:3)
- Format: JPG หรือ WebP
- ขนาดไฟล์: < 500 KB

## หมายเหตุ
- รูปจะถูก upload เข้า Supabase Storage (bucket `dreame-files`) ผ่าน admin UI
- โฟลเดอร์นี้สำหรับรูป default/placeholder ของแต่ละหมวดเท่านั้น

## Default Files (optional)
- `default-hero.jpg` — fallback ถ้า admin ยังไม่ได้ upload
- `default-card.jpg` — fallback ถ้า admin ยังไม่ได้ upload
