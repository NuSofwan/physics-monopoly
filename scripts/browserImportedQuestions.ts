import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = "http://localhost:5174", base = "http://localhost:2567/api";
const directory = `docs/qa/import-browser-${Date.now()}`;
await mkdir(directory, { recursive: true });
async function call(path: string, cookie = "", body?: object) {
  const response = await fetch(`${base}/${path}`, { method: body ? "POST" : "GET", headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  assert.ok(response.ok, `${path}: ${response.status}`);
  return response;
}
const login = await call("auth/dev", "", { teacher: "A" });
const cookie = login.headers.get("set-cookie")!.split(";")[0];
const classroom = await (await call("teacher/classrooms", cookie, { title: `Import browser ${Date.now()}`, grade: 2, curriculumTrack: "พื้นฐาน", term: "1/2569", topic: "แรง", objectives: ["รวมแรงและแปลงหน่วย"] })).json();
const numeric = await (await call("teacher/question-sets", cookie, { title: `Numeric QA ${Date.now()}`, grade: 2, topic: "แรง" })).json();
for (let index = 0; index < 10; index++) {
  const draft = await (await call(`teacher/question-sets/${numeric.id}/questions`, cookie, { kind: "numeric", prompt: `ตรวจหน่วยข้อ ${index + 1}: แรง $F=1000\\,\\mathrm{N}$ เท่ากับกี่ kN`, numericKey: { value: 1000, unit: "N", allowedUnits: ["N", "kN"], absoluteTolerance: .01, relativeTolerance: 0 }, explanation: "1000 N = 1 kN เพราะ 1 kN เท่ากับ 1000 N", hint: "กิโลหมายถึงหนึ่งพัน", objective: "แปลงหน่วยแรง", topic: "mechanics", difficulty: "easy", timeLimitSec: 45 })).json();
  await call(`teacher/question-revisions/${draft.id}/approve`, cookie, {});
}
const version = await (await call(`teacher/question-sets/${numeric.id}/publish`, cookie, {})).json();
const pdfEvidence = JSON.parse(await readFile("docs/qa/pdf/result.json", "utf8"));
assert.equal(pdfEvidence.passed, true);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors: string[] = [], cases: object[] = [];
try {
  for (const type of ["pdf", "numeric"] as const) {
    const activity = await (await call("teacher/assignments", cookie, { title: `Browser ${type}`, classroomId: classroom.id, versionId: type === "pdf" ? pdfEvidence.versionId : version.id, durationMinutes: 15 })).json();
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
    const page = await context.newPage();
    const privateSourceRequests: string[] = [];
    const mathRequests:string[]=[];
    page.on("request",request=>{if(request.url().includes("MathFragment"))mathRequests.push(request.url());});
    page.on("request", (request) => { if (/\/api\/teacher\/imports\//.test(request.url())) privateSourceRequests.push(request.url()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(activity.joinUrl);
    await page.getByLabel("ชื่อเล่น", { exact: true }).fill(`QA ${type}`);
    assert.equal(mathRequests.length,0,"math renderer must not load in the plain lobby");
    await page.getByRole("button", { name: "สร้างห้อง", exact: true }).click();
    await page.getByRole("button", { name: "พร้อมเล่น", exact: true }).click();
    await page.getByRole("button", { name: "เริ่มเกม", exact: true }).click();
    // Only click controls visible to the player; no room state/answer-key access.
    const deadline = Date.now() + 150_000;
    while (!await page.getByRole("dialog").count()) {
      assert.ok(Date.now() < deadline, `${type}: no question reached`);
      for (const name of ["Solve jail quiz", "Buy with quiz", "Roll dice"]) {
        const button = page.getByRole("button", { name, exact: true });
        if (await button.count() && await button.isEnabled()) { await button.click(); break; }
      }
      await page.waitForTimeout(300);
    }
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: "โจทย์ฟิสิกส์", exact: true }).waitFor();
    await page.screenshot({ path: `${directory}/${type}-question.png` });
    if (type === "numeric") {
      await dialog.locator(".katex").waitFor();assert.ok(mathRequests.length>0);
      await dialog.getByLabel("คำตอบตัวเลข", { exact: true }).fill("1");
      await dialog.getByLabel("หน่วย", { exact: true }).selectOption("kN");
      await dialog.getByRole("button", { name: "ส่งคำตอบตัวเลข", exact: true }).click();
      await dialog.getByText(/ตอบถูก · เงิน/).waitFor();
      assert.match(await dialog.innerText(), /1000 N = 1 kN/);
    } else {
      assert.match(await dialog.innerText(), /แรง/);
      await dialog.locator(".mt-5.grid button").first().click();
      await dialog.getByText(/ตอบถูก · เงิน/).waitFor();
    }
    await page.screenshot({ path: `${directory}/${type}-reveal.png` });
    assert.equal(privateSourceRequests.length, 0);
    cases.push({ type, versionId: type === "pdf" ? pdfEvidence.versionId : version.id, result: "correct", browser: "Edge", privateSourceRequests: privateSourceRequests.length });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${directory}/result.json`, JSON.stringify({ passed: true, cases, errors }, null, 2));
  console.log("PASS browser PDF-published question and numeric 1 kN → 1000 N server grading", directory);
} catch (error) {
  await writeFile(`${directory}/result.json`, JSON.stringify({ passed: false, cases, errors, failure: String(error) }, null, 2));
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: `${directory}/failure.png` }).catch(() => {});
  throw error;
} finally { await browser.close(); }
