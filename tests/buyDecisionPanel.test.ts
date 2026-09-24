import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BUY_DECISION_MS, baseTiles } from "../shared/src";
import { BuyDecisionPanel } from "../client/src/ui/BuyDecisionPanel";

const tile = baseTiles.find(candidate => candidate.type === "property")!;
const render = (secondsLeft: number) => renderToStaticMarkup(createElement(BuyDecisionPanel, { open: true, tile, deadline: 1_000_000 + secondsLeft * 1000, now: 1_000_000, onBuy: () => {}, onUpgrade: () => {}, onPass: () => {} }));

describe("buy decision countdown", () => {
  it("gives a 30 second window and shows the full countdown", () => {
    expect(BUY_DECISION_MS).toBe(30_000);
    const html = render(30);
    expect(html).toContain("30s");
    expect(html).toContain("width:100%");
    expect(html).toContain("ตัดสินใจก่อนหมดเวลา");
  });
  it("warns when ten seconds or fewer remain", () => {
    const html = render(8);
    expect(html).toContain("8s");
    expect(html).toContain("ใกล้หมดเวลาแล้ว");
    expect(html).toContain("bg-coral");
  });
  it("renders nothing while closed and nothing has expired", () => {
    expect(renderToStaticMarkup(createElement(BuyDecisionPanel, { open: false, tile, deadline: null, now: 0, onBuy: () => {}, onUpgrade: () => {}, onPass: () => {} }))).toBe("");
  });
});
