import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Difficulty, PhysicsTopic, Question } from "@physics-monopoly/shared";

const topics: PhysicsTopic[] = ["mechanics", "electricity", "waves", "heat", "optics", "modern"];

let cachedQuestions: Question[] | null = null;

export function loadQuestions(): Question[] {
  if (cachedQuestions) return cachedQuestions;
  const root = join(process.cwd(), "shared", "src", "questions");
  cachedQuestions = topics.flatMap((topic) => {
    const file = join(root, `${topic}.json`);
    return JSON.parse(readFileSync(file, "utf8")) as Question[];
  });
  return cachedQuestions;
}

export function selectQuestion(difficulty: Difficulty, rng: () => number = Math.random): Question {
  const pool = loadQuestions().filter((question) => question.difficulty === difficulty);
  return pool[Math.floor(rng() * pool.length)] ?? loadQuestions()[0]!;
}

export function publicQuestion(question: Question): Omit<Question, "answerIndex"> {
  const { answerIndex: _answerIndex, ...safeQuestion } = question;
  return safeQuestion;
}
