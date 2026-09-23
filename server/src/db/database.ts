import "../config";
import { Pool, type PoolClient } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10, connectionTimeoutMillis: 5000 });
export const tokenHash = (token: string): string => createHash("sha256").update(token).digest("hex");

export async function transaction<T>(work: (client: PoolClient) => Promise<T>, target = pool): Promise<T> {
  const client = await target.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function migrate(target = pool): Promise<void> {
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(731295)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, hash text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    const directory = new URL("./migrations/", import.meta.url);
    for (const name of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
      const sql = await readFile(new URL(name, directory), "utf8");
      const hash = tokenHash(sql);
      const previous = await client.query("SELECT hash FROM schema_migrations WHERE name=$1", [name]);
      if (previous.rowCount) {
        if (previous.rows[0].hash !== hash) throw new Error(`Migration changed after application: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name,hash) VALUES($1,$2)", [name, hash]);
    }
  }, target);
}
