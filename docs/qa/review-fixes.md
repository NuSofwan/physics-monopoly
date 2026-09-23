# Review remediation — 22 September 2026

Scope: repair the six review findings, strengthen their regression tests, and
continue the Bangkok renderer. This is **not** acceptance of Phases 0–10.

## Automated evidence collected

- `npm run test`: 22 tests passed (rules, replay/identity/phase/deadline guards,
  stale reveal rejection, bounded turn completion, dice orientations, 28 tile
  coordinates and non-overlapping token/building placement).
- `npm run smoke:regression`: real WebSocket clients passed duplicate active-token
  rejection, host-only start, authenticated reconnect, nickname impersonation
  rejection, concurrent last-seat joins, kick/transport closure and replacement join.
- `npm run smoke:phase1`: passed existing 1/2/3/4-client start scenarios.
- `npm run validate:questions`: 60 questions passed schema validation (not teacher
  approval of curriculum suitability).
- `npm run test:qr`: passed encoder/decoder round trip of the test URL; not a
  cross-device/staging scan.
- Production client build passed. Main JS gzip approximately 233 KB, 3D lazy chunk
  228 KB, legacy Phaser lazy chunk 343 KB. This is bundle size, not measured load time.

## Dependency security

`npm audit fix` without `--force` updated compatible dependencies. The final audit
reported 16 entries: 3 low, 12 moderate, 1 high, reduced from 24 entries (5 high).
Remaining chains include nanoid 2 through Colyseus 0.16, Vitest mocker, and unused
authentication-related transitive dependencies of the Colyseus umbrella package.
There is no claim of a clean dependency/security audit. A blind nanoid 3 override
was deliberately not applied: Colyseus declares the nanoid 2 API. Framework/test
runner upgrades require their own compatibility and full regression review.

The application regression tests and real-WebSocket regression script passed again
after the compatible dependency updates, using Vitest 3.2.7.
The final `npm run check` also passed after placing matching Three.js definitions
at the workspace root so the hoisted Fiber package can resolve them. No `any`
casts or relaxed compiler settings were added to suppress the material type errors.

`git diff --check` still reports trailing blank lines in App.tsx/styles.css in the
combined working-tree diff; this is not a runtime/test success criterion. Unrelated
existing working-tree edits were preserved.

## Browser evidence and limitations

- Local agent-browser successfully reached the actual app and game server.
- Create → ready → start → 3D board → roll → buy/answer worked in the browser.
- UI driver answered a second question after the first reveal (2 submissions and
  1 intervening reveal); it only clicked rendered controls, never read answer keys.
- Four separate browser sessions joined, chose different avatars, started and
  answered questions in the same room. Source hot reload reset the client store
  during that test. A subsequent long run lost browser sessions during a permission
  approval timeout/automation idle shutdown. Neither run is claimed as completed
  normal-length game acceptance.
- Production preview is used for subsequent visual checks, without HMR.
- A short-cycle browser test was attempted after the long run, but the automation
  session returned to `about:blank` and lost element references. No successful
  short-cycle completion is claimed. The temporary server test override was removed;
  ordinary games still retain 80 turns.

## Still required before full delivery

Phase 2: complete Bangkok artwork/variants, preview/animation quality, all four
building levels visually verified, normal-duration four-browser game evidence,
target-device performance and accessibility matrix.

Phases 3–10: teacher authentication/classrooms, PostgreSQL persistence, versioned
assignments, private PDF import/review/OCR worker, group question/hint/retry loop,
classroom economy, host transfer/pause/restart recovery, all 12 maps/24 characters,
teacher reports/CSV, load/security/retention/deployment documentation and full DoD.
There is no configured DATABASE_URL, PostgreSQL/Docker service found by the checks,
teacher identity provider, private object storage or OCR credentials in this workspace.
This observation does not mean those features have been implemented.
