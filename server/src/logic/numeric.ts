import type { NumericKey } from "@physics-monopoly/shared";
const units: Record<string, { dimension: string; factor: number }> = {
  N: { dimension: "force", factor: 1 }, kN: { dimension: "force", factor: 1000 },
  m: { dimension: "length", factor: 1 }, cm: { dimension: "length", factor: .01 }, km: { dimension: "length", factor: 1000 },
  s: { dimension: "time", factor: 1 }, ms: { dimension: "time", factor: .001 },
  kg: { dimension: "mass", factor: 1 }, g: { dimension: "mass", factor: .001 },
  "m/s": { dimension: "speed", factor: 1 }, "km/h": { dimension: "speed", factor: 1 / 3.6 },
  "m/s^2": { dimension: "acceleration", factor: 1 },
  J: { dimension: "energy", factor: 1 }, kJ: { dimension: "energy", factor: 1000 },
  W: { dimension: "power", factor: 1 }, kW: { dimension: "power", factor: 1000 },
  Hz: { dimension: "frequency", factor: 1 }, kHz: { dimension: "frequency", factor: 1000 },
};
const normalize = (unit: string): string => unit.trim().replace(/²/g, "^2");
export function parseNumeric(value: unknown): number | null {
  if (typeof value !== "string" || value.length > 32 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d{1,3})?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= 1e12 ? parsed : null;
}
export function validateNumericKey(value: unknown): NumericKey {
  if (!value || typeof value !== "object") throw new Error("ต้องกำหนดค่าคำตอบ หน่วย และ tolerance");
  const key = value as NumericKey;
  if (!Number.isFinite(key.value) || Math.abs(key.value) > 1e12 || typeof key.unit !== "string" || !units[normalize(key.unit)]) throw new Error("ค่าหรือหน่วยคำตอบไม่ถูกต้อง");
  if (!Array.isArray(key.allowedUnits) || !key.allowedUnits.length || key.allowedUnits.length > 8 || key.allowedUnits.some((unit) => typeof unit !== "string" || units[normalize(unit)]?.dimension !== units[normalize(key.unit)]!.dimension)) throw new Error("หน่วยที่รับต้องมีมิติเดียวกับคำตอบ");
  if (!Number.isFinite(key.absoluteTolerance) || key.absoluteTolerance < 0 || key.absoluteTolerance > 1e6 || !Number.isFinite(key.relativeTolerance) || key.relativeTolerance < 0 || key.relativeTolerance > .1) throw new Error("Tolerance ไม่ถูกต้อง (relative ไม่เกิน 0.1)");
  return { value: key.value, unit: normalize(key.unit), allowedUnits: [...new Set(key.allowedUnits.map(normalize))], absoluteTolerance: key.absoluteTolerance, relativeTolerance: key.relativeTolerance };
}
export function gradeNumeric(key: NumericKey, answer: { value: string; unit: string } | undefined): boolean {
  if (!answer || typeof answer.unit !== "string") return false;
  const value = parseNumeric(answer.value);
  const unit = normalize(answer.unit);
  if (value === null || !key.allowedUnits.map(normalize).includes(unit)) return false;
  const expectedUnit = units[normalize(key.unit)];
  const actualUnit = units[unit];
  if (!expectedUnit || !actualUnit || expectedUnit.dimension !== actualUnit.dimension) return false;
  const expected = key.value * expectedUnit.factor;
  const actual = value * actualUnit.factor;
  const tolerance = Math.max(key.absoluteTolerance * expectedUnit.factor, Math.abs(expected) * key.relativeTolerance);
  return Math.abs(expected - actual) <= tolerance + Number.EPSILON * Math.max(1, Math.abs(expected), Math.abs(actual)) * 8;
}
