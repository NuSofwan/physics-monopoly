import { Router } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { pool } from "../db/database";
import { route, HttpError, uuid } from "../teacher/http";
import { storagePath } from "./storage";

// A short-lived capability is issued only when a question is actually opened.
// Never sign source PDFs/pages, and never put this secret in the client bundle.
const secret = randomBytes(32);
function signature(id: string, expires: string): string {
  return createHmac("sha256", secret).update(`${id}:${expires}`).digest("base64url");
}
export function questionMediaUrl(id: string): string {
  uuid(id);
  const expires = String(Date.now() + 180_000);
  return `/api/question-media/${id}?expires=${expires}&signature=${signature(id, expires)}`;
}
export const mediaRouter = Router();
mediaRouter.get("/:id", route(async (req, res) => {
  const id = uuid(req.params.id);
  const expires = typeof req.query.expires === "string" ? req.query.expires : "";
  const supplied = typeof req.query.signature === "string" ? req.query.signature : "";
  if (!/^\d{13}$/.test(expires) || Number(expires) < Date.now() || Number(expires) > Date.now() + 180_000 || !/^[\w-]{43}$/.test(supplied)) throw new HttpError(404, "ไม่พบภาพที่อนุญาต");
  if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(signature(id, expires)))) throw new HttpError(404, "ไม่พบภาพที่อนุญาต");
  if (!(await pool.query("SELECT id FROM question_media WHERE id=$1", [id])).rowCount) throw new HttpError(404, "ไม่พบภาพ");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.type("image/png").sendFile(await storagePath(id, ".png"));
}));
