import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client, type Room } from "@colyseus/sdk";
import type { GameState } from "../shared/src/types";

const endpoint = process.env.VITE_SERVER_URL ?? "ws://localhost:2567";
const openRooms = new Set<Room<GameState>>();
const states = new Map<Room<GameState>, GameState>();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const intent = () => ({ requestId: randomUUID() });
type Identity = { participantId: string; reconnectToken: string; roomCode: string };

function watch(room: Room<GameState>): Room<GameState> {
  openRooms.add(room);
  room.onLeave(() => openRooms.delete(room));
  room.onMessage("snapshot", (state: GameState) => states.set(room, state));
  room.onMessage("tokenMove", () => undefined);
  room.onMessage("answerResult", () => undefined);
  return room;
}

async function identity(room: Room<GameState>): Promise<Identity> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("participant session timeout")), 3000);
    const off = room.onMessage("participantSession", (session: Identity) => {
      clearTimeout(timeout); off(); resolve(session);
    });
    room.send("getParticipantSession");
  });
}

async function waitFor(room: Room<GameState>, predicate: (state: GameState) => boolean): Promise<GameState> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const state = states.get(room);
    if (state && predicate(state)) return state;
    await delay(30);
  }
  throw new Error(`snapshot condition timeout; phase=${states.get(room)?.phase}`);
}

async function main(): Promise<void> {
  const host = watch(await new Client(endpoint).create<GameState>("game", { name: "Regression Host" }));
  const hostIdentity = await identity(host);
  await assert.rejects(new Client(endpoint).joinById(host.roomId, { ...hostIdentity }));
  assert.equal((await waitFor(host, (state) => state.players.length === 1)).players[0]?.connected, true);

  const guest = watch(await new Client(endpoint).joinById<GameState>(host.roomId, { name: "Regression Guest" }));
  const guestIdentity = await identity(guest);
  guest.send("start", intent());
  await identity(host); // request/response barrier, not a missing-snapshot assertion
  assert.equal(states.get(host)?.phase, "lobby");
  host.send("ready", intent());
  guest.send("ready", intent());
  await waitFor(host, (state) => state.players.every((player) => player.ready));
  host.send("start", intent());
  await waitFor(host, (state) => state.phase === "rolling");
  await guest.leave();
  await waitFor(host, (state) => state.players.some((player) => player.id === guestIdentity.participantId && !player.connected));
  const rejoined = watch(await new Client(endpoint).joinById<GameState>(host.roomId, guestIdentity));
  assert.equal((await identity(rejoined)).participantId, guestIdentity.participantId);
  await assert.rejects(new Client(endpoint).joinById(host.roomId, { name: "Regression Guest" }));
  console.log("PASS duplicate live identity, host permission, authenticated reconnect, nickname impersonation");

  const capacityHost = watch(await new Client(endpoint).create<GameState>("game", { name: "Capacity Host" }));
  await identity(capacityHost);
  const seats: Array<{ room: Room<GameState>; identity: Identity }> = [];
  for (let i = 0; i < 2; i++) {
    const room = watch(await new Client(endpoint).joinById<GameState>(capacityHost.roomId, { name: `Seat ${i}` }));
    seats.push({ room, identity: await identity(room) });
  }
  const racing = await Promise.allSettled(["Race A", "Race B"].map(async (name) => {
    const room = watch(await new Client(endpoint).joinById<GameState>(capacityHost.roomId, { name }));
    await identity(room);
    return room;
  }));
  assert.equal(racing.filter((result) => result.status === "fulfilled").length, 1);
  await waitFor(capacityHost, (state) => state.players.length === 4);
  const kicked = seats[0]!;
  capacityHost.send("kickPlayer", { ...intent(), playerId: kicked.identity.participantId });
  await waitFor(capacityHost, (state) => state.players.length === 3);
  const deadline = Date.now() + 3000;
  while (openRooms.has(kicked.room) && Date.now() < deadline) await delay(20);
  assert.equal(openRooms.has(kicked.room), false, "kicked transport must close");
  const replacement = watch(await new Client(endpoint).joinById<GameState>(capacityHost.roomId, { name: "Replacement" }));
  await identity(replacement);
  await waitFor(capacityHost, (state) => state.players.length === 4);
  console.log("PASS last-seat race, kicked transport closes, replacement takes returned seat");
}

try { await main(); }
finally {
  for (const room of [...openRooms]) if (openRooms.has(room)) await Promise.race([room.leave(), delay(1000)]);
}
