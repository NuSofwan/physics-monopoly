import { it, expect } from "vitest";
import { demoCatalog, demoQuestions } from "../server/src/teacher/demoSets";
import { validateQuestion } from "../server/src/teacher/api";
import { gradeNumeric } from "../server/src/logic/numeric";
import type { NumericKey } from "../shared/src/types";
it("has two review-required 30-question topic sets per grade with valid numeric answers", () => {
  for (const grade of [2,4,5]) expect(demoCatalog.filter((item) => item.grade === grade)).toHaveLength(2);
  for (const set of demoCatalog) {
    const questions = demoQuestions(set.id);
    expect(questions).toHaveLength(30);
    expect(new Set(questions.map((q) => q.prompt)).size).toBe(30);
    for (const q of questions) {
      expect(() => validateQuestion(q)).not.toThrow();
      const key = q.numericKey as NumericKey;
      expect(gradeNumeric(key, { value: String(key.value), unit: key.unit })).toBe(true);
    }
  }
});
