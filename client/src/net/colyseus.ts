import { Client, type Room } from "@colyseus/sdk";
import type { GameState, Appearance } from "@physics-monopoly/shared";
import { useGameStore } from "../store/gameStore";

const serverUrl = (import.meta.env.VITE_SERVER_URL || "ws://localhost:2567").replace(/\/+$/, "");
export const apiUrl = (import.meta.env.VITE_API_URL || serverUrl.replace(/^ws/, "http")).replace(/\/+$/, "");
const participantSessionKey = "physics-monopoly-participant-session";
export function assignmentToken(): string | undefined {
  return window.location.pathname.match(/^\/play\/([A-Za-z0-9_-]{43})\/?$/)?.[1];
}
let connectionGeneration = 0;

interface ParticipantSession {
  activityScope?: string;
  participantId: string;
  reconnectToken: string;
  roomCode: string;
  roomId?: string;
}

export async function createGame(name: string, avatar: string, mapId = "bangkok", appearance?: Appearance): Promise<void> {
  await connect("create", undefined, name, avatar, mapId, appearance);
}

export async function joinGame(roomCode: string, name: string, avatar: string, appearance?: Appearance): Promise<void> {
  await connect("join", roomCode.trim().toUpperCase(), name, avatar, undefined, appearance);
}

async function connect(mode: "create" | "join", roomCode: string | undefined, name: string, avatar: string, mapId?: string, appearance?: Appearance): Promise<void> {
  const generation = ++connectionGeneration;
  const store = useGameStore.getState();
  store.setError(null);
  const previousRoom = store.room;
  if (previousRoom && store.connected) await previousRoom.leave();
  const client = new Client(serverUrl);
  const savedSession = mode === "join" ? loadParticipantSession(roomCode) : null;
  let joinTicket: string | undefined;
  let rejoin: { roomId: string; ticket: string } | undefined;
  if (assignmentToken()) {
    if (savedSession) rejoin = await ticketRequest("rejoin", savedSession);
    else joinTicket = (await ticketRequest("join", { assignmentToken: assignmentToken(), name, avatar })).ticket;
  }
  const options = {
    appearance,
    name,
    avatar,
    ...(mapId ? { mapId } : {}),
    ...(assignmentToken() ? { assignmentToken: assignmentToken()! } : {}),
    ...(savedSession ? { participantId: savedSession.participantId, reconnectToken: savedSession.reconnectToken } : {}),
    ...(joinTicket ? { joinTicket } : {}),
    ...(rejoin ? { rejoinTicket: rejoin.ticket } : {}),
  };
  const room = mode === "create" ? await client.create<GameState>("game", options) : (rejoin?.roomId ?? savedSession?.roomId) ? await rejoinAfterTransportClose(client, (rejoin?.roomId ?? savedSession!.roomId)!, options) : await joinByRoomCode(client, roomCode ?? "", options);
  if (generation !== connectionGeneration) { await room.leave(); return; }
  bindRoom(room, generation, name, avatar, appearance);
}

function bindRoom(room: Room<GameState>, generation: number, name: string, avatar: string, appearance?: Appearance): void {
  // Application identity/tickets own recovery; do not also retry obsolete framework room IDs.
  room.reconnection.enabled = false;
  const store = useGameStore.getState();
  store.setRoom(room);
  store.setConnected(true);
  store.setError(null);
  // Reconnects call bindRoom without an appearance; keep whatever was last persisted instead of clobbering it with {}.
  const persistedAppearance = appearance ?? loadProfileAppearance();
  localStorage.setItem("physics-monopoly-profile", JSON.stringify({ name, avatar, appearance: persistedAppearance }));

  const isCurrent = () => generation === connectionGeneration && useGameStore.getState().room === room;
  room.onMessage("snapshot", (state: GameState) => { if (isCurrent()) useGameStore.getState().setState(state); });
  room.onMessage("participantSession", (session: ParticipantSession) => {
    if (!isCurrent()) return;
    sessionStorage.setItem(participantSessionKey, JSON.stringify({ ...session, roomId: room.roomId, activityScope: assignmentToken() ?? "" }));
    useGameStore.getState().setPlayerId(session.participantId);
  });
  room.onMessage("tokenMove", (event: { playerId: string; path: number[]; dice: [number, number] | null }) => {
    if (!isCurrent()) return;
    useGameStore.getState().setMoveEvent(event);
  });
  room.onMessage("answerResult", (result) => { if (isCurrent()) useGameStore.getState().setAnswerResult(result); });
  room.onMessage("learningReceipt", (receipt) => { if (isCurrent()) useGameStore.getState().setLearningReceipt(receipt); });
  room.onLeave((code) => {
    if (generation !== connectionGeneration) return;
    useGameStore.getState().setConnected(false);
    if (code === 1000 || code === 4000) {
      useGameStore.getState().setRoom(null);
      useGameStore.getState().setState(null);
      useGameStore.getState().setPlayerId(null);
      sessionStorage.removeItem(participantSessionKey);
      if (code === 4000) useGameStore.getState().setError("เจ้าของห้องนำคุณออกจากห้องแล้ว");
    } else {
      void reconnect(room.roomId, generation, name, avatar);
    }
  });
  room.send("getParticipantSession");
}

async function rejoinAfterTransportClose(client: Client, roomId: string, options: object): Promise<Room<GameState>> {
  // A refresh can beat the old WebSocket's close notification at a full room.
  // Retry briefly without accepting simultaneous connections or weakening auth.
  for (let attempt = 0; ; attempt++) {
    try { return await client.joinById<GameState>(roomId, options); }
    catch (error) {
      if (attempt >= 4 || !(error instanceof Error) || !/locked|onAuth failed/.test(error.message)) throw error;
      await new Promise((resolve) => window.setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
}

export function savedRoomCode(): string | null {
  try {
    const session = JSON.parse(sessionStorage.getItem(participantSessionKey) ?? "null") as ParticipantSession | null;
    return session && (session.activityScope ?? "") === (assignmentToken() ?? "") && typeof session.roomCode === "string" && /^[A-Z2-9]{6}$/.test(session.roomCode) ? session.roomCode : null;
  } catch { return null; }
}

export async function loadPersonalResults(roomCode: string, signal: AbortSignal): Promise<unknown> {
  const session = loadParticipantSession(roomCode);
  if (!session?.activityScope) throw new Error("ไม่พบสิทธิ์อ่านผลของคุณในอุปกรณ์นี้");
  const response = await fetch(`${apiUrl}/api/tickets/results`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(session), signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "ไม่สามารถอ่านผลได้");
  return result;
}

async function reconnect(roomId: string, generation: number, name: string, avatar: string): Promise<void> {
  const startedAt = Date.now();
  let attempt = 0;
  while (generation === connectionGeneration && Date.now() - startedAt < 120000) {
    useGameStore.getState().setError("การเชื่อมต่อขาด กำลังกลับเข้าเกมเดิม…");
    await new Promise((resolve) => window.setTimeout(resolve, Math.min(500 * 2 ** attempt++, 5000)));
    if (generation !== connectionGeneration) return;
    const session = loadParticipantSession(useGameStore.getState().state?.roomCode);
    if (!session) break;
    try {
      const renewed = session.activityScope ? await ticketRequest("rejoin", session) : undefined;
      const room = await new Client(serverUrl).joinById<GameState>(renewed?.roomId ?? roomId, { name, avatar, participantId: session.participantId, reconnectToken: session.reconnectToken, ...(renewed ? { rejoinTicket: renewed.ticket } : {}) });
      if (generation !== connectionGeneration) { await room.leave(); return; }
      bindRoom(room, generation, name, avatar);
      return;
    } catch { /* The server may still be retiring the old transport. Retry with backoff. */ }
  }
  if (generation === connectionGeneration) useGameStore.getState().setError("กลับเข้าเกมไม่สำเร็จ กรุณาตรวจเครือข่ายแล้วรีโหลดหน้าเว็บเพื่อเข้าห้องเดิม");
}
async function ticketRequest(action: "join" | "rejoin", body: object): Promise<{ ticket: string; roomId: string }> {
  const response = await fetch(`${apiUrl}/api/tickets/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "ขอตั๋วเข้าร่วมไม่สำเร็จ");
  return result;
}

export function leaveGame(): void {
  ++connectionGeneration;
  const store = useGameStore.getState();
  if (store.connected) void store.room?.leave();
  store.setConnected(false);
  store.setRoom(null);
  store.setState(null);
  store.setPlayerId(null);
  store.setError(null);
  sessionStorage.removeItem(participantSessionKey);
}

export function sendReady(): void {
  send("ready");
}
export function sendMap(mapId: string): void { send("selectMap", { mapId }); }

export function sendStart(): void {
  send("start");
}

export function sendRoll(): void {
  send("roll");
}

export function sendBuy(): void {
  send("buy");
}

export function sendUpgrade(): void {
  send("upgrade");
}

export function sendSkipBuy(): void {
  send("skipBuy");
}

export function sendAnswer(questionId: string, choiceIndex: number): void {
  const pending=useGameStore.getState().state?.pendingQuestion;
  const choiceId=pending?.id===questionId?pending.question.choiceIds?.[choiceIndex]:undefined;
  send("answer", { questionId, choiceIndex, ...(choiceId?{choiceId}:{}) });
}
export function sendHint(questionId: string): void { send("hint", { questionId }); }
export function sendReflection(questionId: string): void { send("reflection", { questionId }); }
export function sendNumericAnswer(questionId: string, value: string, unit: string): void {
  send("answer", { questionId, choiceIndex: -1, numericAnswer: { value, unit } });
}

export function sendPayJailFine(): void {
  send("payJailFine");
}

export function sendJailQuestion(): void {
  send("jailQuestion");
}

export function sendSellProperty(tileIndex: number): void {
  send("sellProperty", { tileIndex });
}

export function sendKickPlayer(playerId: string): void {
  send("kickPlayer", { playerId });
}

function send(type: string, payload: Record<string, unknown> = {}): void {
  const store = useGameStore.getState();
  if (store.connected) store.room?.send(type, { ...payload, requestId: createRequestId() });
}

function createRequestId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadProfileAppearance(): Appearance {
  try {
    const saved = JSON.parse(localStorage.getItem("physics-monopoly-profile") ?? "{}") as { appearance?: Appearance };
    return saved.appearance ?? {};
  } catch {
    return {};
  }
}

function loadParticipantSession(roomCode: string | undefined): ParticipantSession | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(participantSessionKey) ?? "null") as ParticipantSession | null;
    return parsed && parsed.roomCode === roomCode && (parsed.activityScope ?? "") === (assignmentToken() ?? "") ? parsed : null;
  } catch {
    return null;
  }
}

async function joinByRoomCode(client: Client, roomCode: string, options: { assignmentToken?: string }): Promise<Room<GameState>> {
  const suffix = options.assignmentToken ? `?assignmentToken=${encodeURIComponent(options.assignmentToken)}` : "";
  const response = await fetch(`${apiUrl}/api/rooms/${encodeURIComponent(roomCode)}${suffix}`);
  const payload = (await response.json()) as { roomId?: string; error?: string };
  if (!response.ok || !payload.roomId) throw new Error(payload.error ?? "ไม่พบห้องหรือห้องปิดรับผู้เล่นแล้ว");
  return client.joinById<GameState>(payload.roomId, options);
}
