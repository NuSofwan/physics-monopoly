import { describe, it, expect } from "vitest";
import { createInitialGameState, createPlayer, currentPlayer, classroomBoard, type Question } from "../shared/src/index";
import { ClassroomGame } from "../server/src/logic/ClassroomGame";
const question: Question = { id: "qa", prompt: "แรง 1 N + 2 N", choices: ["3 N", "2 N"], answerIndex: 0, explanation: "เฉลยลับบวกแรง", hint: "พิจารณาทิศ", difficulty: "easy", topic: "mechanics", timeLimitSec: 30 };
function setup(count = 4, dice: [number,number] = [1,1]) {
  let time = 1000;
  const state = createInitialGameState("ABC234");
  state.players = Array.from({ length: count }, (_, i) => createPlayer(`p${i}`, `Player ${i}`, "astro"));
  const events: Array<{ id?: string; type: string; value: any }> = [];
  const game = new ClassroomGame(state, [question], 15, { snapshot: () => events.push({ type: "snapshot", value: structuredClone(state) }), event: (type,value) => events.push({ type,value }), privateEvent: (id,type,value) => events.push({ id,type,value }) }, () => time, () => dice);
  game.start();
  const advance = (ms: number) => { time += ms; game.tick(); };
  const open = (action = "skipBuy") => { game.command(currentPlayer(state)!.id, "roll", {}); advance(3000); if (state.phase === "buying") game.command(currentPlayer(state)!.id, action, {}); };
  const answer = (id: string, choiceIndex: number) => game.command(id, "answer", { questionId: state.pendingQuestion!.id, choiceIndex });
  return { state, game, events, advance, open, answer };
}
describe("classroom learning loop", () => {
  it("uses stable choice IDs and rejects conflicting positional submissions",()=>{
    const {state,game,open}=setup(1);open();const id=state.players[0]!.id,questionId=state.pendingQuestion!.id;
    game.command(id,"answer",{questionId,choiceId:"qa:0",choiceIndex:1});expect(game.history[0]!.first).toBeUndefined();
    game.command(id,"answer",{questionId,choiceId:"qa:0"});expect(game.history[0]!.firstCorrect).toBe(true);
  });
  it("extends first/retry windows without changing grading or XP",()=>{
    const {state,game,open,answer}=setup(1);state.questionTimeMultiplier=2;open();
    expect(state.pendingQuestion!.deadline-game.history[0]!.openedAt).toBe(60_000);
    answer(state.players[0]!.id,1);expect(state.pendingQuestion!.deadline-game.history[0]!.openedAt).toBe(40_000);
    answer(state.players[0]!.id,0);expect(state.players[0]!.xp).toBe(40);
  });
  it("has the specified 28 non-elimination board spaces", () => {
    expect(classroomBoard).toHaveLength(28);
    expect(classroomBoard.filter((t) => t.type === "property")).toHaveLength(16);
    expect(classroomBoard.filter((t) => t.type === "challenge")).toHaveLength(4);
    expect(classroomBoard.filter((t) => t.type === "chance")).toHaveLength(3);
    expect(classroomBoard.filter((t) => t.type === "tax")).toHaveLength(2);
    expect(classroomBoard.some((t) => ["jail","goToJail"].includes(t.type))).toBe(false);
  });
  it("asks everyone even when the turn owner passes; no peer answers or early reveal", () => {
    const { game, state, open, answer, events } = setup(); open();
    expect(state.pendingQuestion?.group).toBe(true);
    const id = state.players[1]!.id;
    answer(id, 1);
    expect(events.filter((e) => e.type === "answerResult")).toHaveLength(0);
    const receipt = events.filter((e) => e.type === "learningReceipt" && e.id === id).at(-1)!;
    expect(receipt.value.status).toBe("retry_wait");
    expect(receipt.value.hint).toBe(question.hint);
    for (const event of events.filter((e) => e.type === "snapshot")) expect(JSON.stringify(event.value)).not.toMatch(/answerIndex|firstCorrect|เฉลยลับ/);
    for (const player of state.players.filter((p) => p.id !== id)) answer(player.id, 0);
    expect(state.pendingQuestion?.stage).toBe("retry");
    answer(id, 0);
    expect(state.phase).toBe("reveal");
    expect(events.filter((e) => e.type === "answerResult")).toHaveLength(4);
    expect(game.history.find((a) => a.participantId === id)).toMatchObject({ firstCorrect: false, retryCorrect: true, xp: 40 });
    expect(state.players.filter((p) => p.id !== id).every((p) => p.xp === 100)).toBe(true);
  });
  it("records hint-assisted first answers separately and refuses duplicate submissions", () => {
    const { game, state, open, answer } = setup(1); open();
    const id = state.players[0]!.id;
    game.command(id, "hint", { questionId: state.pendingQuestion!.id });
    answer(id, 0); answer(id, 1);
    expect(game.history[0]).toMatchObject({ hintUsed: true, firstCorrect: true, xp: 60 });
    expect(state.players[0]!.xp).toBe(60);
  });
  it("keeps fixed retry deadlines, marks absent responses not_attempted and rejects late replies", () => {
    const { game, state, open, answer, advance } = setup(2); open();
    answer(state.players[0]!.id, 1);
    advance(30_000);
    const deadline = state.pendingQuestion!.deadline;
    advance(19_000);
    expect(state.pendingQuestion!.deadline).toBe(deadline);
    advance(1000);
    answer(state.players[0]!.id, 0);
    expect(game.history[0]).toMatchObject({ firstCorrect: false });
    expect(game.history[0]!.retry).toBeUndefined();
    expect(game.history[1]!.status).toBe("not_attempted");
  });
  it("does not repeat rewards on repeated exposure and rotates after doubles", () => {
    const { game, state, open, answer, advance } = setup(2); const first = currentPlayer(state)!.id;
    open(); for (const p of state.players) answer(p.id, 0);
    advance(10_000);
    expect(currentPlayer(state)!.id).not.toBe(first);
    open(); expect(state.pendingQuestion!.repeated).toBe(true);
    for (const p of state.players) answer(p.id, 0);
    expect(state.players.every((p) => p.xp === 100)).toBe(true);
    expect(game.history.slice(2).every((a) => a.xp === 0 && a.repeated)).toBe(true);
  });
  it("applies a buy only once after reveal and rechecks affordability", () => {
    const { state, open, answer, advance } = setup(1); open("buy");
    answer(state.players[0]!.id, 0);
    expect(state.tiles[2]!.ownerId).toBe(null);
    advance(10_000);
    expect(state.tiles[2]!.ownerId).toBe(state.players[0]!.id);
    expect(state.players[0]!.money).toBe(13800);
    advance(1000); expect(state.players[0]!.money).toBe(13800);
  });
  it("uses bank support without eliminating a player and grants emergency cash only once", () => {
    const { state, open, answer, advance } = setup(1, [3,4]);
    state.players[0]!.money = 100; open(); answer(state.players[0]!.id, 0); advance(10_000);
    expect(state.players[0]).toMatchObject({ money: 1000, supportDebt: 1400, emergencyGrantUsed: true, bankrupt: false, inJail: false });
  });
  it("finishes at duration plus bounded grace without crediting interrupted attempts as wrong", () => {
    const { game, state, open, advance } = setup(1); open(); advance(17 * 60_000);
    expect(state.phase).toBe("game_over"); expect(state.winnerId).toBe(null);
    expect(game.history[0]!.status).toBe("interrupted");
    expect(state.players[0]!.stats.mechanics.total).toBe(0);
  });
  it("automatically rolls after 15 seconds and never avoids the question by timing out", () => {
    const { state, advance } = setup(); advance(15_000); expect(state.phase).toBe("moving");
    advance(3000); expect(state.phase).toBe("buying"); advance(15_000);
    expect(state.pendingQuestion?.group).toBe(true);
  });
  it("preserves remaining question time while paused and blocks new answers", () => {
    const { game,state,open,answer,advance } = setup(1); open();
    const deadline = state.pendingQuestion!.deadline;
    game.pause("teacher"); advance(120_000); answer(state.players[0]!.id, 0);
    expect(game.history[0]!.first).toBeUndefined();
    expect(state.phase).toBe("answering"); game.resume();
    expect(state.pendingQuestion!.deadline).toBe(deadline + 120_000);
    answer(state.players[0]!.id, 0); expect(state.phase).toBe("reveal");
    expect(game.history[0]!.firstPausedMs).toBe(120_000);
  });
  it("restores the same question/attempt and does not replay XP or reroll dice", () => {
    const original = setup(2); original.open(); original.answer(original.state.players[0]!.id, 0);
    const savedState = structuredClone(original.state), privateState = structuredClone(original.game.serialize());
    let rolls = 0;
    const restored = new ClassroomGame(savedState, [question], 15, { snapshot() {}, event() {}, privateEvent() {} }, () => 4000, () => { rolls++; return [6,6]; }, false);
    restored.restore(privateState);
    restored.command(savedState.players[0]!.id, "answer", { questionId: savedState.pendingQuestion!.id, choiceIndex: 1 });
    expect(restored.history[0]!.firstCorrect).toBe(true);
    restored.command(savedState.players[1]!.id, "answer", { questionId: savedState.pendingQuestion!.id, choiceIndex: 0 });
    expect(savedState.phase).toBe("reveal"); expect(rolls).toBe(0);
    expect(savedState.players.map((p) => p.xp)).toEqual([100,100]);
  });
});
