export type Difficulty = "easy" | "medium" | "hard";

export type PhysicsTopic =
  | "mechanics"
  | "electricity"
  | "waves"
  | "heat"
  | "optics"
  | "modern";

export interface Question {
  hint?: string;
  objective?: string;
  media?: { id: string; alt: string };
  kind?: "choice" | "numeric";
  numericKey?: NumericKey;
  id: string;
  topic: PhysicsTopic;
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  timeLimitSec: number;
}

/**
 * The only question fields that may cross the network before answers close.
 * Keep this explicit: a future field on Question must be deliberately allowed
 * here rather than accidentally becoming public through object spreading.
 */
export interface PublicQuestion {
  choiceIds?: string[];
  media?: { url: string; alt: string };
  kind?: "choice" | "numeric";
  allowedUnits?: string[];
  id: string;
  topic: PhysicsTopic;
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  timeLimitSec: number;
}

export interface NumericKey {
  value: number;
  unit: string;
  allowedUnits: string[];
  absoluteTolerance: number;
  relativeTolerance: number;
}

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
  inactive?: boolean;
  supportDebt?: number;
  emergencyGrantUsed?: boolean;
  invested?: number;
  id: string;
  name: string;
  avatar: string;
  appearance?: import("./appearance").Appearance;
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
  | "reveal"
  | "buying"
  | "auctioning"
  | "turn_end"
  | "game_over";

export interface PendingQuestion {
  timeMultiplier?: number;
  group?: boolean;
  stage?: "first" | "retry" | "reveal";
  repeated?: boolean;
  id: string;
  playerId: string;
  reason: "buy" | "challenge" | "jail" | "chance";
  tileIndex?: number;
  question: PublicQuestion;
  deadline: number;
}

export interface AuctionState {
  tileIndex: number;
  currentBid: number;
  bidderId: string | null;
  passes: string[];
  deadline: number;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  tileIndex: number;
  money: number;
  status: "pending" | "accepted" | "declined";
}

export interface ChanceCard {
  id: string;
  title: string;
  description: string;
  effect: "money" | "move" | "jail" | "question" | "freeParking" | "collectFromEach" | "repair" | "moveRelative";
  amount?: number;
  moveTo?: number;
  moveBy?: number;
  difficulty?: Difficulty;
}

export interface GameState {
  questionTimeMultiplier?: number;
  mapId?: string;
  hostId?: string;
  paused?: { reason: "teacher" | "offline" | "restart"; since: number };
  finishReason?: "completed" | "interrupted" | "abandoned";
  classroomMode?: boolean;
  endsAt?: number;
  winnerIds?: string[];
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
  pendingAuction: AuctionState | null;
  tradeOffers: TradeOffer[];
  lastMovePath: number[];
  turnDeadline: number | null;
  turnTimeSec: number;
}

export interface AnswerResult {
  questionId: string;
  correct: boolean;
  correctChoice: number;
  explanation: string;
  moneyDelta: number;
  xpDelta: number;
}

export interface LearningReceipt {
  questionId: string;
  status: "open" | "retry_wait" | "retry_open" | "closed";
  hint?: string;
  firstSubmitted: boolean;
  retrySubmitted: boolean;
  reflectionSaved?: boolean;
}
