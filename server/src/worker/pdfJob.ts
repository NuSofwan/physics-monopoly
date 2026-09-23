import "../config";
import { readFile, writeFile, mkdir, copyFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";
import { createWorker, type Worker } from "tesseract.js";
import { pool, transaction } from "../db/database";
import { privateRoot, storagePath } from "../pdf/storage";
import { parseCandidates } from "../pdf/parser";
import { uuid } from "../teacher/http";

const jobId = uuid(process.argv[2]);
const runToken = uuid(process.argv[3]);
let ocr: Worker | undefined;
try {
  const record = (await pool.query("SELECT j.id,d.id document_id,d.set_id,s.topic FROM import_jobs j JOIN source_documents d ON d.id=j.document_id JOIN question_sets s ON s.id=d.set_id WHERE j.id=$1 AND j.status='running' AND j.run_token=$2", [jobId, runToken])).rows[0];
  if (!record) throw new Error("ไม่พบงานที่กำลังประมวลผล");
  const pdfPath = await storagePath(record.document_id);
  if ((await stat(pdfPath)).size > 20 * 1024 * 1024) throw new Error("PDF ใหญ่เกิน 20 MB");
  const bytes = await readFile(pdfPath);
  // PDF.js 6 removed eval-based font compilation. Do not load its scripting manager.
  const pdfRoot = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
  const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, maxImageSize: 8_000_000,
    standardFontDataUrl: resolve(pdfRoot, "standard_fonts") + "/", cMapUrl: resolve(pdfRoot, "cmaps") + "/", wasmUrl: resolve(pdfRoot, "wasm") + "/" });
  const document = await loading.promise;
  if (document.numPages > 80) { await loading.destroy(); throw new Error("PDF มีมากกว่า 80 หน้า"); }
  const pages: Array<{ page: number; width: number; height: number; text: string; method: string }> = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, 1800 / Math.max(original.width, original.height)) });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D, viewport }).promise;
      const png = canvas.toBuffer("image/png");
      await writeFile(await storagePath(record.document_id, `-${pageNumber}.png`), png);
      const content = await page.getTextContent();
      const rows = new Map<number, Array<{ x: number; text: string }>>();
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = Math.round(item.transform[5] / 3) * 3;
        const line = rows.get(y) ?? [];
        line.push({ x: item.transform[4], text: item.str }); rows.set(y, line);
      }
      let text = [...rows].sort(([a], [b]) => b - a).map(([, line]) => line.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ")).join("\n");
      let method = "text";
      if (text.replace(/\s/g, "").length < 20) {
        if (process.env.OCR_MODE === "manual") method = "manual_required";
        else {
          if (!ocr) {
            const require = createRequire(import.meta.url);
            const directory = resolve(privateRoot, "ocr-data");
            await mkdir(directory, { recursive: true });
            for (const language of ["tha", "eng"]) {
              const data = require(`@tesseract.js-data/${language}`) as { langPath: string };
              await copyFile(resolve(data.langPath, `${language}.traineddata.gz`), resolve(directory, `${language}.traineddata.gz`));
            }
            ocr = await createWorker(["tha", "eng"], 1, { langPath: directory, cacheMethod: "none", gzip: true });
          }
          text = (await ocr.recognize(png)).data.text.replace(/([\u0e00-\u0e7f]) +(?=[\u0e00-\u0e7f])/g, "$1");
          method = text.trim() ? "ocr" : "manual_required";
        }
      }
      pages.push({ page: pageNumber, width: original.width, height: original.height, text: text.slice(0, 100_000), method });
      const progress = await pool.query("UPDATE import_jobs SET progress=$2,updated_at=now() WHERE id=$1 AND status='running' AND run_token=$3", [jobId, Math.floor(pageNumber / document.numPages * 90), runToken]);
      if (!progress.rowCount) throw new Error("งานถูกยกเลิกหรือแทนที่แล้ว");
      page.cleanup();
    }
  } finally { await loading.destroy(); }
  await transaction(async (db) => {
    const active = await db.query("SELECT status,run_token FROM import_jobs WHERE id=$1 FOR UPDATE", [jobId]);
    if (active.rows[0].status !== "running" || active.rows[0].run_token !== runToken) throw new Error("งานนำเข้าไม่ได้อยู่ในสถานะประมวลผล");
    for (const page of pages) {
      await db.query("INSERT INTO source_pages(document_id,page,width,height,extracted_text,method) VALUES($1,$2,$3,$4,$5,$6)", [record.document_id, page.page, page.width, page.height, page.text, page.method]);
      for (const question of parseCandidates(page.text)) {
        const body = { prompt: question.prompt, choices: question.choices, objective: record.topic, topic: "mechanics", difficulty: "easy", timeLimitSec: 45 };
        const key = { answerIndex: question.answerIndex, explanation: question.explanation, hint: "" };
        const provenance = { documentId: record.document_id, page: page.page, crop: [0, 0, page.width, page.height], method: page.method, reviewRequired: true };
        await db.query("INSERT INTO question_revisions(id,set_id,body,answer_key,provenance) VALUES($1,$2,$3,$4,$5)", [randomUUID(), record.set_id, JSON.stringify(body), JSON.stringify(key), JSON.stringify(provenance)]);
      }
    }
    await db.query("UPDATE source_documents SET page_count=$2 WHERE id=$1", [record.document_id, pages.length]);
    await db.query("UPDATE import_jobs SET status='review',progress=100,lease_until=NULL,updated_at=now() WHERE id=$1", [jobId]);
  });
  console.log("pdf_job_review_ready", { jobId, pages: pages.length, ocrPages: pages.filter((page) => page.method === "ocr").length });
} catch (error) {
  const message = error instanceof Error ? error.message.slice(0, 500) : "อ่าน PDF ไม่สำเร็จ";
  await pool.query("UPDATE import_jobs SET status='failed',error=$2,updated_at=now() WHERE id=$1 AND status='running' AND run_token=$3", [jobId, message, runToken]);
  process.exitCode = 1;
} finally { if (ocr) await ocr.terminate(); await pool.end(); }
