# Feed Images

ใช้สำหรับรูปที่ admin โพสต์ใน feed ของหน้า home (ข่าว, อัพเดต, content marketing)

## ขนาดแนะนำ
- Aspect ratio: **4:5** (1080 × 1350 px) — แนวตั้งสไตล์ Instagram
- Format: JPG หรือ WebP
- ขนาดไฟล์: < 400 KB

## โครงสร้าง feed item ใน DB

ดูตาราง `promotions` (จะใช้ตารางเดียวกัน) — ฟิลด์เพิ่มเติมที่ใช้:
- `image_url` — รูปหลัก
- `link_url` — link ปลายทาง
- `original_price` — ราคาก่อนลด
- `discounted_price` — ราคาหลังลด
- `discount_label` — เช่น "ลด 8,000 บาท"
- `badge_text` — เช่น "BEST SELLING", "Hot"
