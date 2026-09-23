import { randomInt, randomUUID } from "node:crypto";
import { classroomBoard, classroomUpgradeCost, currentPlayer, type AnswerResult, type GameState, type LearningReceipt, type Player, type Question } from "@physics-monopoly/shared";
import { gradeNumeric, parseNumeric } from "./numeric";
import { publicQuestion } from "./questions";

type Submission = { choiceIndex?: number; choiceId?: string; numericAnswer?: { value: string; unit: string } };
export interface LearningAttempt {
  id: string; questionSessionId: string; questionId: string; participantId: string;
  repeated: boolean; first?: Submission; retry?: Submission; firstCorrect?: boolean; retryCorrect?: boolean;
  hintUsed: boolean; reflection: boolean; openedAt: number; firstAt?: number; retryAt?: number; firstPausedMs?: number;
  status: "open" | "completed" | "not_attempted" | "interrupted"; xp: number;
}
type Hooks = { snapshot(): void; event(type: string, payload: unknown): void; privateEvent(id: string, type: string, payload: unknown): void };
/** Deterministic state machine except injected clock/dice; owns no transports or database. */
export class ClassroomGame {
  private question: Question | null = null;
  private round: LearningAttempt[] = [];
  readonly history: LearningAttempt[] = [];
  private seen = new Set<string>();
  private awarded = new Set<string>();
  private action: "buy" | "upgrade" | "pass" = "pass";
  private retryNeeded = new Set<string>();
  private applied = false;
  constructor(private state: GameState, private questions: Question[], private durationMinutes: number, private hooks: Hooks, private now = Date.now, private dice = () => [randomInt(1,7), randomInt(1,7)] as [number,number], initialize = true) {
    state.classroomMode = true;
    if (initialize) state.tiles = structuredClone(classroomBoard);
    state.turnTimeSec = 15;
  }
  start(): void {
    if (this.state.phase !== "lobby" || !this.questions.length) return;
    for (let index = this.state.players.length - 1; index > 0; index--) {
      const other = randomInt(index + 1);
      [this.state.players[index], this.state.players[other]] = [this.state.players[other]!, this.state.players[index]!];
    }
    for (const player of this.state.players) { player.money = 15000; player.supportDebt = 0; player.invested = 0; }
    this.state.endsAt = this.now() + this.durationMinutes * 60_000;
    this.state.currentPlayerIndex = 0;
    this.nextTurn(false);
  }
  command(id: string, type: string, payload: Record<string, unknown>): void {
    if (this.state.phase === "game_over" || this.state.paused) return;
    // Evaluate expired deadlines first, so late intents cannot race a timer tick.
    this.tick();
    if (type === "roll") { if (currentPlayer(this.state)?.id === id && this.state.phase === "rolling") this.roll(); return; }
    if (["buy", "upgrade", "skipBuy"].includes(type)) {
      if (currentPlayer(this.state)?.id !== id || this.state.phase !== "buying") return;
      const tile = this.state.tiles[currentPlayer(this.state)!.tileIndex]!;
      if (type === "buy" && !tile.ownerId) this.action = "buy";
      else if (type === "upgrade" && tile.ownerId === id && (tile.level ?? 0) < 3) this.action = "upgrade";
      else if (type === "skipBuy") this.action = "pass";
      else return;
      this.openQuestion(); return;
    }
    if (payload.questionId !== this.state.pendingQuestion?.id) return;
    const attempt = this.round.find((item) => item.participantId === id);
    if (!attempt || !this.question) return;
    if (type === "reflection" && this.state.phase === "reveal" && attempt.status === "completed" && !attempt.reflection) {
      attempt.reflection = true;
      if (!attempt.firstCorrect && !attempt.retryCorrect) this.award(attempt, 10);
      this.hooks.snapshot(); this.sendReceipt(id); return;
    }
    if (this.state.phase !== "answering") return;
    if (type === "hint" && !attempt.first && this.state.pendingQuestion?.stage === "first") {
      attempt.hintUsed = true; this.hooks.snapshot(); this.sendReceipt(id); return;
    }
    if (type !== "answer") return;
    const submitted = this.validateSubmission(payload);
    if (!submitted) return;
    const correct = this.question.kind === "numeric" ? gradeNumeric(this.question.numericKey!, submitted.numericAnswer) : submitted.choiceIndex === this.question.answerIndex;
    if (this.state.pendingQuestion?.stage === "first" && !attempt.first) {
      attempt.first = submitted; attempt.firstAt = this.now(); attempt.firstCorrect = correct;
      if (!correct) this.retryNeeded.add(id);
    } else if (this.state.pendingQuestion?.stage === "retry" && this.retryNeeded.has(id) && !attempt.retry) {
      attempt.retry = submitted; attempt.retryAt = this.now(); attempt.retryCorrect = correct;
    } else return;
    this.hooks.snapshot(); this.sendReceipt(id);
    this.advanceBarrier();
  }
  tick(): void {
    if (this.state.paused) return;
    if (["lobby", "game_over"].includes(this.state.phase)) return;
    if (this.state.endsAt && this.now() >= this.state.endsAt + 120_000) { this.finish(true); return; }
    if (this.state.phase === "answering") {
      if (this.state.pendingQuestion && this.now() >= this.state.pendingQuestion.deadline) {
        if (this.state.pendingQuestion.stage === "first") this.openRetryOrReveal(); else this.reveal();
      }
      return;
    }
    if (!this.state.turnDeadline || this.now() < this.state.turnDeadline) return;
    if (this.state.phase === "rolling") this.roll();
    else if (this.state.phase === "moving") {
      const tile = this.state.tiles[currentPlayer(this.state)!.tileIndex]!;
      if (tile.type === "property" && (!tile.ownerId || (tile.ownerId === currentPlayer(this.state)!.id && (tile.level ?? 0) < 3))) {
        this.state.phase = "buying"; this.state.turnDeadline = this.now() + 15_000; this.hooks.snapshot();
      } else this.openQuestion();
    } else if (this.state.phase === "buying") this.openQuestion();
    else if (this.state.phase === "reveal") { this.applyLanding(); this.nextTurn(true); }
  }
  private roll(): void {
    const player = currentPlayer(this.state)!;
    const dice = this.dice(), path = Array.from({ length: dice[0] + dice[1] }, (_, index) => (player.tileIndex + index + 1) % 28);
    this.state.dice = dice; this.state.lastMovePath = path; player.tileIndex = path.at(-1)!;
    if (path.includes(0)) this.credit(player, 2000);
    this.action = "pass"; this.applied = false;
    this.state.phase = "moving"; this.state.turnDeadline = this.now() + 3000;
    this.hooks.snapshot(); this.hooks.event("tokenMove", { playerId: player.id, path, dice });
  }
  private openQuestion(): void {
    const unused = this.questions.filter((question) => !this.seen.has(question.id));
    const pool = unused.length ? unused : this.questions;
    if (!pool.length) { this.finish(true); return; }
    const question = pool[randomInt(pool.length)]!;
    this.question = question;
    const repeated = this.seen.has(question.id); this.seen.add(question.id);
    const id = randomUUID();
    this.round = this.state.players.map((player) => ({ id: randomUUID(), questionSessionId: id, questionId: question.id, participantId: player.id, repeated, hintUsed: false, reflection: false, openedAt: this.now(), status: "open", xp: 0 }));
    this.history.push(...this.round); this.retryNeeded.clear();
    this.state.pendingQuestion = { id, playerId: currentPlayer(this.state)!.id, reason: this.action === "pass" ? "challenge" : "buy", tileIndex: currentPlayer(this.state)!.tileIndex, question: publicQuestion(question), deadline: this.now() + question.timeLimitSec * 1000 * (this.state.questionTimeMultiplier ?? 1), group: true, stage: "first", repeated };
    this.state.phase = "answering"; this.state.turnDeadline = null;
    this.state.pendingQuestion.timeMultiplier=this.state.questionTimeMultiplier??1;
    if (repeated) this.state.log.unshift("รอบทบทวน: ข้อนี้เคยเปิดในห้องแล้ว แยกผลจากข้อใหม่");
    this.hooks.snapshot(); for (const player of this.state.players) this.sendReceipt(player.id);
  }
  private validateSubmission(payload: Record<string, unknown>): Submission | null {
    if (!this.question) return null;
    if (this.question.kind === "numeric") {
      const input = payload.numericAnswer as { value?: unknown; unit?: unknown } | undefined;
      if (!input || typeof input.value !== "string" || typeof input.unit !== "string" || parseNumeric(input.value) === null || !this.question.numericKey?.allowedUnits.includes(input.unit)) return null;
      return { numericAnswer: { value: input.value, unit: input.unit } };
    }
    const choiceIds = this.question.choices.map((_choice,index)=>`${this.question!.id}:${index}`);
    const index = typeof payload.choiceId === "string" ? choiceIds.indexOf(payload.choiceId) : payload.choiceIndex;
    if (payload.choiceId !== undefined && (typeof payload.choiceId !== "string" || (payload.choiceIndex !== undefined && payload.choiceIndex !== index))) return null;
    return typeof index === "number" && Number.isInteger(index) && index >= 0 && index < this.question.choices.length ? { choiceIndex: index, choiceId: choiceIds[index] } : null;
  }
  private advanceBarrier(): void {
    if (this.state.pendingQuestion?.stage === "first" && this.round.every((attempt) => attempt.first)) this.openRetryOrReveal();
    else if (this.state.pendingQuestion?.stage === "retry" && this.round.filter((attempt) => this.retryNeeded.has(attempt.participantId)).every((attempt) => attempt.retry)) this.reveal();
  }
  private openRetryOrReveal(): void {
    if (!this.retryNeeded.size) { this.reveal(); return; }
    this.state.pendingQuestion!.stage = "retry";
    this.state.pendingQuestion!.deadline = this.now() + 20_000 * (this.state.questionTimeMultiplier ?? 1);
    this.hooks.snapshot(); for (const player of this.state.players) this.sendReceipt(player.id);
  }
  private reveal(): void {
    if (this.state.phase !== "answering" || !this.question) return;
    this.state.phase = "reveal"; this.state.pendingQuestion!.stage = "reveal"; this.state.turnDeadline = this.now() + 10_000;
    for (const attempt of this.round) {
      attempt.status = attempt.first ? "completed" : "not_attempted";
      if (attempt.firstCorrect) this.award(attempt, attempt.hintUsed ? 60 : 100);
      else if (attempt.retryCorrect) this.award(attempt, 40);
      const player = this.state.players.find((p) => p.id === attempt.participantId)!;
      if (attempt.first && !attempt.repeated) { player.stats[this.question.topic].total++; if (attempt.firstCorrect) player.stats[this.question.topic].correct++; }
    }
    this.hooks.snapshot();
    for (const attempt of this.round) this.sendReveal(attempt);
  }
  private award(attempt: LearningAttempt, amount: number): void {
    const key = `${attempt.participantId}:${attempt.questionId}`;
    if (this.awarded.has(key)) return;
    this.awarded.add(key); attempt.xp += amount;
    this.state.players.find((p) => p.id === attempt.participantId)!.xp += amount;
  }
  private sendReveal(attempt: LearningAttempt): void {
    if (!this.question) return;
    const result: AnswerResult = { questionId: attempt.questionSessionId, correct: Boolean(attempt.firstCorrect || attempt.retryCorrect), correctChoice: this.question.answerIndex, explanation: this.question.kind === "numeric" ? `คำตอบ: ${this.question.numericKey!.value} ${this.question.numericKey!.unit}\n${this.question.explanation}` : this.question.explanation, moneyDelta: 0, xpDelta: attempt.xp };
    this.hooks.privateEvent(attempt.participantId, "answerResult", result);
  }
  sendReceipt(id: string): void {
    const attempt = this.round.find((item) => item.participantId === id);
    if (!attempt || !this.question || !this.state.pendingQuestion) return;
    if (this.state.phase === "reveal") this.sendReveal(attempt);
    const retry = this.retryNeeded.has(id);
    const status: LearningReceipt["status"] = this.state.phase === "reveal" || attempt.retry || (attempt.first && !retry) ? "closed" : retry ? this.state.pendingQuestion.stage === "retry" ? "retry_open" : "retry_wait" : this.state.pendingQuestion.stage === "first" ? "open" : "closed";
    this.hooks.privateEvent(id, "learningReceipt", { questionId: attempt.questionSessionId, status, firstSubmitted: Boolean(attempt.first), retrySubmitted: Boolean(attempt.retry), reflectionSaved: attempt.reflection, ...((attempt.hintUsed || retry) ? { hint: this.question.hint ?? "ทบทวนหลักการและหน่วยก่อนลองอีกครั้ง" } : {}) } satisfies LearningReceipt);
  }
  private credit(player: Player, amount: number): void {
    const repayment = Math.min(player.supportDebt ?? 0, Math.floor(amount / 2));
    player.supportDebt = (player.supportDebt ?? 0) - repayment; player.money += amount - repayment;
  }
  private charge(player: Player, amount: number): void {
    const paid = Math.min(player.money, amount); player.money -= paid; player.supportDebt = (player.supportDebt ?? 0) + amount - paid;
    if (player.money === 0 && !player.emergencyGrantUsed) { player.emergencyGrantUsed = true; player.money = 1000; player.supportDebt += 1000; }
  }
  private applyLanding(): void {
    if (this.applied) return; this.applied = true;
    const player = currentPlayer(this.state)!, tile = this.state.tiles[player.tileIndex]!;
    const attempt = this.round.find((item) => item.participantId === player.id);
    if (tile.type === "property") {
      const price = this.action === "upgrade" ? classroomUpgradeCost(tile) : tile.price!;
      if ((attempt?.firstCorrect || attempt?.retryCorrect) && this.action !== "pass" && player.money >= price && ((this.action === "buy" && !tile.ownerId) || (this.action === "upgrade" && tile.ownerId === player.id && (tile.level ?? 0) < 3))) {
        player.money -= price; player.invested = (player.invested ?? 0) + price;
        if (this.action === "buy") { tile.ownerId = player.id; tile.level = 0; } else tile.level = (tile.level ?? 0) + 1;
      } else if (tile.ownerId && tile.ownerId !== player.id) {
        const rent = Math.min(1500, tile.rentByLevel?.[tile.level ?? 0] ?? 0);
        this.charge(player, Math.round(rent * (attempt?.firstCorrect ? .8 : 1)));
        const owner = this.state.players.find((item) => item.id === tile.ownerId); if (owner) this.credit(owner, rent);
      }
    } else if (tile.type === "tax") this.charge(player, 500);
    else if (tile.type === "chance") this.credit(player, 300);
    else if (tile.index === 14) this.credit(player, 500);
  }
  private nextTurn(advance: boolean): void {
    if (this.state.endsAt && this.now() >= this.state.endsAt) { this.finish(false); return; }
    if (advance) { this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length; this.state.turnCount++; }
    this.state.pendingQuestion = null; this.question = null; this.round = [];
    this.state.phase = "rolling"; this.state.turnDeadline = this.now() + 15_000; this.hooks.snapshot();
  }
  finish(interrupted: boolean): void {
    if (this.state.phase === "game_over") return;
    if (interrupted) for (const attempt of this.round) if (attempt.status === "open") attempt.status = "interrupted";
    const worth = (player: Player) => player.money + (player.invested ?? 0) - (player.supportDebt ?? 0);
    const best = Math.max(...this.state.players.map(worth));
    this.state.winnerIds = this.state.players.filter((player) => worth(player) === best).map((player) => player.id);
    this.state.winnerId = this.state.players.length === 1 ? null : this.state.winnerIds[0] ?? null;
    this.state.finishReason = interrupted ? "interrupted" : "completed";
    this.state.paused = undefined;
    this.state.phase = "game_over"; this.state.pendingQuestion = null; this.state.turnDeadline = null; this.hooks.snapshot();
  }
  pause(reason: "teacher" | "offline" | "restart"): void {
    if (this.state.phase === "game_over") return;
    if (this.state.paused) {
      if (reason === "teacher" && this.state.paused.reason !== "teacher") { this.state.paused.reason = "teacher"; this.hooks.snapshot(); }
      return;
    }
    this.state.paused = { reason, since: this.now() }; this.hooks.snapshot();
  }
  resume(): void {
    if (!this.state.paused) return;
    this.shiftDeadlines(this.now() - this.state.paused.since);
    if (this.question && this.state.pendingQuestion) this.state.pendingQuestion.question = publicQuestion(this.question);
    this.state.paused = undefined; this.hooks.snapshot();
    for (const player of this.state.players) this.sendReceipt(player.id);
  }
  shiftDeadlines(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) return;
    for (const attempt of this.round) {
      if (attempt.status === "open" && !attempt.firstAt) attempt.firstPausedMs = (attempt.firstPausedMs ?? 0) + milliseconds;
    }
    if (this.state.turnDeadline) this.state.turnDeadline += milliseconds;
    if (this.state.endsAt) this.state.endsAt += milliseconds;
    if (this.state.pendingQuestion) this.state.pendingQuestion.deadline += milliseconds;
  }
  restore(value: any): void {
    if (!value || !Array.isArray(value.history) || value.history.length > 10000 || !Array.isArray(value.round) || value.round.length > 4) throw new Error("Unsupported learning snapshot");
    this.history.push(...value.history);
    // Reuse history objects so future answers update the same persistent attempt.
    this.round = value.round.map((item: LearningAttempt) => this.history.find((attempt) => attempt.id === item.id) ?? item);
    this.question = value.question;
    this.seen = new Set(value.seen); this.awarded = new Set(value.awarded); this.retryNeeded = new Set(value.retryNeeded);
    this.action = value.action; this.applied = value.applied;
    if (this.question && this.state.pendingQuestion) this.state.pendingQuestion.question = publicQuestion(this.question);
  }
  serialize(): object { return { question: this.question, round: this.round, history: this.history, seen: [...this.seen], awarded: [...this.awarded], action: this.action, retryNeeded: [...this.retryNeeded], applied: this.applied }; }
}
