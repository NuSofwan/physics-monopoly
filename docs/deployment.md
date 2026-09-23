# Deployment / operations

สถานะ: ทดสอบใน Windows local เท่านั้น ยังไม่มี staging, production domain, real OIDC หรือ classroom pilot; Dockerfile เป็น deployment scaffold ที่ยังไม่ได้ build/run เพราะเครื่องนี้ไม่มี Docker CLI

## Render + Vercel (current free-tier deploy)

This repo's actual deploy target is Render (server, `render.yaml`) + Vercel (client, `vercel.json`), separate from the generic VPS/Docker topology described below.

**Render (server, `render.yaml`):**

- `NODE_ENV=production` and `FREE_PLAY_MODE=true` are set in `render.yaml` — this is the explicit opt-in for `server/src/productionConfig.ts` to boot without `DATABASE_URL`/OIDC on the free tier (legacy free-play Colyseus game only; classroom/teacher routes stay disabled/503, per the `DATABASE_URL` gate in `server/src/index.ts`).
- In free-play mode only `ALLOWED_ORIGINS` is required; `APP_ORIGIN`/`API_ORIGIN` are optional there but validated (HTTPS, and `APP_ORIGIN` must be in `ALLOWED_ORIGINS`) when set. `VITE_API_URL` is optional on Vercel because the client derives it from `VITE_SERVER_URL` (`wss://` → `https://`).
- In the Render dashboard, set `APP_ORIGIN` to the **exact** deployed Vercel origin (e.g. `https://physics-monopoly.vercel.app`, no trailing slash) — this is the front-end origin, used by `server/src/teacher/auth.ts` and `server/src/teacher/api.ts` to build redirect/join URLs. Set `API_ORIGIN` to the Render service's own HTTPS origin (e.g. `https://physics-monopoly-server.onrender.com`). Set `ALLOWED_ORIGINS` to the Vercel origin(s), comma-separated for multiple, no trailing slash — this **must include `APP_ORIGIN`'s exact value**, since `server/src/productionConfig.ts` refuses to boot ("APP_ORIGIN must be explicitly allowed") if `APP_ORIGIN` is not itself in `ALLOWED_ORIGINS`. `ALLOWED_ORIGINS` must match exactly or the browser's Colyseus WebSocket/fetch calls fail the CORS/origin check in `server/src/index.ts`.
- Do not set `DATABASE_URL` or `OIDC_*` on this tier; leaving them unset together with `FREE_PLAY_MODE=true` is intentional, not a misconfiguration.

**Vercel (client, `vercel.json`):**

- In Project Settings > Environment Variables, set `VITE_SERVER_URL=wss://<render-service>.onrender.com` and `VITE_API_URL=https://<render-service>.onrender.com` before building. Vite inlines `import.meta.env.*` at build time, so these must be configured in Vercel's dashboard, not only in `.env.example`/local `.env` files — `vercel.json`'s `buildCommand` does not inject them.

See `.env.example` for the corresponding local-dev defaults.

## Topology

- Node.js 24, one authoritative game/API process per PostgreSQL database (dedicated advisory lease; second writer fails closed)
- Separate PDF worker, concurrency 1, per-job child process memory/time bounds
- PostgreSQL 18 tested locally; persistent database storage and private PDF/page/crop storage shared by API/worker
- Static `client/dist`, HTTPS reverse proxy and WSS forwarding; no serverless WebSocket assumption

Build with real `VITE_API_URL=https://api.example` and `VITE_SERVER_URL=wss://api.example`, before shipping static files. Configure `APP_ORIGIN`, `API_ORIGIN`, exact `ALLOWED_ORIGINS`, `DATABASE_URL`, absolute `PRIVATE_STORAGE_PATH`, OIDC issuer/client and `TEACHER_ALLOWED_SUBJECTS`. Do not log or commit secrets. Prefer same-site front-end/API so SameSite=Lax cookies work; unrelated domains need a separately reviewed cookie/CSRF design.

Production configuration fails startup when required fields are missing, HTTP origins are used, or demo auth is enabled. Do not set `DEV_TEACHER_AUTH=true` in production. Register the exact `${API_ORIGIN}/api/auth/callback` URI with the identity provider. Verify a real allowed and denied account before release.

`Dockerfile --target service` runs API by default; worker command is `npm run dev:worker`. `--target web` serves the SPA with nginx. TLS proxy must route `/api/*`, `/matchmake/*` and WebSocket upgrades to the game service; other routes to static web. The supplied nginx file is static hosting, not a complete TLS/proxy installation. Set upload limit >=21 MB at the proxy, use bounded timeouts, don't expose database or private storage publicly.

## Before release

1. `npm ci`, `npm run test`, `npm run check`, `npm audit`, `npm run assets:check`.
2. Start API once to run checksummed migrations before starting upgraded worker. Back up DB/files before migration; never edit an applied migration.
3. Check `/health` and `/ready`; ready remains false through restore. Perform teacher/PDF/rejoin/ACL tests against staging (local-only scripts need adaptation, don't enable demo auth remotely).
4. Verify an actual phone can scan QR, log in where applicable, join and complete a game over the deployed domain.
5. Test restarts and backup restoration into isolated infrastructure, verify DB rows and private-file hashes before replacing anything.
6. Review all procedural art and the legacy public-assets license inventory; `review_required` is not approved final art. Docker context excludes the unverified old backdrop. Do not publish other unverified legacy assets without clearance.
7. Run target-device FPS/network/memory acceptance and a teacher-supervised pilot. Local CPU load tests are not production capacity guarantees.

## Backup, deletion and incident handling

Default product retention is 180 days, visible to teachers; deletion is owner-confirmed, not an automatic legal retention claim. Operator-managed backups should expire within 30 days. This repository does not configure your storage provider's backup deletion policy.

Assignment deletion removes participant identities/tickets, attempts, question sessions, events and snapshots after rooms have ended and sockets left. Question-bank deletion is separate, blocked while referenced by assignments or active imports; it removes revisions/versions/PDF metadata and records exact filenames in a durable worker deletion queue. Failed cleanup remains queued for retry. Preserve deletion records operationally when restoring old backups; do not silently resurrect erased student data.

`npm run test:backup` is a local rehearsal that creates a **new** database and copies private files; it never overwrites source. It excludes teacher-session cookies and short-lived join tickets. `.local/backups`, databases and uploads contain private data; keep outside static web roots and source control. Production backup automation, restore drills and access controls remain the operator's responsibility.

If database writes fail, the room closes connections rather than acknowledge uncommitted rewards. Recover within 10 minutes to resume supported snapshots; older nonterminal sessions are abandoned. Inspect readiness and storage logs, restore service, then have participants return using their retained application session. Never reconstruct identity from a nickname alone.
