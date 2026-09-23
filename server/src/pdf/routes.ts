import { Router } from "express";
import multer from "multer";
import { randomUUID, createHash } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { pool, transaction } from "../db/database";
import { HttpError, route, uuid } from "../teacher/http";
import { storagePath } from "./storage";

// Mounted below the existing teacher session + CSRF boundary.
export const importsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0, parts: 1 } }).single("file");
// Bound buffered uploads before accepting bytes, including concurrent requests.
const uploading = new Set<string>();
importsRouter.get("/sets/:id", route(async (req, res) => {
  const set = await pool.query("SELECT id FROM question_sets WHERE id=$1 AND owner_id=$2", [uuid(req.params.id), res.locals.teacher.id]);
  if (!set.rowCount) throw new HttpError(404, "ไม่พบชุดโจทย์");
  res.json((await pool.query("SELECT j.id,j.status,j.progress,d.filename FROM import_jobs j JOIN source_documents d ON d.id=j.document_id WHERE d.set_id=$1 AND d.owner_id=$2 ORDER BY j.created_at DESC LIMIT 20", [req.params.id, res.locals.teacher.id])).rows);
}));
importsRouter.post("/:setId", route(async (req, res) => {
  const setId = uuid(req.params.setId);
  const set = await pool.query("SELECT id FROM question_sets WHERE id=$1 AND owner_id=$2", [setId, res.locals.teacher.id]);
  if (!set.rowCount) throw new HttpError(404, "ไม่พบชุดโจทย์");
  const queued = await pool.query("SELECT count(*)::int count FROM import_jobs j JOIN source_documents d ON d.id=j.document_id WHERE d.owner_id=$1 AND j.status IN ('queued','running')", [res.locals.teacher.id]);
  if (queued.rows[0].count >= 3) throw new HttpError(429, "รอไฟล์ก่อนหน้าประมวลผลเสร็จก่อน (สูงสุด 3 งาน)");
  const owner = String(res.locals.teacher.id);
  if (uploading.has(owner) || uploading.size >= 4) throw new HttpError(429, "มีไฟล์กำลังอัปโหลด กรุณาลองใหม่");
  uploading.add(owner);
  try {
  await new Promise<void>((done, reject) => upload(req, res, (error) => error ? reject(new HttpError(error.code === "LIMIT_FILE_SIZE" ? 413 : 400, "รับ PDF ครั้งละ 1 ไฟล์ ขนาดไม่เกิน 20 MB")) : done()));
  const file = req.file;
  if (!file || file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new HttpError(400, "ไฟล์ไม่ใช่ PDF ที่รองรับ");
  const id = randomUUID();
  const jobId = randomUUID();
  const path = await storagePath(id);
  await writeFile(path, file.buffer, { flag: "wx", mode: 0o600 });
  try {
    await transaction(async (db) => {
      await db.query("SELECT id FROM teachers WHERE id=$1 FOR UPDATE", [owner]);
      const count = await db.query("SELECT count(*)::int count FROM import_jobs j JOIN source_documents d ON d.id=j.document_id WHERE d.owner_id=$1 AND j.status IN ('queued','running')", [owner]);
      if (count.rows[0].count >= 3) throw new HttpError(429, "รอไฟล์ก่อนหน้าประมวลผลเสร็จก่อน");
      await db.query("INSERT INTO source_documents(id,owner_id,set_id,storage_key,filename,file_hash,byte_size) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, res.locals.teacher.id, setId, `${id}.pdf`, file.originalname.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 180), createHash("sha256").update(file.buffer).digest("hex"), file.size]);
      await db.query("INSERT INTO import_jobs(id,document_id) VALUES($1,$2)", [jobId, id]);
    });
  } catch (error) { await unlink(path); throw error; }
  res.status(202).json({ jobId, documentId: id, status: "queued" });
  } finally { uploading.delete(owner); }
}));
importsRouter.post("/jobs/:id/:action", route(async (req, res) => {
  const action = req.params.action;
  if (action !== "cancel" && action !== "retry") throw new HttpError(404, "ไม่พบคำสั่ง");
  const result = await transaction(async (db) => {
    await db.query("SELECT id FROM teachers WHERE id=$1 FOR UPDATE", [res.locals.teacher.id]);
    const found = await db.query("SELECT j.* FROM import_jobs j JOIN source_documents d ON d.id=j.document_id WHERE j.id=$1 AND d.owner_id=$2 FOR UPDATE OF j", [uuid(req.params.id), res.locals.teacher.id]);
    if (!found.rowCount) throw new HttpError(404, "ไม่พบงานนำเข้า");
    const job = found.rows[0];
    if (action === "cancel") {
      if (job.status === "review") throw new HttpError(409, "งานเสร็จแล้ว ให้แก้ไขฉบับร่างแทน");
      return (await db.query("UPDATE import_jobs SET status='cancelled',run_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 RETURNING id,status", [job.id])).rows[0];
    }
    // Retrying the same request while queued/running never creates another job.
    if (["queued", "running", "review"].includes(job.status)) return { id: job.id, status: job.status };
    const queued = await db.query("SELECT count(*)::int count FROM import_jobs j JOIN source_documents d ON d.id=j.document_id WHERE d.owner_id=$1 AND j.status IN ('queued','running')", [res.locals.teacher.id]);
    if (queued.rows[0].count >= 3) throw new HttpError(429, "รอไฟล์ก่อนหน้าประมวลผลเสร็จก่อน");
    return (await db.query("UPDATE import_jobs SET status='queued',run_token=NULL,progress=0,attempts=0,error=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 RETURNING id,status", [job.id])).rows[0];
  });
  res.json(result);
}));
importsRouter.get("/jobs/:id", route(async (req, res) => {
  const job = await pool.query("SELECT j.id,j.status,j.progress,j.error,d.id document_id,d.filename,d.page_count FROM import_jobs j JOIN source_documents d ON d.id=j.document_id WHERE j.id=$1 AND d.owner_id=$2", [uuid(req.params.id), res.locals.teacher.id]);
  if (!job.rowCount) throw new HttpError(404, "ไม่พบงานนำเข้า");
  const pages = await pool.query("SELECT page,width,height,extracted_text,method FROM source_pages WHERE document_id=$1 ORDER BY page", [job.rows[0].document_id]);
  res.json({ ...job.rows[0], pages: pages.rows });
}));
importsRouter.get("/documents/:id/file", route(async (req, res) => {
  const document = await pool.query("SELECT id FROM source_documents WHERE id=$1 AND owner_id=$2", [uuid(req.params.id), res.locals.teacher.id]);
  if (!document.rowCount) throw new HttpError(404, "ไม่พบเอกสาร");
  res.setHeader("Content-Disposition", "inline; filename=source.pdf");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.type("application/pdf").sendFile(await storagePath(uuid(req.params.id)));
}));
importsRouter.get("/documents/:id/pages/:page", route(async (req, res) => {
  const id = uuid(req.params.id);
  const page = Number(req.params.page);
  if (!Number.isInteger(page) || page < 1 || page > 80) throw new HttpError(400, "เลขหน้าไม่ถูกต้อง");
  const document = await pool.query("SELECT p.page FROM source_pages p JOIN source_documents d ON p.document_id=d.id WHERE d.id=$1 AND d.owner_id=$2 AND p.page=$3", [id, res.locals.teacher.id, page]);
  if (!document.rowCount) throw new HttpError(404, "ไม่พบหน้าเอกสาร");
  res.type("image/png").sendFile(await storagePath(id, `-${page}.png`));
}));
