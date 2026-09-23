import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client, type Room } from "@colyseus/sdk";
import type { GameState } from "../shared/src/types";
const base = process.env.QA_API_URL ?? "http://localhost:2567";
const origin = process.env.QA_URL ?? "http://localhost:5174";
async function call(path: string, cookie = "", body?: object, method = body ? "POST" : "GET") {
  return fetch(`${base}/api/${path}`, { method, headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}
async function login(teacher: string) {
  const response = await call("auth/dev", "", { teacher });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  assert.match(response.headers.get("set-cookie")!, /HttpOnly/);
  return cookie;
}
const a = await login("A");
const b = await login("B");
assert.equal((await call("teacher/classrooms")).status, 401);
assert.equal((await fetch(`${base}/api/teacher/classrooms`, { method: "POST", headers: { Cookie: a, "Content-Type": "application/json", Origin: "https://attacker.invalid" }, body: "{}" })).status >= 400, true);
const suffix = randomUUID().slice(0, 8);
const classroom = await (await call("teacher/classrooms", a, { title: `QA M2 ${suffix}`, grade: 2, curriculumTrack: "พื้นฐาน", term: "1/2569", topic: "แรง", objectives: ["คำนวณแรงลัพธ์"] })).json();
assert.ok(classroom.id);
assert.equal((await call(`teacher/classrooms/${classroom.id}`, b)).status, 404);
for (const grade of [4, 5]) assert.equal((await call("teacher/classrooms", a, { title: `QA M${grade} ${suffix}`, grade, curriculumTrack: "เพิ่มเติม", term: "1/2569", topic: "แรง", objectives: [] })).status, 201);
const set = await (await call("teacher/question-sets", a, { title: `QA forces ${suffix}`, grade: 2, topic: "แรง" })).json();
const firstIds: string[] = [];
for (let i = 0; i < 10; i++) {
  const draft = await (await call(`teacher/question-sets/${set.id}/questions`, a, { prompt: `QA ${suffix} ข้อ ${i + 1}: แรง 1 N กับ 2 N ทิศเดียวกัน รวมเท่าไร`, choices: ["3 N", "1 N", "2 N", "0 N"], answerIndex: 0, explanation: "แรงทิศเดียวกันบวกกัน 1+2=3 N", hint: "บวกขนาดแรง", objective: "แรงลัพธ์", topic: "mechanics", difficulty: "easy", timeLimitSec: 30 })).json();
  firstIds.push(draft.id);
  assert.equal((await call(`teacher/question-revisions/${draft.id}/approve`, b, {})).status, 404);
  if (i === 0) assert.equal((await call(`teacher/question-sets/${set.id}/publish`, a, {})).status, 400);
  assert.equal((await call(`teacher/question-revisions/${draft.id}/approve`, a, {})).status, 200);
}
const version = await (await call(`teacher/question-sets/${set.id}/publish`, a, {})).json();
assert.equal(version.version, 1);
assert.equal((await call("teacher/question-revisions/restructure", b, {operation:"split",ids:[firstIds[0]]})).status,404);
const split=await (await call("teacher/question-revisions/restructure",a,{operation:"split",ids:[firstIds[0]]})).json();
assert.equal(split.ids.length,2);
assert.equal((await call(`teacher/question-revisions/${split.ids[0]}/approve`,a,{})).status,400,"split requires a newly reviewed answer key");
const merge=await (await call("teacher/question-revisions/restructure",a,{operation:"merge",ids:split.ids})).json();
assert.equal(merge.ids.length,1);
assert.equal((await call("teacher/question-revisions/restructure",a,{operation:"reject",ids:merge.ids})).status,200);
assert.equal((await call(`teacher/question-sets/${set.id}`, b)).status, 404);
const activity = await (await call("teacher/assignments", a, { title: `QA activity ${suffix}`, classroomId: classroom.id, versionId: version.id, durationMinutes: 15 })).json();
assert.ok(activity.joinUrl);
const token = new URL(activity.joinUrl).pathname.split("/").at(-1);
const summary = await (await call(`play/${token}`)).json();
assert.equal(summary.grade, 2);
assert.equal(JSON.stringify(summary).includes("answerIndex"), false);
assert.equal((await call(`teacher/assignments/${activity.id}/rooms`, b)).status, 404);
assert.equal((await call(`teacher/assignments/${activity.id}/close-entry`, b, {})).status, 404);
const connections: Room[] = [];
try {
  for (let index = 0; index < 2; index++) {
    const name = `Scope QA ${index}`;
    const joinTicket = await (await call("tickets/join", "", { assignmentToken: token, name, avatar: "astro" })).json();
    const room = await new Client(base.replace(/^http/, "ws")).create<GameState>("game", { name, avatar: "astro", assignmentToken: token, joinTicket: joinTicket.ticket });
    connections.push(room);
    let state: GameState | undefined;
    room.onMessage("snapshot", (snapshot: GameState) => { state = snapshot; });
    room.onMessage("participantSession", () => {});
    room.onMessage("tokenMove", () => {});
    room.onMessage("answerResult", () => {});
    room.onMessage("learningReceipt", () => {});
    room.send("getParticipantSession");
    const waitFor = async (predicate: (value: GameState) => boolean) => {
      const until = Date.now() + 60_000;
      while (Date.now() < until) {
        if (state && predicate(state)) return state;
        await new Promise((done) => setTimeout(done, 50));
      }
      throw new Error(`activity room timeout: ${state?.phase}`);
    };
    const lobby = await waitFor((value) => value.players.length === 1);
    assert.equal((await call(`rooms/${lobby.roomCode}`)).status, 404, "unscoped lookup cannot discover assignment room");
    assert.equal((await call(`rooms/${lobby.roomCode}?assignmentToken=${token}`)).status, 200);
    await assert.rejects(new Client(base.replace(/^http/, "ws")).joinById(room.roomId, { name: "Wrong scope", assignmentToken: "x".repeat(43) }));
    room.send("ready", { requestId: randomUUID() });
    await waitFor((value) => value.players[0].ready);
    room.send("start", { requestId: randomUUID() });
    await waitFor((value) => value.phase === "rolling");
    if (index === 0) {
      for (let rolls = 0; rolls < 20; rolls++) {
        room.send("roll", { requestId: randomUUID() });
        await new Promise((done) => setTimeout(done, 5000));
        if (state?.phase === "buying") room.send("buy", { requestId: randomUUID() });
        if (state?.players[0].inJail) room.send("jailQuestion", { requestId: randomUUID() });
        await new Promise((done) => setTimeout(done, 300));
        if (state?.pendingQuestion) break;
      }
      const questionState = await waitFor((value) => Boolean(value.pendingQuestion));
      assert.match(questionState.pendingQuestion!.question.prompt, new RegExp(suffix));
      assert.equal(JSON.stringify(questionState).includes("answerIndex"), false);
      assert.equal(JSON.stringify(questionState).includes("explanation"), false);
      room.send("answer", { requestId: randomUUID(), questionId: questionState.pendingQuestion!.id, choiceIndex: 0 });
      await waitFor((value) => value.phase === "reveal");
    }
  }
  const liveRooms = await (await call(`teacher/assignments/${activity.id}/rooms`, a)).json();
  assert.equal(liveRooms.length, 2);
  const controlPath = `teacher/assignments/${activity.id}/rooms/${liveRooms[0].id}/control`;
  assert.equal((await call(controlPath, b, { command: "pause" })).status, 404);
  assert.equal((await call(controlPath, a, { command: "pause" })).status, 200);
  assert.equal((await call(controlPath, a, { command: "resume" })).status, 200);
  assert.equal((await call(`teacher/assignments/${activity.id}/report`)).status, 401);
  assert.equal((await call(`teacher/assignments/${activity.id}/report`, b)).status, 404);
  const report = await (await call(`teacher/assignments/${activity.id}/report`, a)).json();
  assert.equal(report.sessions.length, 2);
  assert.ok(report.summary.some((row: any) => row.firstCorrect === 1 && row.answered === 1));
  const csv = await call(`teacher/assignments/${activity.id}/report?format=csv`, a);
  assert.match(csv.headers.get("content-type")!, /text\/csv/);
  assert.match(await csv.text(), /แรงลัพธ์/);
  assert.equal((await call(controlPath, a, { command: "end" })).status, 200);
  const { pool } = await import("../server/src/db/database");
  try {
    const saved = await pool.query("SELECT snapshot,sequence FROM game_sessions WHERE id=$1", [liveRooms[0].id]);
    assert.ok(saved.rows[0].sequence > 0);
    assert.ok(saved.rows[0].snapshot.public.players.length);
    await assert.rejects(pool.query("UPDATE question_set_versions SET version=99 WHERE id=$1", [version.id]), /immutable/);
    // An emptied lobby must not remain active forever in recovery/report data.
    const emptyTicket = await (await call("tickets/join", "", { assignmentToken: token, name: "Empty lobby QA", avatar: "astro" })).json();
    const emptyRoom = await new Client(base.replace(/^http/, "ws")).create("game", { name: "Empty lobby QA", avatar: "astro", assignmentToken: token, joinTicket: emptyTicket.ticket });
    emptyRoom.reconnection.enabled = false;
    emptyRoom.onMessage("snapshot", () => {});
    emptyRoom.onMessage("participantSession", () => {});
    const afterCreate = await (await call(`teacher/assignments/${activity.id}/rooms`, a)).json();
    const emptied = afterCreate.find((room: {id:string}) => !liveRooms.some((previous: {id:string}) => previous.id === room.id));
    assert.ok(emptied, "disposable lobby must be recorded");
    await emptyRoom.leave();
    const disposeDeadline = Date.now() + 5000;
    let emptyStatus = "";
    do {
      emptyStatus = (await pool.query("SELECT status FROM game_sessions WHERE id=$1", [emptied.id])).rows[0]?.status;
      if (emptyStatus === "abandoned") break;
      await new Promise(resolve => setTimeout(resolve, 50));
    } while (Date.now() < disposeDeadline);
    assert.equal(emptyStatus, "abandoned", "empty lobby must not block retention or recovery");
  } finally { await pool.end(); }
} finally {
  const ownedRooms = await (await call(`teacher/assignments/${activity.id}/rooms`, a)).json();
  for (const room of ownedRooms) if (!['game_over', 'abandoned', 'interrupted'].includes(room.status)) await call(`teacher/assignments/${activity.id}/rooms/${room.id}/control`, a, { command: "end" });
  for (const room of connections) await room.leave();
}
assert.equal((await call(`teacher/assignments/${activity.id}/close-entry`, a, {})).status, 200);
assert.equal((await (await call(`play/${token}`)).json()).status, "closed");
await call("auth/logout", a, {});
assert.equal((await call("teacher/classrooms", a)).status, 401);
await assert.rejects(new Client(base.replace(/^http/, "ws")).create("game", { name: "Closed activity", assignmentToken: token }));
console.log("PASS PostgreSQL classroom M2/M4/M5, teacher isolation, approval, immutable versions, two scoped live rooms, version-bound questions, checkpoint, closed entry, public allowlist, CSRF and logout");
