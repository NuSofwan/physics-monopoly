import type { Tile } from "./types";
/** Economy v1 is shared by every visual location. No jail or elimination rules. */
export const CLASSROOM_ECONOMY_VERSION = 1;
export const classroomBoard: Tile[] = Array.from({ length: 28 }, (_, index) => {
  if (index === 0) return { index, type: "start", name: "START · ผ่านรับ 2,000" };
  if ([3,10,17,24].includes(index)) return { index, type: "challenge", name: "Physics Lab", difficulty: "easy" };
  if ([6,13,20].includes(index)) return { index, type: "chance", name: "Discovery · ทุน 300" };
  if ([7,21].includes(index)) return { index, type: "tax", name: "City Service · ดูแลเมือง 500" };
  if (index === 14) return { index, type: "freeParking", name: "Research Grant · ทุน 500" };
  if (index === 27) return { index, type: "freeParking", name: "Reflection Plaza" };
  const price = 1200 + Math.floor(index / 7) * 1000;
  return { index, type: "property", name: `ย่านเรียนรู้ ${index}`, price, level: 0, ownerId: null, kind: "land", difficulty: "easy", rentByLevel: [Math.round(price * .1), Math.round(price * .2), Math.round(price * .3), Math.min(1500, Math.round(price * .4))] };
});
export function classroomUpgradeCost(tile: Tile): number { return Math.round((tile.price ?? 0) * .5); }
