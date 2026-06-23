# 🎲⚛️ เกมเศรษฐีฟิสิกส์ (Physics Monopoly) — Workflow สมบูรณ์ (ONE-SHOT) สำหรับ Codex

> เอกสารนี้คือ "ใบสั่งงานฉบับสมบูรณ์" (spec + workflow) ให้ Codex สร้างเกมตั้งแต่ต้นจนจบ **ในการรันครั้งเดียวรวดเดียว**

## ⚡ โหมดการทำงาน: ONE-SHOT (อ่านก่อนเริ่ม — สำคัญที่สุด)
- **อ่านทั้งไฟล์ก่อน** แล้ว **ทำต่อเนื่อง Phase 0 → 8 รวดเดียวจนจบ ไม่ต้องหยุดถามหรือรอไฟเขียวระหว่าง Phase**
- จบแต่ละ Phase ให้ **self-verify ตาม "Definition of Done" เอง** (รัน/เทสต์ให้ผ่าน) แล้ว **commit แยกตาม Phase** ด้วย แล้วเดินหน้าต่อทันที
- ถ้าเจอจุดที่ spec ไม่ชัด → **ตัดสินใจด้วยค่า default ที่สมเหตุสมผล เขียนหมายเหตุไว้ใน `DECISIONS.md` แล้วทำต่อ** (ห้ามค้างรอคำตอบ)
- **อย่าบล็อกที่ asset:** Codex สร้างภาพ image2.0 เองตอนรันไม่ได้ → ให้สร้างระบบ **placeholder อัตโนมัติ + `assets/manifest.json` + `assets/IMAGE_PROMPTS.md`** ให้เกม "เล่นได้ครบทุกกลไกด้วย placeholder" ก่อน แล้วผู้ใช้แค่เอาภาพจริงมาวางทับตาม manifest ภายหลัง (รายละเอียด Phase 6)
- เป้าหมายปลายทาง: รันจบแล้วได้ **เกมที่เล่นออนไลน์ 4 คนได้จริง พร้อม deploy** โดยไม่ต้องสั่งงานเพิ่ม
- กฎทั่วไป: TypeScript strict ทั้งหมด, ชื่อไฟล์/ตัวแปร/path เป็น **ASCII** เท่านั้น, ทุกอย่างรันด้วย `npm run dev` (ราก) ได้

---

## 0. ภาพรวมโปรเจกต์ (Vision)

สร้าง **เกมกระดานเศรษฐี (Monopoly) แนวฟิสิกส์** เล่นออนไลน์ได้ **สูงสุด 4 คน** ในห้องเดียวกัน
กติกาเหมือนเกมเศรษฐีทั่วไป (ทอยลูกเต๋า เดิน ซื้อที่ดิน/บ้าน/โรงแรม เก็บค่าเช่า ติดคุก ล้มละลาย) แต่เพิ่ม **ชั้นของโจทย์ฟิสิกส์** เข้าไป:

1. **จะซื้อทรัพย์สิน (ที่ดิน / บ้าน / โรงแรม / คอนโด) ต้องตอบโจทย์ฟิสิกส์ให้ถูก 1 ข้อก่อน** ถ้าตอบผิด ซื้อไม่ได้ในรอบนั้น
2. **เมื่อทอยลูกเต๋าแล้วเดินไปหยุดบนช่องที่กำหนด (Physics Challenge / ช่องพิเศษ) ต้องตอบโจทย์ฟิสิกส์** ถ้าตอบ **ไม่ได้ → ติดคุก / หยุดเดิน 1 ตา**
3. ภาพและกราฟิกทั้งหมดของเกม **สร้างด้วย image2.0** (โมเดลสร้างภาพ) — ดูรายการ asset ใน Phase 6
4. ต้องมี **อนิเมชันการเดินของตัวละครแบบสมจริง** — เมื่อทอยลูกเต๋าเสร็จ กล้องจะ "ฉายภาพ" ตามตัวละครที่กำลังเดินทีละช่องตามแต้มที่ทอยได้ (walk-cycle + ก้าวทีละช่อง)

**เป้าหมายการเรียนรู้:** ผู้เล่นได้ฝึกแก้โจทย์ฟิสิกส์ ม.ปลาย (กลศาสตร์ ไฟฟ้า คลื่น ความร้อน แสง ฟิสิกส์ยุคใหม่) ในบริบทเกมที่สนุกและแข่งขันได้

---

## 1. Tech Stack (ใช้ตามนี้)

| ส่วน | เทคโนโลยี | เหตุผล |
|------|-----------|--------|
| ภาษา | **TypeScript** (strict) | ลด bug, สำคัญมากเพราะ state เกมซับซ้อน |
| Build / Frontend | **Vite + React 18** | เร็ว, ผู้ใช้คุ้นเคย, deploy Vercel ง่าย |
| เรนเดอร์กระดาน + ตัวละคร | **Phaser 3** (ฝังเป็น React component) | เอนจินเกม 2D ที่ทำ sprite walk-cycle + tween เดินทีละช่อง + กล้องตามตัวละครได้ "สมจริง" ตามที่ต้องการ |
| UI / เมนู / โมดอล | **React + Tailwind CSS** | ทำ lobby, โมดอลโจทย์, การ์ดทรัพย์สิน |
| เรนเดอร์สมการ | **KaTeX** (`react-katex`) | โจทย์ฟิสิกส์มีสมการ ใช้ KaTeX render ($v = u + at$ ฯลฯ) |
| Realtime multiplayer | **Colyseus** (authoritative game server, Node + TypeScript) | ออกแบบมาเพื่อเกมกระดาน turn-based โดยเฉพาะ มี room + state sync schema + reconnection ในตัว |
| Animation UI | **Framer Motion** | ทรานสิชันโมดอล/การ์ด/ผลแพ้ชนะ |
| เสียง | **Howler.js** | SFX ลูกเต๋า/ก้าวเดิน/ซื้อสำเร็จ + เพลงพื้นหลัง |
| State ฝั่ง client | **Zustand** | sync state จาก server มาเก็บ + UI อ่านง่าย |
| Deploy frontend | **Vercel** (static SPA) | ผู้ใช้คุ้นเคย |
| Deploy game server | **Render / Railway** (free tier, รองรับ WebSocket ถาวร) | Vercel serverless ทำ WebSocket ค้างไม่ได้ ต้องแยก server |

> 🔒 **ตัดสินใจล็อกแล้ว (ห้ามเปลี่ยน):** ใช้ **Colyseus** เป็น authoritative game server เพราะกันโกงและจัดการเทิร์น 4 คนได้ดีที่สุด. **client → Vercel, server → Render** โดยให้สร้าง config deploy ครบในตัว: `render.yaml` (หรือ `Dockerfile`) สำหรับ server, `vercel.json` สำหรับ client, และ env `VITE_SERVER_URL` ชี้ไป server. ตอน dev ใช้ `localhost:2567`. ให้รองรับ `process.env.PORT` และ CORS ของ client origin ด้วย
>
> 🛟 **Local fallback (ต้องมี เพื่อให้รันรวดเดียวได้โดยไม่ต้องตั้ง cloud):** เกมต้องเล่นได้ครบบน `npm run dev` เครื่องเดียว — client เชื่อม Colyseus ที่ `ws://localhost:2567` อัตโนมัติ เปิดหลายแท็บก็เล่น 4 คนได้ทันที (ไม่ต้องสมัครบริการใด ๆ)
>
> ❗ **ห้ามใช้ฟอนต์/โฟลเดอร์ภาษาไทยเป็นชื่อไฟล์ asset หรือ path สำคัญ** — ตั้งชื่อไฟล์เป็น ASCII ทั้งหมด (กันปัญหา encoding บน Windows/OneDrive ที่เคยเจอ)

---

## 2. โครงสร้างโปรเจกต์ (Monorepo)

```
เกมเศรษฐีฟิสิกส์/
├── CODEX_WORKFLOW.md            ← ไฟล์นี้
├── package.json                 ← workspaces: ["client", "server", "shared"]
├── shared/                      ← โค้ดที่ client+server ใช้ร่วมกัน
│   ├── types.ts                 ← Player, Tile, Property, Question, GameState
│   ├── boardConfig.ts           ← นิยามกระดาน (ลำดับช่อง, ราคา, ค่าเช่า)
│   ├── gameRules.ts             ← logic บริสุทธิ์ (คำนวณค่าเช่า, เช็คชนะ ฯลฯ)
│   └── questions/               ← คลังโจทย์ฟิสิกส์ (JSON แยกตามหมวด)
│       ├── mechanics.json
│       ├── electricity.json
│       ├── waves.json
│       ├── heat.json
│       ├── optics.json
│       └── modern.json
├── server/                      ← Colyseus game server
│   ├── src/
│   │   ├── index.ts             ← bootstrap Colyseus
│   │   ├── rooms/GameRoom.ts     ← ห้องเกม (authoritative)
│   │   ├── schema/GameState.ts   ← Colyseus Schema (sync state)
│   │   └── logic/               ← import จาก shared/gameRules
│   └── package.json
└── client/                      ← Vite + React + Phaser
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx              ← router: Home → Lobby → Game → Result
    │   ├── net/colyseus.ts      ← เชื่อมต่อ server, sync → Zustand
    │   ├── store/gameStore.ts    ← Zustand
    │   ├── game/                ← Phaser
    │   │   ├── PhaserGame.tsx    ← React wrapper
    │   │   ├── scenes/BoardScene.ts  ← กระดาน + token + กล้อง
    │   │   ├── entities/Token.ts     ← ตัวละคร + walk-cycle
    │   │   └── camera/FollowCam.ts   ← กล้อง "ฉายภาพ" ตามตัวเดิน
    │   ├── ui/                  ← React UI overlay
    │   │   ├── screens/ (Home, Lobby, AvatarSelect, Result)
    │   │   ├── modals/ (QuestionModal, BuyModal, JailModal, TradeModal)
    │   │   └── components/ (DiceRoller, PlayerPanel, PropertyCard, Toast)
    │   └── assets/             ← ภาพจาก image2.0 (sprites, board, cards, ui)
    └── package.json
```

---

## 3. กติกาเกม (Game Design)

### 3.1 กระดาน
- กระดานสี่เหลี่ยม เดินวนตามเข็มนาฬิกา **28 ช่อง** (แนะนำ เพื่อให้รอบไม่ยาวเกินสำหรับเล่นออนไลน์ — ปรับเป็น 40 ได้ผ่าน `boardConfig.ts`)
- ประเภทช่อง:
  | ช่อง | ฟังก์ชัน |
  |------|----------|
  | **START / GO** | ผ่าน/หยุด รับเงิน +฿2,000 |
  | **ที่ดิน (Land)** | ซื้อได้ (ตอบโจทย์ฟิสิกส์) — ราคาถูก โจทย์ระดับง่าย |
  | **บ้าน (House)** | อัปเกรดจากที่ดินของตัวเอง — โจทย์ระดับกลาง |
  | **คอนโด (Condo)** | ทรัพย์สินกลุ่ม ค่าเช่าสูง — โจทย์ระดับกลาง-ยาก |
  | **โรงแรม (Hotel)** | อัปเกรดสูงสุด ค่าเช่าแพงสุด — โจทย์ระดับยาก |
  | **Physics Challenge ⚛️** | หยุดแล้ว **ต้องตอบโจทย์** ตอบถูก +เงินรางวัล / ตอบผิด → ติดคุกหรือหยุดเดิน 1 ตา |
  | **Chance / โอกาส** | จับการ์ดสุ่ม (เหตุการณ์ + บางใบมีโจทย์ฟิสิกส์) |
  | **ภาษี (Tax)** | จ่ายเงินเข้ากองกลาง |
  | **คุก (Jail)** | "แค่มาเยี่ยม" ถ้าเดินผ่าน / ถูกขังถ้าโดนสั่ง |
  | **Go To Jail** | เดินไปช่องคุกทันที |
  | **ฟรีปาร์กกิ้ง / กองกลาง** | ผู้หยุดได้เงินกองกลางที่สะสมจากภาษี |

### 3.2 เงื่อนไขฟิสิกส์ (หัวใจของเกม)
1. **ซื้อ/อัปเกรดทรัพย์สิน:** เปิด `QuestionModal` 1 ข้อ (ความยากตามราคาทรัพย์สิน) → ตอบถูกจึงจ่ายเงินซื้อได้ / ตอบผิดยกเลิกการซื้อรอบนี้ (เดินต่อรอบหน้าค่อยลองใหม่)
2. **หยุดบนช่อง Physics Challenge:** ต้องตอบโจทย์
   - ตอบถูก → รับเงินรางวัล (เช่น +฿1,000) และ/หรือ XP
   - ตอบผิด → **สุ่ม/บังคับผล:** "ถูกจับเข้าคุก" **หรือ** "หยุดเดิน 1 ตา" (กำหนดในการ์ดช่องนั้น)
3. **ตัวจับเวลา (Timer):** แต่ละโจทย์มีเวลาจำกัด (เช่น 30 วินาที) หมดเวลา = ตอบผิด
4. **ความยากผูกกับมูลค่า:** ที่ดินถูก = ง่าย, โรงแรม/คอนโด = ยาก (field `difficulty` ในแต่ละช่อง)

### 3.3 เศรษฐกิจเกม (เหมือน Monopoly)
- เงินเริ่มต้นคนละ **฿15,000**
- ทอยลูกเต๋า 2 ลูก, ทอยได้ "เลขคู่เหมือนกัน (doubles)" ได้ทอยซ้ำ (ครบ 3 ครั้งติด → เข้าคุก)
- หยุดบนทรัพย์สินคนอื่น → จ่ายค่าเช่า (ค่าเช่าเพิ่มตามระดับอัปเกรด house→condo→hotel)
- หยุดบนทรัพย์สินว่าง → เลือกซื้อ (ผ่านด่านโจทย์) หรือไม่ซื้อ
- **คุก:** ออกได้เมื่อ (ก) ทอยได้ doubles, (ข) จ่ายค่าปรับ ฿500, หรือ (ค) **ตอบโจทย์ฟิสิกส์ถูก** (กลไกพิเศษ — ฟิสิกส์ช่วยให้ออกจากคุกได้!)
- **ล้มละลาย** (เงินติดลบจ่ายไม่ได้) → ออกจากเกม ทรัพย์สินคืนสู่ธนาคาร
- **เงื่อนไขชนะ:** เหลือผู้เล่นคนสุดท้ายที่ไม่ล้มละลาย **หรือ** ครบจำนวนรอบ/เวลาที่ตั้งไว้ → ผู้มี **มูลค่าสุทธิ (เงิน + ทรัพย์สิน)** สูงสุดชนะ

### 3.4 ระบบ XP/รางวัลการเรียนรู้ (เพิ่มเติม — ช่วยให้เป็น "เกมการศึกษา")
- ตอบโจทย์ถูกสะสม XP, นับสถิติ "ตอบถูกกี่ %" แยกตามหมวดฟิสิกส์
- หน้าจบเกมสรุป: ใครตอบฟิสิกส์เก่งสุด (Physics MVP), หมวดที่ผู้เล่นพลาดบ่อย (ไว้ทบทวน)

---

## 4. โมเดลข้อมูล (Data Models — ไว้ใน `shared/types.ts`)

```ts
export type Difficulty = 'easy' | 'medium' | 'hard';
export type PhysicsTopic =
  | 'mechanics' | 'electricity' | 'waves' | 'heat' | 'optics' | 'modern';

export interface Question {
  id: string;
  topic: PhysicsTopic;
  difficulty: Difficulty;
  prompt: string;            // รองรับ LaTeX inline $...$
  choices: string[];         // 4 ตัวเลือก (รองรับ LaTeX)
  answerIndex: number;       // index คำตอบถูก
  explanation: string;       // เฉลย/วิธีทำ (โชว์หลังตอบ)
  timeLimitSec: number;      // เช่น 30
}

export type TileType =
  | 'start' | 'property' | 'challenge' | 'chance'
  | 'tax' | 'jail' | 'goToJail' | 'freeParking';

export type PropertyKind = 'land' | 'house' | 'condo' | 'hotel';

export interface Tile {
  index: number;
  type: TileType;
  name: string;
  // เฉพาะ property:
  kind?: PropertyKind;
  groupColor?: string;       // สีกลุ่มทรัพย์สิน
  price?: number;
  rentByLevel?: number[];    // ค่าเช่าตามระดับอัปเกรด
  difficulty?: Difficulty;   // ระดับโจทย์เวลาซื้อ
  ownerId?: string | null;
  level?: number;            // 0=ที่ดินเปล่า, 1=บ้าน, 2=คอนโด, 3=โรงแรม
  // เฉพาะ challenge:
  failPenalty?: 'jail' | 'skipTurn';
}

export interface Player {
  id: string;
  name: string;
  avatar: string;            // key sprite ที่เลือก
  money: number;
  tileIndex: number;
  inJail: boolean;
  jailTurns: number;
  skipNextTurn: boolean;
  bankrupt: boolean;
  xp: number;
  stats: Record<PhysicsTopic, { correct: number; total: number }>;
  connected: boolean;        // สำหรับ reconnection
}

export type GamePhase =
  | 'lobby' | 'rolling' | 'moving' | 'resolving_tile'
  | 'answering' | 'buying' | 'turn_end' | 'game_over';

export interface GameState {
  roomCode: string;
  players: Player[];
  tiles: Tile[];
  currentPlayerIndex: number;
  phase: GamePhase;
  dice: [number, number] | null;
  centerPot: number;         // กองกลาง
  turnCount: number;
  log: string[];             // ประวัติเหตุการณ์ (โชว์ใน UI)
  winnerId: string | null;
}
```

---

## 5. สถาปัตยกรรม Multiplayer (Online, ≤4 คน)

### 5.1 ฝั่ง Server (Colyseus — authoritative)
- 1 ห้อง = 1 `GameRoom` มี **roomCode 4–6 ตัวอักษร**
- Server เป็นเจ้าของ state ทั้งหมด (เลขเต๋า, เงิน, เจ้าของทรัพย์สิน, เฉลยโจทย์) — **client ห้ามคำนวณผลเอง** กันโกง
- **เฉลยคำตอบโจทย์อยู่ที่ server เท่านั้น** — client ขอ "โจทย์ (ไม่มี answerIndex)" แล้วส่ง index ที่เลือกกลับมาให้ server ตัดสิน
- Messages (client → server): `joinRoom`, `selectAvatar`, `ready`, `rollDice`, `answerQuestion(index)`, `decideBuy(bool)`, `payJail`, `endTurn`, `leave`
- Broadcast (server → clients): patch ของ `GameState` (Colyseus sync อัตโนมัติ) + event เฉพาะ เช่น `diceRolled`, `tokenMove(path)`, `questionResult`, `gameOver`
- **Turn timer:** ถ้าผู้เล่นไม่ทำในเวลา (เช่น 60 วิ) → auto end turn / นับว่าตอบผิด
- **Reconnection:** ใช้ `allowReconnection` ของ Colyseus, ผู้เล่นหลุดแล้วกลับเข้ามาด้วย sessionId เดิมได้ใน 60 วิ

### 5.2 ฝั่ง Client
- เชื่อม Colyseus → sync state เข้า Zustand → React/Phaser อ่านจาก store
- เมื่อได้ event `tokenMove(path)` → สั่ง Phaser เล่นอนิเมชันเดิน (ดู Phase 2)
- UI ทั้งหมด render จาก server state เท่านั้น (single source of truth)

### 5.3 Flow หนึ่งเทิร์น (State Machine)
```
rolling → (กดทอย) → diceRolled → moving (อนิเมชันเดิน)
   → resolving_tile:
        • ทรัพย์สินว่าง → buying → answering(โจทย์) → ถูก:จ่ายเงินเป็นเจ้าของ / ผิด:ยกเลิก
        • ทรัพย์สินคนอื่น → จ่ายค่าเช่าอัตโนมัติ
        • challenge → answering → ถูก:รับรางวัล / ผิด:jail|skipTurn
        • chance → จับการ์ด (บางใบ answering)
        • tax → จ่ายเข้ากองกลาง
        • goToJail → เดินเข้าคุก
   → turn_end → เช็คล้มละลาย/ชนะ → ส่งเทิร์นถัดไป
```

---

## 6. การสร้าง Asset ด้วย image2.0 (Phase 6)

ภาพจริงทั้งหมด **สร้างด้วย image2.0** ใช้ **สไตล์เดียวกันทั้งเกม**: การ์ตูน 2D ไอโซเมตริก/แบนสดใส โทนสนุก ธีม "เมืองวิทยาศาสตร์/ฟิสิกส์" พื้นหลังโปร่งใส (PNG).

> 🛟 **โหมด one-shot — กันสะดุดที่ asset (ทำตามนี้ใน Phase 6):** เนื่องจาก Codex เรียก image2.0 เองตอนรันไม่ได้ ให้ทำ **ระบบ asset ที่เกมเล่นได้ทันทีด้วย placeholder** ก่อน แล้วผู้ใช้ค่อยเอาภาพ image2.0 มาวางทับ:
> 1. สร้าง **`client/src/assets/manifest.json`** — แม็ป key → path + frame config (frame size, จำนวนเฟรม, fps) ของทุก asset
> 2. สร้าง **`client/src/assets/IMAGE_PROMPTS.md`** — รวมพรอมป์ image2.0 ของทุกไฟล์ (จากตาราง 6.1) + ขนาด/อัตราส่วนที่ต้องการ + ชื่อไฟล์ปลายทางตรงกับ manifest เป๊ะ ๆ เพื่อให้ผู้ใช้ generate แล้ววางทับได้เลย
> 3. ทำ **placeholder generator อัตโนมัติ** (โค้ด เช่น วาด rect สี + ตัวอักษร/ไอคอนลง canvas, walk-cycle เป็นวงกลมมีขามือเด้ง) ให้ทุก key ใน manifest มีภาพชั่วคราวเสมอ → **เกมจึงเล่นครบทุกกลไกได้แม้ยังไม่มีภาพจริง**
> 4. ตัวโหลด asset: ถ้าไฟล์จริงตาม manifest มีอยู่ → ใช้ภาพจริง, ถ้าไม่มี → fallback ไป placeholder อัตโนมัติ (ไม่ crash)

### 6.1 รายการ Asset + ตัวอย่างพรอมป์
| Asset | จำนวน | ตัวอย่างพรอมป์ image2.0 |
|-------|-------|--------------------------|
| **กระดานเกม** | 1 | "Top-down 2D Monopoly-style game board, square loop of 28 tiles, vibrant physics-themed city, cartoon flat style, clean labeled tiles, soft shadows, high detail, transparent edges" |
| **ตัวละคร 4 ตัว (sprite sheet เดิน)** | 4 | "2D cartoon character walk-cycle sprite sheet, 8 frames, side + front + back views, [scientist boy / scientist girl / robot / astronaut], consistent style, transparent background, even spacing for animation" |
| **token ย่อ (หมาก)** | 4 | "Small cute chibi token of [character] for board game piece, transparent background" |
| **การ์ดทรัพย์สิน** | 4 ชนิด | "Property card art: [empty land plot / small house / modern condo / luxury hotel], cartoon flat style, transparent background" |
| **ลูกเต๋า** | 1 ชุด | "3D-looking cartoon dice faces 1–6, glossy, transparent background, sprite sheet" |
| **ไอคอนช่องพิเศษ** | ~6 | "Cartoon icons: jail bars, atom/physics-challenge ⚛️, chance question mark, tax coins, GO arrow, free parking — consistent flat icon set, transparent" |
| **การ์ด Chance/โอกาส** | 1 หลัง | "Game chance card back, physics theme, cartoon, transparent" |
| **พื้นหลังเมนู/lobby** | 2–3 | "Game lobby background, physics laboratory city skyline, cartoon, wide 16:9" |
| **ปุ่ม/กรอบ UI** | ชุด | "Cartoon game UI kit: buttons, panels, badges, coin & XP icons, transparent" |
| **เอฟเฟกต์** | 2–3 | "Confetti burst, correct/wrong answer effects, coin sparkle, transparent sprite sheet" |

### 6.2 ข้อกำหนดเทคนิคของ asset
- Sprite เดิน: ทำเป็น **sprite sheet** เฟรมเท่ากัน (เช่น 64×64 หรือ 128×128 ต่อเฟรม) เพื่อ Phaser ทำ animation ได้ — ระบุ frame size ในชื่อไฟล์ เช่น `hero_walk_128.png`
- ตั้งชื่อไฟล์ ASCII ทั้งหมด, เก็บ manifest ใน `assets/manifest.json` (mapping key → path + frame config)
- ถ้า image2.0 สร้าง sprite sheet ที่ระยะห่างเฟรมไม่เท่า → ให้ตัด/จัดระยะใหม่ หรือสร้างเป็นเฟรมแยกแล้วประกอบ

---

## 7. อนิเมชันการเดินแบบสมจริง (หัวใจที่ผู้ใช้ขอ — Phase 2)

เมื่อทอยลูกเต๋าได้แต้ม N เช่น 5:
1. **เริ่ม "ฉายภาพ":** กล้อง Phaser **ซูม/แพนเข้าหา token ที่เป็นผู้เล่นปัจจุบัน** (FollowCam)
2. **เดินทีละช่อง:** วน 1..N ต่อช่อง:
   - เล่น **walk-cycle animation** (sprite sheet เดิน) หันหน้าไปทิศที่เดิน (ขึ้น/ลง/ซ้าย/ขวา ตามมุมกระดาน)
   - **tween** ตำแหน่ง token จากช่องปัจจุบัน → ช่องถัดไป (เช่น 350ms/ช่อง, ease)
   - เล่น SFX เสียงก้าวเดิน + เด้งตัวเล็กน้อย (squash/stretch ให้ดูมีน้ำหนัก)
   - อัปเดต "ตัวนับก้าว" บนจอ (เช่น 3/5)
   - หยุดผ่าน START → เด้งเอฟเฟกต์ +เงิน
3. **ถึงปลายทาง:** token เล่นท่า idle, กล้อง **แพนกลับ** มุมกว้าง, แล้วเข้าสู่ `resolving_tile`
4. รองรับ **เดินถอยหลัง / วาร์ปเข้าคุก** (กรณีการ์ดสั่ง) ด้วยอนิเมชันที่เหมาะสม
5. ระหว่างอนิเมชัน **ทุก client เห็นพร้อมกัน** (เล่นจาก event `tokenMove(path)` ของ server) และล็อกอินพุตจนเดินจบ

> เคล็ดลับให้ "สมจริง": ใช้เงาใต้ตัว (drop shadow ellipse), ความเร็วเดินคงที่, หันหน้าตามทิศจริง, มี easing ตอนออกตัว/หยุด, และกล้องตามแบบ lerp นุ่ม ๆ ไม่กระชาก

---

## 8. หน้าจอ / UX (ทำด้วย React overlay เหนือ Phaser)

1. **Home** — โลโก้, ปุ่ม "สร้างห้อง" / "เข้าร่วมห้อง" (กรอก roomCode), ตั้งค่า (เสียง/ภาษา)
2. **Lobby** — แสดง roomCode + ปุ่มแชร์, รายชื่อผู้เล่น (≤4), เลือก **avatar**, ปุ่ม "พร้อม", host กด "เริ่มเกม"
3. **เกมหลัก** — กระดาน Phaser ตรงกลาง + overlay:
   - แผงผู้เล่น 4 คน (ชื่อ/เงิน/avatar/ตาใคร) มุมจอ
   - ปุ่ม **ทอยลูกเต๋า** (active เฉพาะตาเรา) + อนิเมชันเต๋า
   - Log เหตุการณ์ + Toast แจ้งเตือน
4. **QuestionModal** — โจทย์ฟิสิกส์ (render KaTeX), 4 ตัวเลือก, **timer แบบวงกลมนับถอยหลัง**, หลังตอบโชว์ ✓/✗ + เฉลย
5. **BuyModal** — การ์ดทรัพย์สิน (ราคา/ค่าเช่า/ระดับ) + ปุ่ม "ซื้อ (ต้องตอบโจทย์)" / "ไม่ซื้อ"
6. **JailModal** — ตัวเลือกออกจากคุก: ทอย doubles / จ่ายปรับ / **ตอบโจทย์ฟิสิกส์**
7. **TradeModal** (เพิ่มเติม, optional) — แลกทรัพย์สิน/เงินระหว่างผู้เล่น
8. **Result** — อันดับ, มูลค่าสุทธิ, **Physics MVP**, สถิติตอบถูกแยกหมวด, ปุ่ม "เล่นอีกครั้ง"

**Responsive:** เล่นได้ทั้ง desktop และมือถือ (กระดานปรับ scale, ปุ่มทอยใหญ่พอแตะ). ทำเป็น **PWA** (ติดตั้งหน้าจอได้, มี manifest + service worker — ระวัง cache sw.js อย่า cache อย่างถาวร)

---

## 9. คลังโจทย์ฟิสิกส์ (Phase 3)

- เก็บเป็น JSON ใน `shared/questions/<topic>.json` ตามสคีมา `Question`
- **อย่างน้อย 60 ข้อ** (6 หมวด × 3 ระดับ × ≥3–4 ข้อ) ตอนเริ่ม แล้วขยายได้
- หมวด: กลศาสตร์, ไฟฟ้า-แม่เหล็ก, คลื่น-เสียง, ความร้อน-แก๊ส, แสง-ทัศนศาสตร์, ฟิสิกส์ยุคใหม่ (อะตอม/นิวเคลียร์/ควอนตัม)
- โจทย์ระดับ ม.ปลาย ไทย, ภาษาไทย, มีสมการ LaTeX, มีเฉลยพร้อมวิธีคิดสั้น ๆ
- ทำสคริปต์ตรวจสอบ (`validateQuestions.ts`): เช็คว่าทุกข้อมี `answerIndex` ถูก range, ไม่มี id ซ้ำ, ตัวเลือกครบ 4
- ตัวอย่าง 1 ข้อ:
```json
{
  "id": "mech-easy-001",
  "topic": "mechanics",
  "difficulty": "easy",
  "prompt": "รถเริ่มจากหยุดนิ่ง ความเร่ง $a = 2\\,\\text{m/s}^2$ หลังจาก $3\\,\\text{s}$ มีความเร็วเท่าใด?",
  "choices": ["$3\\,\\text{m/s}$", "$6\\,\\text{m/s}$", "$9\\,\\text{m/s}$", "$12\\,\\text{m/s}$"],
  "answerIndex": 1,
  "explanation": "$v = u + at = 0 + 2(3) = 6\\,\\text{m/s}$",
  "timeLimitSec": 30
}
```

---

## 10. แผนการพัฒนาแบบ Phase (ลำดับการ build รวดเดียว — Codex ทำต่อเนื่อง)

> **กฎการทำงาน (ONE-SHOT):** ทำ Phase 0 → 8 **ต่อเนื่องรวดเดียว ไม่หยุดรอไฟเขียว**. แต่ละ Phase = 1 commit (`feat(phaseN): ...`). จบ Phase ให้ **self-verify ตาม DoD เอง** (รัน/เทสต์ผ่าน) แล้วไป Phase ถัดไปทันที. ถ้าติดให้แก้เองด้วย default ที่สมเหตุสมผล (จด `DECISIONS.md`). ปิดท้ายอัปเดต `README.md` (วิธีรัน/เทสต์/deploy) ให้ครบ.

### Phase 0 — Scaffold & เครื่องมือ
- ตั้ง monorepo (client/server/shared), TypeScript strict, ESLint+Prettier, Tailwind, โครงโฟลเดอร์ตามข้อ 2
- **DoD:** `npm run dev` เปิดหน้า Home เปล่า ๆ ได้ทั้ง client; server Colyseus รันที่ localhost ได้

### Phase 1 — Core เกมแบบ local (ยังไม่ออนไลน์)
- `boardConfig.ts` (28 ช่อง), `gameRules.ts`, render กระดานด้วย Phaser แบบ static, ทอยเต๋า, เดิน token (ยังไม่มี walk-cycle ก็ได้ แค่ขยับ), ซื้อ/ค่าเช่า/คุก/ล้มละลาย/ชนะ ครบในเครื่องเดียว (hotseat 4 คนสลับกัน)
- **DoD:** เล่นจบเกมแบบ hotseat 4 คนได้ มีผู้ชนะ

### Phase 2 — อนิเมชันการเดินแบบสมจริง
- ใส่ walk-cycle sprite (placeholder ก่อนได้), tween เดินทีละช่อง, FollowCam ซูม/แพนตามตัว, SFX ก้าวเดิน, ตัวนับก้าว, ล็อกอินพุตระหว่างเดิน (ตามข้อ 7)
- **DoD:** ทอยแล้วเห็นตัวละครเดินทีละช่องลื่นไหล กล้องฉายตามจริง

### Phase 3 — ระบบโจทย์ฟิสิกส์
- คลังโจทย์ JSON ≥60 ข้อ + `validateQuestions.ts`, `QuestionModal` (KaTeX + timer + เฉลย), ผูกเงื่อนไข: ซื้อทรัพย์สินต้องตอบถูก, ช่อง challenge ตอบผิด→คุก/หยุดเดิน, ออกจากคุกด้วยการตอบโจทย์
- **DoD:** กลไกฟิสิกส์ทำงานครบทั้ง 3 จุด (ซื้อ/challenge/คุก) + เฉลยแสดงถูกต้อง

### Phase 4 — เศรษฐกิจเต็มรูปแบบ + การ์ด
- doubles, การ์ด Chance/โอกาส, ภาษี+กองกลาง, อัปเกรด house→condo→hotel, ค่าเช่าตามระดับ, ระบบ XP/สถิติ, หน้า Result
- **DoD:** กติกา Monopoly ครบ + หน้าสรุปผลมี Physics MVP/สถิติ

### Phase 5 — Multiplayer ออนไลน์ (≤4 คน)
- Colyseus `GameRoom` + Schema, ย้าย logic เป็น authoritative, Lobby (สร้าง/เข้าร่วมด้วย roomCode), avatar select, turn timer, reconnection, broadcast `tokenMove` ให้ทุกคนเห็นอนิเมชันพร้อมกัน, ป้องกันโกง (เฉลยอยู่ server)
- **DoD:** เปิด 4 แท็บ/อุปกรณ์ เข้าห้องเดียวกัน เล่นจบเกมพร้อมกันได้, หลุดแล้ว reconnect ได้

### Phase 6 — ระบบ Asset (placeholder + manifest + prompt sheet)
- ทำ `assets/manifest.json`, `assets/IMAGE_PROMPTS.md`, placeholder generator อัตโนมัติ และ asset loader ที่ fallback ได้ (ตามกรอบ 🛟 ในข้อ 6) — sprite sheet ต้อง animate ใน Phaser ได้
- **DoD:** เกมเล่นครบทุกกลไกด้วย placeholder; วางไฟล์จริงตาม manifest แล้วภาพเปลี่ยนเป็น image2.0 ทันทีโดยไม่แก้โค้ด; `IMAGE_PROMPTS.md` ครบทุก asset

### Phase 7 — เสียง / polish / responsive / PWA
- Howler (เพลงพื้นหลัง + SFX: เต๋า/ก้าว/ซื้อ/ถูก-ผิด/ชนะ), Framer Motion transitions, ปรับ responsive มือถือ, ทำ PWA, หน้าโหลด, i18n (ไทยหลัก/อังกฤษเสริม)
- **DoD:** เล่นบนมือถือลื่น, ติดตั้ง PWA ได้, มีเสียงครบ

### Phase 8 — ทดสอบ + เตรียม Deploy (deploy-ready)
- unit test `gameRules` + `validateQuestions` (vitest), ทดสอบ flow ห้องจริงด้วยหลายแท็บ, ทำ config ครบ: `vercel.json` (client), `render.yaml`/`Dockerfile` (server), `.env.example` (`VITE_SERVER_URL`, `PORT`, allowed origins), เขียน `README.md` ขั้นตอน deploy แบบ copy-paste ได้
- **DoD:** เทสต์ผ่านทั้งหมด; `npm run dev` รากเล่น 4 แท็บจบเกมได้; มี config + README พร้อม deploy (Codex ไม่มี credential cloud จึง **เตรียมให้พร้อม push ปุ่มเดียว** — ผู้ใช้กด deploy เองตาม README)

---

## 11. เกณฑ์ตรวจรับรวม (Acceptance Criteria)
- [ ] เล่นออนไลน์พร้อมกันได้สูงสุด 4 คนในห้องเดียว ด้วย roomCode
- [ ] กติกาเศรษฐีครบ: ทอยเต๋า, เดิน, ซื้อ/ค่าเช่า/อัปเกรด, คุก, ภาษี, การ์ด, ล้มละลาย, ชนะ
- [ ] **ซื้อทรัพย์สินต้องตอบโจทย์ฟิสิกส์ถูก 1 ข้อ**
- [ ] **หยุดช่อง challenge ตอบผิด → ติดคุก/หยุดเดิน 1 ตา**
- [ ] โจทย์ render สมการ KaTeX + มี timer + มีเฉลย
- [ ] **อนิเมชันเดินสมจริง** — กล้องฉายตามตัวเดินทีละช่อง ทุก client เห็นพร้อมกัน
- [ ] ระบบ asset พร้อม: เล่นได้ด้วย placeholder + วางภาพ image2.0 ทับได้ทันทีตาม manifest + มี `IMAGE_PROMPTS.md` ครบ
- [ ] เฉลยอยู่ server เท่านั้น (กันโกง), reconnect ได้
- [ ] เล่นได้ทั้ง desktop + มือถือ (PWA), มีเสียง
- [ ] หน้า Result สรุปผู้ชนะ + สถิติฟิสิกส์
- [ ] `npm run dev` รากเดียวเล่น 4 แท็บได้โดยไม่ต้องตั้ง cloud; มี config + README พร้อม deploy

---

## 12. สิ่งที่เพิ่มเติมให้ (นอกเหนือจากที่ผู้ใช้ขอ — เพื่อความสมบูรณ์)
1. **ระบบ XP + สถิติการเรียนรู้** และ **Physics MVP** ตอนจบเกม (ทำให้เป็นเกมการศึกษาจริง)
2. **ออกจากคุกด้วยการตอบโจทย์ฟิสิกส์** (เชื่อมกลไกฟิสิกส์เข้ากับ Monopoly อย่างมีความหมาย)
3. **Turn timer + auto-skip + reconnection** (จำเป็นมากสำหรับเกมออนไลน์จริง)
4. **กันโกง:** เฉลยอยู่ server, client เป็นแค่หน้าจอ
5. **การ์ด Chance** ที่บางใบเป็นโจทย์ฟิสิกส์ (เพิ่มความหลากหลาย)
6. **TradeModal** แลกเปลี่ยนทรัพย์สิน (ความลึกแบบ Monopoly)
7. **PWA + responsive + i18n + เสียง** (ประสบการณ์สมบูรณ์)
8. **คลังโจทย์ขยายง่าย (JSON)** + สคริปต์ validate (ครูเพิ่มข้อสอบเองได้)
9. **AI bot (optional, อนาคต)** เติมที่นั่งว่างให้ครบ 4 เมื่อคนไม่พอ

---

### 📌 คำสั่งเริ่มต้นสำหรับ Codex (วางอันนี้ให้ Codex)
> "อ่าน `CODEX_WORKFLOW.md` ทั้งไฟล์ แล้ว **build เกมนี้ให้เสร็จรวดเดียวจาก Phase 0 → 8 แบบต่อเนื่อง ไม่ต้องหยุดถามหรือรอไฟเขียวระหว่าง Phase**. แต่ละ Phase ให้ self-verify ตาม DoD เอง แล้ว commit (`feat(phaseN): ...`) ก่อนไปต่อทันที. ถ้า spec ไม่ชัดให้ตัดสินใจด้วย default ที่สมเหตุสมผล จดไว้ใน `DECISIONS.md`. **ห้ามบล็อกที่ asset** — ทำ placeholder + manifest + `IMAGE_PROMPTS.md` ให้เกมเล่นได้ก่อน. ใช้ TypeScript strict, ชื่อไฟล์/path เป็น ASCII, เกมต้องเล่น 4 แท็บได้ด้วย `npm run dev` รากเดียวโดยไม่ต้องตั้ง cloud. จบแล้วเขียน `README.md` (รัน/เทสต์/deploy) + config deploy ให้ครบ แล้วสรุปสิ่งที่ทำกับวิธีเล่น"

---

## 13. สรุปการตัดสินใจที่ล็อกแล้ว (Locked Decisions)
| หัวข้อ | ค่าที่ใช้ |
|--------|-----------|
| โหมด build | **ONE-SHOT** — Phase 0→8 ต่อเนื่อง ไม่รอไฟเขียว |
| Realtime | **Colyseus** authoritative server (local `localhost:2567`, prod → Render) |
| Deploy | client → **Vercel**, server → **Render** (มี config + README, ผู้ใช้กด deploy เอง) |
| จำนวนช่องกระดาน | **28** (ปรับได้ใน `boardConfig.ts`) |
| ผู้เล่น | สูงสุด **4** คน/ห้อง ด้วย roomCode |
| Asset | image2.0 + ระบบ placeholder/manifest/prompt sheet (เกมเล่นได้ก่อนมีภาพจริง) |
| ภาษา UI | ไทยหลัก, อังกฤษเสริม (i18n) |
