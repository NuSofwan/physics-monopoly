# เปิดทดสอบในเครื่อง — รุ่นกำลังพัฒนา
ต้องมี Node.js 24 และ npm ใช้ PowerShell ในโฟลเดอร์โครงการ

```powershell
npm install
npm run setup:local
```

setup สร้าง PostgreSQL ที่ 127.0.0.1:55432 สุ่มรหัสผ่านใน ignored `.local/database.json`
ไม่สร้าง Windows service และไม่พิมพ์รหัสผ่าน เรียกซ้ำได้โดยไม่หยุดฐานข้อมูลที่เปิดอยู่
Windows ต้องมี ASCII short-path alias หรือใช้ PostgreSQL ภายนอกผ่าน DATABASE_URL

เปิดสอง terminal แยกกัน:

```powershell
# 1: ฐานข้อมูล
npm run dev:db
```

```powershell
# 2: API เว็บ และ PDF/OCR worker (worker รอ API พร้อมก่อน)
$env:DEV_TEACHER_AUTH='true'
$env:APP_ORIGIN='http://localhost:5173'
npm run dev
```

ไม่ต้องเปิด worker ซ้ำเมื่อใช้ `npm run dev` หากเปิด API/preview แยกสำหรับ QA ให้เปิด `npm run dev:worker` อีก terminal ตามเดิม

เปิด http://localhost:5173/teacher ใช้ครูตัวอย่าง A/B เฉพาะเครื่องพัฒนา
สร้างชั้นเรียน ม.2/ม.4/ม.5 → ชุดโจทย์ → PDF หรือชุดฝึกรอตรวจ → แก้โจทย์/เฉลย/คำใบ้/หน่วย
ตรวจรับอย่างน้อย 10 ข้อ (แนะนำ 30) → เผยแพร่รุ่นถาวร → สร้างลิงก์กิจกรรม
นักเรียนเปิดลิงก์ ใส่ชื่อเล่น เลือกตัวละคร สร้าง/เข้าห้อง กดพร้อมและเริ่ม

PDF ไม่เกิน 20 MB / 80 หน้า OCR ไทย/อังกฤษทำในเครื่อง
ต้นฉบับ/ภาพหน้า/ภาพตัดอยู่ใน `.local/uploads` ไม่เปิดเป็น static directory
OCR และเฉลยยังต้องตรวจจริง โดยเฉพาะตัวเลข หน่วย รูปและหลายคอลัมน์
แยก/รวมข้อจะพักต้นฉบับและสร้างร่างใหม่ที่ยังไม่มีเฉลยรับรอง
การแก้ไขไม่เปลี่ยนรุ่นที่เผยแพร่แล้ว

หน้า / เป็น legacy free play ส่วน /play/... เป็นกติกาห้องเรียน ไม่มีคุกหรือการคัดออก
ทุกคนตอบพร้อมกัน มีคำใบ้ ลองใหม่ และเฉลยหลังปิดคำตอบ
ทดสอบหลายคนด้วย browser profile/context แยกกัน ไม่คัดลอก token ให้กัน

## ตรวจซ้ำ

```powershell
npm run test
npm run check
npm audit
npm run test:qr
npm run smoke:regression
```

QA scripts ใช้ API 2567 / preview 5174 พร้อม APP_ORIGIN ตรงกัน
แทน dev ระหว่างทดสอบ ห้ามเปิด API ซ้ำบนพอร์ตเดิม:

```powershell
$env:DEV_TEACHER_AUTH='true'
$env:APP_ORIGIN='http://localhost:5174'
npm run start -w server
```

```powershell
# terminal แยก หลัง npm run check
npm run preview -w client -- --port 5174 --strictPort
```

เมื่อ database/API/worker/preview ทำงานแล้ว:

```powershell
npm run test:teacher
npm run test:pdf
npm run test:import:browser
npm run test:group:browser
npm run test:group:browser -- --full-game
npm run test:backup
npm run test:network
npm run test:accessibility
npm run test:grades
npm run test:assets:browser
npm run test:soak
```

PDF fixtures ใน output/pdf/fixtures สร้างโดยโครงการเอง
scripts/createPdfFixtures.py ต้องมี ReportLab/Poppler; ไม่ต้องสร้างใหม่ทุกครั้ง
Browser tests ใช้ Microsoft Edge/Playwright แยก contexts และไม่เร่งเวลาเกม
หลักฐานอยู่ docs/qa ข้อมูล QA บันทึกในฐานข้อมูลจริง
Backup rehearsal สร้างฐานข้อมูลใหม่ ไม่ทับต้นทาง ตรวจ hash ของไฟล์ private ที่คืนมา
สำเนาใน .local/backups มีข้อมูลส่วนตัว ห้ามเผยแพร่พร้อมเว็บ

## LAN / production

.env.example ไม่มี secret จริง ตั้ง environment ของ process หรือคัดลอกเป็น .env เอง
Vite อ่าน root .env; server ใช้ native dotenv เฉพาะ non-production
ตั้ง VITE_API_URL / VITE_SERVER_URL ก่อน build เป็น address ที่เครื่องนักเรียนเข้าถึงได้
APP_ORIGIN / API_ORIGIN / ALLOWED_ORIGINS ต้องตรง URL จริง ไม่ใช้ localhost ข้ามเครื่อง
production ต้องมี HTTPS/WSS, PostgreSQL, private storage/backup, OIDC และ subject allowlist
ใช้หนึ่ง game process ต่อฐานข้อมูล มี advisory lock ไม่ใช่ multi-instance scaling
ห้ามเปิด DEV_TEACHER_AUTH บนระบบจริง

ผ่าน local load 60 คน/15 ห้อง/30 นาที, real restart recovery, 12/24 technical rendering และรายงานแล้ว
one-hour browser soak ผ่านใน bundle ณ เวลาเริ่มทดสอบ (ก่อนปรับภาพ/แยก KaTeX รอบสุดท้าย) ยังไม่ยืนยัน production OIDC, QR/ประสิทธิภาพบนอุปกรณ์จริง, final art approval หรือ classroom pilot
ดู IMPLEMENTATION_STATUS.md; build ผ่านไม่ได้แปลว่าผ่าน Definition of Done
