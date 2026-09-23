import { describe, expect, it } from "vitest";
import { buyProperty, calculateRent, createInitialGameState, createPlayer, movePlayerByDice, sellProperty } from "../shared/src";
import { publicQuestion } from "../server/src/logic/questions";

describe("gameRules", () => {
  it("moves around the 28 tile board and pays START money", () => {
    const state = createInitialGameState("TEST1");
    const player = createPlayer("p1", "Tester", "astro");
    player.tileIndex = 26;
    state.players.push(player);
    const path = movePlayerByDice(state, "p1", [2, 2]);
    expect(path).toEqual([27, 0, 1, 2]);
    expect(player.tileIndex).toBe(2);
    expect(player.money).toBe(17000);
  });

  it("buys an unowned property and calculates rent by level", () => {
    const state = createInitialGameState("TEST2");
    const player = createPlayer("p1", "Tester", "astro");
    state.players.push(player);
    expect(buyProperty(state, "p1", 1)).toBe(true);
    expect(state.tiles[1]?.ownerId).toBe("p1");
    expect(calculateRent(state.tiles[1]!)).toBe(120);
  });

  it("sells a property back for the correct refund and logs a clean Thai message", () => {
    const state = createInitialGameState("TEST3");
    const player = createPlayer("p1", "Tester", "astro");
    state.players.push(player);
    expect(buyProperty(state, "p1", 1)).toBe(true);
    const tile = state.tiles[1]!;
    tile.level = 2;
    const moneyBeforeSale = player.money;
    const expectedRefund = Math.round((tile.price ?? 0) * 0.55) + Math.round(2 * (tile.price ?? 0) * 0.25);
    expect(sellProperty(state, "p1", 1)).toBe(true);
    expect(player.money).toBe(moneyBeforeSale + expectedRefund);
    expect(tile.ownerId).toBeNull();
    expect(tile.level).toBe(0);
    expect(state.log[0]).not.toMatch(/\?/);
    expect(state.log[0]).toContain(player.name);
    expect(state.log[0]).toContain(tile.name);
    expect(state.log[0]).toContain(expectedRefund.toLocaleString("th-TH"));
  });

  it("uses an explicit public-question allowlist before answers are revealed", () => {
    const question = {
      id: "private-key-test",
      topic: "mechanics" as const,
      difficulty: "easy" as const,
      prompt: "โจทย์",
      choices: ["ก", "ข"],
      answerIndex: 1,
      explanation: "เฉลยต้องไม่อยู่ใน payload นี้",
      timeLimitSec: 45,
    };

    expect(publicQuestion(question)).toEqual({
      choiceIds: ["private-key-test:0", "private-key-test:1"],
      id: "private-key-test",
      topic: "mechanics",
      difficulty: "easy",
      prompt: "โจทย์",
      choices: ["ก", "ข"],
      timeLimitSec: 45,
    });
    expect(Object.keys(publicQuestion(question))).not.toContain("answerIndex");
    expect(Object.keys(publicQuestion(question))).not.toContain("explanation");
  });
});
