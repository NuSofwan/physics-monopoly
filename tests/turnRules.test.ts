import { describe, expect, it } from "vitest";
import { checkWinner, createInitialGameState, createPlayer, endTurn, pay } from "../shared/src";

function threePlayers() {
  const state = createInitialGameState("TURN1");
  state.players.push(createPlayer("a", "A", "astro"), createPlayer("b", "B", "girl"), createPlayer("c", "C", "boy"));
  state.phase = "rolling";
  return state;
}

describe("turn rules", () => {
  it("never keeps the turn for a player who went bankrupt on a double", () => {
    const state = threePlayers();
    state.players[0]!.doublesInRow = 1;
    pay(state, "a", "pot", state.players[0]!.money + 1);
    expect(state.players[0]!.bankrupt).toBe(true);
    expect(checkWinner(state)).toBeNull();
    endTurn(state, true);
    expect(state.currentPlayerIndex).toBe(1);
    expect(state.phase).toBe("rolling");
  });

  it("resets the doubles streak when the turn passes", () => {
    const state = threePlayers();
    state.players[0]!.doublesInRow = 2;
    endTurn(state);
    expect(state.players[0]!.doublesInRow).toBe(0);
    state.players[1]!.doublesInRow = 1;
    endTurn(state, true);
    expect(state.players[1]!.doublesInRow).toBe(1);
  });

  it("ends a game where every player is bankrupt instead of looping", () => {
    const state = createInitialGameState("SOLO1");
    state.players.push(createPlayer("solo", "Solo", "astro"));
    pay(state, "solo", "pot", state.players[0]!.money + 50);
    expect(checkWinner(state)).toBe("solo");
  });
});

describe("payments", () => {
  it("credits the owner only what a bankrupt payer actually had", () => {
    const state = threePlayers();
    state.players[0]!.money = 300;
    const before = state.players[1]!.money;
    pay(state, "a", "b", 1000);
    expect(state.players[0]!.bankrupt).toBe(true);
    expect(state.players[1]!.money).toBe(before + 300);
    const pot = state.centerPot;
    state.players[2]!.money = 50;
    pay(state, "c", "pot", 800);
    expect(state.centerPot).toBe(pot + 50);
  });
});
