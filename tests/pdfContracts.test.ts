import { describe, it, expect } from "vitest";
import { cropRegion } from "../server/src/pdf/crop";
import { publicQuestion } from "../server/src/logic/questions";
import { randomUUID } from "node:crypto";
describe("private PDF media boundary", () => {
  it("accepts a bounded rectangular crop", () => {
    expect(cropRegion({ x: .1, y: .2, width: .8, height: .3 })).toEqual({ x: .1, y: .2, width: .8, height: .3 });
  });
  it.each([null, {}, { x: -.1, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: Infinity, height: 1 }, { x: .9, y: 0, width: .2, height: .1 }])("rejects invalid crop %j", (value) => {
    expect(() => cropRegion(value)).toThrow();
  });
  it("issues a temporary crop capability without publishing the source or answer", () => {
    const result = publicQuestion({ id: "q", prompt: "P", topic: "mechanics", difficulty: "easy", choices: ["a", "b"], answerIndex: 1, explanation: "secret", timeLimitSec: 30, media: { id: randomUUID(), alt: "Diagram" } });
    expect(result.media?.url).toMatch(/^\/api\/question-media\/.*\?expires=\d+&signature=/);
    expect(result.media?.alt).toBe("Diagram");
    expect(JSON.stringify(result)).not.toMatch(/answerIndex|explanation|source_documents|\.pdf/);
  });
});
