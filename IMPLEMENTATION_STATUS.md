# Implementation status

## Current continuation — 23 September 2026

**ยังไม่รับรองว่าเสร็จครบ Phase 0–10 / Definition of Done** — ระบบหลักใช้งานและทดสอบในเครื่องแล้ว รวมหนึ่งชั่วโมง soak แต่ยังมีเกณฑ์ตรวจรับภาพ/อุปกรณ์จริง/staging และ coverage บางข้อที่ไม่ผ่านการยืนยัน

| Phase | Latest status | Evidence / remaining gate |
|---|---|---|
| 0–2 | locally verified | Preserved prior work, security baseline, real 3D, 4 browser contexts finish a complete game |
| 3 | core locally verified | PostgreSQL, teacher A/B ACL, immutable versions, join/rejoin tickets, activity/map settings; real OIDC and cross-device QR remain |
| 4 | core locally verified | Thai text + scanned PDF/OCR, source preview, private crop, cancel/retry, split/merge/reject, approval and browser grading; complex OCR always needs human review |
| 5 | locally verified | Group answers/hints/retry/reveal, non-elimination economy, timed finish, objectives/attempts, repeated-exposure separation; 15-minute 4-browser games pass |
| 6 | locally verified | Serialized lifecycle/commands, durable checkpoints, host transfer, two real process restarts, 30/125-second interruptions, 200–300 ms RTT, actual 60-second pause and 20-second frozen browser tab |
| 7 | implemented, review_required | 12 procedural city kits, levels 0–3 × 2 variants, 24 presets/5 poses, cosmetics/preview, owner badges, construction animation; final-art approval and target-device performance remain |
| 8 | core locally verified | Teacher objective report + safe CSV, private personal review, extra-time settings, accessible board/reduced motion; classroom balance/pilot and screen-reader acceptance remain |
| 9 | locally verified with version limits | 60 clients / 15 rooms / 30 minutes, concurrent real browser game, PDF import, backup restore, zero dependency findings, one-hour memory soak; deployed operations and latest-bundle physical acceptance remain |
| 10 | documentation prepared, NOT accepted | Setup/teacher/student/deployment/asset manifest/checklist supplied; no staging/production/classroom pilot claim |

### Verified local evidence

- `npm run test`: **87/87** contract/unit tests. `npm run check`: passes. `npm run audit:questions`: 60 legacy questions structurally valid (not a teaching endorsement).
- `npm audit --json`: **0 vulnerabilities**, including high/critical 0 (23 September local check).
- Latest four-browser complete class game: `docs/qa/group-browser-1790106459831/result.json`, **902 seconds**, same winner in all contexts, no page errors. Earlier concurrent-load run: `docs/qa/group-browser-1790102811927/result.json`, 903 seconds. Earlier standalone 904-second run: `docs/qa/group-browser-1790100538529/result.json`.
- Latest group/private-hint/retry + DB verification after final API restart: `docs/qa/group-browser-1790108495311/result.json`; 40/60/100/100 XP, no browser errors. The synthetic short-test room was ended through its owning teacher; records retained.
- Load: `docs/qa/load-1790102181000/result.json`: **60 students, 15 rooms, 1,809.97 active seconds, 6,524 answer receipts, p95 126.22 ms, 0 client errors**. Windows 11 / Ryzen AI 7 350 / 32 GB / Node 24.12.0. This measured answer-receipt latency, not every command type or production capacity. Server version predates the final privacy/time-accommodation/lifecycle refinements; final regression tests cover those separately, not a repeated 30-minute load.
- Additional load after privacy/time-accommodation/lifecycle changes: `docs/qa/load-1790107079839/result.json`, **60 clients / 15 rooms / 603.85 active seconds**, 3,064 answer receipts, p95 **138.44 ms**, no errors. Acknowledged command p95: start 224.24 ms (15 samples), roll 76.05 (615), buy 145.48 (189), upgrade 155.22 (27), hint 144.04 (613), reflection 59.09 (611). These measure state/receipt acknowledgments, not HTTP pings. The 15 synthetic rooms were ended via their owning teacher after the run; no user records were deleted.
- Teacher HTTP integration: ACL, M2/M4/M5, split/merge/reject, immutable version, report/CSV and pause/resume/end pass. Final API restart rerun also verifies that an emptied lobby becomes abandoned instead of blocking recovery/retention. Teacher UI: `docs/qa/teacher-browser-1790104169497/result.json`.
- PDF/OCR/crop/import limits: `docs/qa/pdf/result.json`. Published PDF/numeric 1 kN→1000 N and lazily loaded KaTeX browser: `docs/qa/import-browser-1790107675653/result.json`.
- Password-protected and malformed PDFs fail safely; six-page Thai PDF containing 30 questions is reviewed and published: `docs/qa/pdf-boundaries/result.json`. M2 uses that version, M4/M5 separate synthetic versions; real questions/reports/room lookup stay isolated: `docs/qa/grade-isolation/result.json`. Not curriculum certification.
- Recovery: `docs/qa/recovery/result.json`: two actual child-process kills/restarts, same question/dice/money/ownership, replay ignored, XP 100/40, own postgame review only.
- Privacy: `docs/qa/privacy/result.json`: cross-teacher deletion rejected, confirmation required, live sessions and referenced banks protected, published versions immutable outside explicit authorized purge, metadata + actual private file removed by worker. **Only disposable fixtures created by that test were deleted; user data was not deleted.**
- Backup: `docs/qa/database/restore-result.json`: new isolated DB `physics_restore_1790108116064`, all 15 domain tables including **10,150 learning attempts** in that snapshot and **60 private files** verified. Teacher sessions and join tickets intentionally excluded; source untouched.
- Catalog: `docs/qa/catalog-1790107534174/result.json`: all 12 cities, 24 presets/5 poses, camera rotation/reset; saturated board **118–124 draw calls / 13,742–20,094 triangles**. Headless desktop samples are not physical Android acceptance. Distinct local roofs, balconies, vegetation, transport and waterfront geometry are implemented, but final-art approval remains open.
- `npm run assets:check`: 37 procedural entries, **133 individual geometry triangle counts**, paths/LF-normalized source hashes/clip names/fallback and bundle-key scan pass. Art explicitly remains `review_required`, never silently `approved`.
- Network/pause/frozen-tab: `docs/qa/network-1790106706383/result.json`; real TCP transport delay, 30/125-second interruptions, identity/host transfer, actual 60-second pause and 20-second frozen tab pass.
- Responsive/accessibility: `docs/qa/accessibility-1790106875796/result.json`; 390/1024/1440 widths plus 320 px results, 150% text, keyboard focus containment, cosmetics, actual WebGL context loss into same-game HTML fallback, and teacher CSV download pass. Not physical-device or screen-reader acceptance.
- Recorded actual UI/server walkthrough: `docs/qa/walkthrough-1790107592119/one-lap.webm`, 36 server-confirmed steps in 49.31 seconds; no injected dice or game snapshots. The separate asset-lab saturated-board fixtures are explicitly synthetic.
- One-hour memory soak: `docs/qa/soak-1790104775514/result.json`, **PASS, 3,600 seconds**, actual 40-minute solo game completed followed by result view. Retained heap increased **1,746,064 bytes (~1.67 MiB)** versus post-warmup baseline; final 196 listeners, 769 DOM nodes, one document, no page errors. CDP forced GC once/minute; acceptance thresholds are +32 MiB heap and +30 listeners. This is browser retained heap, not server RSS or physical Android. The run uses the bundle from its start, before the later walking-ring/art and KaTeX splitting changes; it is not a one-hour certification of those final UI changes.
- Entry JS reduced from 735.95 KB (232.77 KB gzip) to 466.27 KB (152.56 KB gzip) by loading KaTeX only for equations. The separate 3D and legacy Phaser chunks still produce size warnings; they are not hidden.
- Phase 1 smoke, last-seat race/authenticated reconnect/host-permission regression and QR decode round-trip pass. QR on a real second device remains open.
- Final source check/build, 87 tests, all 1/2/3/4 start-size smoke tests, security regressions, QR round-trip, asset check and dependency audit rerun successfully. API was restarted with final source after the soak; `/ready` returns `ok: true, database: true`. Teacher, privacy and four-browser learning regressions passed against that process. Git diff whitespace check passes (only Windows line-ending warnings). GitHub CI and Docker scaffolds were not executed remotely.

### Still open / release gates

1. Final visual approval/polish: simplified procedural city/character silhouettes and sparse environments; production licensing of retained legacy 2D assets. Individual triangle metadata is now present. Old backdrop is no longer used by main CSS. Dedicated U07 four-browser 0→3 upgrade sequence and exhaustive U24 live-game combinations are not yet certified by catalog rendering alone.
2. Physical Android/tablet/screen-reader pilot and final-bundle target-device soak. The one-hour earlier-bundle browser soak and automated network, keyboard, CSV and WebGL-loss checks have passed.
3. Real OIDC provider/allowlist, reachable HTTPS/WSS domain, Docker/staging run, deployed backup retention and a supervised classroom trial. Docker CLI is absent; scaffold has not been executed.
4. Official roster/student-ID binding is not implemented. Nicknames remain pseudonymous game identities. Demo question sets require teacher approval and are not validated pre/post assessments.
5. Default retention 180 days is visible and **owner-confirmed**, not automated deletion. Operator-managed backup expiration/reconciliation must be configured before real student use.

Start with `docs/run-review-build.md`; then `docs/teacher-guide.md`, `docs/student-guide.md`, `docs/deployment.md`, `docs/acceptance-checklist.md`. Local services use PostgreSQL 55432, API 2567, browser preview 5174 and separate PDF worker. Secrets/data are in ignored `.local/`, not client assets.

## Previous continuation — 22 September 2026 (superseded by 23 September above)

ยังไม่ปิด Definition of Done ทั้งโครงการ

| Phase | Current status | Evidence / remaining |
|---|---|---|
| 0 | verified | Preserved dirty worktree; workflow and contracts recorded |
| 1 | verified (local baseline) | Colyseus 0.17 migration; zero vulnerabilities after install; permission/replay regressions pass |
| 2 | verified (technical Milestone A) | Four independent browsers lobby → results, 809 seconds, same winner, no page errors; geometry/rotation/reset evidence below |
| 3 | in_progress | PostgreSQL, teacher ACL/OIDC adapter, dashboard, immutable versions, scoped rooms, participant checkpoints and private-file backup verified locally; join tickets, physical-device QR and production identity verification remain |
| 4 | in_progress (core pipeline verified) | Real Thai PDF/OCR → teacher approval → published questions → browser grading passes; private crops, split/merge/reject implemented; latest editor/cancellation race acceptance remains |
| 5 | in_progress | Group engine, private receipts, hints/retry/reveal barrier, classroom economy and attempts persistence implemented; 4-browser verification running; 180 demo drafts available for teacher review |
| 6–10 | not_started | Recovery/live controls, complete locations/avatars, teacher reports, capacity/deployment and final acceptance remain |

Evidence: `docs/qa/runs/2026-09-22T12-50-57-451Z/result.json` and screenshots;
`docs/qa/phase2-assets/result.json`, `levels-and-avatars.png`, `rotated.png`.
These are local technical tests, not approved final assets, staging or a classroom pilot.
The Bangkok models remain explicitly labeled prototypes until final asset acceptance in Phase 7.

Current automated tests: 59/59 pass. Latest complete build passed before the demo-library/results UI additions; recheck pending.
Teacher HTTP integration passes M2/M4/M5 creation, A/B isolation, approval threshold,
version publication, activity summary allowlist, close-entry and logout.
Extended live-room integration and browser teacher flow pass. Browser evidence:
`docs/qa/teacher-browser-1790083636842/result.json`.
PDF/OCR/crop/limit evidence: `docs/qa/pdf/result.json`.
Published PDF and numeric-unit browser grading: `docs/qa/import-browser-1790086202931/result.json`.
Database and private PDF/page/crop backup restore into a separate database passes:
`docs/qa/database/restore-result.json` (latest learning tables require another rehearsal).
An initial numeric browser run failed on the unit selector accessible label; it was corrected and rerun successfully.

Local PostgreSQL: `npm run setup:local` succeeded with Windows ASCII short-path aliases
for the existing directory; `npm run dev:db` starts loopback-only PostgreSQL.
Credentials are generated into ignored `.local/database.json`, never printed or included in Vite.
OIDC adapter is implemented but no real identity provider is configured/tested.
Development teachers require `DEV_TEACHER_AUTH=true`, non-production and loopback.
Checkpoint persistence is not yet crash recovery: no claim of restart/rejoin acceptance.

## Historical review remediation — 22 September 2026 (superseded above)

**ยังไม่เสร็จครบ Phase 0–10 และยังไม่ผ่าน Definition of Done ข้อ 23**

รอบนี้แก้ review findings ทั้ง 6 จุดในโค้ด พร้อม regression tests:

- ผลตอบค้างข้ามข้อ: ผูก questionId, ล้างผลเมื่อเปลี่ยนข้อ, ปฏิเสธ stale result และเปิดอ่านเฉลย 10 วินาที
- เลือกซื้อค้าง: หมดเวลาที่ server ใน 15 วินาทีและปฏิเสธคำสั่งหลังเส้นตาย
- token ซ้ำ: ปฏิเสธ connection ที่สองใน onAuth/onJoin; ทดสอบ WebSocket จริง
- เตะแล้วไม่คืนที่: ปิด transport/revoke token; replacement client เข้าได้จริง
- request replay หลัง 2,048 คำสั่ง: เปลี่ยนเป็น bounded fail-closed ledger + rate limit
- เต๋า/ตัวละคร: หน้าเต๋า 1–6 ตรง server, 8 procedural characters ใช้ avatar ที่เลือก

เพิ่มเติม: lazy renderer, กล้องหมุน/รีเซ็ต, path movement, HTML fallback, quality/reduced-motion/mute,
วงจร reconnect backoff 120 วินาทีฝั่ง client, ชื่อห้องเดิม/กลับเข้าเกม, focus management,
ปฏิเสธ late answer/jail replacement/out-of-turn sale, จำกัด log 100 รายการ และทดสอบระยะวางตัวหมากไม่ซ้อนอาคาร

หลักฐาน: `docs/qa/review-fixes.md`, `tests/securityRegression.test.ts`,
`tests/rendererContract.test.ts`, `scripts/reviewRegression.ts`, `scripts/browser-autoplay.js`

ผลล่าสุดหลังอัปเดต dependency แบบไม่ใช้ --force: unit/regression 22/22 ผ่าน,
WebSocket regression ผ่าน, validator 60 ข้อผ่าน, QR round-trip ผ่าน
`npm run check` รอบสุดท้ายผ่าน (shared/server type-check และ client production build)
Audit ยังเหลือ 16 entries (3 low / 12 moderate / 1 high) จึงยังไม่พร้อมอ้าง security acceptance

สถานะปัจจุบัน:

| Phase | สถานะ | สิ่งที่เหลือสำคัญ |
|---|---|---|
| 0 | verified | baseline/ข้อกำหนดและงานเดิมเก็บไว้ |
| 1 | in_progress | regression fixes ผ่านในเครื่อง; dependency security และ acceptance matrix ยังต้องตรวจครบ |
| 2 | in_progress | ภาพ final, building variants, normal full-game browser evidence, target-device performance |
| 3–10 | not_started | teacher/DB/PDF/learning loop/recovery/12 maps/24 characters/reports/load/deployment/DoD |

Browser เปิดหน้าเกมจริงและตอบสองข้อต่อกันได้; 4 contexts เข้าห้อง/เริ่ม/เล่นร่วมกันได้บางส่วน
แต่รอบยาวถูกรบกวนโดย HMR และการหมดอายุ session ระหว่างรอ permission review
จึงไม่อ้างว่าเล่นครบหนึ่งเกมตามเกณฑ์ หรือผ่าน staging/classroom pilot แล้ว

งานถัดไป: ยืนยัน production browser harness ให้คง session และเก็บหลักฐาน lobby → results
พร้อมภาพอาคาร 0–3; ปิด Phase 2 ก่อนเริ่ม teacher/persistence ตามลำดับ workflow

ส่วนด้านล่างเป็นบันทึก baseline ก่อนการตรวจแก้รอบนี้ ไม่ใช่สถานะล่าสุดของทั้งโครงการ

## Phase 0 — ตรวจโครงการ ล็อกสัญญา และรักษางานเดิม

สถานะ: verified

พฤติกรรมที่เพิ่มหรือแก้:
- อ่าน `TERRA_WORKFLOW.md` ครบและใช้เป็น specification หลัก
- เก็บ baseline ก่อนแก้โค้ด และล็อกสัญญา public/private ของโจทย์, participant identity, classroom ruleset และแผนย้าย renderer
- รักษา working tree เดิมทั้งหมด; ไม่ reset, checkout หรือเขียนทับการแก้ค้าง

ไฟล์หรือโมดูลสำคัญ:
- `DECISIONS.md`, `docs/architecture.md`, `TERRA_WORKFLOW.md`
- จุดเริ่มต้นที่ตรวจ: `server/src/rooms/GameRoom.ts`, `server/src/logic/questions.ts`, `shared/src/types.ts`, `client/src/net/colyseus.ts`

วิธีทดสอบและผลจริง:
- `npm run validate:questions` — ผ่าน, ตรวจ 60 ข้อ
- `npm run test` — ผ่าน, 1 file / 2 tests
- `npm run check` — ผ่าน, shared/server type-check และ client production build
- `npm run build` — ผ่าน; client bundle หลัก 2,247.69 kB / gzip 576.24 kB
- รอบแรกใน sandbox ของ validator/test/build บางคำสั่งล้มด้วย `spawn EPERM`; รัน validator/test นอก sandbox แล้วผ่าน และ `check` ที่ยังรันอยู่จบผ่าน

หลักฐานหรือ artifact:
- baseline command output ใน turn วันที่ 22 กันยายน 2026
- `docs/architecture.md` และ `DECISIONS.md`

ข้อจำกัดที่ยังมี:
- ยังเป็น Phaser 2D, ไม่มี PostgreSQL/auth/storage/worker, QR ยังเป็นลายตกแต่ง และคำตอบยังรั่วผ่าน public question ณ ตอนเริ่ม Phase 1
- test coverage เริ่มต้นมีเพียง 2 unit tests; ไม่มี integration/E2E/asset performance evidence

สิ่งที่ต้องใช้จากภายนอก (เฉพาะที่จำเป็น):
- ยังไม่ต้องใช้สิทธิ์ภายนอกใน Phase 0; staging, DB, object storage, auth และ OCR ต้องตั้งค่าก่อนอ้างว่าใช้งานจริง

งานถัดไป:
- Phase 1: ปิดเฉลยรั่ว, token-based reconnect, สิทธิ์ host/capacity, ปิด trade/auction, request-id validation และ QR มาตรฐาน

## Phase 1 — ปิดข้อมูลรั่วและทำแกนเกมให้เชื่อถือได้

สถานะ: verified (local technical verification)

พฤติกรรมที่เพิ่มหรือแก้:
- `PublicQuestion` เป็น allowlist จึงไม่มี `answerIndex` หรือ `explanation` ก่อน reveal
- participant ID คงที่แยกจาก socket; reconnect ต้องมี token แบบสุ่มที่ส่งเฉพาะ client และเก็บใน `sessionStorage`
- room code 6 ตัวอักษรแยกจาก internal Colyseus room ID และ lookup ผ่าน API; ห้องเริ่ม 1–4 คนได้เมื่อทุกคนพร้อม โดยไม่เติม bot
- ปิด trade/auction สำหรับ classroom ruleset ทั้ง server และ UI; command ที่เปลี่ยน state ใช้ request ID และตรวจ phase/ตัวตน/ชนิดข้อมูล
- แทนลาย QR ตกแต่งด้วย QR encoder มาตรฐานและมี round-trip decoder test

ไฟล์หรือโมดูลสำคัญ:
- `shared/src/types.ts`, `server/src/logic/questions.ts`, `server/src/rooms/GameRoom.ts`, `server/src/index.ts`, `client/src/net/colyseus.ts`, `client/src/ui/MiniQr.tsx`

วิธีทดสอบและผลจริง:
- `npm run test` — ผ่าน 3/3 รวม allowlist regression
- `npm run validate:questions` — ผ่าน 60 ข้อ
- `npm run test:qr` — ถอด QR กลับเป็น activity URL เดิมได้
- `npm run smoke:phase1` — ผ่านกับ local Colyseus server: non-host start ถูกปฏิเสธ, room-code lookup, reconnect token, nickname impersonation ถูกปฏิเสธ, capacity คนที่ 5 ถูกปฏิเสธ และ start สำเร็จที่ 1/2/3/4 clients
- `npm run check` — ผ่านหลังแก้ Phase 1 (client bundle 584.71 kB gzip ก่อนเพิ่ม 3D)

หลักฐานหรือ artifact:
- `scripts/phase1Smoke.ts`, `scripts/qrRoundTrip.ts`, `tests/gameRules.test.ts`

ข้อจำกัดที่ยังมี:
- token/reconnect state ยังอยู่ใน memory ของ game process; server restart recovery เป็นงาน Phase 3/6
- ไม่มี assignment/question-set version หรือ teacher authorization จึงยังไม่ใช่ classroom production flow
- QR ผ่าน automated decode แต่ยังไม่ได้สแกนจากอุปกรณ์จริงหรือ staging URL

สิ่งที่ต้องใช้จากภายนอก (เฉพาะที่จำเป็น):
- staging URL ที่มือถือเข้าถึงได้สำหรับการตรวจ QR ข้ามอุปกรณ์

งานถัดไป:
- Phase 2: ทำ Bangkok 3D ให้เล่นครบ, asset/performance/accessibility verification และ fallback

## Phase 2 — กระดาน 3 มิติแรกที่เล่นครบหนึ่งเกม

สถานะ: in_progress

พฤติกรรมที่เพิ่มหรือแก้:
- เพิ่ม `three` และ React Three Fiber 8 ที่เข้ากับ React 18
- เพิ่ม `Board3D` หลัง feature flag (`?renderer=2d` ใช้ Phaser fallback) เป็น scene 3 มิติ procedural ของกรุงเทพฯ: แม่น้ำ สะพาน/แลนด์มาร์ก ต้นไม้ กระดาน 28 ช่อง อาคารระดับ 0–3 ตัวหมาก และลูกเต๋าจาก state server
- ขยาย avatar ID ที่รับได้จาก 4 เป็น 8 preset ระหว่างพิสูจน์ renderer

ไฟล์หรือโมดูลสำคัญ:
- `client/src/game3d/Board3D.tsx`, `client/src/App.tsx`, `client/package.json`, `server/src/rooms/GameRoom.ts`

วิธีทดสอบและผลจริง:
- `npm run build -w client` — ผ่าน; JavaScript 808.46 kB gzip

หลักฐานหรือ artifact:
- production build output และ scene code ที่ใช้ actual Three.js meshes/lighting/shadows

ข้อจำกัดที่ยังมี:
- ยังไม่มี browser visual QA ใน environment นี้ (in-app browser แยก network จาก local dev server)
- ยังไม่มี movement path animation, camera controls, HTML fallback, Bangkok asset manifest/approved art, 4-client visual sync proof หรือ performance profiling
- bundle ใหญ่เกิน budget จึงต้อง code-split renderer/asset ก่อนตรวจรับ Phase 2

สิ่งที่ต้องใช้จากภายนอก (เฉพาะที่จำเป็น):
- ไม่มีสำหรับ procedural proof; asset final และ staging/device test ต้องใช้ใน Phase 2/7/9

งานถัดไป:
- แยกโหลด 3D, เพิ่ม animation/camera/fallback แล้วทดสอบ scene กับ game server จริงก่อนเรียก Phase 2 ว่าผ่าน
