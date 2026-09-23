import { Router } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { pool, tokenHash, transaction } from "../db/database";
import { protectOrigin, teacherSession } from "./auth";
import { grade, HttpError, route, text, uuid } from "./http";
import { importsRouter } from "../pdf/routes";
import { validateNumericKey } from "../logic/numeric";
import { cropRouter } from "../pdf/crop";
import { revisionOperations } from "./revisionOperations";
import { demoCatalog, demoQuestions } from "./demoSets";
import { matchMaker } from "@colyseus/core";
import type { GameRoom } from "../rooms/GameRoom";
import { locations, isLocationId } from "@physics-monopoly/shared";
import { reportsRouter } from "./reports";
import { privacyRouter } from "./privacy";

export const teacherRouter = Router();
teacherRouter.use(protectOrigin, teacherSession);
teacherRouter.use(privacyRouter);
teacherRouter.use("/imports", importsRouter);
teacherRouter.use("/question-revisions", cropRouter);
teacherRouter.use("/question-revisions", revisionOperations);
teacherRouter.use("/assignments", reportsRouter);
teacherRouter.get("/demos", (_req, res) => { res.json(demoCatalog); });
teacherRouter.post("/demos/:id", route(async (req, res) => {
  const definition = demoCatalog.find((item) => item.id === req.params.id);
  if (!definition) throw new HttpError(404, "ไม่พบตัวอย่าง");
  const id = randomUUID();
  await transaction(async (db) => {
    await db.query("INSERT INTO question_sets(id,owner_id,title,grade,topic) VALUES($1,$2,$3,$4,$5)", [id, res.locals.teacher.id, `ตัวอย่างรอตรวจ: ${definition.title}`, definition.grade, definition.title]);
    for (const input of demoQuestions(definition.id)) {
      const draft = validateQuestion(input);
      await db.query("INSERT INTO question_revisions(id,set_id,body,answer_key,provenance) VALUES($1,$2,$3,$4,$5)", [randomUUID(), id, JSON.stringify(draft.body), JSON.stringify(draft.key), JSON.stringify({ source: "project-authored-demo-v1", demoId: definition.id, reviewRequired: true })]);
    }
  });
  res.status(201).json({ id });
}));

teacherRouter.get("/classrooms", route(async (_req, res) => {
  res.json((await pool.query("SELECT * FROM classrooms WHERE owner_id=$1 ORDER BY created_at DESC", [res.locals.teacher.id])).rows);
}));
teacherRouter.post("/classrooms", route(async (req, res) => {
  const body = req.body ?? {};
  if (!Array.isArray(body.objectives) || body.objectives.length > 8) throw new HttpError(400, "เป้าหมายการเรียนรู้ไม่ถูกต้อง");
  const values = [randomUUID(), res.locals.teacher.id, text(body.title), grade(body.grade), text(body.curriculumTrack), text(body.term), text(body.topic), JSON.stringify(body.objectives.map((item: unknown) => text(item, 500)))];
  res.status(201).json((await pool.query("INSERT INTO classrooms(id,owner_id,title,grade,curriculum_track,term,topic,objectives) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *", values)).rows[0]);
}));
teacherRouter.get("/classrooms/:id", route(async (req, res) => {
  const result = await pool.query("SELECT * FROM classrooms WHERE id=$1 AND owner_id=$2", [uuid(req.params.id), res.locals.teacher.id]);
  if (!result.rowCount) throw new HttpError(404, "ไม่พบชั้นเรียน");
  res.json(result.rows[0]);
}));
teacherRouter.get("/question-sets", route(async (_req, res) => {
  res.json((await pool.query("SELECT s.*, (SELECT count(*)::int FROM question_revisions q WHERE q.set_id=s.id) question_count FROM question_sets s WHERE s.owner_id=$1 ORDER BY s.created_at DESC", [res.locals.teacher.id])).rows);
}));
teacherRouter.post("/question-sets", route(async (req, res) => {
  const body = req.body ?? {};
  res.status(201).json((await pool.query("INSERT INTO question_sets(id,owner_id,title,grade,topic) VALUES($1,$2,$3,$4,$5) RETURNING *", [randomUUID(), res.locals.teacher.id, text(body.title), grade(body.grade), text(body.topic)])).rows[0]);
}));
teacherRouter.get("/question-sets/:id", route(async (req, res) => {
  const id = uuid(req.params.id);
  const set = await pool.query("SELECT * FROM question_sets WHERE id=$1 AND owner_id=$2", [id, res.locals.teacher.id]);
  if (!set.rowCount) throw new HttpError(404, "ไม่พบชุดโจทย์");
  const [questions, versions] = await Promise.all([
    pool.query("SELECT * FROM question_revisions WHERE set_id=$1 ORDER BY updated_at,id", [id]),
    pool.query("SELECT id,version,published_at FROM question_set_versions WHERE set_id=$1 ORDER BY version DESC", [id]),
  ]);
  res.json({ ...set.rows[0], questions: questions.rows, versions: versions.rows });
}));

export function validateQuestion(input: Record<string, unknown>): { body: object; key: object } {
  if (!["easy", "medium", "hard"].includes(String(input.difficulty))) throw new HttpError(400, "ระดับความยากไม่ถูกต้อง");
  if (!Number.isInteger(input.timeLimitSec) || (input.timeLimitSec as number) < 15 || (input.timeLimitSec as number) > 120) throw new HttpError(400, "เวลาตอบต้องเป็น 15–120 วินาที");
  if (!["mechanics", "electricity", "waves", "heat", "optics", "modern"].includes(String(input.topic))) throw new HttpError(400, "เลือกหมวดวิชาให้ถูกต้อง");
  const body = { prompt: text(input.prompt, 8000), difficulty: input.difficulty, timeLimitSec: input.timeLimitSec, topic: input.topic, objective: text(input.objective, 500) };
  const key = { explanation: text(input.explanation, 10000), hint: text(input.hint, 2000) };
  if (input.kind === "numeric") {
    try { return { body: { ...body, kind: "numeric", choices: [] }, key: { ...key, answerIndex: -1, numericKey: validateNumericKey(input.numericKey) } }; }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : "ข้อมูลคำตอบตัวเลขไม่ถูกต้อง"); }
  }
  if (input.kind !== undefined && input.kind !== "choice") throw new HttpError(400, "ประเภทโจทย์ไม่รองรับ");
  if (!Array.isArray(input.choices) || input.choices.length < 2 || input.choices.length > 5) throw new HttpError(400, "ต้องมีตัวเลือก 2–5 ข้อ");
  const choices = input.choices.map((item) => text(item, 2000));
  if (new Set(choices).size !== choices.length) throw new HttpError(400, "ตัวเลือกซ้ำกัน");
  if (!Number.isInteger(input.answerIndex) || (input.answerIndex as number) < 0 || (input.answerIndex as number) >= choices.length) throw new HttpError(400, "กรุณาระบุคำตอบที่ถูกต้อง");
  return {
    body: { ...body, choices }, key: { ...key, answerIndex: input.answerIndex },
  };
}
teacherRouter.post("/question-sets/:id/questions", route(async (req, res) => {
  const setId = uuid(req.params.id);
  const question = validateQuestion(req.body ?? {});
  const result = await pool.query("INSERT INTO question_revisions(id,set_id,body,answer_key) SELECT $1,id,$3,$4 FROM question_sets WHERE id=$2 AND owner_id=$5 RETURNING id", [randomUUID(), setId, JSON.stringify(question.body), JSON.stringify(question.key), res.locals.teacher.id]);
  if (!result.rowCount) throw new HttpError(404, "ไม่พบชุดโจทย์");
  res.status(201).json(result.rows[0]);
}));
teacherRouter.patch("/question-revisions/:id", route(async (req, res) => {
  const question = validateQuestion(req.body ?? {});
  const result = await pool.query("UPDATE question_revisions q SET body=$3::jsonb || CASE WHEN q.body ? 'media' THEN jsonb_build_object('media',q.body->'media') ELSE '{}'::jsonb END,answer_key=$4,review_status='NEEDS_REVIEW',approved_by=NULL,approved_at=NULL,updated_at=now() FROM question_sets s WHERE q.id=$1 AND q.set_id=s.id AND s.owner_id=$2 RETURNING q.id", [uuid(req.params.id), res.locals.teacher.id, JSON.stringify(question.body), JSON.stringify(question.key)]);
  if (!result.rowCount) throw new HttpError(404, "ไม่พบโจทย์");
  res.json(result.rows[0]);
}));
teacherRouter.post("/question-revisions/:id/approve", route(async (req, res) => {
  const approved = await transaction(async (db) => {
    const id = uuid(req.params.id);
    const draft = await db.query("SELECT q.body,q.answer_key FROM question_revisions q JOIN question_sets s ON s.id=q.set_id WHERE q.id=$1 AND s.owner_id=$2 FOR UPDATE OF q", [id, res.locals.teacher.id]);
    if (!draft.rowCount) throw new HttpError(404, "ไม่พบโจทย์");
    validateQuestion({ ...draft.rows[0].body, ...draft.rows[0].answer_key });
    return (await db.query("UPDATE question_revisions SET review_status='APPROVED',approved_by=$2,approved_at=now() WHERE id=$1 RETURNING id", [id, res.locals.teacher.id])).rows[0];
  });
  res.json(approved);
}));
teacherRouter.post("/question-sets/:id/publish", route(async (req, res) => {
  const version = await transaction(async (db) => {
    const id = uuid(req.params.id);
    const set = await db.query("SELECT * FROM question_sets WHERE id=$1 AND owner_id=$2 FOR UPDATE", [id, res.locals.teacher.id]);
    if (!set.rowCount) throw new HttpError(404, "ไม่พบชุดโจทย์");
    // Lock drafts while taking the immutable version: edits cannot race publication.
    const revisions = await db.query("SELECT * FROM question_revisions WHERE set_id=$1 AND approved_at IS NOT NULL AND review_status='APPROVED' ORDER BY id FOR SHARE", [id]);
    if (revisions.rows.length < 10) throw new HttpError(400, "ต้องตรวจรับอย่างน้อย 10 ข้อก่อนเผยแพร่ (แนะนำ 30 ข้อ)");
    const next = await db.query("SELECT coalesce(max(version),0)+1 version FROM question_set_versions WHERE set_id=$1", [id]);
    const questions = revisions.rows.map((item) => ({ id: item.id, ...item.body, ...item.answer_key, provenance: item.provenance }));
    return (await db.query("INSERT INTO question_set_versions(id,set_id,owner_id,version,questions) VALUES($1,$2,$3,$4,$5) RETURNING id,version,published_at", [randomUUID(), id, res.locals.teacher.id, next.rows[0].version, JSON.stringify(questions)])).rows[0];
  });
  res.status(201).json(version);
}));
teacherRouter.get("/assignments", route(async (_req, res) => {
  res.json((await pool.query("SELECT id,classroom_id,version_id,title,rules,status,created_at FROM assignments WHERE owner_id=$1 ORDER BY created_at DESC", [res.locals.teacher.id])).rows);
}));
teacherRouter.post("/assignments", route(async (req, res) => {
  const body = req.body ?? {};
  const duration = body.durationMinutes ?? 30;
  const questionTimeMultiplier = body.questionTimeMultiplier ?? 1;
  if (![1,1.5,2].includes(questionTimeMultiplier)) throw new HttpError(400,"เวลาเสริมต้องเป็น 1 / 1.5 / 2 เท่า");
  const maps = body.maps ?? locations.map((location) => location.id);
  if (!Array.isArray(maps) || !maps.length || maps.length > 12 || !maps.every(isLocationId)) throw new HttpError(400, "เลือกสถานที่ที่รองรับอย่างน้อยหนึ่งแห่ง");
  if (![15,20,30,40].includes(duration)) throw new HttpError(400, "เวลาเกมต้องเป็น 15/20/30/40 นาที");
  const token = randomBytes(32).toString("base64url");
  const result = await pool.query(`INSERT INTO assignments(id,owner_id,classroom_id,version_id,title,join_token_hash,rules)
    SELECT $1,$2,c.id,v.id,$5,$6,$7 FROM classrooms c JOIN question_set_versions v ON v.id=$4
    JOIN question_sets s ON s.id=v.set_id WHERE c.id=$3 AND c.owner_id=$2 AND v.owner_id=$2 AND c.grade=s.grade RETURNING id,title,status`,
    [randomUUID(), res.locals.teacher.id, uuid(body.classroomId), uuid(body.versionId), text(body.title), tokenHash(token), JSON.stringify({ questionTimeMultiplier, durationMinutes: duration, maps: [...new Set(maps)] })]);
  if (!result.rowCount) throw new HttpError(400, "ชั้นเรียนและชุดโจทย์ต้องเป็นของครูและระดับชั้นเดียวกัน");
  const origin = process.env.APP_ORIGIN ?? "http://localhost:5173";
  res.status(201).json({ ...result.rows[0], joinUrl: `${origin}/play/${token}` });
}));
teacherRouter.post("/assignments/:id/close-entry", route(async (req, res) => {
  const result = await pool.query("UPDATE assignments SET status='closed' WHERE id=$1 AND owner_id=$2 AND status='open' RETURNING id,status", [uuid(req.params.id), res.locals.teacher.id]);
  if (!result.rowCount) throw new HttpError(404, "ไม่พบกิจกรรมที่เปิดอยู่");
  res.json(result.rows[0]);
}));
teacherRouter.get("/assignments/:id/rooms", route(async (req, res) => {
  const assignment = await pool.query("SELECT id FROM assignments WHERE id=$1 AND owner_id=$2", [uuid(req.params.id), res.locals.teacher.id]);
  if (!assignment.rowCount) throw new HttpError(404, "ไม่พบกิจกรรม");
  // Do not expose the private recovery snapshot or reconnect tokens.
  res.json((await pool.query("SELECT id,room_code,status,updated_at FROM game_sessions WHERE assignment_id=$1 ORDER BY created_at", [req.params.id])).rows);
}));
teacherRouter.post("/assignments/:id/rooms/:sessionId/control", route(async (req, res) => {
  const command = req.body?.command;
  if (!["pause", "resume", "end"].includes(command)) throw new HttpError(400, "คำสั่งไม่ถูกต้อง");
  const room = await pool.query("SELECT s.live_room_id FROM game_sessions s JOIN assignments a ON a.id=s.assignment_id WHERE s.id=$1 AND a.id=$2 AND a.owner_id=$3", [uuid(req.params.sessionId), uuid(req.params.id), res.locals.teacher.id]);
  if (!room.rowCount) throw new HttpError(404, "ไม่พบห้อง");
  let accepted = false;
  try { accepted = await matchMaker.remoteRoomCall<GameRoom, "teacherControl">(room.rows[0].live_room_id, "teacherControl", [command, req.params.id]); }
  catch { throw new HttpError(409, "ห้องไม่ได้เชื่อมต่อหรือกำลังกู้คืน"); }
  if (!accepted) throw new HttpError(409, "ห้องไม่รับคำสั่งในขณะนี้");
  res.json({ ok: true });
}));

export const playRouter = Router();
playRouter.get("/:token", route(async (req, res) => {
  const token = req.params.token;
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(404, "ไม่พบกิจกรรม");
  const result = await pool.query("SELECT a.id,a.title,a.rules,a.status,c.grade,c.topic FROM assignments a JOIN classrooms c ON c.id=a.classroom_id WHERE a.join_token_hash=$1", [tokenHash(token)]);
  if (!result.rowCount) throw new HttpError(404, "ไม่พบกิจกรรม");
  res.json(result.rows[0]);
}));
