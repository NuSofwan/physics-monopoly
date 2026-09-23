import { Router } from "express";
import { randomUUID } from "node:crypto";
import { transaction } from "../db/database";
import { HttpError, route, uuid } from "./http";
export const revisionOperations = Router();
revisionOperations.post("/restructure", route(async (req, res) => {
  const operation = req.body?.operation;
  const ids = req.body?.ids;
  if (!["split", "merge", "reject"].includes(operation) || !Array.isArray(ids) || new Set(ids).size !== ids.length || ids.length < 1 || ids.length > 5) throw new HttpError(400, "เลือกข้อที่จะจัดใหม่ 1–5 ข้อ");
  if ((operation === "split" && ids.length !== 1) || (operation === "merge" && ids.length < 2)) throw new HttpError(400, "แยกครั้งละ 1 ข้อ หรือรวมอย่างน้อย 2 ข้อ");
  const result = await transaction(async (db) => {
    const source = await db.query("SELECT q.* FROM question_revisions q JOIN question_sets s ON s.id=q.set_id WHERE q.id=ANY($1::uuid[]) AND s.owner_id=$2 ORDER BY q.updated_at,q.id FOR UPDATE OF q", [ids.map(uuid), res.locals.teacher.id]);
    if (source.rowCount !== ids.length || new Set(source.rows.map((row) => row.set_id)).size !== 1) throw new HttpError(404, "ต้องเป็นโจทย์ในชุดเดียวกันของครู");
    if (operation === "reject") {
      await db.query("UPDATE question_revisions SET review_status='REJECTED',approved_at=NULL,approved_by=NULL,updated_at=now() WHERE id=ANY($1::uuid[])", [ids]);
      return { ids: [] };
    }
    const first = source.rows[0];
    const provenance = { ...(first.provenance ?? {}), operation, sourceRevisionIds: ids, sources: source.rows.map((row) => row.provenance).filter(Boolean), reviewRequired: true };
    const created: string[] = [];
    // Preserve every original; new drafts are deliberately incomplete, never auto-approved.
    for (let index = 0; index < (operation === "split" ? 2 : 1); index++) {
      const id = randomUUID();
      const body = { ...first.body, prompt: operation === "merge" ? source.rows.map((row) => row.body.prompt).join("\n\n") : first.body.prompt };
      await db.query("INSERT INTO question_revisions(id,set_id,body,answer_key,provenance,review_status) VALUES($1,$2,$3,$4,$5,'NEEDS_REVIEW')", [id, first.set_id, JSON.stringify(body), JSON.stringify({ ...first.answer_key, answerIndex: null, numericKey: undefined, explanation: "", hint: "" }), JSON.stringify(provenance)]);
      created.push(id);
    }
    await db.query("UPDATE question_revisions SET review_status='REJECTED',approved_at=NULL,approved_by=NULL,updated_at=now() WHERE id=ANY($1::uuid[])", [ids]);
    return { ids: created };
  });
  res.json(result);
}));
