import type { Room } from "@colyseus/sdk";
import { create } from "zustand";
import type { AnswerResult, GameState, LearningReceipt } from "@physics-monopoly/shared";

export interface MoveEvent {
  playerId: string;
  path: number[];
  dice: [number, number] | null;
  nonce: number;
}

interface GameStore {
  learningReceipt: LearningReceipt | null;
  setLearningReceipt: (receipt: LearningReceipt) => void;
  room: Room | null;
  state: GameState | null;
  playerId: string | null;
  moveEvent: MoveEvent | null;
  answerResult: AnswerResult | null;
  connected: boolean;
  error: string | null;
  setRoom: (room: Room | null) => void;
  setState: (state: GameState | null) => void;
  setPlayerId: (id: string | null) => void;
  setMoveEvent: (event: Omit<MoveEvent, "nonce">) => void;
  setAnswerResult: (result: AnswerResult | null) => void;
  setConnected: (connected: boolean) => void;
  setError: (error: string | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  learningReceipt: null,
  setLearningReceipt: (receipt) => set((previous) => ({ learningReceipt: receipt.questionId === previous.state?.pendingQuestion?.id ? receipt : previous.learningReceipt })),
  room: null,
  state: null,
  playerId: null,
  moveEvent: null,
  answerResult: null,
  connected: false,
  error: null,
  setRoom: (room) => set({ room }),
  setState: (state) => set((previous) => ({
    state,
    answerResult: previous.answerResult?.questionId === state?.pendingQuestion?.id ? previous.answerResult : null,
    learningReceipt: previous.learningReceipt?.questionId === state?.pendingQuestion?.id ? previous.learningReceipt : null,
  })),
  setPlayerId: (playerId) => set({ playerId }),
  setMoveEvent: (event) => set({ moveEvent: { ...event, nonce: Date.now() } }),
  setAnswerResult: (answerResult) => set((previous) => ({
    answerResult: answerResult?.questionId === previous.state?.pendingQuestion?.id ? answerResult : null,
  })),
  setConnected: (connected) => set({ connected }),
  setError: (error) => set({ error }),
}));
