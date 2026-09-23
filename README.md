# Physics Monopoly

เกมเศรษฐีฟิสิกส์ 1–4 คน ใช้ Vite / React / Three.js + Colyseus authoritative server + PostgreSQL + local PDF/OCR worker

ครูสร้างชั้นเรียน ม.2/ม.4/ม.5 นำเข้า PDF ตรวจรับและเผยแพร่ชุดโจทย์เป็นรุ่นถาวร แล้วแชร์กิจกรรม มีคำใบ้ ลองตอบใหม่ รายงาน CSV และกู้เกมหลังหลุด/รีสตาร์ต พร้อมโมเดล procedural 12 เมือง / 24 ตัวละคร

**สถานะ: ทดสอบในเครื่อง ยังไม่รับรองครบ Phase 0–10 หรือพร้อมเปิดสาธารณะ** ดู `IMPLEMENTATION_STATUS.md` และ `docs/acceptance-checklist.md` สำหรับผลจริงและเกณฑ์ที่ยังเปิด งานภาพยังรอตรวจรับขั้นสุดท้าย และยังไม่ได้ยืนยัน OIDC จริง/อุปกรณ์จริง/staging/classroom pilot

## Run

Node.js 24 / PowerShell:

```powershell
npm ci
npm run setup:local
# Terminal 1
npm run dev:db
```

```powershell
# Terminal 2: เปิด API / เว็บ / worker โดย worker รอ migration และ ready
$env:DEV_TEACHER_AUTH='true'
$env:APP_ORIGIN='http://localhost:5173'
npm run dev
```

เปิด `http://localhost:5173/teacher` ใช้ครูตัวอย่าง A/B เฉพาะในเครื่อง → สร้างชั้นเรียน → นำเข้า/แก้โจทย์ → ตรวจรับอย่างน้อย 10 ข้อ → เผยแพร่ → สร้างลิงก์กิจกรรม

ทดสอบผู้เล่นด้วย browser profiles/contexts แยกกัน ไม่แชร์ token เดียวกัน ข้อมูล/รหัสผ่าน/ไฟล์ private อยู่ใน ignored `.local/` ห้ามเผยแพร่ directory นี้
PDF จำกัด 20 MB / 80 หน้า ต้องตรวจข้อความ ตัวเลข หน่วย ภาพ และเฉลยด้วยคนก่อนเผยแพร่
`npm run dev:core` เปิดเฉพาะเว็บ/API; `npm run dev:worker` ใช้เปิด worker แยกสำหรับ QA ตาม `docs/run-review-build.md` ไม่เปิด worker ซ้ำเมื่อใช้ `dev`

## Test

```bash
npm run validate:questions
npm run test
npm run check
npm run build
```

## กติกาห้องเรียน `/play/...`

ทุกคนตอบพร้อมกัน มีคำใบ้/ลองใหม่/เฉลย ไม่มีคุกหรือการคัดออก เงินกับ XP แยกกัน จบตามเวลาที่ครูตั้งไว้ ดูวิธีใช้ใน `docs/teacher-guide.md` และ `docs/student-guide.md`

## กติกา legacy free play `/` (เก็บไว้เพื่อความเข้ากันได้ ไม่ใช่กติกาห้องเรียน)

- สร้างห้องหรือเข้าร่วมห้องด้วย `roomCode`
- Host กดเริ่มเกม
- ผู้เล่นทอยเต๋า เดินบนกระดาน 28 ช่อง
- ซื้อหรืออัปเกรดทรัพย์สินต้องตอบโจทย์ฟิสิกส์ให้ถูก
- ช่อง Physics Challenge ตอบผิดจะเข้าคุกหรือถูกข้าม 1 ตา
- ออกจากคุกได้ด้วยการจ่าย ฿500 หรือแก้โจทย์ฟิสิกส์
- Chance, ภาษี, กองกลาง, ค่าเช่า, ล้มละลาย, XP และ Physics MVP ทำงานผ่าน server

## Assets

โมเดล 3 มิติหลักอยู่ใน `client/src/game3d` มีที่มาใน `assets/LICENSES.md` และ `assets/procedural-manifest.v1.json` หลังแก้โมเดล ให้ build → `npm run test:assets:browser` → `npm run assets:manifest` → `npm run assets:check` เพื่อวัด geometry ใหม่

ระบบ asset **2 มิติเดิม** อยู่ที่ `assets/manifest.json` และ `client/public/assets/manifest.json` เก็บไฟล์เดิมไว้ แต่ยังไม่รับรองสิทธิ์แจกจ่ายภาพเดิม

ถ้าต้องการแทน placeholder ด้วยภาพ image2.0 ให้วางไฟล์ใหม่ตาม path ใน manifest หรือแก้ `path` ใน manifest ให้ชี้ไฟล์ใหม่โดยไม่ต้องแก้โค้ด Prompt ทั้งหมดอยู่ใน `assets/IMAGE_PROMPTS.md`

## Deploy

ใช้ `docs/deployment.md` เป็น runbook ปัจจุบัน ต้องมี OIDC จริง, HTTPS/WSS, PostgreSQL และ private storage ถาวร ไม่ใช่ตั้ง WebSocket URL อย่างเดียว
ยังไม่ได้ deploy บริการภายนอก Docker scaffold ที่ root ยังไม่ได้รันในเครื่องนี้ ห้ามใช้ dev teacher auth บนอินเทอร์เน็ต หรือใช้ QR ชี้ localhost แล้วอ้างว่าเปิดข้ามอุปกรณ์ได้
CI ตรวจ unit/build/question structure/manifest/dependency audit แต่ไม่แทนการเล่นจริงหรือ staging ผลการทดสอบในเครื่องอยู่ใน `docs/qa/`
