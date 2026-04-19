# Gemini Final Prompt Pro — Spark / No Functions Edition

ชุดนี้ตัด Cloud Functions ออก เพื่อให้ใช้งานบน Spark plan ได้

รองรับ:
- Google Login
- ระบบรออนุมัติ
- Admin panel
- Prompt History
- Gemini API key ฝั่ง browser

## ไฟล์สำคัญ
- public/index.html
- public/app.js
- public/firebase-config.js
- firestore.rules
- firebase.json

## สำคัญก่อน deploy
แก้อีเมลแอดมินให้ตรงกัน 2 จุด:
1. `public/app.js` → `const ADMIN_EMAILS = [...]`
2. `firestore.rules` → `isBootstrapAdmin()`

ถ้าคุณใช้อีเมลอื่นเป็นแอดมิน ให้แก้ทั้งสองไฟล์เป็นอีเมลเดียวกัน

## Deploy
```bash
firebase deploy --only hosting,firestore
```

## วิธีทำงาน
- ผู้ใช้ทั่วไป login ครั้งแรก → ถูกสร้างเป็น role=user และ approved=false
- อีเมลใน ADMIN_EMAILS → เป็น admin อัตโนมัติ และ approved=true
- admin เปิดหน้าเว็บแล้วเห็น Admin Approval Panel
- admin กดอนุมัติ user ได้จากหน้าเว็บโดยตรงผ่าน Firestore
- ผู้ใช้ที่ approved แล้วจึงจะสร้าง Prompt และบันทึก Prompt History ได้
