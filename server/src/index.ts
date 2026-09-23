import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { Server, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";
import "./config";
import { migrate, pool, tokenHash } from "./db/database";
import { authRouter } from "./teacher/auth";
import { playRouter, teacherRouter } from "./teacher/api";
import { handleError, HttpError } from "./teacher/http";
import { mediaRouter } from "./pdf/media";
import { recoverableSessions, recoveryKey, sweepStaleSessions } from "./db/recovery";
import { ticketsRouter } from "./teacher/joinTickets";

const app = express();
// Render's edge is a single reverse-proxy hop: trust exactly that hop so
// express derives req.ip from X-Forwarded-For instead of every request
// collapsing onto the proxy's own socket address (rate limiters key on req.ip).
// Only enable this when a proxy actually sits in front of us (production, or an
// operator-set TRUST_PROXY for a specific dev/LAN topology). Without a real proxy,
// req.ip would otherwise be attacker-controlled via a spoofed X-Forwarded-For
// header, defeating the dev-teacher-auth loopback check and the rate limiters.
if (process.env.NODE_ENV === "production" || process.env.TRUST_PROXY) {
  const hops = process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 1;
  if (!Number.isInteger(hops) || hops < 1 || hops > 10) throw new Error("TRUST_PROXY must be a small positive integer (proxy hop count)");
  app.set("trust proxy", hops);
}
let ready = false;
// One game writer per database in this release. The advisory lock must be taken
// and held on the SAME dedicated connection for the lifetime of the process: a
// lock taken via the shared pool (pool.query) belongs to whichever pooled client
// happened to run that query, which the pool can then close as idle (default
// idleTimeoutMillis 10s), silently releasing the lock out from under us.
let writerLease = process.env.DATABASE_URL ? await pool.connect() : undefined;
if (writerLease) {
  if (!(await writerLease.query("SELECT pg_try_advisory_lock(731296) locked")).rows[0].locked) {
    writerLease.release(); throw new Error("Another game process already owns this database");
  }
}
async function onWriterLeaseError(): Promise<void> {
  console.error("game_writer_lease_error");
  // Distinguish a transient network/proxy fault on this one connection from
  // genuine loss of the advisory lock before taking down the whole process.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { writerLease?.removeAllListeners("error"); } catch { /* already gone */ }
    const candidate = await pool.connect();
    try {
      const check = await candidate.query("SELECT pg_try_advisory_lock(731296) locked");
      if (check.rows[0].locked) {
        console.error("game_writer_lease_reacquired", { attempt });
        writerLease = candidate;
        writerLease.on("error", onWriterLeaseError);
        return;
      }
      candidate.release();
    } catch (error) {
      candidate.release();
      console.error("game_writer_lease_recheck_failed", { attempt, error });
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  console.error("game_writer_lease_lost");
  process.exit(1);
}
writerLease?.on("error", onWriterLeaseError);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new HttpError(403, "Origin ไม่ได้รับอนุญาต"));
    },
  }),
);
app.use(express.json({ limit: "256kb" }));
app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
if (process.env.DATABASE_URL) {
  await migrate();
  app.use("/api/auth", authRouter);
  app.use("/api/teacher", teacherRouter);
  app.use("/api/play", playRouter);
  app.use("/api/question-media", mediaRouter);
  app.use("/api/tickets", ticketsRouter);
} else {
  app.use(["/api/auth", "/api/teacher", "/api/play", "/api/question-media", "/api/tickets"], (_req, res) => res.status(503).json({ error: "ยังไม่ได้ตั้งฐานข้อมูล: npm run setup:local และ npm run dev:db" }));
}
app.get("/ready", async (_req, res) => {
  try {
    if (!ready) { res.status(503).json({ ok: false, recovering: true }); return; }
    if (process.env.DATABASE_URL) await pool.query("SELECT 1");
    res.json({ ok: true, database: Boolean(process.env.DATABASE_URL) });
  } catch { res.status(503).json({ ok: false, database: false }); }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "physics-monopoly-server" });
});

// Room codes are friendly lookup values, never replacements for the internal
// Colyseus room ID or a participant/reconnect credential.
app.get("/api/rooms/:roomCode", async (req, res, next) => {
  try {
    const roomCode = req.params.roomCode?.trim().toUpperCase();
    if (!roomCode || !/^[A-Z2-9]{6}$/.test(roomCode)) {
      res.status(400).json({ error: "รูปแบบรหัสห้องไม่ถูกต้อง" });
      return;
    }
    let assignmentId: string | null = null;
    if (typeof req.query.assignmentToken === "string") {
      if (!process.env.DATABASE_URL) { res.status(503).json({ error: "โหมดเล่นอิสระ: ไม่รองรับกิจกรรมห้องเรียน" }); return; }
      const assignment = await pool.query("SELECT id FROM assignments WHERE join_token_hash=$1 AND status='open'", [tokenHash(req.query.assignmentToken)]);
      if (!assignment.rowCount) { res.status(404).json({ error: "ไม่พบกิจกรรมหรือครูปิดรับแล้ว" }); return; }
      assignmentId = assignment.rows[0].id;
    }
    const rooms = await matchMaker.query({ name: "game" });
    const room = rooms.find((candidate) => candidate.metadata?.roomCode === roomCode && (candidate.metadata?.assignmentId ?? null) === assignmentId && !candidate.locked);
    if (!room) {
      res.status(404).json({ error: "ไม่พบห้องหรือห้องปิดรับผู้เล่นแล้ว" });
      return;
    }
    res.json({ roomId: room.roomId });
  } catch (error) {
    next(error);
  }
});

const server = createServer(app);
app.use(handleError);
const gameServer = new Server({
  transport: new WebSocketTransport({ server }),
});

gameServer.define("game", GameRoom);

const port = Number(process.env.PORT ?? 2567);
await gameServer.listen(port);
if (process.env.DATABASE_URL) {
  for (const sessionId of await recoverableSessions()) {
    try { await matchMaker.createRoom("game", { restoreSessionId: sessionId, restoreKey: recoveryKey }); }
    catch { await pool.query("UPDATE game_sessions SET status='interrupted' WHERE id=$1", [sessionId]); console.error("session_recovery_failed", { sessionId }); }
  }
  // Boot only recovers sessions once; without a periodic re-sweep a session
  // abandoned mid-game (student disconnects, teacher never ends it) stays in
  // a non-terminal status until the next full restart. Re-run every 5 minutes.
  setInterval(() => {
    matchMaker.query({ name: "game" })
      .then((rooms) => sweepStaleSessions(rooms.map((room) => room.roomId)))
      .catch((error) => console.error("stale_session_sweep_failed", error));
  }, 5 * 60_000).unref();
}
ready = true;
gameServer.onBeforeShutdown(() => { ready = false; });
gameServer.onShutdown(async () => { if (writerLease) { await writerLease.query("SELECT pg_advisory_unlock(731296)"); writerLease.release(); } await pool.end(); });
console.log(`Physics Monopoly server ready on http://localhost:${port}`);
console.log(`Entry: ${fileURLToPath(import.meta.url)}`);
