# Quick Action Card Images

ใช้เป็น **พื้นหลังของการ์ด Quick Action 4 อันบนหน้า home**
- ลงทะเบียน · ประกัน · คูปอง · แลกของ

## ขนาดแนะนำ
- **Aspect ratio: 4:5 หรือ 1:1.2** (เช่น 800 × 1000 px)
- Format: **JPG / WebP** (ไม่ต้อง transparent — รูปจะเต็มการ์ด)
- ขนาดไฟล์: < 200 KB ต่อรูป
- สีสันเข้ม / contrast สูง — เพราะข้อความขาวจะวางทับ

## ไฟล์ที่ต้องมี

| ไฟล์ | การ์ด | สีโทนแนะนำ |
|---|---|---|
| `register.png` | ลงทะเบียน  | Gold / amber / warm |
| `warranty.png` | ประกัน      | Blue / steel |
| `coupons.png`  | คูปอง       | Pink / purple |
| `rewards.png`  | แลกของ      | Green / emerald |

## หมายเหตุ
- ระบบจะใส่ overlay ดำ + gradient + shimmer effect ทับรูปอัตโนมัติ
- ไม่ต้องเขียนข้อความบนรูป — โค้ด render label เอง
- ถ้าไม่มีไฟล์ → fallback เป็น gradient ขาว-ทอง
