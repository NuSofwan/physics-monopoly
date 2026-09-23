import { readFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { validateProductionConfig } from "./productionConfig";
// Node 24 native dotenv support. Existing process environment wins.
validateProductionConfig(process.env);
if (process.env.NODE_ENV === "production" && process.env.FREE_PLAY_MODE === "true") {
  console.log("physics_monopoly_free_play_mode", { database: false, teacherFeatures: false, note: "FREE_PLAY_MODE=true: running the legacy free-play game with no database/OIDC configured" });
}
if (process.env.NODE_ENV !== "production") {
  try { loadEnvFile(fileURLToPath(new URL("../../.env", import.meta.url))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
// Imported before the database pool. Never reads dev credentials in production.
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  try {
    const { password, port } = JSON.parse(await readFile(new URL("../../.local/database.json", import.meta.url), "utf8"));
    process.env.DATABASE_URL = `postgresql://physics:${password}@127.0.0.1:${port}/physics_world`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
