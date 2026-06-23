import type { Tile } from "./types";

const property = (
  index: number,
  name: string,
  kind: NonNullable<Tile["kind"]>,
  groupColor: string,
  price: number,
  rents: number[],
  difficulty: NonNullable<Tile["difficulty"]>,
): Tile => ({
  index,
  type: "property",
  name,
  kind,
  groupColor,
  price,
  rentByLevel: rents,
  difficulty,
  ownerId: null,
  level: 0,
});

export const START_MONEY = 2000;
export const INITIAL_MONEY = 15000;
export const MAX_PLAYERS = 4;
export const JAIL_TILE_INDEX = 7;
export const BOARD_SIZE = 28;

export const baseTiles: Tile[] = [
  { index: 0, type: "start", name: "START" },
  property(1, "สนามแรง", "land", "#ef4444", 1200, [120, 280, 620, 1100], "easy"),
  property(2, "ถนนความเร็ว", "land", "#ef4444", 1400, [140, 320, 700, 1250], "easy"),
  { index: 3, type: "challenge", name: "โจทย์กลศาสตร์", failPenalty: "skipTurn" },
  property(4, "ย่านงานพลังงาน", "house", "#f97316", 1800, [180, 420, 900, 1600], "medium"),
  { index: 5, type: "tax", name: "ภาษีเครื่องมือ", price: 800 },
  { index: 6, type: "chance", name: "โอกาส" },
  { index: 7, type: "jail", name: "คุก/เยี่ยมชม" },
  property(8, "ชุมชนคลื่น", "land", "#eab308", 1600, [160, 380, 820, 1450], "easy"),
  property(9, "สถานีเสียง", "house", "#eab308", 2000, [200, 470, 980, 1750], "medium"),
  { index: 10, type: "challenge", name: "โจทย์คลื่น", failPenalty: "jail" },
  property(11, "เมืองความร้อน", "condo", "#22c55e", 2400, [260, 620, 1320, 2300], "medium"),
  { index: 12, type: "freeParking", name: "กองกลาง" },
  property(13, "ตึกแก๊สอุดมคติ", "condo", "#22c55e", 2600, [280, 680, 1450, 2500], "medium"),
  { index: 14, type: "goToJail", name: "ไปคุก" },
  property(15, "ถนนเลนส์", "land", "#06b6d4", 2200, [230, 540, 1200, 2100], "medium"),
  { index: 16, type: "challenge", name: "โจทย์แสง", failPenalty: "skipTurn" },
  property(17, "เมืองกระจก", "house", "#06b6d4", 2700, [300, 720, 1500, 2650], "medium"),
  { index: 18, type: "chance", name: "โอกาส" },
  property(19, "เขตวงจร", "condo", "#3b82f6", 3000, [340, 820, 1700, 3000], "hard"),
  { index: 20, type: "tax", name: "ภาษีพลังงาน", price: 1200 },
  property(21, "สถานีแม่เหล็ก", "hotel", "#3b82f6", 3400, [400, 920, 1950, 3400], "hard"),
  { index: 22, type: "challenge", name: "โจทย์ไฟฟ้า", failPenalty: "jail" },
  property(23, "นครโฟตอน", "condo", "#8b5cf6", 3600, [440, 1050, 2200, 3800], "hard"),
  property(24, "หออะตอม", "hotel", "#8b5cf6", 4000, [500, 1200, 2500, 4300], "hard"),
  { index: 25, type: "chance", name: "โอกาส" },
  property(26, "ศูนย์นิวเคลียร์", "hotel", "#ec4899", 4200, [540, 1320, 2750, 4700], "hard"),
  { index: 27, type: "challenge", name: "โจทย์ยุคใหม่", failPenalty: "skipTurn" },
];

export const chanceCards = [
  {
    id: "chance-money-1",
    title: "ทุนวิจัยเข้า",
    description: "ได้รับเงินสนับสนุนห้องทดลอง ฿1,000",
    effect: "money",
    amount: 1000,
  },
  {
    id: "chance-money-2",
    title: "อุปกรณ์เสีย",
    description: "ซ่อมเครื่องมือทดลอง จ่าย ฿700 เข้ากองกลาง",
    effect: "money",
    amount: -700,
  },
  {
    id: "chance-move-start",
    title: "ไปนำเสนอที่ START",
    description: "เดินทางกลับ START และรับเงินผ่านทาง",
    effect: "move",
    moveTo: 0,
  },
  {
    id: "chance-jail",
    title: "ทดลองผิดกฎความปลอดภัย",
    description: "ไปคุกทันที",
    effect: "jail",
  },
  {
    id: "chance-question",
    title: "โจทย์โบนัส",
    description: "ตอบโจทย์ฟิสิกส์เพื่อรับ XP และเงิน",
    effect: "question",
    difficulty: "medium",
  },
] as const;
