import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const directory = `docs/qa/teacher-browser-${Date.now()}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });
const errors: string[] = [];
const report: Record<string, unknown> = { status: "running", errors };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5174/teacher");
  await page.getByRole("button", { name: "ครูตัวอย่าง A", exact: true }).click();
  await page.getByRole("heading", { name: "สร้างชั้นเรียน", exact: true }).waitFor();
  const suffix = String(Date.now());
  const classroom = page.locator("form").filter({ has: page.getByRole("heading", { name: "สร้างชั้นเรียน", exact: true }) });
  await classroom.getByLabel("ชื่อชั้นเรียน", { exact: true }).fill(`Browser M2 ${suffix}`);
  await classroom.getByLabel("ภาคเรียน / ปีการศึกษา", { exact: true }).fill("1/2569");
  await classroom.getByLabel("หน่วยการเรียนรู้", { exact: true }).fill("แรงลัพธ์");
  await classroom.getByLabel("เป้าหมาย (บรรทัดละข้อ)", { exact: true }).fill("รวมแรงทิศเดียวกัน");
  await classroom.getByRole("button", { name: "บันทึกชั้นเรียน", exact: true }).click();
  await page.getByText("สร้างชั้นเรียนแล้ว", { exact: true }).waitFor();
  const set = page.locator("form").filter({ has: page.getByRole("heading", { name: "สร้างชุดโจทย์", exact: true }) });
  await set.getByLabel("ชื่อชุดโจทย์", { exact: true }).fill(`Browser forces ${suffix}`);
  await set.getByLabel("หัวข้อชุดโจทย์", { exact: true }).fill("แรงลัพธ์");
  await set.getByRole("button", { name: "สร้างฉบับร่าง", exact: true }).click();
  for (let index = 0; index < 10; index++) {
    const prompt = `Browser QA ${suffix} ข้อ ${index + 1}: แรง 1 N กับ 2 N ทิศเดียวกันรวมเท่าไร`;
    await page.getByLabel("โจทย์", { exact: true }).fill(prompt);
    await page.getByLabel("ตัวเลือก (บรรทัดละข้อ)", { exact: true }).fill("3 N\n2 N\n1 N\n0 N");
    await page.getByLabel("เฉลยเป็นขั้นตอน", { exact: true }).fill("บวกแรงทิศเดียวกัน 1+2=3 N");
    await page.getByLabel("คำใบ้", { exact: true }).fill("บวกแรงที่ทิศเดียวกัน");
    await page.getByLabel("ทักษะที่วัด", { exact: true }).fill("แรงลัพธ์");
    await page.getByRole("button", { name: "บันทึกโจทย์ฉบับร่าง", exact: true }).click();
    await page.locator("article").getByText(prompt, { exact: true }).waitFor();
    await page.getByRole("button", { name: "ยืนยันตรวจรับ", exact: true }).last().click();
  }
  await page.getByRole("button", { name: "เผยแพร่รุ่นใหม่ (อย่างน้อย 10 ข้อที่ตรวจรับ)", exact: true }).click();
  await page.getByRole("heading", { name: "สร้างกิจกรรมจากรุ่นที่เผยแพร่", exact: true }).waitFor();
  await page.getByLabel("ชื่อกิจกรรม", { exact: true }).fill(`Browser activity ${suffix}`);
  await page.locator("select[name='classroomId']").selectOption({ label: `Browser M2 ${suffix}` });
  await page.getByRole("button", { name: "สร้างลิงก์กิจกรรม", exact: true }).click();
  const link = page.locator("a[href*='/play/']");
  await link.waitFor();
  const joinUrl = (await link.getAttribute("href"))!;
  report.joinUrl = joinUrl;
  await page.screenshot({ path: `${directory}/teacher-published.png`, fullPage: true });
  await page.reload();
  await page.getByText(`Browser activity ${suffix} · open`, { exact: true }).waitFor();
  report.refreshPersists = true;
  const student = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  student.on("pageerror", (error) => errors.push(error.message));
  await student.goto(joinUrl);
  await student.getByText(`Browser activity ${suffix}`, { exact: true }).waitFor();
  await student.getByLabel("ชื่อเล่น", { exact: true }).fill("Browser Student");
  await student.getByRole("button", { name: "สร้างห้อง", exact: true }).click();
  await student.getByRole("button", { name: "พร้อมเล่น", exact: true }).click();
  await student.getByRole("button", { name: "เริ่มเกม", exact: true }).click();
  await student.locator("canvas").waitFor();
  await student.screenshot({ path: `${directory}/student-activity-board.png`, fullPage: true });
  report.studentActivityStarted = true;
  assert.equal(errors.length, 0);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = String(error); process.exitCode = 1;
  for (const [index, context] of browser.contexts().entries()) for (const [pageIndex, page] of context.pages().entries()) {
    await page.screenshot({ path: `${directory}/failure-${index}-${pageIndex}.png` }).catch(() => {});
  }
}
finally {
  await writeFile(`${directory}/result.json`, JSON.stringify(report, null, 2));
  await browser.close();
  console.log(JSON.stringify({ directory, ...report }));
}
