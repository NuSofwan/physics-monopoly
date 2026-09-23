import { Router } from "express";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { pool, transaction } from "../db/database";
import { HttpError, route, text, uuid } from "../teacher/http";
import { storagePath } from "./storage";

export function cropRegion(value: unknown): { x: number; y: number; width: number; height: number } {
  const region = value as Record<string, unknown> | null;
  if (!region || ![region.x, region.y, region.width, region.height].every((n) => typeof n === "number" && Number.isFinite(n))) throw new HttpError(400, "พื้นที่ภาพไม่ถูกต้อง");
  const { x, y, width, height } = region as { x: number; y: number; width: number; height: number };
  if (x < 0 || y < 0 || width < .01 || height < .01 || x + width > 1.000001 || y + height > 1.000001) throw new HttpError(400, "เลือกพื้นที่ภายในหน้าต้นฉบับเท่านั้น");
  return { x, y, width, height };
}
export const cropRouter = Router();
cropRouter.post("/:id/crop", route(async (req, res) => {
  const revision = uuid(req.params.id), documentId = uuid(req.body?.documentId);
  const page = Number(req.body?.page), region = cropRegion(req.body?.region), alt = text(req.body?.alt, 1000);
  if (req.body?.noAnswer !== true) throw new HttpError(400, "ครูต้องยืนยันว่าภาพไม่ติดเฉลย");
  if (!Number.isInteger(page) || page < 1 || page > 80) throw new HttpError(400, "เลขหน้าไม่ถูกต้อง");
  const owner = res.locals.teacher.id;
  const source = await pool.query("SELECT p.width,p.height FROM question_revisions q JOIN question_sets s ON s.id=q.set_id JOIN source_documents d ON d.set_id=s.id JOIN source_pages p ON p.document_id=d.id WHERE q.id=$1 AND s.owner_id=$2 AND d.id=$3 AND p.page=$4", [revision, owner, documentId, page]);
  if (!source.rowCount) throw new HttpError(404, "ไม่พบต้นฉบับในชุดโจทย์นี้");
  const image = await loadImage(await readFile(await storagePath(documentId, `-${page}.png`)));
  const width = Math.max(1, Math.floor(region.width * image.width)), height = Math.max(1, Math.floor(region.height * image.height));
  const canvas = createCanvas(width, height);
  canvas.getContext("2d").drawImage(image, Math.floor(region.x * image.width), Math.floor(region.y * image.height), width, height, 0, 0, width, height);
  const bytes = canvas.toBuffer("image/png"), id = randomUUID(), path = await storagePath(id, ".png");
  await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
  try {
    await transaction(async (db) => {
      await db.query("INSERT INTO question_media(id,owner_id,document_id,page,region,alt,sha256) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, owner, documentId, page, JSON.stringify(region), alt, createHash("sha256").update(bytes).digest("hex")]);
      await db.query("UPDATE question_revisions SET body=body || $2::jsonb,provenance=coalesce(provenance,'{}'::jsonb) || $3::jsonb,review_status='NEEDS_REVIEW',approved_at=NULL,approved_by=NULL,updated_at=now() WHERE id=$1", [revision, JSON.stringify({ media: { id, alt } }), JSON.stringify({ documentId, page, crop: [region.x * source.rows[0].width, region.y * source.rows[0].height, region.width * source.rows[0].width, region.height * source.rows[0].height], method: "teacher_crop", reviewRequired: true })]);
    });
  } catch (error) { await unlink(path); throw error; }
  res.status(201).json({ id, alt });
}));
cropRouter.get("/:id/media", route(async (req, res) => {
  const result = await pool.query("SELECT q.body->'media'->>'id' id FROM question_revisions q JOIN question_sets s ON s.id=q.set_id WHERE q.id=$1 AND s.owner_id=$2", [uuid(req.params.id), res.locals.teacher.id]);
  if (!result.rows[0]?.id) throw new HttpError(404, "ไม่พบภาพ");
  res.type("image/png").sendFile(await storagePath(uuid(result.rows[0].id), ".png"));
}));
