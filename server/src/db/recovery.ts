import { randomBytes } from "node:crypto";
import type { GameState } from "@physics-monopoly/shared";
import { pool } from "./database";
import type { ClassroomContext } from "./classroomSession";
export const recoveryKey = randomBytes(32).toString("base64url");
export async function loadRecovery(id: string): Promise<{ context: ClassroomContext; state: GameState; privateState: any; updatedAt: number }> {
  const result = await pool.query("SELECT s.*,a.join_token_hash,a.rules,v.questions FROM game_sessions s JOIN assignments a ON a.id=s.assignment_id JOIN question_set_versions v ON v.id=a.version_id WHERE s.id=$1 AND s.schema_version=2 AND s.status NOT IN ('game_over','abandoned','interrupted')", [id]);
  const row = result.rows[0];
  if (!row?.snapshot?.public || !row.snapshot.private?.learning) throw new Error("Unsupported recovery snapshot");
  return { context: { sessionId: row.id, assignmentId: row.assignment_id, tokenHash: row.join_token_hash, questions: row.questions, durationMinutes: row.rules.durationMinutes, maps: row.rules.maps, questionTimeMultiplier: row.rules.questionTimeMultiplier }, state: row.snapshot.public, privateState: row.snapshot.private, updatedAt: new Date(row.updated_at).getTime() };
}
// liveRoomIds should list every Colyseus "game" room id currently running in this
// process (e.g. from matchMaker.query({name:"game"})). Sessions backing a live room
// must never be swept, even if they have not checkpointed in the last 10 minutes
// (a paused classroom game, or a lobby waiting on students, can go quiet that long).
export async function sweepStaleSessions(liveRoomIds: string[] = []): Promise<void> {
  await pool.query(
    "UPDATE game_sessions SET status='abandoned',updated_at=now() WHERE status='lobby' AND (snapshot IS NULL OR jsonb_array_length(snapshot->'public'->'players')=0) AND (live_room_id IS NULL OR NOT (live_room_id = ANY($1::text[])))",
    [liveRoomIds]
  );
  await pool.query(
    "UPDATE game_sessions SET status='abandoned' WHERE schema_version=2 AND status NOT IN ('game_over','abandoned','interrupted') AND updated_at<now()-interval '10 minutes' AND (live_room_id IS NULL OR NOT (live_room_id = ANY($1::text[])))",
    [liveRoomIds]
  );
}
export async function recoverableSessions(): Promise<string[]> {
  // Called only at boot, before any room exists in this process, so nothing is live yet.
  await sweepStaleSessions([]);
  return (await pool.query("SELECT id FROM game_sessions WHERE schema_version=2 AND snapshot IS NOT NULL AND jsonb_array_length(snapshot->'public'->'players')>0 AND status NOT IN ('game_over','abandoned','interrupted') ORDER BY created_at")).rows.map((row) => row.id);
}
