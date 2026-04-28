# Stats Card Background Images

ใช้เป็น **พื้นหลังของกล่องสถิติ Your Points / Lifetime** บนหน้า home

## ขนาดแนะนำ
- **Aspect ratio: 16:10 หรือ 3:2** (เช่น 1200 × 750 px)
- Format: **JPG / WebP**
- ขนาดไฟล์: < 250 KB ต่อรูป
- โทนเข้มกว่ากลาง — ตัวเลขสีทองจะอ่านง่ายขึ้น

## ไฟล์ที่ต้องมี

| ไฟล์ | ใช้เป็น bg ของ |
|---|---|
| `points-bg.jpg`   | กล่อง "Your Points" (ตัวเลขใหญ่ตรงกลาง) |
| `lifetime-bg.jpg` | กล่อง "Lifetime" |

## หมายเหตุ
- ระบบใส่ overlay + glass blur ทับให้
- รูปจะเป็นพื้นหลังเบลอ ๆ — ไม่ต้องชัดเจน
- ถ้าไม่มี → fallback เป็น gradient ดำ-ทอง
