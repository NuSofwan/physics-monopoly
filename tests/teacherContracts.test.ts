import { describe, expect, it } from "vitest";
import { validateQuestion } from "../server/src/teacher/api";
const valid = { prompt: "แรงลัพธ์เท่าไร", choices: ["1 N", "2 N"], answerIndex: 1, explanation: "บวกแรง", hint: "ทิศเดียวกัน", objective: "แรงลัพธ์", topic: "mechanics", difficulty: "easy", timeLimitSec: 30 };
describe("teacher question contracts", () => {
  it("keeps answer keys separate from the student body", () => {
    const result = validateQuestion(valid);
    expect(result.body).not.toHaveProperty("answerIndex");
    expect(result.body).not.toHaveProperty("explanation");
    expect(result.key).toHaveProperty("answerIndex", 1);
  });
  it.each([NaN, Infinity, -1, 0, 121, "30"])("rejects invalid deadline %s", (timeLimitSec) => expect(() => validateQuestion({ ...valid, timeLimitSec })).toThrow());
  it("rejects duplicate choices and out-of-range answer keys", () => {
    expect(() => validateQuestion({ ...valid, choices: ["same", "same"] })).toThrow();
    expect(() => validateQuestion({ ...valid, answerIndex: 2 })).toThrow();
  });
  it("accepts five choices and rejects more as specified in the workflow", () => {
    expect(validateQuestion({ ...valid, choices: ["1","2","3","4","5"], answerIndex: 4 }).key).toHaveProperty("answerIndex", 4);
    expect(() => validateQuestion({ ...valid, choices: ["1","2","3","4","5","6"], answerIndex: 5 })).toThrow();
  });
});
