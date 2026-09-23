import { randomBytes, randomUUID } from "node:crypto";
import type { Client } from "@colyseus/core";
import { Room } from "@colyseus/core";
import {
  BOARD_SIZE,
  JAIL_TILE_INDEX,
  MAX_PLAYERS,
  buyProperty,
  calculateRent,
  chanceCards,
  checkWinner,
  createInitialGameState,
  createPlayer,
  currentPlayer,
  difficultyReward,
  endTurn,
  findPlayer,
  movePlayerByDice,
  pay,
  rollDice,
  isLocationId,
  locationById,
  avatarPresets,
  safeAppearance,
  sellProperty,
  upgradeProperty,
  type AnswerResult,
  type GameState,
  type Question,
} from "@physics-monopoly/shared";
import { publicQuestion, selectQuestion } from "../logic/questions";
import { RequestGate } from "../logic/RequestGate";
import { gradeNumeric, parseNumeric } from "../logic/numeric";
import { ClassroomGame } from "../logic/ClassroomGame";
import { loadRecovery, recoveryKey } from "../db/recovery";
import { pool } from "../db/database";
import { validJoinTicket, consumeJoinTicket, consumeRejoinTicket } from "../teacher/joinTickets";
import { canJoinAssignment, checkpoint, createClassroomSession, type ClassroomContext } from "../db/classroomSession";

interface JoinOptions {
  appearance?: unknown;
  mapId?: string;
  joinTicket?: string;
  rejoinTicket?: string;
  restoreSessionId?: string;
  restoreKey?: string;
  assignmentToken?: string;
  name?: string;
  avatar?: string;
  participantId?: string;
  reconnectToken?: string;
}

interface RequestPayload {
  requestId: string;
}

interface AnswerPayload extends RequestPayload {
  numericAnswer?: { value: string; unit: string };
  questionId: string;
  choiceIndex: number;
}

interface PlayerPayload extends RequestPayload {
  playerId: string;
}

interface TilePayload extends RequestPayload {
  tileIndex: number;
}

const avatars: string[] = [...avatarPresets.map((preset) => preset.id), "robot"];

export class GameRoom extends Room<{ state: GameState }> {
  override maxClients = MAX_PLAYERS;
  // A game retains its authoritative participant/token mapping while a player
  // reconnects. Phase 6 adds the bounded 120-second/abandoned-session policy.
  override autoDispose = false;
  private pendingAnswers = new Map<string, Question>();
  private participantBySession = new Map<string, string>();
  private reconnectTokenByParticipant = new Map<string, string>();
  private requestGate = new RequestGate();
  private lastAnswerResult: AnswerResult | null = null;
  private classroom?: ClassroomContext;
  private learningGame?: ClassroomGame;
  private disconnectedAt = new Map<string, number>();
  private writes = Promise.resolve();
  private commands = Promise.resolve();
  private storageFailed = false;

  override async onCreate(options: JoinOptions = {}): Promise<void> {
    const recovered = options.restoreSessionId ? options.restoreKey === recoveryKey ? await loadRecovery(options.restoreSessionId) : (() => { throw new Error("Invalid recovery authority"); })() : undefined;
    const roomCode = recovered?.state.roomCode ?? makeRoomCode();
    this.setState(createInitialGameState(roomCode));
    if (recovered) { this.setState(recovered.state); this.classroom = recovered.context; }
    else if (options.assignmentToken !== undefined) {
      if (!await validJoinTicket(options.assignmentToken, options.joinTicket, options.name, options.avatar)) throw new Error("ขอตั๋วเข้าร่วมกิจกรรมใหม่ก่อนสร้างห้อง");
      this.classroom = await createClassroomSession(options.assignmentToken, roomCode, this.roomId);
    }
    if (this.classroom) this.state.questionTimeMultiplier=this.classroom.questionTimeMultiplier ?? 1;
    if (this.classroom) this.learningGame = new ClassroomGame(this.state, this.classroom.questions, this.classroom.durationMinutes, {
      snapshot: () => this.sendSnapshot(), event: (type, payload) => this.publish(type, payload),
      privateEvent: (id, type, payload) => this.publish(type, payload, id),
    }, undefined, undefined, !recovered);
    if (recovered) {
      this.reconnectTokenByParticipant = new Map(recovered.privateState.reconnectTokens);
      this.requestGate.restore(recovered.privateState.requestGate ?? []);
      this.learningGame!.restore(recovered.privateState.learning);
      for (const player of this.state.players) { player.connected = false; this.disconnectedAt.set(player.id, Date.now()); }
      if (this.state.paused) {
        this.learningGame!.shiftDeadlines(Math.max(0, Date.now() - this.state.paused.since));
        this.state.paused.since = Date.now();
      }
      else {
        this.learningGame!.shiftDeadlines(Math.max(0, Date.now() - recovered.updatedAt));
        this.learningGame!.pause("restart");
      }
      await pool.query("UPDATE game_sessions SET live_room_id=$2 WHERE id=$1", [this.classroom!.sessionId, this.roomId]);
    }
    if (!recovered) this.applyMap(options.mapId ?? this.classroom?.maps?.[0] ?? "bangkok");
    await this.setMetadata({ roomCode, assignmentId: this.classroom?.assignmentId ?? null });
    // The synchronous legacy handlers run through one queue. Database checkpoints
    // complete before another command can mutate an activity room.
    const register = this.onMessage.bind(this);
    this.onMessage = ((type: string, handler: (client: Client, payload: any) => void) => register(type, (client, payload) => {
      this.enqueue(() => {
        if (this.learningGame && this.state.phase !== "lobby" && type !== "getParticipantSession") {
          if (this.isFreshRequest(client, payload)) this.learningGame.command(this.participantIdFor(client)!, type, payload ?? {});
        } else handler(client, payload);
      });
    })) as typeof this.onMessage;
    this.onMessage("ready", (client, payload: RequestPayload) => this.setReady(client, payload));
    this.onMessage("selectMap", (client, payload: RequestPayload & { mapId: string }) => {
      if (!this.isFreshRequest(client, payload) || !this.isHost(client) || this.state.phase !== "lobby" || !isLocationId(payload.mapId) || (this.classroom?.maps && !this.classroom.maps.includes(payload.mapId))) return;
      this.applyMap(payload.mapId);
      for (const player of this.state.players) player.ready = false;
      this.sendSnapshot();
    });
    this.onMessage("start", (client, payload: RequestPayload) => this.startGame(client, payload));
    this.onMessage("roll", (client, payload: RequestPayload) => this.roll(client, payload));
    this.onMessage("answer", (client, payload: AnswerPayload) => this.answer(client, payload));
    this.onMessage("hint", () => {});
    this.onMessage("reflection", () => {});
    this.onMessage("buy", (client, payload: RequestPayload) => this.requestBuy(client, payload));
    this.onMessage("upgrade", (client, payload: RequestPayload) => this.requestUpgrade(client, payload));
    this.onMessage("skipBuy", (client, payload: RequestPayload) => this.skipBuy(client, payload));
    this.onMessage("payJailFine", (client, payload: RequestPayload) => this.payJailFine(client, payload));
    this.onMessage("jailQuestion", (client, payload: RequestPayload) => this.askJailQuestion(client, payload));
    this.onMessage("sellProperty", (client, payload: TilePayload) => this.sellOwnedProperty(client, payload));
    this.onMessage("kickPlayer", (client, payload: PlayerPayload) => this.kickPlayer(client, payload));
    this.onMessage("getParticipantSession", (client) => {
      this.sendParticipantSession(client);
      client.send("snapshot", this.state);
      if (this.state.phase === "reveal" && this.lastAnswerResult) client.send("answerResult", this.lastAnswerResult);
      const id = this.participantIdFor(client); if (id) this.learningGame?.sendReceipt(id);
    });
    this.clock.setInterval(() => {
      this.enqueue(() => { this.checkLifecycle(); if (this.learningGame) this.learningGame.tick(); else { this.checkQuestionTimeout(); this.checkTurnTimeout(); } });
    }, 1000);
    this.clock.setTimeout(() => { if (!this.state.players.length) { this.autoDispose = true; void this.disconnect(); } }, 60_000);
  }

  override onAuth(_client: Client, options: JoinOptions): boolean | Promise<boolean> {
    if (this.storageFailed) return false;
    if (!options || typeof options !== "object") return false;
    const requestedParticipantId = typeof options.participantId === "string" ? options.participantId.trim() : undefined;
    const requestedToken = typeof options.reconnectToken === "string" ? options.reconnectToken.trim() : undefined;
    const isValidReconnect = Boolean(
      requestedParticipantId &&
        requestedToken &&
        this.reconnectTokenByParticipant.get(requestedParticipantId) === requestedToken &&
        findPlayer(this.state, requestedParticipantId),
    );
    if (isValidReconnect) {
      if (Array.from(this.participantBySession.values()).includes(requestedParticipantId!)) return false;
      if (this.classroom && findPlayer(this.state, requestedParticipantId!)?.inactive) return consumeRejoinTicket(this.classroom.sessionId, requestedParticipantId!, options.rejoinTicket);
      return true;
    }
    if (options.participantId !== undefined || options.reconnectToken !== undefined) return false;
    const valid = this.state.phase === "lobby" && this.state.players.length < MAX_PLAYERS && Boolean(normalizeNickname(options.name));
    return valid && this.classroom ? canJoinAssignment(this.classroom, options.assignmentToken).then((allowed) => allowed && consumeJoinTicket(this.classroom!.assignmentId, options.joinTicket, options.name, options.avatar)) : valid;
  }

  override onJoin(client: Client, options: JoinOptions): Promise<void> {
    return this.lifecycle(() => this.joinParticipant(client, options));
  }

  private joinParticipant(client: Client, options: JoinOptions): void {
    const requestedParticipantId = options.participantId?.trim();
    const requestedToken = options.reconnectToken?.trim();
    const existing =
      requestedParticipantId &&
      requestedToken &&
      this.reconnectTokenByParticipant.get(requestedParticipantId) === requestedToken
        ? findPlayer(this.state, requestedParticipantId)
        : undefined;

    if (existing) {
      if (Array.from(this.participantBySession.values()).includes(existing.id)) throw new Error("ผู้เล่นนี้เชื่อมต่ออยู่แล้ว");
      existing.connected = true;
      existing.inactive = false;
      this.disconnectedAt.delete(existing.id);
      this.participantBySession.set(client.sessionId, existing.id);
      this.state.log.unshift(`${existing.name} reconnect แล้ว`);
    } else {
      if (this.state.phase !== "lobby") throw new Error("เกมเริ่มแล้ว ไม่รับผู้เล่นใหม่");
      if (this.state.players.length >= MAX_PLAYERS) throw new Error("ห้องเต็ม");
      const name = normalizeNickname(options.name);
      if (!name) throw new Error("ชื่อเล่นต้องยาว 2–20 ตัวอักษร");
      if (this.state.players.some((player) => player.name === name)) throw new Error("ชื่อเล่นซ้ำ กรุณาเพิ่มชื่อหรือตัวเลขเพื่อแยกผู้เล่น");
      const avatar = options.avatar && avatars.includes(options.avatar) ? options.avatar : avatars[this.state.players.length] ?? "astro";
      const participantId = randomUUID();
      const player = createPlayer(participantId, name, avatar);
      player.appearance = safeAppearance(options.appearance);
      const reconnectToken = randomBytes(32).toString("base64url");
      this.state.players.push(player);
      this.participantBySession.set(client.sessionId, participantId);
      this.reconnectTokenByParticipant.set(participantId, reconnectToken);
      this.state.log.unshift(`${player.name} เข้าห้อง`);
    }
    if (!this.state.hostId || !this.state.players.some((player) => player.id === this.state.hostId)) this.state.hostId = this.state.players[0]?.id;
    if (this.state.paused?.reason === "offline" || this.state.paused?.reason === "restart") this.learningGame?.resume();
    this.sendSnapshot();
  }

  override onLeave(client: Client): Promise<void> {
    return this.lifecycle(() => this.leaveParticipant(client));
  }

  private leaveParticipant(client: Client): void {
    const participantId = this.participantBySession.get(client.sessionId);
    this.participantBySession.delete(client.sessionId);
    const player = participantId ? findPlayer(this.state, participantId) : undefined;
    if (player) {
      if (this.state.phase === "lobby") {
        this.state.players = this.state.players.filter((item) => item.id !== player.id);
        this.reconnectTokenByParticipant.delete(player.id);
        this.state.log.unshift(`${player.name} ออกจาก lobby และคืนที่นั่งแล้ว`);
        if (this.state.players.length === 0) this.autoDispose = true;
        this.sendSnapshot();
        return;
      }
      player.connected = false;
      this.disconnectedAt.set(player.id, Date.now());
      this.state.log.unshift(`${player.name} หลุดการเชื่อมต่อ`);
      this.sendSnapshot();
    }
  }

  override async onDispose(): Promise<void> {
    await this.commands;
    await this.writes;
    // Failed ticket reservations and emptied lobbies must not leave undeletable
    // phantom active sessions in teacher reports or recovery discovery.
    if (this.classroom && !this.state.players.length) {
      await pool.query("UPDATE game_sessions SET status='abandoned',updated_at=now() WHERE id=$1 AND status='lobby'",[this.classroom.sessionId]);
    }
  }

  private setReady(client: Client, payload: RequestPayload): void {
    if (!this.isFreshRequest(client, payload)) return;
    const player = this.playerFor(client);
    if (!player || this.state.phase !== "lobby") return;
    player.ready = !player.ready;
    this.state.log.unshift(`${player.name} ${player.ready ? "พร้อมแล้ว" : "ยังไม่พร้อม"}`);
    this.sendSnapshot();
  }

  private startGame(client: Client, payload: RequestPayload): void {
    if (!this.isFreshRequest(client, payload) || !this.isHost(client) || this.state.phase !== "lobby") return;
    const connectedPlayers = this.state.players.filter((player) => player.connected);
    if (connectedPlayers.length < 1 || !connectedPlayers.every((player) => player.ready)) return;
    if (this.learningGame) { this.learningGame.start(); return; }
    this.state.phase = "rolling";
    this.state.currentPlayerIndex = this.state.players.findIndex((player) => player.id === connectedPlayers[0]?.id);
    this.state.log.unshift("เกมเริ่มแล้ว");
    this.refreshTurnTimer();
    this.sendSnapshot();
  }

  private roll(client: Client, payload: RequestPayload): void {
    if (!this.isFreshRequest(client, payload)) return;
    const player = currentPlayer(this.state);
    if (!player || player.id !== this.participantIdFor(client) || this.state.phase !== "rolling") return;
    if (player.skipNextTurn) {
      player.skipNextTurn = false;
      this.state.log.unshift(`${player.name} ถูกข้าม 1 ตา`);
      endTurn(this.state);
      this.refreshTurnTimer();
      this.sendSnapshot();
      return;
    }
    if (player.inJail) {
      this.state.log.unshift(`${player.name} อยู่ในคุก: ทอย doubles, จ่ายปรับ, หรือแก้โจทย์`);
      this.sendSnapshot();
      return;
    }
    const dice = rollDice();
    this.state.dice = dice;
    const isDouble = dice[0] === dice[1];
    player.doublesInRow = isDouble ? player.doublesInRow + 1 : 0;
    if (player.doublesInRow >= 3) {
      this.sendToJail(player.id);
      player.doublesInRow = 0;
      endTurn(this.state);
      this.refreshTurnTimer();
      this.sendSnapshot();
      return;
    }
    this.state.phase = "moving";
    this.state.turnDeadline = null;
    const path = movePlayerByDice(this.state, player.id, dice);
    this.publish("tokenMove", { playerId: player.id, path, dice });
    this.state.log.unshift(`${player.name} ทอยได้ ${dice[0]} + ${dice[1]}`);
    this.clock.setTimeout(() => this.enqueue(() => this.resolveLanding(player.id, isDouble)), Math.max(700, path.length * 380));
    this.sendSnapshot();
  }

  private resolveLanding(playerId: string, keepTurnOnDouble = false): void {
    const player = findPlayer(this.state, playerId);
    if (!player || player.bankrupt) return;
    const tile = this.state.tiles[player.tileIndex];
    if (!tile) return;
    this.state.phase = "resolving_tile";
    if (tile.type === "property") {
      if (!tile.ownerId) {
        this.state.phase = "buying";
        this.state.turnDeadline = Date.now() + 15000;
        this.state.log.unshift(`${player.name} หยุดที่ ${tile.name} ตอบโจทย์เพื่อซื้อได้`);
      } else if (tile.ownerId !== player.id) {
        const rent = calculateRent(tile);
        pay(this.state, player.id, tile.ownerId, rent);
        this.state.log.unshift(`${player.name} จ่ายค่าเช่า ${tile.name} ฿${rent.toLocaleString("th-TH")}`);
        this.finishLanding(keepTurnOnDouble);
      } else {
        this.state.log.unshift(`${player.name} หยุดที่ทรัพย์สินของตัวเอง`);
        this.finishLanding(keepTurnOnDouble);
      }
    } else if (tile.type === "challenge") {
      this.askQuestion(player, "challenge", tile.index, tile.difficulty ?? "medium");
    } else if (tile.type === "chance") {
      this.resolveChance(player);
    } else if (tile.type === "tax") {
      const amount = tile.price ?? 800;
      pay(this.state, player.id, "pot", amount);
      this.state.log.unshift(`${player.name} จ่ายภาษี ฿${amount.toLocaleString("th-TH")}`);
      this.finishLanding(keepTurnOnDouble);
    } else if (tile.type === "freeParking") {
      player.money += this.state.centerPot;
      this.state.log.unshift(`${player.name} ได้กองกลาง ฿${this.state.centerPot.toLocaleString("th-TH")}`);
      this.state.centerPot = 0;
      this.finishLanding(keepTurnOnDouble);
    } else if (tile.type === "goToJail") {
      this.sendToJail(player.id);
      this.finishLanding(false);
    } else {
      this.finishLanding(keepTurnOnDouble);
    }
    this.sendSnapshot();
  }

  private requestBuy(client: Client, payload: RequestPayload): void {
    if (!this.isFreshRequest(client, payload)) return;
    const player = currentPlayer(this.state);
    if (!player || player.id !== this.participantIdFor(client) || this.state.phase !== "buying") return;
    const tile = this.state.tiles[player.tileIndex];
    if (!tile || tile.type !== "property" || tile.ownerId) return;
    this.askQuestion(player, "buy", tile.index, tile.difficulty ?? "easy");
    this.sendSnapshot();
  }

  private requestUpgrade(client: Client, payload: RequestPayload): void {
    if (!this.isFreshRequest(client, payload)) return;
    const player = currentPlayer(this.state);
    if (!player || player.id !== this.participantIdFor(client) || this.state.phase !== "rolling") return;
    const tile = this.state.tiles[player.tileIndex];
    if (!tile || tile.type !== "property" || tile.ownerId !== player.id || (tile.level ?? 0) >= 3) return;
    this.askQuestion(player, "buy", tile.index, tile.difficulty ?? "medium");
    this.sendSnapshot();
  }

  private answer(client: Client, payload: AnswerPayload): void {
    if (!this.isFreshRequest(client, payload)) return;
    const participantId = this.participantIdFor(client);
    if (!participantId) return;
    if (this.state.phase !== "answering") return;
    if (this.state.pendingQuestion?.question.kind === "numeric") {
      if (!payload.numericAnswer || parseNumeric(payload.numericAnswer.value) === null || typeof payload.numericAnswer.unit !== "string" || !this.state.pendingQuestion.question.allowedUnits?.includes(payload.numericAnswer.unit)) return;
    } else if (!isChoiceIndex(payload.choiceIndex) || payload.choiceIndex < 0) return;
    if (!this.state.pendingQuestion || Date.now() >= this.state.pendingQuestion.deadline) return;
    this.answerForParticipant(participantId, payload);
  }

  private answerForParticipant(participantId: string, payload: Omit<AnswerPayload, "requestId">): void {
    const pending = this.state.pendingQuestion;
    if (this.state.phase !== "answering" || !pending || pending.playerId !== participantId || pending.id !== payload.questionId || !isChoiceIndex(payload.choiceIndex)) return;
    const question = this.pendingAnswers.get(pending.id);
    if (!question) return;
    if (question.kind !== "numeric" && payload.choiceIndex >= question.choices.length) return;
    const player = findPlayer(this.state, participantId);
    if (!player) return;
    const correct = question.kind === "numeric" && question.numericKey ? gradeNumeric(question.numericKey, payload.numericAnswer) : payload.choiceIndex === question.answerIndex;
    const reward = correct ? difficultyReward(question.difficulty) : 0;
    const xp = correct ? (question.difficulty === "hard" ? 30 : question.difficulty === "medium" ? 20 : 10) : 0;
    const topicStats = player.stats[question.topic];
    topicStats.total += 1;
    if (correct) topicStats.correct += 1;
    player.xp += xp;
    player.money += reward;

    if (pending.reason === "buy") {
      if (correct && pending.tileIndex !== undefined) {
        const tile = this.state.tiles[pending.tileIndex];
        if (tile?.ownerId === player.id) upgradeProperty(this.state, player.id, pending.tileIndex);
        else buyProperty(this.state, player.id, pending.tileIndex);
      } else {
        this.state.log.unshift(`${player.name} ตอบผิด ซื้อ/อัปเกรดไม่ได้ในรอบนี้`);
      }
    } else if (pending.reason === "challenge") {
      if (correct) this.state.log.unshift(`${player.name} ผ่านโจทย์ รับ ฿${reward.toLocaleString("th-TH")} และ ${xp} XP`);
      else this.applyChallengePenalty(player.id, pending.tileIndex);
    } else if (pending.reason === "jail") {
      if (correct) {
        player.inJail = false;
        player.jailTurns = 0;
        this.state.log.unshift(`${player.name} ตอบโจทย์ถูกและออกจากคุก`);
      } else {
        this.state.log.unshift(`${player.name} ยังออกจากคุกไม่ได้`);
      }
    } else if (pending.reason === "chance") {
      if (correct) this.state.log.unshift(`${player.name} ผ่านโจทย์โอกาส รับ ฿${reward.toLocaleString("th-TH")}`);
      else this.state.log.unshift(`${player.name} พลาดโจทย์โอกาส`);
    }

    const result: AnswerResult = {
      questionId: pending.id,
      correct,
      correctChoice: question.answerIndex,
      explanation: question.explanation,
      moneyDelta: reward,
      xpDelta: xp,
    };
    this.pendingAnswers.delete(pending.id);
    this.lastAnswerResult = result;
    this.state.phase = "reveal";
    this.state.turnDeadline = Date.now() + 10000;
    this.sendSnapshot();
    this.publish("answerResult", result);
  }

  private payJailFine(client: Client, payload: RequestPayload): void {
    if (!this.isFreshRequest(client, payload) || this.state.phase !== "rolling") return;
    const player = currentPlayer(this.state);
    if (!player || player.id !== this.participantIdFor(client) || !player.inJail || player.money < 500) return;
    player.money -= 500;
    player.inJail = false;
    player.jailTurns = 0;
    this.state.log.unshift(`${player.name} จ่ายค่าปรับออกจากคุก`);
    this.sendSnapshot();
  }

  private askJailQuestion(client: Client, payload: RequestPayload): void {
    if (!this.isFreshRequest(client, payload) || this.state.phase !== "rolling" || this.state.pendingQuestion) return;
    const player = currentPlayer(this.state);
    if (!player || player.id !== this.participantIdFor(client) || !player.inJail) return;
    this.askQuestion(player, "jail", undefined, "medium");
    this.sendSnapshot();
  }

  private askQuestion(player: { id: string }, reason: "buy" | "challenge" | "jail" | "chance", tileIndex: number | undefined, difficulty: "easy" | "medium" | "hard"): void {
    // Assignment versions are pinned at room creation. Never fall back across sets.
    const question = this.classroom
      ? this.classroom.questions[Math.floor(Math.random() * this.classroom.questions.length)]!
      : selectQuestion(difficulty);
    if (!question) throw new Error("กิจกรรมไม่มีโจทย์ที่เผยแพร่แล้ว");
    const id = randomUUID();
    this.lastAnswerResult = null;
    this.pendingAnswers.set(id, question);
    this.state.pendingQuestion = {
      id,
      playerId: player.id,
      reason,
      tileIndex,
      question: publicQuestion(question),
      deadline: Date.now() + question.timeLimitSec * 1000,
    };
    this.state.phase = "answering";
    this.state.turnDeadline = null;
  }

  private resolveChance(player: { id: string; name: string; money: number }): void {
    const card = chanceCards[Math.floor(Math.random() * chanceCards.length)]!;
    this.state.log.unshift(`${player.name} จั่วการ์ด: ${card.title}`);
    if (card.effect === "money") {
      if ((card.amount ?? 0) >= 0) player.money += card.amount ?? 0;
      else pay(this.state, player.id, "pot", Math.abs(card.amount ?? 0));
      this.finishLanding(false);
    } else if (card.effect === "move" && card.moveTo !== undefined) {
      const steps = (card.moveTo - findPlayer(this.state, player.id)!.tileIndex + BOARD_SIZE) % BOARD_SIZE;
      // Card moves can traverse more than a single 1-6/1-6 dice roll, so we never synthesize a fake
      // dice pair for these (that would render invalid faces on the 3D board). We reuse
      // movePlayerByDice purely for its path-building/pass-start side effects, then broadcast the
      // move with dice: null, matching the convention already used by sendToJail().
      const path = movePlayerByDice(this.state, player.id, [steps, 0]);
      findPlayer(this.state, player.id)!.tileIndex = card.moveTo;
      this.broadcast("tokenMove", { playerId: player.id, path, dice: null });
      this.finishLanding(false);
    } else if (card.effect === "jail") {
      this.sendToJail(player.id);
      this.finishLanding(false);
    } else if (card.effect === "question") {
      this.askQuestion(player, "chance", undefined, card.difficulty ?? "medium");
    } else {
      this.finishLanding(false);
    }
  }

  private finishLanding(keepTurnOnDouble: boolean): void {
    this.state.winnerId = checkWinner(this.state);
    endTurn(this.state, keepTurnOnDouble && !this.state.winnerId);
    this.refreshTurnTimer();
  }

  private skipBuy(client: Client, payload: RequestPayload): void {
    if (!this.isFreshRequest(client, payload)) return;
    const player = currentPlayer(this.state);
    if (!player || player.id !== this.participantIdFor(client) || this.state.phase !== "buying") return;
    const tile = this.state.tiles[player.tileIndex];
    if (tile?.type === "property" && !tile.ownerId) this.state.log.unshift(`${player.name} เลือกผ่าน ${tile.name}`);
    this.finishLanding(false);
    this.sendSnapshot();
  }

  private sellOwnedProperty(client: Client, payload: TilePayload): void {
    if (!this.isFreshRequest(client, payload) || this.state.phase !== "rolling" || !isTileIndex(payload.tileIndex)) return;
    const participantId = this.participantIdFor(client);
    if (currentPlayer(this.state)?.id !== participantId) return;
    if (participantId && sellProperty(this.state, participantId, payload.tileIndex)) this.sendSnapshot();
  }

  private sendToJail(playerId: string): void {
    const player = findPlayer(this.state, playerId);
    if (!player) return;
    player.tileIndex = JAIL_TILE_INDEX;
    player.inJail = true;
    player.jailTurns += 1;
    this.state.lastMovePath = [JAIL_TILE_INDEX];
    this.broadcast("tokenMove", { playerId, path: [JAIL_TILE_INDEX], dice: null });
    this.state.log.unshift(`${player.name} ถูกส่งเข้าคุก`);
  }

  private applyChallengePenalty(playerId: string, tileIndex: number | undefined): void {
    const player = findPlayer(this.state, playerId);
    const tile = tileIndex !== undefined ? this.state.tiles[tileIndex] : undefined;
    if (!player) return;
    if (tile?.failPenalty === "skipTurn") {
      player.skipNextTurn = true;
      this.state.log.unshift(`${player.name} ตอบผิดและถูกหยุดเดิน 1 ตา`);
    } else {
      this.sendToJail(player.id);
    }
  }

  private checkQuestionTimeout(): void {
    const pending = this.state.pendingQuestion;
    if (this.state.phase !== "answering" || !pending || Date.now() < pending.deadline) return;
    this.answerForParticipant(pending.playerId, { questionId: pending.id, choiceIndex: -1 });
  }

  private kickPlayer(client: Client, payload: PlayerPayload): void {
    if (!this.isFreshRequest(client, payload) || this.state.phase !== "lobby" || !this.isHost(client)) return;
    if (payload.playerId === this.participantIdFor(client)) return;
    const player = findPlayer(this.state, payload.playerId);
    if (!player) return;
    this.state.players = this.state.players.filter((item) => item.id !== payload.playerId);
    this.reconnectTokenByParticipant.delete(player.id);
    this.disconnectedAt.delete(player.id);
    for (const [sessionId, participantId] of this.participantBySession) {
      if (participantId !== player.id) continue;
      this.participantBySession.delete(sessionId);
      this.clients.find((member) => member.sessionId === sessionId)?.leave(4000, "นำออกจากห้องโดยเจ้าของห้อง");
    }
    this.state.log.unshift(player.name + " left lobby");
    this.sendSnapshot();
  }

  private refreshTurnTimer(): void {
    if (this.state.phase === "rolling" && !this.state.winnerId) {
      this.state.turnDeadline = Date.now() + this.state.turnTimeSec * 1000;
      const player = currentPlayer(this.state);
    } else {
      this.state.turnDeadline = null;
    }
  }

  private checkTurnTimeout(): void {
    if (!this.state.turnDeadline || Date.now() < this.state.turnDeadline) return;
    if (this.state.phase === "buying" || this.state.phase === "reveal") {
      this.lastAnswerResult = null;
      this.finishLanding(false);
      this.sendSnapshot();
      return;
    }
    if (this.state.phase !== "rolling") return;
    const player = currentPlayer(this.state);
    if (player) this.state.log.unshift(player.name + " timed out");
    this.finishLanding(false);
    this.refreshTurnTimer();
    this.sendSnapshot();
  }

  private participantIdFor(client: Client): string | undefined {
    return this.participantBySession.get(client.sessionId);
  }

  private playerFor(client: Client) {
    const participantId = this.participantIdFor(client);
    return participantId ? findPlayer(this.state, participantId) : undefined;
  }

  private isHost(client: Client): boolean {
    return (this.state.hostId ?? this.state.players[0]?.id) === this.participantIdFor(client);
  }

  private isFreshRequest(client: Client, payload: RequestPayload | undefined): boolean {
    const participantId = this.participantIdFor(client);
    if ((this.state.phase === "rolling" || this.state.phase === "buying") && this.state.turnDeadline && Date.now() >= this.state.turnDeadline) return false;
    return Boolean(participantId && payload && this.requestGate.accept(participantId, payload.requestId));
  }

  private sendParticipantSession(client: Client): void {
    const participantId = this.participantIdFor(client);
    const reconnectToken = participantId ? this.reconnectTokenByParticipant.get(participantId) : undefined;
    if (participantId && reconnectToken) client.send("participantSession", { participantId, reconnectToken, roomCode: this.state.roomCode });
  }

  private sendSnapshot(): void {
    this.state.log = this.state.log.slice(0, 100);
    this.publish("snapshot", this.state);
  }

  private lifecycle(work: () => void): Promise<void> {
    const operation = this.commands.then(async () => {
      await this.writes;
      if (this.storageFailed) throw new Error("Room storage unavailable");
      work();
      await this.writes;
      if (this.storageFailed) throw new Error("Room storage unavailable");
    });
    // Invalid/duplicate joins reject that client, without poisoning later commands.
    this.commands = operation.catch(() => {});
    return operation;
  }

  private enqueue(work: () => void): void {
    if (!this.classroom) { work(); return; }
    this.commands = this.commands.then(async () => {
      if (this.storageFailed) return;
      await this.writes;
      work();
      await this.writes;
    }).catch(() => this.failStorage());
  }

  private publish(type: string, value: unknown, participantId?: string): void {
    if (!this.classroom) { this.broadcast(type, value); return; }
    if (participantId) {
      // Private receipts never mutate state. Their preceding snapshot owns the
      // durable commit; avoid writing the entire history once per recipient.
      const payload = structuredClone(value);
      this.writes = this.writes.then(() => {
        if (!this.storageFailed) for (const client of this.clients) if (this.participantIdFor(client) === participantId) client.send(type, payload);
      }).catch(() => this.failStorage());
      return;
    }
    const state = structuredClone(this.state);
    const payload = structuredClone(value);
    const privateState = structuredClone({ pendingAnswers: [...this.pendingAnswers], reconnectTokens: [...this.reconnectTokenByParticipant], lastAnswerResult: this.lastAnswerResult, learning: this.learningGame?.serialize(), requestGate: this.requestGate.serialize() });
    this.writes = this.writes.then(async () => {
      if (this.storageFailed) return;
      await checkpoint(this.classroom!, type, state, privateState);
      if (participantId) {
        for (const client of this.clients) if (this.participantIdFor(client) === participantId) client.send(type, payload);
      } else this.broadcast(type, payload);
    }).catch(() => this.failStorage());
  }

  private failStorage(): void {
    if (this.storageFailed) return;
    this.storageFailed = true;
    console.error("game_checkpoint_failed", { roomId: this.roomId });
    // Fail closed: no further rewards or mutations may be acknowledged without storage.
    for (const client of this.clients) client.leave(1011, "บันทึกเกมไม่สำเร็จ กรุณาติดต่อครู");
  }
  private checkLifecycle(): void {
    let changed = false;
    for (const player of this.state.players) {
      if (!player.connected && !player.inactive && Date.now() - (this.disconnectedAt.get(player.id) ?? Date.now()) >= 120_000) { player.inactive = true; changed = true; }
    }
    const connected = this.state.players.filter((player) => player.connected);
    if (connected.length && !connected.some((player) => player.id === this.state.hostId)) { this.state.hostId = connected[0]!.id; changed = true; }
    if (this.learningGame && !connected.length && this.state.players.length && this.state.phase !== "game_over") {
      this.learningGame.pause("offline");
      if (this.state.paused && Date.now() - this.state.paused.since >= 600_000) {
        this.learningGame.finish(true); this.state.finishReason = "abandoned"; changed = true;
      }
    }
    if (changed) this.sendSnapshot();
    if (!connected.length && this.state.phase === "game_over") { this.autoDispose = true; void this.disconnect(); }
    if (!this.learningGame && !connected.length && this.disconnectedAt.size && Math.min(...this.disconnectedAt.values()) + 600_000 < Date.now()) { this.autoDispose = true; void this.disconnect(); }
  }
  private applyMap(id: string): void {
    if (!isLocationId(id) || (this.classroom?.maps && !this.classroom.maps.includes(id))) throw new Error("สถานที่ไม่อยู่ในกิจกรรมนี้");
    this.state.mapId = id;
    if (this.classroom) for (const tile of this.state.tiles) if (tile.type === "property") tile.name = `${locationById(id).name} · ย่าน ${tile.index}`;
  }
  async teacherControl(command: string, assignmentId: string): Promise<boolean> {
    if (!this.learningGame || this.classroom?.assignmentId !== assignmentId) return false;
    let accepted = false;
    this.commands = this.commands.then(async () => {
      await this.writes;
      if (this.storageFailed) return;
      if (command === "pause") this.learningGame!.pause("teacher");
      else if (command === "resume") this.learningGame!.resume();
      else if (command === "end") this.learningGame!.finish(true);
      else return;
      await this.writes; accepted = !this.storageFailed;
    }).catch(() => this.failStorage());
    await this.commands; return accepted;
  }
}

function normalizeNickname(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return normalized.length >= 2 && normalized.length <= 20 ? normalized : undefined;
}

function isChoiceIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= -1 && value <= 4;
}

function isTileIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < BOARD_SIZE;
}

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
