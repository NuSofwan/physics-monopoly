import { Client, type Room } from "@colyseus/sdk";
import type { GameState } from "../shared/src/types";

const endpoint = process.env.VITE_SERVER_URL ?? "ws://localhost:2567";

interface ParticipantSession {
  participantId: string;
  reconnectToken: string;
  roomCode: string;
}

async function main(): Promise<void> {
  const hostClient = new Client(endpoint);
  const guestClient = new Client(endpoint);
  const host = await hostClient.create<GameState>("game", { name: "Host QA", avatar: "astro" });
  const hostSession = await requestSession(host);
  const guest = await guestClient.joinById<GameState>(await roomIdFor(hostSession.roomCode), { name: "Guest QA", avatar: "robot" });
  const guestSession = await requestSession(guest);

  let latest: GameState | undefined;
  host.onMessage("snapshot", (state: GameState) => {
    latest = state;
  });
  guest.onMessage("snapshot", () => undefined);

  // A non-host start intent must not change the lobby state.
  guest.send("start", request());
  await pause(120);
  if (latest?.phase && latest.phase !== "lobby") throw new Error("non-host started the game");

  host.send("ready", request());
  guest.send("ready", request());
  await pause(120);
  host.send("start", request());
  const started = await waitForSnapshot(host, (state) => state.phase === "rolling");
  if (started.players.length !== 2) throw new Error("unexpected player count after start");

  // Trade has no server handler in the classroom ruleset.
  guest.send("trade", { ...request(), toPlayerId: hostSession.participantId, tileIndex: 1, money: 999999 });
  await pause(120);
  if (latest?.phase === "auctioning" || latest?.tradeOffers.length) throw new Error("disabled advanced economy command changed state");

  // Nickname alone cannot join an in-progress game or claim the disconnected host.
  await host.leave();
  const reconnectClient = new Client(endpoint);
  const rejoined = await reconnectClient.joinById<GameState>(host.roomId, {
    name: "not-used-for-auth",
    avatar: "girl",
    participantId: hostSession.participantId,
    reconnectToken: hostSession.reconnectToken,
  });
  const rejoinedSession = await requestSession(rejoined);
  if (rejoinedSession.participantId !== hostSession.participantId) throw new Error("reconnect changed participant identity");
  const imposterClient = new Client(endpoint);
  await expectReject(() => imposterClient.joinById<GameState>(host.roomId, { name: "Host QA", avatar: "girl" }));

  // A distinct lobby accepts four human players and rejects the fifth at the server.
  const capacityOwner = new Client(endpoint);
  const capacityRoom = await capacityOwner.create<GameState>("game", { name: "Capacity 1", avatar: "astro" });
  capacityRoom.onMessage("snapshot", () => {});
  const capacityClients = ["Capacity 2", "Capacity 3", "Capacity 4"].map(() => new Client(endpoint));
  const capacityRooms = await Promise.all(
    capacityClients.map((client, index) => client.joinById<GameState>(capacityRoom.roomId, { name: `Capacity ${index + 2}`, avatar: "robot" })),
  );
  capacityRooms.forEach(room => room.onMessage("snapshot", () => {}));
  const fifthClient = new Client(endpoint);
  await expectReject(() => fifthClient.joinById<GameState>(capacityRoom.roomId, { name: "Capacity 5", avatar: "girl" }));

  await verifyStartSizes();
  process.stdout.write(`${JSON.stringify({ ok: true, roomCode: hostSession.roomCode, guestParticipant: guestSession.participantId })}\n`);
  void guest.leave();
  void rejoined.leave();
  void capacityRoom.leave();
  capacityRooms.forEach((room) => void room.leave());
}

function request(): { requestId: string } {
  return { requestId: crypto.randomUUID() };
}

function requestSession(room: Room<GameState>): Promise<ParticipantSession> {
  room.reconnection.enabled = false;
  room.onMessage("snapshot", () => {});
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("participant session message timed out")), 2_000);
    room.onMessage("participantSession", (session: ParticipantSession) => {
      clearTimeout(timeout);
      resolve(session);
    });
    room.send("getParticipantSession");
  });
}

function waitForSnapshot(room: Room<GameState>, predicate: (state: GameState) => boolean): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("snapshot predicate timed out")), 3_000);
    room.onMessage("snapshot", (state: GameState) => {
      if (predicate(state)) {
        clearTimeout(timeout);
        resolve(state);
      }
    });
  });
}

async function expectReject(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error("expected server to reject join");
}

async function roomIdFor(roomCode: string): Promise<string> {
  const httpEndpoint = endpoint.replace(/^ws/, "http");
  const response = await fetch(`${httpEndpoint}/api/rooms/${encodeURIComponent(roomCode)}`);
  const payload = (await response.json()) as { roomId?: string };
  if (!response.ok || !payload.roomId) throw new Error("room-code lookup did not return an internal room ID");
  return payload.roomId;
}

async function verifyStartSizes(): Promise<void> {
  for (const size of [1, 2, 3, 4]) {
    const ownerClient = new Client(endpoint);
    const owner = await ownerClient.create<GameState>("game", { name: `Size ${size} host`, avatar: "astro" });
    let latest: GameState | undefined;
    owner.onMessage("snapshot", (state: GameState) => {
      latest = state;
    });
    const guests = await Promise.all(
      Array.from({ length: size - 1 }, (_, index) =>
        new Client(endpoint).joinById<GameState>(owner.roomId, { name: `Size ${size} guest ${index + 1}`, avatar: "robot" }),
      ),
    );
    guests.forEach(room => room.onMessage("snapshot", () => {}));
    owner.send("ready", request());
    guests.forEach((room) => room.send("ready", request()));
    await pause(100);
    owner.send("start", request());
    const started = await waitForSnapshot(owner, (state) => state.phase === "rolling");
    if (started.players.length !== size || latest?.phase !== "rolling") throw new Error(`room size ${size} did not start correctly`);
    void owner.leave();
    guests.forEach((room) => void room.leave());
  }
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
