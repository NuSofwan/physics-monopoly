/** Kill/restart only child processes owned by this test, using a fresh local database. */
import "../server/src/config";
import { pool } from "../server/src/db/database";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { Client, type Room } from "@colyseus/sdk";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import type { GameState, LearningReceipt } from "../shared/src/types";
if (process.env.NODE_ENV === "production") throw new Error("Recovery QA is local only");
const connection = new URL(process.env.DATABASE_URL!);
if (!["localhost","127.0.0.1"].includes(connection.hostname)) throw new Error("Recovery QA requires local PostgreSQL");
const database = `physics_recovery_${Date.now()}`;
await pool.query(`CREATE DATABASE ${database}`); await pool.end();
connection.pathname = `/${database}`;
const base = "http://localhost:2568", origin = "http://localhost:5174";
let server: ChildProcess | undefined;
let serverLog = "";
async function start(): Promise<void> {
  server = spawn(process.execPath, ["--import", "tsx", "server/src/index.ts"], { windowsHide: true, stdio: ["ignore","pipe","pipe"], env: { ...process.env, DATABASE_URL: connection.href, PORT: "2568", APP_ORIGIN: origin, DEV_TEACHER_AUTH: "true" } });
  server.stdout?.on("data", (bytes) => { serverLog = (serverLog + bytes.toString()).slice(-8000); });
  server.stderr?.on("data", (bytes) => { serverLog = (serverLog + bytes.toString()).slice(-8000); });
  for (let index = 0; index < 100; index++) {
    if (server.exitCode !== null) throw new Error(`Owned server exited: ${serverLog}`);
    try { if ((await fetch(`${base}/ready`)).ok) return; } catch {}
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error("Owned test server readiness timeout");
}
async function kill(): Promise<void> {
  if (server && server.exitCode === null) { const stopped = once(server, "exit"); server.kill("SIGKILL"); await stopped; }
}
async function call(path: string, body?: object, cookie = "") {
  const response = await fetch(`${base}/api/${path}`, { method: body ? "POST" : "GET", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  assert.ok(response.ok, `${path} ${response.status}`); return response;
}
const rooms: Room[] = [];
const report: Record<string,unknown> = { passed: false, database };
type Connected = { room: Room<GameState>; state?: GameState; identity?: { participantId: string; reconnectToken: string; roomCode: string }; receipt?: LearningReceipt };
function bind(room: Room<GameState>): Connected {
  room.reconnection.enabled = false;
  rooms.push(room); const client: Connected = { room };
  room.onMessage("snapshot", (state) => { client.state = state; });
  room.onMessage("participantSession", (identity) => { client.identity = identity; });
  room.onMessage("learningReceipt", (receipt) => { client.receipt = receipt; });
  room.onMessage("answerResult", () => {}); room.onMessage("tokenMove", () => {});
  room.send("getParticipantSession"); return client;
}
async function wait(check: () => boolean, label: string, limit = 30_000) {
  const until = Date.now() + limit;
  while (Date.now() < until) { if (check()) return; await new Promise((done) => setTimeout(done, 50)); }
  throw new Error(`Timeout: ${label}`);
}
try {
  await start();
  const login = await call("auth/dev", { teacher: "A" }), cookie = login.headers.get("set-cookie")!.split(";")[0];
  const classroom = await (await call("teacher/classrooms", { title: "Recovery test", grade: 2, curriculumTrack: "พื้นฐาน", term: "QA", topic: "แรง", objectives: [] }, cookie)).json();
  const set = await (await call("teacher/question-sets", { title: "Recovery QA", grade: 2, topic: "แรง" }, cookie)).json();
  for (let index = 0; index < 10; index++) {
    const q = await (await call(`teacher/question-sets/${set.id}/questions`, { prompt: `QA ${index}: 1+2 N`, choices: ["3 N","2 N"], answerIndex: 0, hint: "บวกแรง", explanation: "1+2=3 N", objective: "แรงลัพธ์", topic: "mechanics", difficulty: "easy", timeLimitSec: 60 }, cookie)).json();
    await call(`teacher/question-revisions/${q.id}/approve`, {}, cookie);
  }
  const version = await (await call(`teacher/question-sets/${set.id}/publish`, {}, cookie)).json();
  const assignment = await (await call("teacher/assignments", { title: "Restart QA", classroomId: classroom.id, versionId: version.id, durationMinutes: 15 }, cookie)).json();
  const token = new URL(assignment.joinUrl).pathname.split("/").at(-1);
  const clients: Connected[] = [];
  for (let index = 0; index < 2; index++) {
    const name = `Recovery ${index}`, avatar = "astro";
    const ticket = await (await call("tickets/join", { assignmentToken: token, name, avatar })).json();
    const options = { name, avatar, assignmentToken: token, joinTicket: ticket.ticket };
    const room = index ? await new Client(base).joinById<GameState>(clients[0]!.room.roomId, options) : await new Client(base).create<GameState>("game", options);
    const client = bind(room); clients.push(client);
    await wait(() => Boolean(client.identity), "participant identity");
    room.send("ready", { requestId: randomUUID() });
  }
  await wait(() => clients[0]!.state?.players.length === 2 && clients[0]!.state.players.every((p) => p.ready), "ready");
  clients[0]!.room.send("start", { requestId: randomUUID() });
  await wait(() => clients[0]!.state?.phase === "rolling", "start");
  const turn = clients[0]!.state!.players[clients[0]!.state!.currentPlayerIndex]!.id;
  const active = clients.find((c) => c.identity!.participantId === turn)!;
  active.room.send("roll", { requestId: randomUUID() });
  await wait(() => ["buying","answering"].includes(clients[0]!.state?.phase ?? ""), "landing");
  if (clients[0]!.state?.phase === "buying") active.room.send("buy", { requestId: randomUUID() });
  await wait(() => Boolean(clients[0]!.state?.pendingQuestion), "question");
  const questionId = clients[0]!.state!.pendingQuestion!.id, replayId = randomUUID();
  clients[0]!.room.send("answer", { requestId: replayId, questionId, choiceIndex: 0 });
  clients[1]!.room.send("answer", { requestId: randomUUID(), questionId, choiceIndex: 1 });
  await wait(() => clients[1]!.receipt?.status === "retry_open", "retry committed");
  const oldRoomId = clients[0]!.room.roomId, before = structuredClone(clients[0]!.state!);
  const identities = clients.map((c) => c.identity!);
  await kill(); await start();
  const resumed: Connected[] = [];
  for (const identity of identities) {
    const ticket = await (await call("tickets/rejoin", identity)).json();
    assert.notEqual(ticket.roomId, oldRoomId, "framework room ID must change after a real process restart");
    const client = bind(await new Client(base).joinById<GameState>(ticket.roomId, { ...identity, rejoinTicket: ticket.ticket }));
    resumed.push(client); await wait(() => Boolean(client.identity && client.state), "restored identity and snapshot");
  }
  assert.equal(resumed[0]!.state!.pendingQuestion!.id, questionId);
  assert.deepEqual(resumed[0]!.state!.dice, before.dice);
  assert.deepEqual(resumed[0]!.state!.players.map((p) => [p.id,p.money,p.tileIndex]), before.players.map((p) => [p.id,p.money,p.tileIndex]));
  resumed[0]!.room.send("answer", { requestId: replayId, questionId, choiceIndex: 1 });
  resumed[1]!.room.send("answer", { requestId: randomUUID(), questionId, choiceIndex: 0 });
  await wait(() => resumed[0]!.state?.phase === "reveal", "reveal after recovery");
  for (const [index,xp] of [100,40].entries()) assert.equal(resumed[0]!.state!.players.find((p) => p.id === identities[index]!.participantId)!.xp, xp);
  await wait(() => resumed[0]!.state?.phase === "rolling", "apply once", 15_000);
  const committed = structuredClone(resumed[0]!.state!);
  await kill(); await start();
  const ticket = await (await call("tickets/rejoin", identities[0]!)).json();
  const final = bind(await new Client(base).joinById<GameState>(ticket.roomId, { ...identities[0], rejoinTicket: ticket.ticket }));
  await wait(() => Boolean(final.state), "second restore");
  assert.deepEqual(final.state!.tiles, committed.tiles);
  assert.deepEqual(final.state!.players.map((p) => [p.id,p.money,p.xp,p.invested]), committed.players.map((p) => [p.id,p.money,p.xp,p.invested]));
  const denied = await fetch(`${base}/api/tickets/results`, { method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(identities[0]) });
  assert.equal(denied.status,409,"review must remain closed during play");
  const live = await (await call(`teacher/assignments/${assignment.id}/rooms`,undefined,cookie)).json();
  await call(`teacher/assignments/${assignment.id}/rooms/${live[0].id}/control`,{command:"end"},cookie);
  await wait(()=>final.state?.phase==="game_over","teacher end committed");
  const personal = await (await call("tickets/results",identities[0])).json();
  assert.equal(personal.summary.length,1); assert.equal(personal.summary[0].firstCorrect,1);
  assert.equal(personal.review.length,1,"never return unseen bank questions");
  assert.equal(personal.review[0].answer,"3 N");
  const impersonation = await fetch(`${base}/api/tickets/results`, { method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({...identities[0],participantId:identities[1]!.participantId}) });
  assert.equal(impersonation.status,404);
  report.privatePostgameReview = true;
  report.passed = true; report.realProcessRestarts = 2; report.sameQuestion = true; report.xp = [100,40]; report.ownershipAndMoneyPreserved = true;
} catch (error) { report.failure = String(error); report.serverLog = serverLog; process.exitCode = 1; }
finally {
  for (const room of rooms) { room.reconnection.enabled = false; void room.leave().catch(() => {}); }
  await kill(); await mkdir("docs/qa/recovery", { recursive: true });
  await writeFile("docs/qa/recovery/result.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
