import { describe, expect, it } from "vitest";
import { gradeNumeric, parseNumeric, validateNumericKey } from "../server/src/logic/numeric";
import { publicQuestion } from "../server/src/logic/questions";
const key = { value: 1, unit: "m", allowedUnits: ["m", "cm"], absoluteTolerance: .001, relativeTolerance: .01 };
describe("server numeric grading", () => {
  it("converts compatible units", () => expect(gradeNumeric(key, { value: "100", unit: "cm" })).toBe(true));
  it("applies tolerance in the teacher's canonical unit", () => {
    expect(gradeNumeric(key, { value: "100.5", unit: "cm" })).toBe(true);
    expect(gradeNumeric(key, { value: "102", unit: "cm" })).toBe(false);
  });
  it("rejects dimension mismatches", () => {
    expect(gradeNumeric(key, { value: "1", unit: "s" })).toBe(false);
    expect(() => validateNumericKey({ ...key, allowedUnits: ["s"] })).toThrow();
  });
  it("rejects a dimension mismatch even if allowedUnits was hand-built to bypass validateNumericKey", () => {
    // gradeNumeric takes a NumericKey directly (not `unknown`), so a caller could in principle
    // construct one without ever calling validateNumericKey. Its own dimension guard must still hold.
    const unvalidatedKey = { value: 10, unit: "m/s", allowedUnits: ["m/s", "m"], absoluteTolerance: 0, relativeTolerance: 0.01 };
    expect(gradeNumeric(unvalidatedKey, { value: "10", unit: "m" })).toBe(false);
  });
  it.each(["Infinity", "NaN", "1/0", "process.exit()", "1e999", "0x10", "1,000"])("does not evaluate %s", (value) => expect(parseNumeric(value)).toBeNull());
  it("does not expose values, tolerances or explanations", () => {
    const question = publicQuestion({ id: "numeric", kind: "numeric", numericKey: key, topic: "mechanics", difficulty: "easy", prompt: "ระยะทางเท่าไร", choices: [], answerIndex: -1, explanation: "private", timeLimitSec: 30 });
    expect(question.allowedUnits).toEqual(["m", "cm"]);
    expect(JSON.stringify(question)).not.toMatch(/numericKey|Tolerance|explanation|private/);
  });
});
