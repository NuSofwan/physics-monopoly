import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { Client, type Room } from "@colyseus/sdk";
import type { GameState, LearningReceipt } from "../shared/src/types";

const base = "http://localhost:2567", origin = "http://localhost:5174";
const duration = Number(process.env.QA_LOAD_MINUTES ?? 30) * 60_000;
assert.ok(duration >= 60_000 && duration <= 3_600_000);
const directory = `docs/qa/load-${Date.now()}`;
await mkdir(directory, { recursive: true });
async function request(path: string, body?: object, cookie = "") {
  const response = await fetch(`${base}/api/${path}`, { method: body ? "POST" : "GET", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  assert.ok(response.ok, `${path}: ${response.status}`); return response;
}
const login = await request("auth/dev", { teacher: "A" });
const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
const fixture = JSON.parse(await readFile("docs/qa/pdf/result.json", "utf8"));
const classroom = await (await request("teacher/classrooms", { title: `Load QA ${Date.now()}`, grade: 2, curriculumTrack: "พื้นฐาน", term: "QA", topic: "แรง", objectives: ["load testing only"] }, cookie)).json();
const activity = await (await request("teacher/assignments", { title: "60 synthetic students / 15 rooms", classroomId: classroom.id, versionId: fixture.versionId, durationMinutes: 40 }, cookie)).json();
const token = new URL(activity.joinUrl).pathname.split("/").at(-1);
type Seat = { room: Room; state?: GameState; id?: string; sent: Set<string>; pending: Map<string, number>; commandPending:Map<string,number>; receipt?:LearningReceipt; hint:boolean; retry:boolean };
const seats: Seat[] = [], latencies: number[] = [], errors: string[] = [];
const commandSamples:Record<string,number[]>={start:[],roll:[],buy:[],upgrade:[],hint:[],reflection:[]};
function acknowledged(seat:Seat,type:string){const sent=seat.commandPending.get(type);if(sent!==undefined){commandSamples[type]!.push(performance.now()-sent);seat.commandPending.delete(type);}}
let timer: ReturnType<typeof setInterval> | undefined;
const started = Date.now();
const result: Record<string, unknown> = { passed: false, mode: "SDK load (not a substitute for a concurrent real-browser room)", assignmentId: activity.id, startedAt: new Date().toISOString(), os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, ramBytes: os.totalmem(), node: process.version, rooms: 15, clients: 60, errors };
try {
  for (let group = 0; group < 15; group++) {
    let roomId = "";
    for (let index = 0; index < 4; index++) {
      const name = `Load ${group + 1}-${index + 1}`;
      const ticket = await (await request("tickets/join", { assignmentToken: token, name, avatar: "astro" })).json();
      const client = new Client(base), options = { name, avatar: "astro", assignmentToken: token, joinTicket: ticket.ticket };
      const room = index ? await client.joinById(roomId, options) : await client.create("game", options);
      roomId = room.roomId; room.reconnection.enabled = false;
      const seat: Seat = { room, sent: new Set(), pending: new Map(), commandPending:new Map(),hint:index===1,retry:index===0 }; seats.push(seat);
      room.onMessage("snapshot", (state: GameState) => { seat.state = state;
        if(state.phase==="rolling")acknowledged(seat,"start");
        if(state.phase==="moving")acknowledged(seat,"roll");
        if(state.phase==="answering"){acknowledged(seat,"buy");acknowledged(seat,"upgrade");}
      });
      room.onMessage("participantSession", (session: { participantId: string }) => { seat.id = session.participantId; });
      room.onMessage("learningReceipt", (receipt: LearningReceipt) => {
        seat.receipt=receipt;
        if(receipt.hint)acknowledged(seat,"hint");if(receipt.reflectionSaved)acknowledged(seat,"reflection");
        const key = `${receipt.questionId}:${receipt.retrySubmitted ? "retry" : "first"}`, sent = seat.pending.get(key);
        if (sent !== undefined && receipt.firstSubmitted) { latencies.push(performance.now() - sent); seat.pending.delete(key); }
      });
      for (const message of ["tokenMove", "answerResult"]) room.onMessage(message, () => {});
      room.onError((code, message) => errors.push(`${code}: ${message}`));
      room.send("getParticipantSession"); room.send("ready", { requestId: randomUUID() });
    }
    console.log(`Connected ${seats.length}/60`);
  }
  const sendOnce = (seat: Seat, key: string, type: string, payload: object = {}) => {
    if (seat.sent.has(key)) return; seat.sent.add(key);
    if(type in commandSamples)seat.commandPending.set(type,performance.now());
    seat.room.send(type, { requestId: randomUUID(), ...payload });
  };
  timer = setInterval(() => {
    for (const seat of seats) {
      const s = seat.state;
      if (!s || !seat.id || s.paused) continue;
      if (s.phase === "lobby" && s.hostId === seat.id && s.players.length === 4 && s.players.every(p => p.ready)) sendOnce(seat, "start", "start");
      const turn = `${s.turnCount}:${s.currentPlayerIndex}`;
      if (s.players[s.currentPlayerIndex]?.id === seat.id) {
        if (s.phase === "rolling") sendOnce(seat, `${turn}:roll`, "roll");
        if (s.phase === "buying") sendOnce(seat, `${turn}:buy`, s.tiles[s.players[s.currentPlayerIndex]!.tileIndex]!.ownerId?"upgrade":"buy");
      }
      const q = s.pendingQuestion;
      if (s.phase === "answering" && q) {
        const key = `${q.id}:${q.stage === "retry" ? "retry" : "first"}`;
        if(q.stage==="retry"&&(seat.receipt?.questionId!==q.id||seat.receipt.status!=="retry_open"))continue;
        if(seat.hint&&q.stage==="first"&&!seat.sent.has(key)&&!(seat.receipt?.questionId===q.id&&seat.receipt.hint)){sendOnce(seat,`${q.id}:hint`,"hint",{questionId:q.id});continue;}
        if (!seat.sent.has(key)) { seat.pending.set(key, performance.now()); sendOnce(seat, key, "answer", { questionId: q.id, choiceIndex: seat.retry&&q.stage==="first"?1:0 }); }
      }
      if(s.phase==="reveal"&&q&&seat.retry)sendOnce(seat,`${q.id}:reflection`,"reflection",{questionId:q.id});
    }
  }, 100);
  const activeSince = Date.now();
  while (Date.now() - activeSince < duration) {
    await new Promise(resolve => setTimeout(resolve, 10_000));
    await request(`teacher/assignments/${activity.id}/report`, undefined, cookie);
    console.log(`elapsed=${Math.round((Date.now()-activeSince)/1000)}s answerReceipts=${latencies.length} errors=${errors.length}`);
  }
  assert.equal(errors.length, 0); assert.ok(latencies.length >= 60, "all students must complete real answers");
  latencies.sort((a,b) => a-b);
  result.p95AnswerReceiptMs = latencies[Math.floor(latencies.length*.95)];
  result.samples = latencies.length; result.activeDurationSeconds = (Date.now()-activeSince)/1000;
  result.commandLatency=Object.fromEntries(Object.entries(commandSamples).map(([type,values])=>{values.sort((a,b)=>a-b);return [type,{samples:values.length,p95Ms:values.length?values[Math.floor(values.length*.95)]:null}];}));
  for(const[type,values]of Object.entries(commandSamples))if(values.length)assert.ok(values[Math.floor(values.length*.95)]!<=500,`${type} p95 exceeds 500ms`);
  assert.ok(Number(result.p95AnswerReceiptMs) <= 500, `p95 ${result.p95AnswerReceiptMs} exceeds 500 ms`);
  result.passed = true;
} catch(error) { result.failure = String(error); process.exitCode = 1; }
finally {
  if (timer) clearInterval(timer);
  result.elapsedSeconds = (Date.now()-started)/1000;
  try {
    const ownedRooms=await(await request(`teacher/assignments/${activity.id}/rooms`,undefined,cookie)).json();
    for(const room of ownedRooms)await request(`teacher/assignments/${activity.id}/rooms/${room.id}/control`,{command:"end"},cookie);
    result.syntheticRoomsEndedByHarness=true;
  } catch(error){result.cleanupFailure=String(error);result.passed=false;process.exitCode=1;}
  await Promise.all(seats.map(seat => seat.room.leave().catch(() => {})));
  await writeFile(`${directory}/result.json`, JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}
