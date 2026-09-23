import { chromium, type Page } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://localhost:5174", api = "http://localhost:2567/api";
const directory = `docs/qa/group-browser-${Date.now()}`;
await mkdir(directory, { recursive: true });
const login = await fetch(`${api}/auth/dev`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ teacher: "A" }) });
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie")!.split(";")[0];
async function post(path: string, body: object) {
  const response = await fetch(`${api}/teacher/${path}`, { method: "POST", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.ok(response.ok, `${path} ${response.status}`); return response.json();
}
const evidence = JSON.parse(await readFile("docs/qa/pdf/result.json", "utf8"));
const classroom = await post("classrooms", { title: `Group QA ${Date.now()}`, grade: 2, curriculumTrack: "พื้นฐาน", term: "1/2569", topic: "แรง", objectives: ["แก้ความเข้าใจหลังคำใบ้"] });
const assignment = await post("assignments", { title: "Group browser QA", classroomId: classroom.id, versionId: evidence.versionId, durationMinutes: 15 });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const pages: Page[] = [], errors: string[] = [];
const report: Record<string, unknown> = { passed: false, assignmentId: assignment.id, errors };
try {
  let roomCode = "";
  for (let index = 0; index < 4; index++) {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" })).newPage();
    pages.push(page); page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(assignment.joinUrl);
    await page.getByLabel("ชื่อเล่น", { exact: true }).fill(`Group Student ${index + 1}`);
    if (index === 0) {
      await page.getByRole("button", { name: "สร้างห้อง", exact: true }).click();
      await page.getByText("Room code", { exact: true }).waitFor();
      roomCode = (await page.getByText("Room code", { exact: true }).locator("..").locator("button").first().innerText()).trim();
    } else {
      await page.getByLabel("รหัสห้อง", { exact: true }).fill(roomCode);
      await page.getByRole("button", { name: "เข้าห้อง", exact: true }).click();
    }
    await page.getByRole("button", { name: "พร้อมเล่น", exact: true }).click();
  }
  await pages[0]!.getByText("4/4", { exact: true }).waitFor();
  await pages[0]!.getByRole("button", { name: "เริ่มเกม", exact: true }).click();
  const until = Date.now() + 90_000;
  while (!await pages[0]!.getByRole("dialog").count()) {
    assert.ok(Date.now() < until, "question must open even when the owner passes");
    for (const page of pages) for (const name of ["Roll dice", "Pass"]) {
      const button = page.getByRole("button", { name, exact: true });
      if (await button.count() && await button.isEnabled()) await button.click();
    }
    await pages[0]!.waitForTimeout(300);
  }
  const dialogs = pages.map((page) => page.getByRole("dialog"));
  for (const dialog of dialogs) await dialog.locator(".mt-5.grid button").first().waitFor();
  await dialogs[0]!.locator(".mt-5.grid button").nth(1).click();
  await dialogs[0]!.getByText(/ยังไม่ถูก ลองทบทวนคำใบ้ก่อน/).waitFor();
  await dialogs[1]!.getByRole("button", { name: /ขอคำใบ้/ }).click();
  await dialogs[1]!.getByText(/คำใบ้:/).waitFor();
  await dialogs[1]!.locator(".mt-5.grid button").first().click();
  await dialogs[2]!.locator(".mt-5.grid button").first().click();
  for (const dialog of dialogs) assert.equal(await dialog.getByText(/XP \+/).count(), 0, "no explanation/result before final first submission");
  assert.equal(await dialogs[3]!.getByText(/คำใบ้:/).count(), 0, "hints must not broadcast to peers");
  await pages[0]!.screenshot({ path: `${directory}/private-retry-wait.png` });
  await dialogs[3]!.locator(".mt-5.grid button").first().click();
  await dialogs[0]!.getByText(/ช่วงลองใหม่ 20 วินาที/).waitFor();
  await dialogs[0]!.locator(".mt-5.grid button").first().click();
  for (const dialog of dialogs) await dialog.getByText(/ตอบถูก · เงิน/).waitFor();
  for (const [index, xp] of [40,60,100,100].entries()) {
    assert.match(await dialogs[index]!.innerText(), new RegExp(`XP \\+${xp}`));
    await pages[index]!.screenshot({ path: `${directory}/reveal-${index + 1}.png` });
  }
  const { pool } = await import("../server/src/db/database");
  try {
    const rows = (await pool.query("SELECT p.nickname,a.evidence FROM learning_attempts a JOIN game_sessions s ON s.id=a.session_id JOIN participants p ON p.id=a.participant_id WHERE s.assignment_id=$1 ORDER BY p.nickname", [assignment.id])).rows;
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map((row) => row.evidence.xp), [40,60,100,100]);
    assert.equal(rows[0]!.evidence.retryCorrect, true);
    assert.equal(rows[1]!.evidence.hintUsed, true);
    report.persisted = rows.map((row) => ({ nickname: row.nickname, xp: row.evidence.xp, status: row.evidence.status }));
  } finally { await pool.end(); }
  if (process.argv.includes("--full-game")) {
    const started = Date.now();
    for (const page of pages) await page.evaluate(() => {
      const timer = setInterval(() => {
        const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")];
        if (buttons.some((b) => b.textContent?.trim() === "Play again")) { clearInterval(timer); return; }
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          const choice = dialog.querySelector<HTMLButtonElement>(".mt-5.grid button:not(:disabled)");
          if (choice) choice.click();
          return;
        }
        buttons.find((b) => !b.disabled && /^(Roll dice|Buy with quiz|Upgrade with quiz|Pass)$/.test(b.textContent?.trim() ?? ""))?.click();
      }, 600);
    });
    while (Date.now() - started < 18 * 60_000) {
      const finished = await Promise.all(pages.map((page) => page.getByRole("button", { name: "Play again", exact: true }).count()));
      if (finished.every(Boolean)) break;
      report.elapsedSeconds = Math.round((Date.now() - started) / 1000);
      await writeFile(`${directory}/result.json`, JSON.stringify(report, null, 2));
      console.log("classroom full-game seconds", report.elapsedSeconds);
      await new Promise((done) => setTimeout(done, 10_000));
    }
    const results: string[] = [];
    for (const [index,page] of pages.entries()) {
      await page.getByRole("button", { name: "Play again", exact: true }).waitFor({ timeout: 3000 });
      results.push(await page.getByRole("heading", { name: /^นักพัฒนาเมือง:/ }).innerText());
      await page.screenshot({ path: `${directory}/final-${index}.png` });
    }
    assert.equal(new Set(results).size, 1);
    report.fullGame = { results, actualElapsedSeconds: Math.round((Date.now() - started) / 1000), configuredMinutes: 15 };
  }
  assert.deepEqual(errors, []); report.passed = true;
} catch (error) {
  report.failure = String(error); process.exitCode = 1;
  for (const [index, page] of pages.entries()) await page.screenshot({ path: `${directory}/failure-${index}.png` }).catch(() => {});
} finally {
  await browser.close(); await writeFile(`${directory}/result.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ directory, ...report }));
}
