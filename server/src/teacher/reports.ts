import { Router } from "express";
import { pool } from "../db/database";
import { HttpError, route, uuid } from "./http";
import type { LearningAttempt } from "../logic/ClassroomGame";
export interface ReportSource { nickname: string; room_code: string; session_status: string; objective: string; evidence: LearningAttempt }
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b), middle = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle-1]! + sorted[middle]!)/2;
}
export function summarizeAttempts(rows: ReportSource[]) {
  const groups = new Map<string, { participantId: string; nickname: string; room: string; objective: string; offered: number; answered: number; firstCorrect: number; firstHint: number; retryCorrect: number; wrong: number; notAttempted: number; interrupted: number; repeated: number; responseSeconds: number[] }>();
  for (const row of rows) {
    const a = row.evidence, key = `${a.participantId}:${row.room_code}:${row.objective}`;
    let value = groups.get(key);
    if (!value) { value = { participantId: a.participantId, nickname: row.nickname, room: row.room_code, objective: row.objective, offered: 0, answered: 0, firstCorrect: 0, firstHint: 0, retryCorrect: 0, wrong: 0, notAttempted: 0, interrupted: 0, repeated: 0, responseSeconds: [] }; groups.set(key, value); }
    if (a.repeated) { value.repeated++; continue; }
    value.offered++;
    if (a.status === "interrupted") { value.interrupted++; continue; }
    if (a.status === "not_attempted") { value.notAttempted++; continue; }
    if (a.status !== "completed") continue;
    if (a.first) value.answered++;
    if (a.firstCorrect) value.firstCorrect++;
    if (a.hintUsed) value.firstHint++;
    if (a.retryCorrect) value.retryCorrect++;
    if (a.first && !a.firstCorrect && !a.retryCorrect) value.wrong++;
    if (a.firstAt) value.responseSeconds.push(Math.max(0,(a.firstAt-a.openedAt-(a.firstPausedMs ?? 0))/1000));
  }
  return [...groups.values()].map(({ responseSeconds,...row }) => ({ ...row, firstAccuracy: row.answered ? row.firstCorrect / row.answered : null, responseTimeSamples: responseSeconds.length, medianResponseSeconds: median(responseSeconds) }));
}
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
export const reportsRouter = Router();
reportsRouter.get("/:id/report", route(async (req,res) => {
  const id = uuid(req.params.id);
  const assignment = await pool.query("SELECT id,title FROM assignments WHERE id=$1 AND owner_id=$2", [id,res.locals.teacher.id]);
  if (!assignment.rowCount) throw new HttpError(404,"ไม่พบกิจกรรม");
  const records = await pool.query(`SELECT p.nickname,s.room_code,s.status session_status,a.evidence,
    coalesce(q.item->>'objective','ไม่ระบุทักษะ') objective,q.item->>'prompt' prompt,q.item->'choices' choices
    FROM learning_attempts a JOIN participants p ON p.id=a.participant_id
    JOIN game_sessions s ON s.id=a.session_id JOIN assignments activity ON activity.id=s.assignment_id
    JOIN question_set_versions v ON v.id=activity.version_id
    LEFT JOIN LATERAL (SELECT item FROM jsonb_array_elements(v.questions) item WHERE item->>'id'=a.evidence->>'questionId') q ON true
    WHERE s.assignment_id=$1 ORDER BY p.nickname,s.room_code,a.evidence->>'openedAt'`,[id]);
  const summary = summarizeAttempts(records.rows);
  if (req.query.format === "csv") {
    const columns = ["nickname","room","objective","offered","answered","firstCorrect","firstHint","retryCorrect","wrong","notAttempted","interrupted","repeated","medianResponseSeconds","responseTimeSamples"] as const;
    res.setHeader("Content-Disposition",'attachment; filename="physics-report.csv"');
    res.type("text/csv; charset=utf-8").send("\uFEFF" + [columns.map(csvCell).join(","),...summary.map((row) => columns.map((key) => csvCell(row[key])).join(","))].join("\r\n")); return;
  }
  const wrongOptions = new Map<string,{ questionId: string; prompt: string; answer: string; count: number }>();
  for (const row of records.rows) {
    const a = row.evidence as LearningAttempt;
    if (a.repeated || a.status !== "completed" || !a.first || a.firstCorrect) continue;
    const answer = a.first.numericAnswer ? `${a.first.numericAnswer.value} ${a.first.numericAnswer.unit}` : row.choices?.[a.first.choiceIndex ?? -1] ?? "ไม่ระบุ";
    const key = `${a.questionId}:${answer}`, value = wrongOptions.get(key) ?? { questionId: a.questionId, prompt: row.prompt, answer, count: 0 };
    value.count++; wrongOptions.set(key,value);
  }
  const sessions = (await pool.query("SELECT id,room_code,status,updated_at,snapshot->'public'->>'finishReason' finish_reason FROM game_sessions WHERE assignment_id=$1 ORDER BY created_at",[id])).rows;
  res.json({ assignment: assignment.rows[0], summary, sessions, commonWrongAnswers: [...wrongOptions.values()].sort((a,b)=>b.count-a.count), attemptCount: records.rowCount, disclaimer: "ชื่อเล่นไม่ใช่ทะเบียนนักเรียน ไม่จัดอันดับข้ามห้องจาก XP เวลาไม่ใช่ตัววัดความเก่ง และผลเกมไม่ใช่ผลสอบโดยอัตโนมัติ" });
}));
