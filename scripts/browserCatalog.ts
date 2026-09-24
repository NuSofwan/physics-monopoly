import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { locations } from "../shared/src/locations";
import { baseTiles } from "../shared/src/boardConfig";
const directory = `docs/qa/catalog-${Date.now()}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors: string[] = [], checks: object[] = [];
const geometry: Record<string,number> = {};
async function measure(page: import("playwright").Page) {
  Object.assign(geometry, await page.locator("canvas").evaluate(canvas=>JSON.parse(canvas.dataset.assetGeometry ?? "{}")));
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5174/asset-lab");
  await page.waitForFunction(() => Number(document.querySelector("canvas")?.dataset.triangles) > 0);
  for (const city of locations) {
    await page.getByRole("combobox", { name: "สถานที่", exact: true }).selectOption(city.id);
    for (const mode of ["city","buildings","properties","board"]) {
      await page.getByRole("combobox", { name: "ชุดภาพ", exact: true }).selectOption(mode);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${directory}/${city.id}-${mode}.png` });
      await measure(page);
      const metrics = await page.locator("canvas").evaluate((canvas) => ({ drawCalls: Number(canvas.dataset.drawCalls), triangles: Number(canvas.dataset.triangles), fpsSample: Number(canvas.dataset.fps) }));
      assert.ok(metrics.drawCalls > 0 && metrics.triangles > 0);
      if(mode==="board"){assert.ok(metrics.drawCalls<=150,`${city.id}: ${metrics.drawCalls} calls exceeds 150`);assert.ok(metrics.triangles<=250000);}
      checks.push({ map: city.id, mode, ...metrics });
    }
  }
  await page.getByRole("combobox", { name: "ชุดภาพ", exact: true }).selectOption("avatars");
  for (const pose of ["idle","walk","think","celebrate","wave"]) {
    await page.getByRole("combobox", { name: "ท่าทาง", exact: true }).selectOption(pose);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${directory}/avatars-${pose}.png` });
    await measure(page);
  }
  const canvas = page.locator("canvas"), initial = await canvas.getAttribute("data-camera-position");
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2); await page.mouse.down();
  await page.mouse.move(bounds.x+bounds.width/2+150,bounds.y+bounds.height/2,{ steps:20 }); await page.mouse.up();
  await page.waitForFunction((value) => document.querySelector("canvas")?.dataset.cameraPosition !== value, initial);
  await page.getByRole("button", { name: "รีเซ็ตกล้อง", exact: true }).click();
  await page.waitForFunction((value) => document.querySelector("canvas")?.dataset.cameraPosition === value, initial);
  assert.deepEqual(errors, []);
  const propertyTiles = baseTiles.filter(tile=>tile.type==="property").map(tile=>tile.index);
  for(const city of locations)for(const tileIndex of propertyTiles)assert.ok(geometry[`property:${city.id}:${tileIndex}`]>0,`${city.id} property ${tileIndex} missing`);
  assert.equal(Object.keys(geometry).length,135+locations.length*propertyTiles.length,"environments, buildings, 14 property forms per city, avatars, dice and board groups");
  for(const [id,count] of Object.entries(geometry)){assert.ok(Number.isInteger(count)&&count>0,`${id} triangle measurement`);if(id.startsWith("avatar:"))assert.ok(count<=12000);}
  const sourcePaths=["client/src/game3d/CityKit.tsx","client/src/game3d/PropertyArchitecture.tsx","client/src/game3d/AvatarFigure.tsx","client/src/game3d/Character.tsx","client/src/game3d/StaticBatch.tsx","client/src/game3d/Board3D.tsx","shared/src/avatars.ts","shared/src/appearance.ts","shared/src/boardConfig.ts"];
  const sources=Object.fromEntries(await Promise.all(sourcePaths.map(async path=>[path,createHash("sha256").update((await readFile(path,"utf8")).replace(/\r\n/g,"\n")).digest("hex")])));
  await writeFile("assets/geometry-metrics.v1.json",JSON.stringify({schemaVersion:1,method:"Three.js visible mesh indexed/nonindexed triangle counts; hidden batch inputs excluded",sources,triangles:geometry},null,2)+"\n");
  await writeFile(`${directory}/result.json`, JSON.stringify({ passed: true, checks, avatarPresets: 24, poses: 5, errors, note: "Technical rendering/camera check only; visual review and target-device FPS are separate" }, null, 2));
  console.log("PASS catalog rendering and camera", directory);
} catch (error) {
  await writeFile(`${directory}/result.json`, JSON.stringify({ passed: false, checks, errors, failure: String(error) }, null, 2)); throw error;
} finally { await browser.close(); }
