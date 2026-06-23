export type Difficulty = "easy" | "medium" | "hard";

export type PhysicsTopic =
  | "mechanics"
  | "electricity"
  | "waves"
  | "heat"
  | "optics"
  | "modern";

export interface Question {
  id: string;
  topic: PhysicsTopic;
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  timeLimitSec: number;
}

export type PublicQuestion = Omit<Question, "answerIndex">;

export type TileType =
  | "start"
  | "property"
  | "challenge"
  | "chance"
  | "tax"
  | "jail"
  | "goToJail"
  | "freeParking";

export type PropertyKind = "land" | "house" | "condo" | "hotel";

export interface Tile {
  index: number;
  type: TileType;
  name: string;
  kind?: PropertyKind;
  groupColor?: string;
  price?: number;
  rentByLevel?: number[];
  difficulty?: Difficulty;
  ownerId?: string | null;
  level?: number;
  failPenalty?: "jail" | "skipTurn";
}

export interface TopicStats {
  correct: number;
  total: number;
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  money: number;
  tileIndex: number;
  inJail: boolean;
  jailTurns: number;
  skipNextTurn: boolean;
  bankrupt: boolean;
  xp: number;
  stats: Record<PhysicsTopic, TopicStats>;
  connected: boolean;
  ready: boolean;
  doublesInRow: number;
}

export type GamePhase =
  | "lobby"
  | "rolling"
  | "moving"
  | "resolving_tile"
  | "answering"
  | "buying"
  | "turn_end"
  | "game_over";

export interface PendingQuestion {
  id: string;
  playerId: string;
  reason: "buy" | "challenge" | "jail" | "chance";
  tileIndex?: number;
  question: PublicQuestion;
  deadline: number;
}

export interface ChanceCard {
  id: string;
  title: string;
  description: string;
  effect: "money" | "move" | "jail" | "question" | "freeParking";
  amount?: number;
  moveTo?: number;
  difficulty?: Difficulty;
}

export interface GameState {
  roomCode: string;
  players: Player[];
  tiles: Tile[];
  currentPlayerIndex: number;
  phase: GamePhase;
  dice: [number, number] | null;
  centerPot: number;
  turnCount: number;
  log: string[];
  winnerId: string | null;
  pendingQuestion: PendingQuestion | null;
  lastMovePath: number[];
}

export interface AnswerResult {
  correct: boolean;
  correctChoice: number;
  explanation: string;
  moneyDelta: number;
  xpDelta: number;
}
