import EmbeddedPostgres from "embedded-postgres";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { execFile, execFileSync, spawn } from "node:child_process";
import { promisify } from "node:util";

if (process.env.NODE_ENV === "production") throw new Error("Embedded database is for local development only");
const directory = resolve(".local");
await mkdir(directory, { recursive: true });
const configPath = resolve(directory, "database.json");
let config: { password: string; port: number };
try { config = JSON.parse(await readFile(configPath, "utf8")); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  config = { password: randomBytes(32).toString("hex"), port: 55432 };
  await writeFile(configPath, JSON.stringify(config), { flag: "wx", mode: 0o600 });
}
// PostgreSQL Windows initdb cannot reliably decode non-ASCII data paths.
// Use the same directory's native 8.3 alias; never move the user's workspace.
const nativeDirectory = process.platform === "win32" ? execFileSync("powershell.exe", ["-NoProfile", "-Command", "(New-Object -ComObject Scripting.FileSystemObject).GetFolder($env:PHYSICS_DATABASE_PARENT).ShortPath"], {
  encoding: "utf8", windowsHide: true, env: { ...process.env, PHYSICS_DATABASE_PARENT: directory },
}).trim() : directory;
if (process.platform === "win32" && /[^\x00-\x7f]/.test(nativeDirectory)) throw new Error("PostgreSQL needs an ASCII data path or Windows 8.3 aliases enabled. Use DATABASE_URL with an external local PostgreSQL instead.");
const databaseDir = resolve(nativeDirectory, "postgres");
const run = promisify(execFile);
const nativeBin = resolve(nativeDirectory, "..", "node_modules/@embedded-postgres/windows-x64/native/bin");
function control(args: string[]): Promise<void> {
  return new Promise((done, reject) => {
    const child = spawn(resolve(nativeBin, "pg_ctl.exe"), args, { windowsHide: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? done() : reject(new Error(`pg_ctl failed (${code}); inspect .local/postgres.log`)));
  });
}
const database = new EmbeddedPostgres({
  databaseDir, user: "physics", password: config.password, port: config.port,
  persistent: true, authMethod: "scram-sha-256", createPostgresUser: false,
  postgresFlags: ["-h", "127.0.0.1"], initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => undefined, onError: (error) => console.error(String(error)),
});
try { await access(resolve(databaseDir, "PG_VERSION")); }
catch {
  if (process.platform === "win32") {
    const passwordFile = resolve(nativeDirectory, "init-password");
    await writeFile(passwordFile, config.password, { mode: 0o600 });
    try {
      await run(resolve(nativeBin, "initdb.exe"), ["-D", databaseDir, "-U", "physics", "--pwfile", passwordFile,
        "--auth=scram-sha-256", "--encoding=UTF8", "--locale=C", "-L", resolve(nativeBin, "../share")], { windowsHide: true });
    } finally {
      const { unlink } = await import("node:fs/promises");
      await unlink(passwordFile);
    }
  } else await database.initialise();
}
let ownsServer = true;
if (process.platform === "win32") {
  try { await control(["status", "-D", databaseDir]); ownsServer = false; }
  catch { await control(["start", "-D", databaseDir, "-l", resolve(nativeDirectory, "postgres.log"), "-o", `-h 127.0.0.1 -p ${config.port}`, "-w"]); }
} else await database.start();
let stopping = false;
async function stop() {
  if (stopping) return; stopping = true;
  if (ownsServer) {
    if (process.platform === "win32") await control(["stop", "-D", databaseDir, "-m", "fast", "-w"]);
    else await database.stop();
  }
  process.exit(process.exitCode ?? 0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  const admin = database.getPgClient("postgres", "127.0.0.1");
  await admin.connect();
  try {
    if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname='physics_world'")).rowCount) await admin.query("CREATE DATABASE physics_world");
  } finally { await admin.end(); }
  process.env.DATABASE_URL = `postgresql://physics:${config.password}@127.0.0.1:${config.port}/physics_world`;
  const { migrate, pool } = await import("../server/src/db/database");
  try { await migrate(); } finally { await pool.end(); }
  console.log(`PostgreSQL ready on 127.0.0.1:${config.port}; migrations applied. Credentials remain in ignored .local/database.json.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Database setup failed");
  process.exitCode = 1;
  await stop();
}
if (process.argv.includes("--setup")) await stop();
else setInterval(() => {}, 60_000); // Keep the owner alive until SIGINT/SIGTERM stops the cluster.
