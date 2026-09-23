# Architecture and migration plan

## Current baseline (Phase 0)

| Area | Existing | Replace / retain / add |
|---|---|---|
| UI | Vite, React 18, TypeScript, Zustand | Retain; add teacher/student feature boundaries and accessible HTML fallback |
| Board renderer | Phaser 3 canvas with a 28-tile board | Retain only as migration fallback; add React Three Fiber Board3D behind feature flag |
| Realtime | Node, Express, Colyseus 0.16 | Retain as authoritative game server; add participant session/reconnect contracts and command validation |
| Rules | `shared/src/gameRules.ts`, 28 tile board | Retain pure rules but replace elimination/jail-first rules with versioned classroom rules |
| Questions | JSON files read by server; public question is an unsafe omit | Keep server loading temporarily; add allowlisted public DTO, versions, approval and private answer-key storage |
| Persistence | Room memory and snapshots only | Add PostgreSQL migrations, event/snapshot persistence and recovery in Phase 3 |
| Teacher workflow | Not present | Add authenticated classroom, question set, assignment and reports features in Phases 3–8 |
| PDF/OCR | Not present | Add private storage, import worker, PDF.js extraction and configured OCR adapter in Phase 4 |
| QR | Decorative 9x9 grid | Replace with a standards-compliant QR encoder in Phase 1 |

## Public/private boundary

`server/content` and eventual database `AnswerKey` records are private. The only question shape sent while answers are open is an explicit allowlist. A player reconnect token is delivered privately to its connection, never placed in state snapshots, logs, room metadata or URLs. The game state identifies players by stable participant ID, but a socket session ID is only a transient connection mapping.

## Renderer migration

1. Introduce a renderer contract that consumes server snapshots and token-move events.
2. Add a grey 28-tile `Board3D` for Bangkok behind a feature flag while Phaser remains the fallback.
3. Validate four independent clients against live room events, including reconnect/event ordering.
4. Add lighting, materials, avatars, dice visualisation and building kits in slices.
5. Make 3D default only after visual/performance/accessibility checks; do not run the Phaser canvas and Three renderer together.

## Known baseline risks

- `publicQuestion()` leaks explanations, and the game state broadcasts an active question to every client.
- Reconnection currently matches a nickname and rewrites the player ID from a socket ID.
- `trade` transfers an arbitrary tile without proving that the sender owns it; auctions and bot-fill conflict with classroom defaults.
- No durable state, authorization boundary, private storage, PDF pipeline, worker or teacher identity exists.
- Client build output is a single 576 kB gzip main JavaScript bundle before 3D assets.

## Phase work items

- P1: SEC-01 private question DTO; SEC-02 participant/token session; SEC-03 classroom command authority; SEC-04 request id/numeric guards; SEC-05 standards QR.
- P2: R3D-01 renderer contract; R3D-02 Bangkok board, dice, avatars and building kit; R3D-03 fallback and responsive overlays.
- P3–P6: DATA-01 persistence; TEACH-01 classroom/assignment; PDF-01 import/review; LEARN-01 simultaneous learning loop; REC-01 reconnect/recovery.
- P7–P10: ASSET-01 all maps/avatars; REPORT-01 evidence-based reports; OPS-01 capacity/deployment; QA-01 acceptance evidence and handover.
