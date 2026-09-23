import "../config";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { pool, transaction } from "../db/database";
import { randomUUID } from "node:crypto";
import { cleanDeletedFiles } from "../pdf/cleanup";
import { supervise } from "./supervise";
if (!process.env.DATABASE_URL) throw new Error("Worker requires DATABASE_URL or npm run setup:local");
let stopping = false;
let active: ChildProcess | undefined;
process.on("SIGINT", () => { stopping = true; active?.kill(); });
process.on("SIGTERM", () => { stopping = true; active?.kill(); });
console.log("PDF worker ready; concurrency=1; each job has a 180-second process limit");
while (!stopping) {
  await cleanDeletedFiles();
  await pool.query("UPDATE import_jobs SET status='failed',error='Worker ไม่สำเร็จหลังลอง 3 ครั้ง กรุณาตรวจไฟล์แล้วลองใหม่',lease_until=NULL,updated_at=now() WHERE status='running' AND lease_until<now() AND attempts>=3");
  const job = await transaction(async (db) => (await db.query(`UPDATE import_jobs SET status='running',run_token=$1,attempts=attempts+1,lease_until=now()+interval '4 minutes',updated_at=now()
    WHERE id=(SELECT id FROM import_jobs WHERE (status='queued' OR (status='running' AND lease_until<now())) AND attempts<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,run_token`, [randomUUID()])).rows[0]);
  if (!job) { await new Promise((done) => setTimeout(done, 1000)); continue; }
  console.log("pdf_job_started", job.id);
  const child = spawn(process.execPath, ["--max-old-space-size=512", "--import", "tsx", fileURLToPath(new URL("./pdfJob.ts", import.meta.url)), job.id, job.run_token], { windowsHide: true, stdio: "inherit" });
  active = child;
  const code = await supervise(child, async () => {
    const result = await pool.query("SELECT status,run_token FROM import_jobs WHERE id=$1", [job.id]);
    return result.rows[0]?.status === "running" && result.rows[0]?.run_token === job.run_token;
  });
  if (active === child) active = undefined;
  if (code !== 0) await pool.query("UPDATE import_jobs SET status='failed',error=coalesce(error,'Worker ถูกยุติหรือเกินเวลา กรุณาใช้ไฟล์เล็กลง'),updated_at=now() WHERE id=$1 AND status='running' AND run_token=$2", [job.id, job.run_token]);
}
await pool.end();
