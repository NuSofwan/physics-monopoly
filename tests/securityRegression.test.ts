import { describe, expect, it, vi } from "vitest";
import { GameRoom } from "../server/src/rooms/GameRoom";
import { RequestGate } from "../server/src/logic/RequestGate";
import { chanceCards, createInitialGameState, createPlayer } from "../shared/src";
import { useGameStore } from "../client/src/store/gameStore";

function fixture() {
  // Exercise real room methods without Colyseus timers/network in unit tests.
  const room = Object.create(GameRoom.prototype);
  Object.defineProperty(room, "state", { value: createInitialGameState("QATEST"), writable: true });
  room.state.players.push(createPlayer("p1", "Host QA", "astro"), createPlayer("p2", "Guest QA", "robot"));
  room.participantBySession = new Map([["s1", "p1"], ["s2", "p2"]]);
  room.reconnectTokenByParticipant = new Map([["p1", "token1"], ["p2", "token2"]]);
  room.pendingAnswers = new Map();
  room.commands = Promise.resolve();
  room.writes = Promise.resolve();
  room.disconnectedAt = new Map();
  room.requestGate = new RequestGate();
  room.broadcast = vi.fn();
  room.clients = [{ sessionId: "s1", leave: vi.fn() }, { sessionId: "s2", leave: vi.fn() }];
  return room;
}

describe("review regressions", () => {
  it("retains replay protection when the request ledger is restored", () => {
    const original = new RequestGate();
    expect(original.accept("p1", "request_0001")).toBe(true);
    const restored = new RequestGate(); restored.restore(original.serialize());
    expect(restored.accept("p1", "request_0001")).toBe(false);
    expect(restored.accept("p1", "request_0002")).toBe(true);
  });
  it("clears the previous answer on a new presentation, preserving it during reveal", () => {
    const store = useGameStore.getState();
    const room = fixture();
    room.askQuestion(room.state.players[0], "challenge", undefined, "easy");
    store.setState(room.state);
    store.setAnswerResult({ questionId: room.state.pendingQuestion.id, correct: true, correctChoice: 0, explanation: "old", moneyDelta: 0, xpDelta: 10 });
    store.setState({ ...room.state, phase: "reveal" });
    expect(useGameStore.getState().answerResult).not.toBeNull();
    room.askQuestion(room.state.players[0], "challenge", undefined, "easy");
    store.setState({ ...room.state });
    expect(useGameStore.getState().answerResult).toBeNull();
    store.setAnswerResult({ questionId: "stale-question", correct: true, correctChoice: 0, explanation: "stale", moneyDelta: 0, xpDelta: 10 });
    expect(useGameStore.getState().answerResult).toBeNull();
  });

  it("rejects a second socket for a connected participant, including a join race", async () => {
    const room = fixture();
    const options = { participantId: "p1", reconnectToken: "token1" };
    expect(room.onAuth({}, options)).toBe(false);
    await expect(room.onJoin({ sessionId: "duplicate" }, options)).rejects.toThrow();
    expect(room.participantBySession.size).toBe(2);
    room.state.phase = "rolling";
    await room.onLeave(room.clients[0]);
    expect(room.onAuth({}, options)).toBe(true);
    await room.onJoin({ sessionId: "rejoined" }, options);
    expect(room.state.players[0].connected).toBe(true);
  });

  it("rejects malformed auth and invalid credentials instead of creating another participant", () => {
    const room = fixture();
    expect(room.onAuth({}, { participantId: {}, reconnectToken: [] })).toBe(false);
    expect(room.onAuth({}, { name: "Valid Name", participantId: "p1", reconnectToken: "wrong" })).toBe(false);
    expect(room.onAuth({}, { name: {} })).toBe(false);
  });

  it("expires property selection instead of stalling the room", () => {
    const room = fixture();
    room.state.phase = "rolling";
    room.state.players[0].tileIndex = 1;
    room.resolveLanding("p1");
    expect(room.state.phase).toBe("buying");
    expect(room.state.turnDeadline).toBeGreaterThan(Date.now());
    room.state.turnDeadline = Date.now() - 1;
    room.checkTurnTimeout();
    expect(room.state.phase).toBe("rolling");
    expect(room.state.currentPlayerIndex).toBe(1);
  });

  it("disconnects kicked sockets and revokes credentials", () => {
    const room = fixture();
    room.kickPlayer(room.clients[0], { requestId: "kick_request_1", playerId: "p2" });
    expect(room.clients[1].leave).toHaveBeenCalledOnce();
    expect(room.participantBySession.has("s2")).toBe(false);
    expect(room.reconnectTokenByParticipant.has("p2")).toBe(false);
    expect(room.state.players).toHaveLength(1);
  });

  it("clears the stale disconnectedAt entry when a previously-disconnected player is kicked", () => {
    const room = fixture();
    room.disconnectedAt.set("p2", Date.now() - 1000);
    room.kickPlayer(room.clients[0], { requestId: "kick_request_2", playerId: "p2" });
    expect(room.disconnectedAt.has("p2")).toBe(false);
  });

  it("moves a player along a chance 'move' card without inventing an out-of-range dice pair", () => {
    const room = fixture();
    const moveCardIndex = chanceCards.findIndex((card) => card.effect === "move");
    expect(moveCardIndex).toBeGreaterThanOrEqual(0);
    const random = vi.spyOn(Math, "random").mockReturnValue(moveCardIndex / chanceCards.length);
    room.state.phase = "rolling";
    room.state.players[0].tileIndex = 25;
    room.resolveChance(room.state.players[0]);
    random.mockRestore();
    const card = chanceCards[moveCardIndex]!;
    expect(room.state.players[0].tileIndex).toBe(card.moveTo);
    expect(room.broadcast).toHaveBeenCalledWith("tokenMove", expect.objectContaining({ playerId: "p1", dice: null }));
    const call = room.broadcast.mock.calls.find(([event]: [string]) => event === "tokenMove");
    expect(call?.[1].path.every((tile: number) => tile >= 0 && tile < room.state.tiles.length)).toBe(true);
  });

  it("keeps reveal visible, awards only once, then closes it on a bounded timer", () => {
    const room = fixture();
    room.askQuestion(room.state.players[0], "challenge", undefined, "easy");
    const pending = room.state.pendingQuestion;
    const question = room.pendingAnswers.get(pending.id);
    const payload = { requestId: "answer_request_1", questionId: pending.id, choiceIndex: question.answerIndex };
    room.answer(room.clients[0], payload);
    const xp = room.state.players[0].xp;
    expect(room.state.phase).toBe("reveal");
    expect(room.state.pendingQuestion.id).toBe(pending.id);
    room.answer(room.clients[0], { ...payload, requestId: "answer_request_2" });
    expect(room.state.players[0].xp).toBe(xp);
    room.state.turnDeadline = Date.now() - 1;
    room.checkTurnTimeout();
    expect(room.state.pendingQuestion).toBeNull();
    expect(room.state.phase).toBe("rolling");
  });

  it("rejects late answers even before the timer callback runs", () => {
    const room = fixture();
    room.askQuestion(room.state.players[0], "challenge", undefined, "easy");
    const pending = room.state.pendingQuestion;
    pending.deadline = Date.now() - 1;
    const answerIndex = room.pendingAnswers.get(pending.id).answerIndex;
    room.answer(room.clients[0], { requestId: "late_answer_1", questionId: pending.id, choiceIndex: answerIndex });
    expect(room.state.players[0].xp).toBe(0);
    expect(room.state.phase).toBe("answering");
    room.checkQuestionTimeout();
    expect(room.state.phase).toBe("reveal");
  });

  it("rejects jail question replacement and out-of-phase sales", () => {
    const room = fixture();
    room.state.players[0].inJail = true;
    room.state.phase = "rolling";
    room.askJailQuestion(room.clients[0], { requestId: "jail_request_1" });
    const id = room.state.pendingQuestion.id;
    room.askJailQuestion(room.clients[0], { requestId: "jail_request_2" });
    expect(room.state.pendingQuestion.id).toBe(id);
    room.state.tiles[1].ownerId = "p1";
    room.sellOwnedProperty(room.clients[0], { requestId: "sale_request_1", tileIndex: 1 });
    expect(room.state.tiles[1].ownerId).toBe("p1");
  });

  it("rejects purchase decisions after the action deadline", () => {
    const room = fixture();
    room.state.phase = "buying";
    room.state.players[0].tileIndex = 1;
    room.state.turnDeadline = Date.now() - 1;
    room.requestBuy(room.clients[0], { requestId: "expired_purchase" });
    expect(room.state.pendingQuestion).toBeNull();
  });

  it.each([1, 2, 3, 4])("eventually finishes a %i-player room even if every turn times out", (count) => {
    const room = fixture();
    room.state.players = Array.from({ length: count }, (_, index) => createPlayer(`p${index}`, `Player ${index}`, "astro"));
    room.state.phase = "rolling";
    for (let i = 0; i < 82 && room.state.phase !== "game_over"; i++) {
      room.state.turnDeadline = Date.now() - 1;
      room.checkTurnTimeout();
    }
    expect(room.state.phase).toBe("game_over");
    expect(room.state.winnerId).not.toBeNull();
  });
});

describe("request replay protection", () => {
  it("never forgets the first ID when more than 2048 other IDs arrive", () => {
    const gate = new RequestGate();
    expect(gate.accept("p1", "original_request", 0)).toBe(true);
    for (let i = 1; i <= 3000; i++) expect(gate.accept("p1", `request_${i}`, i * 10001)).toBe(true);
    expect(gate.accept("p1", "original_request", 40000000)).toBe(false);
    expect(gate.accept("p2", "original_request", 40000000)).toBe(true);
  });
  it("rate limits floods and refuses overflow without discarding IDs", () => {
    const gate = new RequestGate();
    for (let i = 0; i < 60; i++) expect(gate.accept("p1", `request_${i}`, 0)).toBe(true);
    expect(gate.accept("p1", "overflow_request", 1)).toBe(false);
    for (let i = 60; i < 10000; i++) expect(gate.accept("p1", `request_${i}`, i * 10001)).toBe(true);
    expect(gate.accept("p1", "another_request", 200000000)).toBe(false);
    expect(gate.accept("p1", "request_0", 200000000)).toBe(false);
  });

  it("carries the burst-rate window across a restore, not just the replay ledger", () => {
    const original = new RequestGate();
    for (let i = 0; i < 60; i++) expect(original.accept("p1", `request_${i}`, 0)).toBe(true);
    // Burst window is full; without persisting it a restore would silently reset the limiter.
    expect(original.accept("p1", "overflow_before_restore", 1)).toBe(false);
    const restored = new RequestGate();
    restored.restore(original.serialize());
    expect(restored.accept("p1", "overflow_after_restore", 2)).toBe(false);
    // Once the 10s window has actually elapsed, new requests are allowed again.
    expect(restored.accept("p1", "next_window_request", 11000)).toBe(true);
  });

  it("still restores an older bare-array request ledger (pre-windows persistence format)", () => {
    const original = new RequestGate();
    expect(original.accept("p1", "legacy_request", 0)).toBe(true);
    const legacySeenOnly = original.serialize().seen;
    const restored = new RequestGate();
    restored.restore(legacySeenOnly);
    expect(restored.accept("p1", "legacy_request", 1)).toBe(false);
    expect(restored.accept("p1", "fresh_request", 1)).toBe(true);
  });

  it("does not let the burst-window count run away past the reject threshold, so restore never throws", () => {
    const original = new RequestGate();
    // Send far more than 1000 requests within a single 10s window; every one past 60 should be rejected
    // without the internal counter climbing past what restore() will accept.
    for (let i = 0; i < 1500; i++) {
      const accepted = original.accept("p1", `request_${i}`, 0);
      expect(accepted).toBe(i < 60);
    }
    const serialized = original.serialize();
    const [, window] = serialized.windows.find(([id]) => id === "p1")!;
    expect(window.count).toBeLessThanOrEqual(60);
    const restored = new RequestGate();
    expect(() => restored.restore(serialized)).not.toThrow();
    // The window is still full immediately after restore (same 10s window).
    expect(restored.accept("p1", "still_over_limit", 1)).toBe(false);
    // Once the window elapses, new requests succeed again.
    expect(restored.accept("p1", "next_window_request", 11000)).toBe(true);
  });
});
