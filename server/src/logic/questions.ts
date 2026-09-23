import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Difficulty, PhysicsTopic, PublicQuestion, Question } from "@physics-monopoly/shared";
import { questionMediaUrl } from "../pdf/media";

const topics: PhysicsTopic[] = ["mechanics", "electricity", "waves", "heat", "optics", "modern"];

let cachedQuestions: Question[] | null = null;

export function loadQuestions(): Question[] {
  if (cachedQuestions) return cachedQuestions;
  const root = fileURLToPath(new URL("../../../shared/src/questions/", import.meta.url));
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

export function publicQuestion(question: Question): PublicQuestion {
  return {
    id: question.id,
    topic: question.topic,
    difficulty: question.difficulty,
    prompt: question.prompt,
    choices: [...question.choices],
    choiceIds: question.choices.map((_choice,index)=>`${question.id}:${index}`),
    timeLimitSec: question.timeLimitSec,
    ...(question.media ? { media: { url: questionMediaUrl(question.media.id), alt: question.media.alt } } : {}),
    ...(question.kind === "numeric" ? { kind: "numeric" as const, allowedUnits: [...(question.numericKey?.allowedUnits ?? [])] } : {}),
  };
}
