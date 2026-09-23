import { isAbsolute } from "node:path";
export function validateProductionConfig(env:NodeJS.ProcessEnv):void {
  if(env.NODE_ENV!=="production")return;
  // Explicit opt-in: production may run the legacy free-play game (Colyseus
  // room only, no classroom/teacher features) with no database and no OIDC,
  // e.g. Render's free tier. This must be an intentional flag, never inferred
  // from a merely-missing DATABASE_URL, so misconfiguration still fails closed.
  const freePlayOnly=env.FREE_PLAY_MODE==="true";
  if(freePlayOnly&&env.DATABASE_URL?.trim())throw new Error("FREE_PLAY_MODE must not be combined with DATABASE_URL");
  // Free play needs only the CORS allowlist; APP_ORIGIN/API_ORIGIN are teacher-auth
  // settings and are validated only if the operator sets them.
  const required=freePlayOnly
    ?["ALLOWED_ORIGINS"]
    :["DATABASE_URL","APP_ORIGIN","API_ORIGIN","ALLOWED_ORIGINS","OIDC_ISSUER","OIDC_CLIENT_ID","TEACHER_ALLOWED_SUBJECTS","PRIVATE_STORAGE_PATH"];
  const missing=required.filter(key=>!env[key]?.trim());
  if(missing.length)throw new Error(`Production configuration missing: ${missing.join(", ")}`);
  if(env.DEV_TEACHER_AUTH==="true")throw new Error("Demo teacher authentication is forbidden in production");
  for(const key of freePlayOnly?["APP_ORIGIN","API_ORIGIN"]:["APP_ORIGIN","API_ORIGIN","OIDC_ISSUER"]){if(freePlayOnly&&!env[key]?.trim())continue;const url=new URL(env[key]!);if(url.protocol!=="https:")throw new Error(`${key} requires HTTPS`);}
  const origins=env.ALLOWED_ORIGINS!.split(",").map(value=>value.trim());
  if(env.APP_ORIGIN?.trim()&&!origins.includes(env.APP_ORIGIN))throw new Error("APP_ORIGIN must be explicitly allowed");
  if(!freePlayOnly&&!env.APP_ORIGIN?.trim())throw new Error("APP_ORIGIN must be explicitly allowed");
  for(const value of origins){const url=new URL(value);if(url.protocol!=="https:"||url.origin!==value)throw new Error("Allowed origins must be exact HTTPS origins");}
  if(freePlayOnly)return;
  if(!isAbsolute(env.PRIVATE_STORAGE_PATH!))throw new Error("Private storage must be an absolute persistent path");
  const database=new URL(env.DATABASE_URL!);if(!["postgres:","postgresql:"].includes(database.protocol))throw new Error("PostgreSQL is required");
}
