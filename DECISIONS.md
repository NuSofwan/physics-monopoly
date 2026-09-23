# Decisions

## D-001 — ขอบเขตและสถานะเริ่มต้น (Phase 0)

- วันที่บันทึก: 22 กันยายน 2026
- เอกสารหลักคือ `TERRA_WORKFLOW.md`; ใช้แทน `CODEX_WORKFLOW.md` เมื่อข้อกำหนดขัดกัน
- สถานะเริ่มต้นเป็นเกม Phaser แบบหลายคนขั้นต้นเท่านั้น ไม่อ้างว่าเป็น 3 มิติจริง, persistence, OCR, QR ที่สแกนได้, หรือเส้นทางครูที่พร้อมใช้
- งานแก้ค้างใน `client/src/App.tsx`, `client/src/game/PhaserGame.tsx`, `client/src/game/scenes/BoardScene.ts`, `client/src/styles.css`, `server/src/index.ts`, และ `server/src/logic/questions.ts` ถูกเก็บไว้และจะไม่ reset หรือเขียนทับโดยไม่มีเหตุผล

## D-002 — สัญญาโจทย์สาธารณะ

- `Question` และ answer key เป็น server-only content
- payload ที่ส่งก่อนปิดหน้าต่างตอบใช้ allowlist (`id`, `topic`, `difficulty`, `prompt`, `choices`, `timeLimitSec`) เท่านั้น
- คำอธิบาย เฉลย และคำตอบถูกส่งได้เฉพาะ event reveal หลัง server ปิดรอบตอบ ไม่อยู่ใน game snapshot, import ที่ client ใช้, source map, หรือ URL สาธารณะ

## D-003 — ตัวตนและ reconnect

- ใช้ `participantId` ที่คงอยู่แยกจาก Colyseus `sessionId`
- reconnect ต้องใช้ token สุ่มที่ server ออกให้และเก็บเฉพาะ `sessionStorage`; ชื่อเล่นและรหัสห้องไม่ใช่สิทธิ์เข้าห้องเดิม
- ใน lobby เมื่อออกห้องให้คืนที่นั่ง; เมื่อเกมเริ่มแล้วจึงกันที่นั่งตาม token และนโยบาย reconnect ใน Phase 6

## D-004 — กติกา classroom เริ่มต้น

- ห้องเริ่มได้ตั้งแต่ผู้เล่นมนุษย์ 1 คน โดย host ต้องเป็นผู้กดและผู้เล่นที่เชื่อมต่อทุกคนต้องพร้อม
- ไม่เติม bot อัตโนมัติ และปิด trade/auction ใน classroom ruleset จนกว่าจะมีสัญญาสองฝ่ายและการตรวจสิทธิ์ครบ
- คำสั่งที่เปลี่ยน state จะเพิ่ม request ID และตรวจชนิด/ขอบเขต/phase ก่อนใช้จริงใน Phase 1–5

## D-005 — Renderer และ dependency plan

- คง Vite + React 18 + TypeScript และ Colyseus 0.16 ตาม package lock ปัจจุบัน
- หากติดตั้ง 3D จะตรึง `three` + `@react-three/fiber` major ที่รองรับ React 18 (Fiber 8) และทำผ่าน feature flag โดยไม่รัน Phaser/WebGL สองตัวพร้อมกัน
- Phaser คือ fallback ระหว่างย้าย renderer ไม่ใช่งานภาพส่งมอบสุดท้าย

## D-006 — Persistence และบริการภายนอก

- ยังไม่มี PostgreSQL, teacher authentication, private object storage หรือ OCR adapter ใน repo จึงไม่อ้างว่าข้อมูลถาวร/แยกสิทธิ์ครู/PDF import พร้อมใช้
- Phase 3 จะเพิ่ม adapter และ local configuration ก่อนเลือกผู้ให้บริการจริง; deployment/staging/public QR ต้องมี URL ที่เข้าถึงได้จริงจึงจะตรวจรับได้

## D-007 — Assets

- asset manifest เดิมและภาพ placeholder เป็นเพียงชั่วคราว ไม่เป็นหลักฐานว่าด่านหรือ asset 3D เสร็จ
- asset ส่งมอบต้องเป็นโมเดล 3 มิติที่มี license manifest, source/editable pipeline, readiness `approved` และ fallback ที่ทดสอบได้

## D-008 — Review remediation: identity, replay and reveal

- หนึ่ง participant มี connection ที่ใช้งานได้หนึ่งรายการ ตรวจทั้ง onAuth และ onJoin เพื่อกัน race; reconnect ไม่ใช้ชื่อเล่นแทน token
- เตะผู้เล่นต้องลบ mapping/revoke token และปิด transport เพื่อคืนที่นั่งจริง
- RequestGate เก็บ request IDs ตลอดอายุห้อง: สูงสุด 10,000 ต่อคนแล้วปฏิเสธคำสั่งใหม่แบบ fail-closed ไม่ล้างประวัติ; จำกัด 60 intents ต่อ 10 วินาที
- ผลตอบผูก questionId; snapshot ใหม่และ result event เก่าต้องไม่ทำให้คำถามถัดไปถูกล็อก
- ช่วงอ่านเฉลย 10 วินาทีและช่วงเลือกซื้อ 15 วินาทีมี server deadline; ปฏิเสธคำตอบ/ธุรกรรมที่มาถึงหลัง deadline แม้ timer callback ยังไม่ทำงาน
- การป้องกันซ้ำยังอยู่ใน process memory ไม่ใช่หลักฐานว่าผ่าน restart recovery

## D-009 — Bangkok renderer hardening

- lazy-load Three.js และ Phaser แยกกัน; มี accessible HTML board ใช้ authoritative state เดียวกัน
- Three.js runtime 0.169 ใช้ @types/three 0.169 ใน devDependencies
- เต๋ามี 6 หน้า 1–6 จุด พร้อมทดสอบ quaternion ให้ค่าที่ server สุ่มหงายขึ้น
- แยกแนวเดินตัวหมากจาก footprint อาคาร, คง 28 ตำแหน่งและ 4 ที่ยืนต่อช่อง
- ตัวละคร 8 แบบเป็น procedural prototypes ที่มีอุปกรณ์/รูปทรงต่างกัน ยังไม่ใช่ approved final assets 24 แบบ
- เปลี่ยน AudioContext จากสร้างใหม่ทุกเสียงเป็นใช้ร่วมหนึ่งชุด พร้อม mute และ disconnect nodes
- browser QA ใช้ production preview เพื่อไม่ให้ HMR รีเซ็ต store กลางเกม; การทดสอบที่ session สูญหายไม่นับเป็น full-game acceptance

## D-010 — Patched networking and reproducible browser verification

- Replace the unused umbrella Colyseus package with `@colyseus/core` 0.17.51, ws transport 0.17.13 and SDK 0.17.43; update Room state generic and server listen lifecycle together.
- Vitest 4.1.11 and Vite's esbuild override ^0.28.1 remove the reported dependency advisories; no blind nanoid 2→3 override (incompatible default export).
- Keep four browser contexts owned by one Playwright process after agent-browser daemon/session loss in the prior run. No private game state, clock acceleration, reduced turn limit or answer-key lookup is used in full-game acceptance.
- Use `/asset-lab` only for explicitly labeled visual inspection; its scene is not a live game and does not replace multiplayer evidence.

## D-011 — Local PostgreSQL and teacher boundary

- Use real PostgreSQL 18.4 via embedded-postgres binaries for development, bound to 127.0.0.1:55432. No Windows service, system user, paid account or workspace rename.
- Windows native initdb needs both binary/share/data paths addressed through ASCII 8.3 aliases in this Thai workspace. Start/stop uses pg_ctl with hidden windows and explicit local data directory.
- SQL migrations are transactional, advisory-locked and checksum-verified. Published versions have a database trigger preventing mutation.
- Teacher session cookies are HttpOnly/SameSite, server sessions are hash-indexed and expiring; unsafe requests require an allowed Origin. OIDC uses authorization code + PKCE/state/nonce and a configured teacher subject allowlist. Dev identities A/B are explicitly local-only and never enabled in production.
- Activity rooms pin a published version and require the activity invitation for new joins. Classroom snapshots are committed before broadcasts. This does not yet implement process-restart recovery or a persistent request ledger.

## D-012 — Private PDF pipeline and numeric review

- PDF.js text/rendering and bundled Thai/English Tesseract data run in a bounded worker subprocess, never in the game event loop. No third-party OCR upload or instruction execution from PDFs.
- Uploads are bounded to 20 MB/80 pages, three queued jobs per teacher, one buffered upload per teacher and four globally. Cancellation/retry uses a run token so superseded workers cannot commit drafts.
- OCR is not authoritative. Only Thai inter-character whitespace is normalized; misread digits/units require teacher correction. Split/merge produces incomplete unapproved drafts and preserves parked originals.
- Crops are immutable private PNGs with alt text and explicit teacher confirmation that no answer is included. The current question gets a 180-second signed capability; source PDFs/pages remain teacher-only.
- Numeric answers use a fixed dimensional unit registry, bounded decimal/scientific parsing and explicit tolerances. No expression eval or client grading.
- Local backups include DB rows plus private PDF/page/crop checksums and restore to new destinations. Teacher login sessions are not restored.

## D-013 — Classroom rules separated from legacy free play

- ClassroomGame owns the group-learning state machine; legacy free play remains available to preserve the previously verified complete game.
- All players see one question per turn. First answers, hints and retry receipts are private; the reveal barrier closes all first/retry windows before explanations.
- Classroom board/economy v1 has 28 spaces with no jail/elimination, 15-second roll/action deadlines, fixed 20-second retry and 10-second reveal. Passing does not skip learning.
- XP, first/repeat exposure, retries and not-attempted/interrupted outcomes are stored separately. Game wealth excludes XP and deducts support debt; solo results do not claim a competitive win.
- Six project-authored 30-question numeric practice templates are explicitly demo/review-required, not teacher-certified assessments. Publication still requires individual approval.

## D-014 — Durable identity, recovery, reporting and release gates

- Single-use 120-second join tickets bind assignment/name/avatar. Rejoin checks application credentials and persisted seat; framework room IDs are rediscovered after restart. SDK automatic reconnect is disabled in favor of the application policy.
- One database writer lease; joins/leaves and game intents share a serial queue. Checkpoints commit before public/private acknowledgements. Request replay ledger and learning attempts survive restarts.
- Teacher and personal objective reports derive from immutable version + actual attempts, exclude repeated exposure from first metrics, and distinguish interruption/non-attempt. Paused time is subtracted from response timing. Stable choice IDs are accepted; positional legacy clients remain compatible when no conflicting ID is supplied.
- Extra-time multiplier 1/1.5/2 is activity-wide, affects first/retry windows only, and never changes difficulty/XP. Default retry remains 20 seconds; reveal 10 seconds.
- Procedural 12/24 assets stay review_required despite passing technical scene budgets. Retained user artwork is not assumed licensed. No paid assets or third-party OCR service were used.
- Retention policy is visible and owner-confirmed. Deletion removes only scoped records after room/import guards, and exact private filenames enter a durable cleanup queue; no recursive directory delete. Production backups/retention require operator configuration.
- Local 30-minute load and 4-browser full-game success do not replace physical-device, memory-soak, real OIDC, staging or teacher-pilot approval. Release documentation states these gates explicitly.

## D-015 — Verification-driven presentation and worker refinements

- Separate lazy KaTeX rendering from the lobby bundle. Keep server-owned movement/dice; queue actual tile steps and calculate speed from route length so long rolls finish within the movement window.
- A continuous raised walking ring supports all four seats. Left/right lane rotation is outward; geometry tests include balcony clearance. Construction animates for 1.8 seconds; reduced motion remains available.
- Record actual visible geometry counts (including instances, excluding hidden batch inputs) for 133 items; canonical LF source hashes keep manifest validation reproducible across Windows/Linux. Distinct local architecture does not automatically grant final-art approval.
- Worker cancellation polling is scoped to one child process with single-flight polling and listener/timer cleanup, preventing a late response from killing a subsequent PDF job.
- Game results use a scrollable focus-contained dialog; real WebGL context loss switches to the same-state HTML board. CSV download, 150% text and mobile result layouts are browser-verified, not a claim of screen-reader or physical Android acceptance.
- Reports use the mathematical median for even-sized samples. Personal practice recommendations preserve first exposure instead of being overwritten by repeated questions. Empty disposed lobbies become abandoned so they do not block explicit retention operations.
- Local development starts the PDF worker with the API/client and waits for database-ready API state. Real OIDC/staging, external backup expiration and classroom validation remain explicit operator gates.
