import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Question } from "../shared/src/types";

const topics = ["mechanics", "electricity", "waves", "heat", "optics", "modern"];
const ids = new Set<string>();
const errors: string[] = [];

for (const topic of topics) {
  const file = join(process.cwd(), "shared", "src", "questions", `${topic}.json`);
  const questions = JSON.parse(readFileSync(file, "utf8")) as Question[];
  if (questions.length < 10) {
    errors.push(`${topic}: expected at least 10 questions, found ${questions.length}`);
  }
  for (const question of questions) {
    if (ids.has(question.id)) errors.push(`${question.id}: duplicate id`);
    ids.add(question.id);
    if (question.topic !== topic) errors.push(`${question.id}: topic mismatch`);
    if (!["easy", "medium", "hard"].includes(question.difficulty)) errors.push(`${question.id}: bad difficulty`);
    if (question.choices.length !== 4) errors.push(`${question.id}: needs exactly 4 choices`);
    if (question.answerIndex < 0 || question.answerIndex >= question.choices.length) {
      errors.push(`${question.id}: answerIndex out of range`);
    }
    if (!question.prompt || !question.explanation) errors.push(`${question.id}: prompt/explanation required`);
    if (question.timeLimitSec < 10) errors.push(`${question.id}: timeLimitSec too low`);
  }
}

if (ids.size < 60) errors.push(`expected at least 60 total questions, found ${ids.size}`);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated ${ids.size} physics questions.`);
