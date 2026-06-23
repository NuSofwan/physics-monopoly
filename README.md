# Physics Monopoly

เกมเศรษฐีฟิสิกส์แบบออนไลน์สูงสุด 4 คน ใช้ Vite + React + Phaser ฝั่ง client และ Colyseus authoritative server ฝั่ง Node.js

## Run

```bash
npm install
npm run dev
```

เปิด `http://localhost:5173` หลายแท็บ สร้างห้องในแท็บแรก แล้วใช้ `roomCode` เข้าร่วมจากแท็บอื่นได้ทันที server รันที่ `ws://localhost:2567`

## Test

```bash
npm run validate:questions
npm run test
npm run check
npm run build
```

## Gameplay

- สร้างห้องหรือเข้าร่วมห้องด้วย `roomCode`
- Host กดเริ่มเกม
- ผู้เล่นทอยเต๋า เดินบนกระดาน 28 ช่อง
- ซื้อหรืออัปเกรดทรัพย์สินต้องตอบโจทย์ฟิสิกส์ให้ถูก
- ช่อง Physics Challenge ตอบผิดจะเข้าคุกหรือถูกข้าม 1 ตา
- ออกจากคุกได้ด้วยการจ่าย ฿500 หรือแก้โจทย์ฟิสิกส์
- Chance, ภาษี, กองกลาง, ค่าเช่า, ล้มละลาย, XP และ Physics MVP ทำงานผ่าน server

## Assets

ระบบ asset อยู่ที่ `assets/manifest.json` และ copy ที่ client ใช้จริงอยู่ใน `client/public/assets/manifest.json`

ถ้าต้องการแทน placeholder ด้วยภาพ image2.0 ให้วางไฟล์ใหม่ตาม path ใน manifest หรือแก้ `path` ใน manifest ให้ชี้ไฟล์ใหม่โดยไม่ต้องแก้โค้ด Prompt ทั้งหมดอยู่ใน `assets/IMAGE_PROMPTS.md`

## Deploy

### Server on Render

1. สร้าง Web Service จาก repo
2. ใช้ `render.yaml` หรือ Dockerfile ใน `server/Dockerfile`
3. ตั้ง env:
   - `PORT=2567`
   - `ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app`

### Client on Vercel

1. ตั้ง project เป็น root นี้
2. ใช้ `vercel.json`
3. ตั้ง env:
   - `VITE_SERVER_URL=wss://your-render-service.onrender.com`

จากนั้น deploy client และ server แยกกัน client จะต่อ WebSocket ไป server ตาม `VITE_SERVER_URL`
