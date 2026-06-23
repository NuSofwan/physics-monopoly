import type { Client } from "colyseus";
import { Room } from "colyseus";
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
  upgradeProperty,
  type AnswerResult,
  type GameState,
  type Question,
} from "@physics-monopoly/shared";
import { publicQuestion, selectQuestion } from "../logic/questions";

interface JoinOptions {
  name?: string;
  avatar?: string;
}

interface AnswerPayload {
  questionId: string;
  choiceIndex: number;
}

interface TradePayload {
  toPlayerId: string;
  money: number;
  tileIndex: number;
}

const avatars = ["astro", "robot", "girl", "boy"];

export class GameRoom extends Room<GameState> {
  override maxClients = MAX_PLAYERS;
  private pendingAnswers = new Map<string, Question>();

  override onCreate(): void {
    this.roomId = makeRoomCode();
    this.setState(createInitialGameState(this.roomId));
    this.setMetadata({ roomCode: this.roomId });
    this.onMessage("ready", (client) => this.setReady(client));
    this.onMessage("start", (client) => this.startGame(client));
    this.onMessage("roll", (client) => this.roll(client));
    this.onMessage("answer", (client, payload: AnswerPayload) => this.answer(client, payload));
    this.onMessage("buy", (client) => this.requestBuy(client));
    this.onMessage("upgrade", (client) => this.requestUpgrade(client));
    this.onMessage("skipBuy", (client) => this.finishTurnIfCurrent(client));
    this.onMessage("payJailFine", (client) => this.payJailFine(client));
    this.onMessage("jailQuestion", (client) => this.askJailQuestion(client));
    this.onMessage("trade", (_client, payload: TradePayload) => this.trade(payload));
    this.clock.setInterval(() => this.checkQuestionTimeout(), 1000);
  }

  override onJoin(client: Client, options: JoinOptions): void {
    const existing = this.state.players.find((player) => player.name === options.name && !player.connected);
    if (existing) {
      existing.id = client.sessionId;
      existing.connected = true;
      this.state.log.unshift(`${existing.name} reconnect แล้ว`);
    } else {
      const avatar = options.avatar && avatars.includes(options.avatar) ? options.avatar : avatars[this.state.players.length] ?? "astro";
      const player = createPlayer(client.sessionId, options.name ?? "Player", avatar);
      this.state.players.push(player);
      this.state.log.unshift(`${player.name} เข้าห้อง`);
    }
    this.sendSnapshot();
  }

  override onLeave(client: Client): void {
    const player = findPlayer(this.state, client.sessionId);
    if (player) {
      player.connected = false;
      this.state.log.unshift(`${player.name} หลุดการเชื่อมต่อ`);
      this.sendSnapshot();
    }
  }

  private setReady(client: Client): void {
    const player = findPlayer(this.state, client.sessionId);
    if (!player || this.state.phase !== "lobby") return;
    player.ready = !player.ready;
    this.state.log.unshift(`${player.name} ${player.ready ? "พร้อมแล้ว" : "ยังไม่พร้อม"}`);
    this.sendSnapshot();
  }

  private startGame(client: Client): void {
    if (this.state.players[0]?.id !== client.sessionId) return;
    if (this.state.players.length < 2) this.addBotPlayers(2 - this.state.players.length);
    this.state.phase = "rolling";
    this.state.currentPlayerIndex = 0;
    this.state.log.unshift("เริ่มเกมแล้ว");
    this.sendSnapshot();
  }

  private roll(client: Client): void {
    const player = currentPlayer(this.state);
    if (!player || player.id !== client.sessionId || this.state.phase !== "rolling") return;
    if (player.skipNextTurn) {
      player.skipNextTurn = false;
      this.state.log.unshift(`${player.name} ถูกข้าม 1 ตา`);
      endTurn(this.state);
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
      this.sendSnapshot();
      return;
    }
    this.state.phase = "moving";
    const path = movePlayerByDice(this.state, player.id, dice);
    this.broadcast("tokenMove", { playerId: player.id, path, dice });
    this.state.log.unshift(`${player.name} ทอยได้ ${dice[0]} + ${dice[1]}`);
    this.clock.setTimeout(() => this.resolveLanding(player.id, isDouble), Math.max(700, path.length * 380));
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
        this.state.log.unshift(`${player.name} หยุดที่ ${tile.name} เลือกซื้อได้`);
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

  private requestBuy(client: Client): void {
    const player = currentPlayer(this.state);
    if (!player || player.id !== client.sessionId || this.state.phase !== "buying") return;
    const tile = this.state.tiles[player.tileIndex];
    if (!tile || tile.type !== "property" || tile.ownerId) return;
    this.askQuestion(player, "buy", tile.index, tile.difficulty ?? "easy");
    this.sendSnapshot();
  }

  private requestUpgrade(client: Client): void {
    const player = currentPlayer(this.state);
    if (!player || player.id !== client.sessionId || this.state.phase !== "rolling") return;
    const tile = this.state.tiles[player.tileIndex];
    if (!tile || tile.type !== "property" || tile.ownerId !== player.id || (tile.level ?? 0) >= 3) return;
    this.askQuestion(player, "buy", tile.index, tile.difficulty ?? "medium");
    this.sendSnapshot();
  }

  private answer(client: Client, payload: AnswerPayload): void {
    const pending = this.state.pendingQuestion;
    if (!pending || pending.playerId !== client.sessionId || pending.id !== payload.questionId) return;
    const question = this.pendingAnswers.get(pending.id);
    if (!question) return;
    const player = findPlayer(this.state, client.sessionId);
    if (!player) return;
    const correct = payload.choiceIndex === question.answerIndex;
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
      correct,
      correctChoice: question.answerIndex,
      explanation: question.explanation,
      moneyDelta: reward,
      xpDelta: xp,
    };
    this.pendingAnswers.delete(pending.id);
    this.broadcast("answerResult", result);
    this.finishLanding(false);
    this.sendSnapshot();
  }

  private payJailFine(client: Client): void {
    const player = currentPlayer(this.state);
    if (!player || player.id !== client.sessionId || !player.inJail || player.money < 500) return;
    player.money -= 500;
    player.inJail = false;
    player.jailTurns = 0;
    this.state.log.unshift(`${player.name} จ่ายค่าปรับออกจากคุก`);
    this.sendSnapshot();
  }

  private askJailQuestion(client: Client): void {
    const player = currentPlayer(this.state);
    if (!player || player.id !== client.sessionId || !player.inJail) return;
    this.askQuestion(player, "jail", undefined, "medium");
    this.sendSnapshot();
  }

  private trade(payload: TradePayload): void {
    const tile = this.state.tiles[payload.tileIndex];
    const owner = tile?.ownerId ? findPlayer(this.state, tile.ownerId) : undefined;
    const target = findPlayer(this.state, payload.toPlayerId);
    if (!tile || !owner || !target || payload.money < 0 || target.money < payload.money) return;
    target.money -= payload.money;
    owner.money += payload.money;
    tile.ownerId = target.id;
    this.state.log.unshift(`${target.name} แลก ${tile.name} จาก ${owner.name}`);
    this.sendSnapshot();
  }

  private askQuestion(player: { id: string }, reason: "buy" | "challenge" | "jail" | "chance", tileIndex: number | undefined, difficulty: "easy" | "medium" | "hard"): void {
    const question = selectQuestion(difficulty);
    const id = `${question.id}-${Date.now()}`;
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
      const dice: [number, number] = [Math.min(6, steps), Math.max(1, steps - Math.min(6, steps))];
      movePlayerByDice(this.state, player.id, dice);
      findPlayer(this.state, player.id)!.tileIndex = card.moveTo;
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
  }

  private finishTurnIfCurrent(client: Client): void {
    const player = currentPlayer(this.state);
    if (!player || player.id !== client.sessionId) return;
    this.finishLanding(false);
    this.sendSnapshot();
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
    if (!pending || Date.now() < pending.deadline) return;
    const fakeClient = { sessionId: pending.playerId } as Client;
    this.answer(fakeClient, { questionId: pending.id, choiceIndex: -1 });
  }

  private addBotPlayers(count: number): void {
    for (let i = 0; i < count; i += 1) {
      const id = `bot-${i}-${Date.now()}`;
      this.state.players.push(createPlayer(id, `Bot ${i + 1}`, avatars[(this.state.players.length + i) % avatars.length] ?? "robot"));
    }
  }

  private sendSnapshot(): void {
    this.broadcast("snapshot", this.state);
  }
}

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
