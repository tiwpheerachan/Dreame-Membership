# Member Card Background Images

ใช้เป็น **พื้นหลังของบัตรสมาชิก** บนหน้า home (อันที่มี Cardholder + Member Since)

## ขนาดแนะนำ
- **Aspect ratio: 85.6 / 53.98** (สัดส่วนบัตร credit card จริง — ISO 7810 ID-1)
- ตัวอย่าง: 1200 × 757 px
- Format: **JPG / WebP**
- ขนาดไฟล์: < 250 KB ต่อรูป
- โทนเข้ม / มี contrast — เพราะตัวอักษรขาว/ทองจะวางทับ

## ไฟล์ตามแต่ละ tier (optional — ใส่ไฟล์ไหนก็ได้)

| ไฟล์ | Tier | ตัวอย่างโทน |
|---|---|---|
| `plus.jpg`   | Plus   | เงิน-เทา marble / metal |
| `pro.jpg`    | Pro    | ดำ carbon fiber / leather |
| `ultra.jpg`  | Ultra  | ส้ม-ทองแดง |
| `master.jpg` | Master | ทอง iridescent / hologram |

## Fallback
ถ้าไม่มีไฟล์ ระบบจะใช้ **gradient โทนตาม tier** (สวยอยู่แล้ว — ไม่ต้องใส่รูปก็ได้)
ใส่รูปทีละ tier ก็ได้ ระบบจะเลือกใช้รูปก่อน gradient เสมอ

## หมายเหตุ
- รูปจะถูก darken/blur นิดนึงให้ตัวอักษรอ่านง่าย
- Pattern decoration (เส้น + วง arc) จะวาดทับรูปอีกชั้น
