/** Local rehearsal only. Creates a NEW restore database; never overwrites data. */
import "../server/src/config";
import { pool, migrate, transaction, tokenHash } from "../server/src/db/database";
import { mkdir, writeFile, readFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { storagePath } from "../server/src/pdf/storage";
import assert from "node:assert/strict";
import pg from "pg";

if (process.env.NODE_ENV === "production") throw new Error("Local backup rehearsal is disabled in production");
const connection = new URL(process.env.DATABASE_URL!);
if (!["127.0.0.1", "localhost"].includes(connection.hostname)) throw new Error("Backup rehearsal requires a local PostgreSQL");
const tables = ["teachers", "classrooms", "question_sets", "question_revisions", "question_set_versions", "assignments", "participants", "game_sessions", "game_events", "source_documents", "import_jobs", "source_pages", "question_media", "question_sessions", "learning_attempts"];
const data = await transaction(async (client) => {
  await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const result: Record<string, Record<string, unknown>[]> = {};
  for (const table of tables) result[table] = (await client.query(`SELECT * FROM ${table}`)).rows;
  return result;
});
const serialized = JSON.stringify(data);
await mkdir(resolve(".local/backups"), { recursive: true });
const backup = resolve(".local/backups", `database-${Date.now()}.json`);
const filesDirectory = `${backup}.files`;
await mkdir(filesDirectory);
const files: Array<{ name: string; hash: string }> = [];
for (const item of [
  ...data.source_documents.map((row) => ({ id: String(row.id), suffix: ".pdf" })),
  ...data.source_pages.map((row) => ({ id: String(row.document_id), suffix: `-${row.page}.png` })),
  ...data.question_media.map((row) => ({ id: String(row.id), suffix: ".png" })),
]) {
  const bytes = await readFile(await storagePath(item.id, item.suffix));
  const name = item.id + item.suffix;
  await writeFile(resolve(filesDirectory, name), bytes, { flag: "wx", mode: 0o600 });
  files.push({ name, hash: tokenHash(bytes.toString("base64")) });
}
await writeFile(backup, JSON.stringify({ format: 2, hash: tokenHash(serialized), data, files }), { flag: "wx", mode: 0o600 });
// Re-read the actual backup, not the in-memory source, and verify every byte.
const archive = JSON.parse(await readFile(backup, "utf8")) as { hash: string; data: typeof data; files: typeof files };
assert.equal(tokenHash(JSON.stringify(archive.data)), archive.hash);
const restoreDirectory = `${backup}.restored-files`;
await mkdir(restoreDirectory);
for (const file of archive.files) {
  assert.match(file.name, /^[a-f0-9-]{36}(?:\.pdf|\.png|-[1-9][0-9]?\.png)$/);
  assert.equal(tokenHash((await readFile(resolve(filesDirectory, file.name))).toString("base64")), file.hash);
  await copyFile(resolve(filesDirectory, file.name), resolve(restoreDirectory, file.name));
  assert.equal(tokenHash((await readFile(resolve(restoreDirectory, file.name))).toString("base64")), file.hash);
}
const targetName = `physics_restore_${Date.now()}`;
await pool.query(`CREATE DATABASE ${targetName}`);
connection.pathname = `/${targetName}`;
const restored = new pg.Pool({ connectionString: connection.href });
try {
  await migrate(restored);
  const counts: Record<string, number> = {};
  await transaction(async (client) => {
    for (const table of tables) {
      const columns = (await client.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [table])).rows;
      for (const row of archive.data[table]) {
        const values = columns.map((column) => ["json", "jsonb"].includes(column.data_type) && row[column.column_name] !== null ? JSON.stringify(row[column.column_name]) : row[column.column_name]);
        await client.query(`INSERT INTO ${table} (${columns.map((column) => `"${column.column_name}"`).join(",")}) VALUES(${values.map((_, i) => `$${i + 1}`).join(",")})`, values);
      }
      counts[table] = Number((await client.query(`SELECT count(*) FROM ${table}`)).rows[0].count);
      assert.equal(counts[table], archive.data[table].length);
    }
  }, restored);
  await mkdir("docs/qa/database", { recursive: true });
  await writeFile("docs/qa/database/restore-result.json", JSON.stringify({ passed: true, targetName, counts, verifiedPrivateFiles: archive.files.length, sessionCookiesRestored: false }, null, 2));
  console.log(`PASS backup/restore into new local database ${targetName}; source untouched; teacher login sessions deliberately not restored.`);
} finally { await restored.end(); await pool.end(); }
