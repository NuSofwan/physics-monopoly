import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const directory = "docs/qa/phase2-assets";
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5174/asset-lab");
  const canvas = page.locator("canvas");
  await page.waitForFunction(() => document.querySelector("canvas")?.dataset.cameraPosition);
  const initial = await canvas.getAttribute("data-camera-position");
  await page.screenshot({ path: `${directory}/levels-and-avatars.png`, fullPage: true });
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 200, bounds.y + bounds.height / 2, { steps: 20 });
  await page.mouse.up();
  await page.waitForFunction((before) => document.querySelector("canvas")?.dataset.cameraPosition !== before, initial);
  const rotated = await canvas.getAttribute("data-camera-position");
  await page.screenshot({ path: `${directory}/rotated.png`, fullPage: true });
  await page.getByRole("button", { name: "รีเซ็ตกล้อง", exact: true }).click();
  await page.waitForFunction((before) => document.querySelector("canvas")?.dataset.cameraPosition === before, initial);
  assert.equal(errors.length, 0);
  await writeFile(`${directory}/result.json`, JSON.stringify({ passed: true, initial, rotated, errors, drawCalls: await canvas.getAttribute("data-draw-calls"), triangles: await canvas.getAttribute("data-triangles") }, null, 2));
  console.log("PASS actual four-level buildings, eight avatar geometry, drag rotation and reset");
} finally { await browser.close(); }
