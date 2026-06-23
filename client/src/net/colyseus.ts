import { Client } from "colyseus.js";
import type { GameState } from "@physics-monopoly/shared";
import { useGameStore } from "../store/gameStore";

const serverUrl = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";

export async function createGame(name: string, avatar: string): Promise<void> {
  await connect("create", undefined, name, avatar);
}

export async function joinGame(roomCode: string, name: string, avatar: string): Promise<void> {
  await connect("join", roomCode.trim().toUpperCase(), name, avatar);
}

async function connect(mode: "create" | "join", roomCode: string | undefined, name: string, avatar: string): Promise<void> {
  const store = useGameStore.getState();
  store.setError(null);
  const client = new Client(serverUrl);
  const room =
    mode === "create"
      ? await client.create<GameState>("game", { name, avatar })
      : await client.joinById<GameState>(roomCode ?? "", { name, avatar });

  store.setRoom(room);
  store.setPlayerId(room.sessionId);
  store.setConnected(true);
  localStorage.setItem("physics-monopoly-profile", JSON.stringify({ name, avatar, roomCode: room.roomId }));

  room.onMessage("snapshot", (state: GameState) => useGameStore.getState().setState(state));
  room.onMessage("tokenMove", (event: { playerId: string; path: number[]; dice: [number, number] | null }) => {
    useGameStore.getState().setMoveEvent(event);
  });
  room.onMessage("answerResult", (result) => useGameStore.getState().setAnswerResult(result));
  room.onLeave(() => useGameStore.getState().setConnected(false));
}

export function sendReady(): void {
  useGameStore.getState().room?.send("ready");
}

export function sendStart(): void {
  useGameStore.getState().room?.send("start");
}

export function sendRoll(): void {
  useGameStore.getState().room?.send("roll");
}

export function sendBuy(): void {
  useGameStore.getState().room?.send("buy");
}

export function sendUpgrade(): void {
  useGameStore.getState().room?.send("upgrade");
}

export function sendSkipBuy(): void {
  useGameStore.getState().room?.send("skipBuy");
}

export function sendAnswer(questionId: string, choiceIndex: number): void {
  useGameStore.getState().room?.send("answer", { questionId, choiceIndex });
}

export function sendPayJailFine(): void {
  useGameStore.getState().room?.send("payJailFine");
}

export function sendJailQuestion(): void {
  useGameStore.getState().room?.send("jailQuestion");
}

export function sendTrade(toPlayerId: string, tileIndex: number, money: number): void {
  useGameStore.getState().room?.send("trade", { toPlayerId, tileIndex, money });
}
