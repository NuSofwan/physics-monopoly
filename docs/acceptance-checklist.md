# Definition of Done — 23 September 2026

This is an evidence ledger, **not a full-project acceptance certificate**. See `IMPLEMENTATION_STATUS.md` for latest run paths. A local PASS does not mean staging/deployment/classroom approval.

| Workflow §23 requirement | Current evidence / remaining gate |
|---|---|
| Teacher M2/M4/M5, own topics | Local HTTP and teacher-browser flows pass |
| Text/scanned PDF and editable formulas/images/answers | Local Thai text/OCR, crop ACL, review/publish and real browser grading pass; complex mathematical OCR needs human review |
| Immutable published version / scoped content | Database trigger + actual assignment questions verified |
| Link/QR on another device | QR round-trip automated; physical cross-device/LAN/HTTPS acceptance still open |
| Nickname/avatar/room/code/map | Implemented and browser-tested, including wheelchair/hair/shirt cosmetics |
| Start 1/2/3/4, fifth/races denied | Baseline regressions cover sizes/replay; final rerun recorded in implementation status |
| Real 3D + authoritative multiplayer | Four browser contexts finish a real 15-minute class game with same winner |
| 12 cities, 24 presets, levels 0–3 | Procedural catalog exists, technical rendering passes; final-art approval remains open |
| Thai/math/responsive/accessibility | KaTeX/numeric units, 150% text, 320–1440 px layouts, actual WebGL-loss fallback, keyboard focus, reduced motion, mute and time accommodations tested; physical device/screen-reader acceptance still open |
| Hints/retry/reveal without early leak | Four browsers verify private hint, retry barrier, 40/60/100/100 XP and DB evidence |
| No elimination / timed finish | Engine tests and actual 15-minute end pass |
| Server owns dice/money/answers/ownership, no duplicates | Security regressions, persistent request ledger, commit-before-ack, two real restart tests pass |
| Reconnect/host/pause/restart | Real process restart twice, 30/125-second interruptions, host transfer, actual 60-second pause, 200–300 ms transport RTT and 20-second frozen tab pass |
| Teacher reports / CSV from attempts | Owner-only API, CSV formula defense, first/repeated denominators, even-sample median and browser CSV download pass |
| Private data / no bundled answer bank | Teacher/PDF cross-owner isolation and allowlisted snapshots pass; source/manifest/bundle checks included |
| Every map visual + performance, no hidden placeholders | Screenshots and 133 per-geometry triangle counts collected; low saturated scene budget 118–124 calls / 13,742–20,094 triangles; art explicitly review_required; target Android/FPS not certified |
| Updated baseline and full scenario matrix | 87 unit/contract tests pass; scenario evidence below distinguishes partial coverage; no blanket acceptance claim |
| Setup/teacher/student/deploy/licenses/evidence/limits | Documents added. Docker scaffold not executed (no Docker installed); real hosting/OIDC not configured |
| Distinguish local/staging/deployed/pilot | Only local execution has occurred. No staging, production or real classroom claims |

Additional Phase 9 local evidence: 60-client/15-room 30-minute load, one-hour browser memory/listener soak (bundle/version limitation recorded in implementation status), and 200–300 ms transport RTT + interruptions pass. Backup retention automation on real storage and physical classroom pilot remain open. These must not be inferred from a successful build.

## Workflow §21 scenario ledger

Run directories and measured values are in `IMPLEMENTATION_STATUS.md`. “Local” is not a claim of staging or physical-device acceptance.

| Scenario | Evidence / status |
|---|---|
| U01 | Local: real six-page Thai PDF with 30 questions, review/publish and isolated M2 game; PDF-boundaries + grade-isolation |
| U02 | Local: separate M4/M5 activities, questions, rooms and reports; grade-isolation |
| U03–U05 | Local: solo practice, room size/permission/last-seat regressions; no automatic bots |
| U06 | Partial: QR encode/decode round-trip; second physical device remains open |
| U07 | Partial: all levels render, upgrade engine/recovery/load pass; dedicated four-browser same-property 0→3 sequence not yet recorded |
| U08 | Local contract: city selection does not alter shared economy tiers; Paris models separately render |
| U09–U12 | Local: four-browser answer barrier/private receipts, persistent replay ledger, bundle/snapshot allowlist and identity regressions |
| U13–U15 | Local: network proxy, host transfer, reconnect with deadlines, real 60-second pause and frozen-tab tests |
| U16 | Local: two actual server-process kills/restarts, money/property/question identity retained and replay denied |
| U17 | Local: Thai scanned/text PDF, crop/formula review, missing answer publication guard, malformed/password rejection; mathematical OCR still requires teacher review |
| U18 | Local: immutable published-version trigger and assignment version binding; draft editing does not mutate active version |
| U19 | Local: soft-debt/emergency-grant/repayment rule tests; no bankruptcy removal in classroom mode |
| U20 | Local: complete 15-minute four-browser game, 40-minute solo game in soak, teacher interrupt/deadline rules |
| U21 | Local: actual WebGL context loss switches to the same room's HTML board; no external GLB loader in procedural renderer |
| U22 | Local: teacher A/B report/file/crop/purge ACL tests |
| U23 | Local: repeated-exposure denominators, missed/interrupted labels, first-exposure personal review and median tests |
| U24 | Partial: all 12 cities / 24 presets / five poses / eight building variants per city render; not exhaustive live-game combinations or final-art acceptance |
| U25 | Local: closed-entry rejects new joins; existing-room teacher control policy tested |
| U26 | Local: CSV BOM/Thai and formula-neutralization tests, actual browser download |

No global checkbox in the authoritative workflow has been marked complete to conceal these remaining gates.
