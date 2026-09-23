/** Real browser acceptance run. No clock overrides, private state, or answer keys. */
import { chromium, type Page } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const url = process.env.QA_URL ?? "http://localhost:5174";
const directory = resolve("docs/qa/runs", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const pages: Page[] = [];
const errors: string[] = [];
const started = Date.now();
const report: Record<string, unknown> = { url, started: new Date(started).toISOString(), status: "running", errors };
const save = async () => writeFile(resolve(directory, "result.json"), JSON.stringify(report, null, 2));
const autoplay = await readFile(new URL("./browser-autoplay.js", import.meta.url), "utf8");
try {
  for (let i = 0; i < 4; i++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(`player ${i}: ${error.message}`));
    pages.push(page);
    await page.goto(url);
    await page.getByLabel("ชื่อเล่น", { exact: true }).fill(`QA Player ${i + 1}`);
    await page.getByRole("button", { name: ["astro", "engineer", "girl", "boy"][i], exact: true }).click();
    if (i === 0) {
      await page.getByRole("button", { name: "สร้างห้อง", exact: true }).click();
      await page.getByText("Room code", { exact: true }).waitFor();
      report.roomCode = (await page.getByText("Room code", { exact: true }).locator("..").locator("button").first().innerText()).trim();
    } else {
      await page.getByLabel("รหัสห้อง", { exact: true }).fill(String(report.roomCode));
      await page.getByRole("button", { name: "เข้าห้อง", exact: true }).click();
    }
    await page.getByRole("button", { name: "พร้อมเล่น", exact: true }).click();
  }
  await pages[0].getByText("4/4", { exact: true }).waitFor();
  await pages[0].screenshot({ path: resolve(directory, "lobby.png"), fullPage: true });
  await pages[0].getByRole("button", { name: "เริ่มเกม", exact: true }).click();
  for (const page of pages) {
    await page.getByRole("button", { name: "Roll dice", exact: true }).waitFor();
    await page.locator("canvas").first().waitFor();
    await page.evaluate(() => { (window as any).physicsQaQuestionLimit = Infinity; });
    await page.evaluate(autoplay);
  }
  await pages[0].screenshot({ path: resolve(directory, "board.png"), fullPage: true });
  await save();
  let lastCapture = 0;
  while (Date.now() - started < 45 * 60_000) {
    const progress = await Promise.all(pages.map((page) => page.evaluate(() => {
      const qa = (window as any).physicsQa;
      return { questions: qa?.questions, reveals: qa?.reveals, actions: qa?.actions?.length, finished: qa?.finished };
    })));
    report.progress = progress;
    report.elapsedSeconds = Math.round((Date.now() - started) / 1000);
    await save();
    console.log(JSON.stringify({ elapsedSeconds: report.elapsedSeconds, progress }));
    if (progress.every((player) => player.finished)) break;
    if (progress.some((player) => player.reveals > 0) && lastCapture === 0) {
      await pages[0].screenshot({ path: resolve(directory, "in-game.png"), fullPage: true });
      lastCapture++;
    }
    await new Promise((done) => setTimeout(done, 10_000));
  }
  const results = await Promise.all(pages.map(async (page, i) => {
    await page.getByRole("button", { name: "Play again", exact: true }).waitFor({ timeout: 5000 });
    await page.screenshot({ path: resolve(directory, `results-${i + 1}.png`), fullPage: true });
    return page.getByRole("heading", { name: /^Winner:/ }).innerText();
  }));
  assert.equal(new Set(results).size, 1, "all four clients must agree on winner");
  assert.equal(errors.length, 0, "browser runtime errors");
  report.status = "passed";
  report.results = results;
} catch (error) {
  report.status = "failed";
  report.failure = String(error);
  for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: resolve(directory, `failure-${i}.png`) }).catch(() => {});
  process.exitCode = 1;
} finally {
  await save();
  await browser.close();
  console.log(`Browser evidence: ${directory}; status=${report.status}`);
}
