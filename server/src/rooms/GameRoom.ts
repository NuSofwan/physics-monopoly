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
  sellProperty,
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

interface AuctionBidPayload {
  amount: number;
}

interface PlayerPayload {
  playerId: string;
}

interface TilePayload {
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
    this.onMessage("skipBuy", (client) => this.skipBuy(client));
    this.onMessage("payJailFine", (client) => this.payJailFine(client));
    this.onMessage("jailQuestion", (client) => this.askJailQuestion(client));
    this.onMessage("trade", (_client, payload: TradePayload) => this.trade(payload));
    this.onMessage("auctionBid", (client, payload: AuctionBidPayload) => this.auctionBid(client, payload));
    this.onMessage("auctionPass", (client) => this.auctionPass(client));
    this.onMessage("sellProperty", (client, payload: TilePayload) => this.sellOwnedProperty(client, payload));
    this.onMessage("addBot", (client) => this.addLobbyBot(client));
    this.onMessage("kickPlayer", (client, payload: PlayerPayload) => this.kickPlayer(client, payload));
    this.clock.setInterval(() => {
      this.checkQuestionTimeout();
      this.checkAuctionTimeout();
      this.checkTurnTimeout();
    }, 1000);
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
    this.state.log.unshift("????????????");
    this.refreshTurnTimer();
    this.sendSnapshot();
  }

  private roll(client: Client): void {
    const player = currentPlayer(this.state);
    if (!player || player.id !== client.sessionId || this.state.phase !== "rolling") return;
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
        this.state.turnDeadline = null;
        this.state.log.unshift(`${player.name} ??????? ${tile.name} ????????????`);
        if (this.isBot(player.id)) this.clock.setTimeout(() => this.botBuyDecision(player.id), 900);
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
    this.state.turnDeadline = null;
    if (this.isBot(player.id)) {
      this.clock.setTimeout(() => this.botAnswer(player.id, id), 1200);
    }
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
    this.refreshTurnTimer();
  }

  private skipBuy(client: Client): void {
    const player = currentPlayer(this.state);
    if (!player || player.id !== client.sessionId || this.state.phase !== "buying") return;
    const tile = this.state.tiles[player.tileIndex];
    if (!tile || tile.type !== "property" || tile.ownerId) {
      this.finishLanding(false);
      this.sendSnapshot();
      return;
    }
    this.startAuction(tile.index, player.id);
    this.sendSnapshot();
  }

  private startAuction(tileIndex: number, firstPassPlayerId: string): void {
    const tile = this.state.tiles[tileIndex];
    if (!tile || tile.type !== "property") return;
    this.state.phase = "auctioning";
    this.state.pendingAuction = {
      tileIndex,
      currentBid: Math.max(100, Math.round((tile.price ?? 1000) * 0.35)),
      bidderId: null,
      passes: [firstPassPlayerId],
      deadline: Date.now() + 25000,
    };
    this.state.turnDeadline = null;
    this.state.log.unshift("Auction started: " + tile.name);
  }

  private auctionBid(client: Client, payload: AuctionBidPayload): void {
    const auction = this.state.pendingAuction;
    const player = findPlayer(this.state, client.sessionId);
    if (!auction || !player || player.bankrupt || player.money < payload.amount) return;
    const minimum = auction.bidderId ? auction.currentBid + 100 : auction.currentBid;
    if (payload.amount < minimum) return;
    auction.currentBid = payload.amount;
    auction.bidderId = player.id;
    auction.passes = auction.passes.filter((id) => id !== player.id);
    auction.deadline = Date.now() + 18000;
    this.state.log.unshift(player.name + " bids " + payload.amount.toLocaleString("th-TH"));
    this.sendSnapshot();
  }

  private auctionPass(client: Client): void {
    const auction = this.state.pendingAuction;
    const player = findPlayer(this.state, client.sessionId);
    if (!auction || !player) return;
    if (!auction.passes.includes(player.id)) auction.passes.push(player.id);
    this.state.log.unshift(player.name + " passed auction");
    this.resolveAuctionIfReady();
    this.sendSnapshot();
  }

  private checkAuctionTimeout(): void {
    if (!this.state.pendingAuction || Date.now() < this.state.pendingAuction.deadline) return;
    this.resolveAuction(true);
  }

  private resolveAuctionIfReady(): void {
    const auction = this.state.pendingAuction;
    if (!auction) return;
    const active = this.state.players.filter((player) => !player.bankrupt);
    const passCount = active.filter((player) => auction.passes.includes(player.id)).length;
    if (auction.bidderId && passCount >= active.length - 1) this.resolveAuction(true);
    if (!auction.bidderId && passCount >= active.length) this.resolveAuction(false);
  }

  private resolveAuction(sold: boolean): void {
    const auction = this.state.pendingAuction;
    if (!auction) return;
    const tile = this.state.tiles[auction.tileIndex];
    const bidder = auction.bidderId ? findPlayer(this.state, auction.bidderId) : undefined;
    if (sold && tile?.type === "property" && bidder && bidder.money >= auction.currentBid) {
      bidder.money -= auction.currentBid;
      tile.ownerId = bidder.id;
      tile.level = 0;
      this.state.log.unshift(bidder.name + " won auction: " + tile.name);
    } else if (tile) {
      this.state.log.unshift("Auction ended without winner: " + tile.name);
    }
    this.state.pendingAuction = null;
    this.finishLanding(false);
    this.sendSnapshot();
  }

  private sellOwnedProperty(client: Client, payload: TilePayload): void {
    if (sellProperty(this.state, client.sessionId, payload.tileIndex)) this.sendSnapshot();
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

  private addLobbyBot(client: Client): void {
    if (this.state.phase !== "lobby" || this.state.players[0]?.id !== client.sessionId) return;
    if (this.state.players.length >= MAX_PLAYERS) return;
    this.addBotPlayers(1);
    this.sendSnapshot();
  }

  private kickPlayer(client: Client, payload: PlayerPayload): void {
    if (this.state.phase !== "lobby" || this.state.players[0]?.id !== client.sessionId) return;
    if (payload.playerId === client.sessionId) return;
    const player = findPlayer(this.state, payload.playerId);
    if (!player) return;
    this.state.players = this.state.players.filter((item) => item.id !== payload.playerId);
    this.state.log.unshift(player.name + " left lobby");
    this.sendSnapshot();
  }

  private refreshTurnTimer(): void {
    if (this.state.phase === "rolling" && !this.state.winnerId) {
      this.state.turnDeadline = Date.now() + this.state.turnTimeSec * 1000;
      const player = currentPlayer(this.state);
      if (player && this.isBot(player.id)) {
        this.clock.setTimeout(() => this.rollBot(player.id), 900);
      }
    } else {
      this.state.turnDeadline = null;
    }
  }

  private checkTurnTimeout(): void {
    if (this.state.phase !== "rolling" || !this.state.turnDeadline || Date.now() < this.state.turnDeadline) return;
    const player = currentPlayer(this.state);
    if (player) this.state.log.unshift(player.name + " timed out");
    endTurn(this.state);
    this.refreshTurnTimer();
    this.sendSnapshot();
  }

  private rollBot(playerId: string): void {
    const player = currentPlayer(this.state);
    if (!player || player.id !== playerId || this.state.phase !== "rolling") return;
    this.roll({ sessionId: playerId } as Client);
  }

  private botBuyDecision(playerId: string): void {
    const player = currentPlayer(this.state);
    if (!player || player.id !== playerId || this.state.phase !== "buying") return;
    const tile = this.state.tiles[player.tileIndex];
    if (!tile || tile.type !== "property" || tile.ownerId || (tile.price ?? 0) > player.money * 0.75) {
      this.startAuction(player.tileIndex, player.id);
      this.sendSnapshot();
      return;
    }
    this.askQuestion(player, "buy", tile.index, tile.difficulty ?? "easy");
    this.sendSnapshot();
  }

  private botAnswer(playerId: string, pendingId: string): void {
    const pending = this.state.pendingQuestion;
    const question = this.pendingAnswers.get(pendingId);
    if (!pending || pending.id !== pendingId || pending.playerId !== playerId || !question) return;
    const skill = question.difficulty === "hard" ? 0.48 : question.difficulty === "medium" ? 0.62 : 0.76;
    const choiceIndex = Math.random() < skill ? question.answerIndex : Math.floor(Math.random() * question.choices.length);
    this.answer({ sessionId: playerId } as Client, { questionId: pendingId, choiceIndex });
  }

  private isBot(playerId: string): boolean {
    return playerId.startsWith("bot-");
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
