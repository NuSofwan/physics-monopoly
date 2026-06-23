import { describe, expect, it } from "vitest";
import { buyProperty, calculateRent, createInitialGameState, createPlayer, movePlayerByDice } from "../shared/src";

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
});
