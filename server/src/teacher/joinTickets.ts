import { Router } from "express";
import { randomBytes } from "node:crypto";
import { avatarPresets } from "@physics-monopoly/shared";
import { pool, tokenHash } from "../db/database";
import { HttpError, route, text, uuid } from "./http";
import { protectOrigin } from "./auth";
import { summarizeAttempts } from "./reports";
const limits = new Map<string, { count: number; since: number }>();
const avatarIds = new Set<string>(avatarPresets.map((preset) => preset.id));
export const ticketsRouter = Router();
ticketsRouter.use(protectOrigin, (req, _res, next) => {
  const now = Date.now();
  for (const [key, value] of limits) if (now - value.since > 60_000) limits.delete(key);
  const ip = req.ip ?? "unknown";
  const value = limits.get(ip) ?? { count: 0, since: now };
  // A school may have 60 students behind one NAT; allow burst joining without unbounded buffering.
  if (++value.count > 240 || limits.size > 2000) return next(new HttpError(429, "กรุณารอก่อนขอตั๋วเข้าเกมใหม่"));
  limits.set(ip, value); next();
});
ticketsRouter.post("/join", route(async (req, res) => {
  const token = req.body?.assignmentToken;
  if (typeof token !== "string" || !/^[\w-]{43}$/.test(token)) throw new HttpError(404, "ไม่พบกิจกรรม");
  const name = text(req.body?.name, 20).replace(/\s+/g, " ");
  if (name.length < 2) throw new HttpError(400, "ชื่อเล่นสั้นเกินไป");
  const avatarRaw = req.body?.avatar ?? "astro";
  if (typeof avatarRaw !== "string" || !avatarIds.has(avatarRaw)) throw new HttpError(400, "เลือกตัวละครที่มีอยู่ในระบบ");
  const avatar = avatarRaw;
  const assignment = await pool.query("SELECT id FROM assignments WHERE join_token_hash=$1 AND status='open'", [tokenHash(token)]);
  if (!assignment.rowCount) throw new HttpError(404, "ไม่พบกิจกรรมหรือปิดรับแล้ว");
  const ticket = randomBytes(32).toString("base64url");
  await pool.query("DELETE FROM join_tickets WHERE expires_at<now()");
  await pool.query("INSERT INTO join_tickets(token_hash,assignment_id,nickname,avatar,expires_at) VALUES($1,$2,$3,$4,now()+interval '120 seconds')", [tokenHash(ticket), assignment.rows[0].id, name, avatar]);
  res.json({ ticket, expiresIn: 120 });
}));
ticketsRouter.post("/results", route(async (req, res) => {
  const id = uuid(req.body?.participantId), token = req.body?.reconnectToken;
  if (typeof token !== "string" || !/^[\w-]{43}$/.test(token)) throw new HttpError(401, "Session ไม่ถูกต้อง");
  const session = (await pool.query(`SELECT s.id,s.status,p.nickname FROM participants p
    JOIN game_sessions s ON s.assignment_id=p.assignment_id
    WHERE p.id=$1 AND p.token_hash=$2 AND s.room_code=$3
    AND s.snapshot->'public'->'players' @> $4::jsonb ORDER BY s.updated_at DESC LIMIT 1`,
    [id,tokenHash(token),text(req.body?.roomCode,6),JSON.stringify([{id}])])).rows[0];
  if (!session) throw new HttpError(404,"ไม่พบผลของคุณ");
  if (session.status !== "game_over") throw new HttpError(409,"เปิดผลทบทวนได้หลังเกมจบเท่านั้น");
  const records = (await pool.query(`SELECT p.nickname,s.room_code,s.status session_status,a.evidence,
    q.item->>'objective' objective,q.item->>'prompt' prompt,q.item->'choices' choices,
    q.item->>'explanation' explanation,q.item->>'answerIndex' answer_index,q.item->'numericKey' numeric_key
    FROM learning_attempts a JOIN participants p ON p.id=a.participant_id JOIN game_sessions s ON s.id=a.session_id
    JOIN assignments activity ON activity.id=s.assignment_id JOIN question_set_versions v ON v.id=activity.version_id
    JOIN LATERAL (SELECT item FROM jsonb_array_elements(v.questions) item WHERE item->>'id'=a.evidence->>'questionId') q ON true
    WHERE a.session_id=$1 AND a.participant_id=$2 ORDER BY a.evidence->>'openedAt'`,[session.id,id])).rows;
  // Only this participant's completed questions, never the rest of the published bank.
  // Keep the first completed exposure: repeated practice must not silently erase
  // the recommendation associated with the original assessed attempt.
  const seen = new Set<string>();
  const review = records.filter(row => {
    if (row.evidence.status !== "completed" || seen.has(row.evidence.questionId)) return false;
    seen.add(row.evidence.questionId); return true;
  }).map(row => ({
    id:row.evidence.questionId,objective:row.objective,prompt:row.prompt,explanation:row.explanation,
    answer:row.numeric_key ? `${row.numeric_key.value} ${row.numeric_key.unit}` : row.choices?.[Number(row.answer_index)],
    needsPractice:!row.evidence.firstCorrect,
  }));
  res.json({ nickname:session.nickname,summary:summarizeAttempts(records),review });
}));
ticketsRouter.post("/rejoin", route(async (req, res) => {
  const id = uuid(req.body?.participantId), token = req.body?.reconnectToken;
  if (typeof token !== "string" || !/^[\w-]{43}$/.test(token)) throw new HttpError(401, "Session ไม่ถูกต้อง");
  const result = await pool.query("SELECT s.id,s.assignment_id,s.live_room_id,s.snapshot FROM participants p JOIN game_sessions s ON s.assignment_id=p.assignment_id WHERE p.id=$1 AND p.token_hash=$2 AND s.room_code=$3 AND s.status NOT IN ('abandoned','interrupted') ORDER BY s.updated_at DESC LIMIT 1", [id, tokenHash(token), text(req.body?.roomCode, 6)]);
  const session = result.rows[0];
  if (!session?.snapshot?.public?.players?.some((player: { id: string }) => player.id === id)) throw new HttpError(404, "ไม่พบที่นั่งเดิม");
  const ticket = randomBytes(32).toString("base64url");
  await pool.query("INSERT INTO join_tickets(token_hash,assignment_id,session_id,participant_id,expires_at) VALUES($1,$2,$3,$4,now()+interval '120 seconds')", [tokenHash(ticket), session.assignment_id, session.id, id]);
  res.json({ ticket, roomId: session.live_room_id, expiresIn: 120 });
}));
export async function validJoinTicket(assignmentToken: unknown, ticket: unknown, name: unknown, avatar: unknown): Promise<boolean> {
  if (typeof assignmentToken !== "string" || typeof ticket !== "string" || typeof name !== "string") return false;
  return Boolean((await pool.query("SELECT 1 FROM join_tickets t JOIN assignments a ON a.id=t.assignment_id WHERE a.join_token_hash=$1 AND a.status='open' AND t.token_hash=$2 AND t.nickname=$3 AND t.avatar=$4 AND t.participant_id IS NULL AND t.consumed_at IS NULL AND t.expires_at>now()", [tokenHash(assignmentToken), tokenHash(ticket), name.trim().replace(/\s+/g, " "), avatar ?? "astro"])).rowCount);
}
export async function consumeJoinTicket(assignmentId: string, ticket: unknown, name: unknown, avatar: unknown): Promise<boolean> {
  if (typeof ticket !== "string" || typeof name !== "string") return false;
  return Boolean((await pool.query("UPDATE join_tickets t SET consumed_at=now() FROM assignments a WHERE t.assignment_id=a.id AND a.id=$1 AND a.status='open' AND t.token_hash=$2 AND t.nickname=$3 AND t.avatar=$4 AND t.participant_id IS NULL AND t.expires_at>now() AND t.consumed_at IS NULL RETURNING t.token_hash", [assignmentId, tokenHash(ticket), name.trim().replace(/\s+/g, " "), avatar ?? "astro"])).rowCount);
}
export async function consumeRejoinTicket(sessionId: string, participantId: string, ticket: unknown): Promise<boolean> {
  if (typeof ticket !== "string") return false;
  return Boolean((await pool.query("UPDATE join_tickets SET consumed_at=now() WHERE session_id=$1 AND participant_id=$2 AND token_hash=$3 AND expires_at>now() AND consumed_at IS NULL RETURNING token_hash", [sessionId, participantId, tokenHash(ticket)])).rowCount);
}
