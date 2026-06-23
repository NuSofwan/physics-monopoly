import type { Room } from "colyseus.js";
import { create } from "zustand";
import type { AnswerResult, GameState } from "@physics-monopoly/shared";

export interface MoveEvent {
  playerId: string;
  path: number[];
  dice: [number, number] | null;
  nonce: number;
}

interface GameStore {
  room: Room | null;
  state: GameState | null;
  playerId: string | null;
  moveEvent: MoveEvent | null;
  answerResult: AnswerResult | null;
  connected: boolean;
  error: string | null;
  setRoom: (room: Room | null) => void;
  setState: (state: GameState) => void;
  setPlayerId: (id: string | null) => void;
  setMoveEvent: (event: Omit<MoveEvent, "nonce">) => void;
  setAnswerResult: (result: AnswerResult | null) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  room: null,
  state: null,
  playerId: null,
  moveEvent: null,
  answerResult: null,
  connected: false,
  error: null,
  setRoom: (room) => set({ room }),
  setState: (state) => set({ state }),
  setPlayerId: (playerId) => set({ playerId }),
  setMoveEvent: (event) => set({ moveEvent: { ...event, nonce: Date.now() } }),
  setAnswerResult: (answerResult) => set({ answerResult }),
  setConnected: (connected) => set({ connected }),
  setError: (error) => set({ error }),
}));
