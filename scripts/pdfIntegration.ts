import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const origin = "http://localhost:5174";
const base = "http://localhost:2567/api";
async function call(path: string, cookie = "", body?: object, method = body ? "POST" : "GET") {
  return fetch(`${base}/${path}`, { method, headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}
const loginA = await call("auth/dev", "", { teacher: "A" });
const cookie = loginA.headers.get("set-cookie")!.split(";")[0];
const loginB = await call("auth/dev", "", { teacher: "B" });
const other = loginB.headers.get("set-cookie")!.split(";")[0];
const set = await (await call("teacher/question-sets", cookie, { title: `PDF QA ${randomUUID().slice(0, 8)}`, grade: 2, topic: "แรงลัพธ์" })).json();
const evidence: Record<string, unknown> = { setId: set.id, files: [] };
async function upload(name: string, data: Uint8Array, session = cookie) {
  const form = new FormData(); form.set("file", new Blob([data as BlobPart], { type: "application/pdf" }), name);
  return fetch(`${base}/teacher/imports/${set.id}`, { method: "POST", headers: { Origin: origin, Cookie: session }, body: form });
}
assert.equal((await upload("fake.pdf", new Uint8Array([1,2,3]))).status, 400);
assert.equal((await upload("x.pdf", new Uint8Array([1,2,3]), other)).status, 404);
const cancelResponse = await upload("cancel-test.pdf", await readFile("output/pdf/fixtures/thai-scan.pdf"));
assert.equal(cancelResponse.status, 202);
const cancelJob = await cancelResponse.json();
assert.equal((await call(`teacher/imports/jobs/${cancelJob.jobId}/cancel`, other, {})).status, 404);
for (let repeat = 0; repeat < 2; repeat++) assert.equal((await call(`teacher/imports/jobs/${cancelJob.jobId}/cancel`, cookie, {})).status, 200);
assert.equal((await (await call(`teacher/imports/jobs/${cancelJob.jobId}`, cookie)).json()).status, "cancelled");
assert.equal((await upload("oversize.pdf", new Uint8Array(20 * 1024 * 1024 + 1))).status, 413);
for (const name of ["thai-text", "thai-scan", "diagram-formula", "two-columns", "over-80-pages"]) {
  const response = await upload(`${name}.pdf`, await readFile(`output/pdf/fixtures/${name}.pdf`));
  assert.equal(response.status, 202, await response.text().then((text) => { evidence.lastUpload = text; return "upload must return 202"; }));
  const { jobId, documentId } = JSON.parse(String(evidence.lastUpload));
  assert.equal((await call(`teacher/imports/jobs/${jobId}`, other)).status, 404);
  assert.equal((await call(`teacher/imports/documents/${documentId}/file`, other)).status, 404);
  assert.equal((await call(`teacher/imports/documents/${documentId}/file`)).status, 401);
  let job: any;
  const started = Date.now();
  do {
    await new Promise((done) => setTimeout(done, 1000));
    job = await (await call(`teacher/imports/jobs/${jobId}`, cookie)).json();
    if (Date.now() - started > 190_000) throw new Error(`PDF job timeout: ${name}`);
  } while (["queued", "running"].includes(job.status));
  if (name === "over-80-pages") { assert.equal(job.status, "failed"); assert.match(job.error, /80/); }
  else {
    assert.equal(job.status, "review", job.error);
    assert.ok(job.pages.length > 0);
    assert.equal((await call(`teacher/imports/documents/${documentId}/pages/1`, cookie)).status, 200);
    if (name === "thai-text") {
      assert.match(job.pages[0].extracted_text, /แรง/);
      const detail = await (await call(`teacher/question-sets/${set.id}`, cookie)).json();
      assert.equal(detail.questions.length, 10);
      for (const draft of detail.questions) {
        assert.equal(draft.approved_at, null);
        assert.equal(draft.provenance.documentId, documentId);
        assert.equal((await call(`teacher/question-revisions/${draft.id}/approve`, cookie, {})).status, 400, "incomplete import must not be approved");
        assert.equal((await call(`teacher/question-revisions/${draft.id}`, cookie, { ...draft.body, ...draft.answer_key, hint: "พิจารณาทิศทางและบวกขนาดแรง" }, "PATCH")).status, 200);
        if (draft.id === detail.questions[0].id) {
          const crop = { documentId, page: 1, region: { x: .05, y: .02, width: .85, height: .06 }, alt: "ส่วนหัวเอกสารฝึกแรงลัพธ์", noAnswer: true };
          assert.equal((await call(`teacher/question-revisions/${draft.id}/crop`, other, crop)).status, 404);
          assert.equal((await call(`teacher/question-revisions/${draft.id}/crop`, cookie, { ...crop, noAnswer: false })).status, 400);
          const cropped = await call(`teacher/question-revisions/${draft.id}/crop`, cookie, crop);
          assert.equal(cropped.status, 201);
          const media = await cropped.json();
          assert.equal((await call(`question-media/${media.id}`)).status, 404, "bare media IDs are not public access");
          assert.equal((await call(`teacher/question-revisions/${draft.id}/media`)).status, 401);
          assert.equal((await call(`teacher/question-revisions/${draft.id}/media`, cookie)).status, 200);
          evidence.cropId = media.id;
        }
        assert.equal((await call(`teacher/question-revisions/${draft.id}/approve`, cookie, {})).status, 200);
      }
      const published = await call(`teacher/question-sets/${set.id}/publish`, cookie, {});
      assert.equal(published.status, 201);
      evidence.versionId = (await published.json()).id;
    }
    if (name === "thai-scan") {
      assert.equal(job.pages[0].method, "ocr");
      assert.match(job.pages[0].extracted_text, /แรง/);
    }
  }
  (evidence.files as unknown[]).push({ name, status: job.status, pages: job.page_count, methods: job.pages.map((page: any) => page.method), milliseconds: Date.now() - started });
  console.log("PDF fixture checked", name, job.status);
}
delete evidence.lastUpload;
await mkdir("docs/qa/pdf", { recursive: true });
await writeFile("docs/qa/pdf/result.json", JSON.stringify({ passed: true, ...evidence }, null, 2));
console.log("PASS real Thai PDF extraction, local Thai OCR, private crop/preview ACL, cancellation, review gate, immutable publication, 20MB and 80-page limits");
