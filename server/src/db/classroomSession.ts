import { createHash, randomUUID } from "node:crypto";
import type { GameState, Question } from "@physics-monopoly/shared";
import { pool, tokenHash, transaction } from "./database";
import type { LearningAttempt } from "../logic/ClassroomGame";
const savedAttempts = new WeakMap<ClassroomContext, Map<string, string>>();

export interface ClassroomContext { assignmentId: string; sessionId: string; tokenHash: string; questions: Question[]; durationMinutes: number; maps?: string[]; questionTimeMultiplier?: number }
export async function createClassroomSession(token: unknown, roomCode: string, roomId: string): Promise<ClassroomContext> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("ลิงก์กิจกรรมไม่ถูกต้อง");
  return transaction(async (db) => {
    const activity = await db.query("SELECT a.id,a.rules,v.questions FROM assignments a JOIN question_set_versions v ON v.id=a.version_id WHERE a.join_token_hash=$1 AND a.status='open' FOR SHARE OF a", [tokenHash(token)]);
    if (!activity.rowCount) throw new Error("ไม่พบกิจกรรมหรือครูปิดรับผู้เล่นแล้ว");
    const sessionId = randomUUID();
    await db.query("INSERT INTO game_sessions(id,assignment_id,room_code,live_room_id) VALUES($1,$2,$3,$4)", [sessionId, activity.rows[0].id, roomCode, roomId]);
    return { assignmentId: activity.rows[0].id, sessionId, tokenHash: tokenHash(token), questions: activity.rows[0].questions, durationMinutes: activity.rows[0].rules.durationMinutes, maps: activity.rows[0].rules.maps, questionTimeMultiplier: activity.rows[0].rules.questionTimeMultiplier };
  });
}
// Deterministic per (session, sequence, eventType) so a retried checkpoint for
// the exact same logical event collides on UNIQUE(session_id,request_id) and
// is deduped by ON CONFLICT DO NOTHING, instead of a fresh random id always
// inserting a duplicate row.
export function checkpointRequestId(sessionId: string, sequence: number, eventType: string): string {
  return createHash("sha256").update(`${sessionId}:${sequence}:${eventType}`).digest("hex");
}
export async function canJoinAssignment(context: ClassroomContext, token: unknown): Promise<boolean> {
  if (typeof token !== "string" || tokenHash(token) !== context.tokenHash) return false;
  return Boolean((await pool.query("SELECT 1 FROM assignments WHERE id=$1 AND status='open'", [context.assignmentId])).rowCount);
}
export async function checkpoint(context: ClassroomContext, eventType: string, state: GameState, privateState: { reconnectTokens: [string, string][]; learning?: object }): Promise<void> {
  const cache = savedAttempts.get(context) ?? new Map<string, string>();
  const changed = ((privateState.learning as { history?: LearningAttempt[] } | undefined)?.history ?? [])
    .map((attempt) => ({ attempt, json: JSON.stringify(attempt) })).filter(({ attempt,json }) => cache.get(attempt.id) !== json);
  await transaction(async (db) => {
    const tokens = new Map(privateState.reconnectTokens);
    for (const player of state.players) {
      const token = tokens.get(player.id);
      if (!token) throw new Error("Participant identity missing from checkpoint");
      await db.query("INSERT INTO participants(id,assignment_id,nickname,avatar,token_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname,avatar=excluded.avatar,token_hash=excluded.token_hash WHERE participants.assignment_id=excluded.assignment_id", [player.id, context.assignmentId, player.name, player.avatar, tokenHash(token)]);
    }
    const next = await db.query("UPDATE game_sessions SET sequence=sequence+1,schema_version=$4,status=$2,snapshot=$3,updated_at=now() WHERE id=$1 RETURNING sequence", [context.sessionId, state.finishReason === "abandoned" ? "abandoned" : state.phase, JSON.stringify({ public: state, private: privateState }), privateState.learning ? 2 : 1]);
    if (!next.rowCount) throw new Error("Game session disappeared");
    for (const { attempt,json } of changed) {
      await db.query("INSERT INTO question_sessions(id,session_id,question_id,repeated,opened_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING", [attempt.questionSessionId, context.sessionId, attempt.questionId, attempt.repeated, new Date(attempt.openedAt)]);
      await db.query("INSERT INTO learning_attempts(id,session_id,question_session_id,participant_id,evidence) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET evidence=excluded.evidence,updated_at=now() WHERE learning_attempts.evidence IS DISTINCT FROM excluded.evidence", [attempt.id, context.sessionId, attempt.questionSessionId, attempt.participantId, json]);
    }
    const requestId = checkpointRequestId(context.sessionId, next.rows[0].sequence, eventType);
    await db.query("INSERT INTO game_events(session_id,sequence,request_id,event_type,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT (session_id,request_id) DO NOTHING", [context.sessionId, next.rows[0].sequence, requestId, eventType, JSON.stringify({ phase: state.phase, turnCount: state.turnCount })]);
  });
  for (const { attempt,json } of changed) cache.set(attempt.id, json);
  savedAttempts.set(context, cache);
}
