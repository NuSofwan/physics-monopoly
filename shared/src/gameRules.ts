import { baseTiles, BOARD_SIZE, INITIAL_MONEY, JAIL_TILE_INDEX, START_MONEY } from "./boardConfig";
import type { Difficulty, GameState, PhysicsTopic, Player, Question, Tile } from "./types";

export const physicsTopics: PhysicsTopic[] = [
  "mechanics",
  "electricity",
  "waves",
  "heat",
  "optics",
  "modern",
];

export function createEmptyStats(): Player["stats"] {
  return Object.fromEntries(physicsTopics.map((topic) => [topic, { correct: 0, total: 0 }])) as Player["stats"];
}

export function createPlayer(id: string, name: string, avatar: string): Player {
  return {
    id,
    name: name.trim().slice(0, 20) || `Player ${id.slice(0, 4)}`,
    avatar,
    money: INITIAL_MONEY,
    tileIndex: 0,
    inJail: false,
    jailTurns: 0,
    skipNextTurn: false,
    bankrupt: false,
    xp: 0,
    stats: createEmptyStats(),
    connected: true,
    ready: false,
    doublesInRow: 0,
  };
}

export function createInitialGameState(roomCode: string): GameState {
  return {
    roomCode,
    players: [],
    tiles: cloneTiles(baseTiles),
    currentPlayerIndex: 0,
    phase: "lobby",
    dice: null,
    centerPot: 0,
    turnCount: 0,
    log: [`ห้อง ${roomCode} พร้อมแล้ว`],
    winnerId: null,
    pendingQuestion: null,
    lastMovePath: [],
  };
}

export function cloneTiles(tiles: Tile[]): Tile[] {
  return tiles.map((tile) => ({ ...tile, rentByLevel: tile.rentByLevel ? [...tile.rentByLevel] : undefined }));
}

export function rollDice(rng: () => number = Math.random): [number, number] {
  return [Math.floor(rng() * 6) + 1, Math.floor(rng() * 6) + 1];
}

export function buildMovePath(from: number, steps: number): number[] {
  const path: number[] = [];
  for (let i = 1; i <= steps; i += 1) {
    path.push((from + i) % BOARD_SIZE);
  }
  return path;
}

export function movePlayerByDice(state: GameState, playerId: string, dice: [number, number]): number[] {
  const player = findPlayer(state, playerId);
  if (!player) return [];
  const steps = dice[0] + dice[1];
  const oldIndex = player.tileIndex;
  const path = buildMovePath(oldIndex, steps);
  const passedStart = oldIndex + steps >= BOARD_SIZE;
  player.tileIndex = path.at(-1) ?? oldIndex;
  if (passedStart) {
    player.money += START_MONEY;
    state.log.unshift(`${player.name} ผ่าน START รับ ฿${START_MONEY.toLocaleString("th-TH")}`);
  }
  state.lastMovePath = path;
  return path;
}

export function calculateRent(tile: Tile): number {
  if (tile.type !== "property" || !tile.rentByLevel) return 0;
  const level = Math.max(0, Math.min(tile.level ?? 0, tile.rentByLevel.length - 1));
  return tile.rentByLevel[level] ?? 0;
}

export function canAfford(player: Player, amount: number): boolean {
  return !player.bankrupt && player.money >= amount;
}

export function pay(state: GameState, fromId: string, toId: string | "bank" | "pot", amount: number): void {
  const from = findPlayer(state, fromId);
  if (!from || amount <= 0) return;
  from.money -= amount;
  if (toId === "pot") {
    state.centerPot += amount;
  } else if (toId !== "bank") {
    const to = findPlayer(state, toId);
    if (to) to.money += amount;
  }
  if (from.money < 0) {
    from.bankrupt = true;
    state.log.unshift(`${from.name} ล้มละลาย`);
    state.tiles.forEach((tile) => {
      if (tile.ownerId === from.id) {
        tile.ownerId = null;
        tile.level = 0;
      }
    });
  }
}

export function buyProperty(state: GameState, playerId: string, tileIndex: number): boolean {
  const player = findPlayer(state, playerId);
  const tile = state.tiles[tileIndex];
  if (!player || !tile || tile.type !== "property" || tile.ownerId || !tile.price || !canAfford(player, tile.price)) {
    return false;
  }
  player.money -= tile.price;
  tile.ownerId = player.id;
  tile.level = Math.max(tile.level ?? 0, 0);
  state.log.unshift(`${player.name} ซื้อ ${tile.name} สำเร็จ`);
  return true;
}

export function upgradeProperty(state: GameState, playerId: string, tileIndex: number): boolean {
  const player = findPlayer(state, playerId);
  const tile = state.tiles[tileIndex];
  if (!player || !tile || tile.type !== "property" || tile.ownerId !== playerId || (tile.level ?? 0) >= 3) return false;
  const cost = Math.round((tile.price ?? 0) * 0.55);
  if (!canAfford(player, cost)) return false;
  player.money -= cost;
  tile.level = (tile.level ?? 0) + 1;
  state.log.unshift(`${player.name} อัปเกรด ${tile.name} เป็นระดับ ${tile.level}`);
  return true;
}

export function applyQuestionStats(player: Player, question: Question, correct: boolean): void {
  const stats = player.stats[question.topic];
  stats.total += 1;
  if (correct) {
    stats.correct += 1;
    player.xp += question.difficulty === "hard" ? 30 : question.difficulty === "medium" ? 20 : 10;
  }
}

export function difficultyReward(difficulty: Difficulty): number {
  if (difficulty === "hard") return 1400;
  if (difficulty === "medium") return 900;
  return 600;
}

export function nextActivePlayerIndex(state: GameState): number {
  const total = state.players.length;
  if (total === 0) return 0;
  for (let offset = 1; offset <= total; offset += 1) {
    const index = (state.currentPlayerIndex + offset) % total;
    const player = state.players[index];
    if (player && !player.bankrupt) return index;
  }
  return state.currentPlayerIndex;
}

export function endTurn(state: GameState, keepTurn = false): void {
  state.pendingQuestion = null;
  state.phase = state.winnerId ? "game_over" : "rolling";
  if (!keepTurn) {
    state.currentPlayerIndex = nextActivePlayerIndex(state);
    state.turnCount += 1;
  }
}

export function checkWinner(state: GameState, maxTurns = 80): string | null {
  const active = state.players.filter((player) => !player.bankrupt);
  if (active.length === 1 && state.players.length > 1) return active[0]?.id ?? null;
  if (state.turnCount >= maxTurns && active.length > 0) {
    return [...active].sort((a, b) => calculateNetWorth(state, b.id) - calculateNetWorth(state, a.id))[0]?.id ?? null;
  }
  return null;
}

export function calculateNetWorth(state: GameState, playerId: string): number {
  const player = findPlayer(state, playerId);
  if (!player) return 0;
  const propertyValue = state.tiles.reduce((total, tile) => {
    if (tile.ownerId !== playerId) return total;
    const upgradeValue = (tile.level ?? 0) * Math.round((tile.price ?? 0) * 0.45);
    return total + (tile.price ?? 0) + upgradeValue;
  }, 0);
  return player.money + propertyValue;
}

export function physicsMvp(state: GameState): Player | null {
  return [...state.players].sort((a, b) => {
    const aCorrect = physicsTopics.reduce((sum, topic) => sum + a.stats[topic].correct, 0);
    const bCorrect = physicsTopics.reduce((sum, topic) => sum + b.stats[topic].correct, 0);
    return bCorrect - aCorrect || b.xp - a.xp;
  })[0] ?? null;
}

export function findPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((player) => player.id === playerId);
}

export function currentPlayer(state: GameState): Player | undefined {
  return state.players[state.currentPlayerIndex];
}
