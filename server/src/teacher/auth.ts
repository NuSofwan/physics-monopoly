import { Router, type Request, type Response, type RequestHandler } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import * as oidc from "openid-client";
import { pool, tokenHash } from "../db/database";
import { HttpError, route } from "./http";

const sessionCookie = "physics_teacher";
const production = process.env.NODE_ENV === "production";
const frontend = process.env.APP_ORIGIN ?? "http://localhost:5173";
const apiOrigin = process.env.API_ORIGIN ?? "http://localhost:2567";
const origins = (process.env.ALLOWED_ORIGINS ?? `${frontend},http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174`).split(",").map((item) => item.trim());
const devEnabled = !production && process.env.DEV_TEACHER_AUTH === "true";
const cookieOptions = { httpOnly: true, secure: production, sameSite: "lax" as const, path: "/" };
const pending = new Map<string, { verifier: string; nonce: string; expires: number }>();
const loginWindows = new Map<string, { count: number; until: number }>();
let provider: Promise<oidc.Configuration> | undefined;
function providerConfig(): Promise<oidc.Configuration> {
  if (!process.env.OIDC_ISSUER || !process.env.OIDC_CLIENT_ID) throw new HttpError(503, "ยังไม่ได้ตั้งค่า OpenID Connect");
  return provider ??= oidc.discovery(new URL(process.env.OIDC_ISSUER), process.env.OIDC_CLIENT_ID, process.env.OIDC_CLIENT_SECRET);
}
function cookie(req: Request, name: string): string | undefined {
  return req.headers.cookie?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1);
}
export const protectOrigin: RequestHandler = (req, _res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && (!req.headers.origin || !origins.includes(req.headers.origin))) {
    next(new HttpError(403, "Origin ไม่ได้รับอนุญาต")); return;
  }
  next();
};
function limitLogin(req: Request): void {
  const now = Date.now();
  for (const [key, value] of loginWindows) if (value.until < now) loginWindows.delete(key);
  const key = req.ip ?? "unknown";
  const entry = loginWindows.get(key) ?? { count: 0, until: now + 60_000 };
  if (loginWindows.size >= 1000 || ++entry.count > 20) throw new HttpError(429, "กรุณารอสักครู่ก่อนเข้าสู่ระบบใหม่");
  loginWindows.set(key, entry);
}
export const teacherSession: RequestHandler = (req, res, next) => {
  Promise.resolve((async () => {
    const token = cookie(req, sessionCookie);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new HttpError(401, "กรุณาเข้าสู่ระบบครู");
    const result = await pool.query("SELECT t.id,t.display_name FROM teacher_sessions s JOIN teachers t ON t.id=s.teacher_id WHERE s.token_hash=$1 AND s.expires_at>now()", [tokenHash(token)]);
    if (!result.rowCount) throw new HttpError(401, "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
    res.locals.teacher = result.rows[0];
  })()).then(() => next(), next);
};
async function establish(res: Response, subject: string, displayName: string): Promise<void> {
  const teacher = await pool.query("INSERT INTO teachers(id,auth_subject,display_name) VALUES($1,$2,$3) ON CONFLICT(auth_subject) DO UPDATE SET display_name=excluded.display_name RETURNING id", [randomUUID(), subject, displayName.slice(0, 120)]);
  const token = randomBytes(32).toString("base64url");
  await pool.query("DELETE FROM teacher_sessions WHERE expires_at<now()");
  await pool.query("INSERT INTO teacher_sessions(token_hash,teacher_id,expires_at) VALUES($1,$2,now()+interval '12 hours')", [tokenHash(token), teacher.rows[0].id]);
  res.cookie(sessionCookie, token, { ...cookieOptions, maxAge: 12 * 3600_000 });
}
export const authRouter = Router();
authRouter.use(protectOrigin);
authRouter.get("/config", (_req, res) => res.json({ devEnabled, oidcEnabled: Boolean(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID) }));
authRouter.post("/dev", route(async (req, res) => {
  // Use the actual socket address, never req.ip: req.ip can be derived from the
  // client-supplied X-Forwarded-For header when trust proxy is enabled, which would
  // let a LAN client spoof "127.0.0.1" and obtain a teacher session. Also refuse
  // outright when a forwarded-for header is present, so this invariant never depends
  // on whether trust proxy happens to be configured.
  const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
  if (!devEnabled || !loopback || req.headers["x-forwarded-for"]) throw new HttpError(404, "ไม่พบเส้นทาง");
  limitLogin(req);
  if (!["A", "B"].includes(req.body?.teacher)) throw new HttpError(400, "เลือกครูตัวอย่าง A หรือ B");
  await establish(res, `dev:${req.body.teacher}`, `ครูตัวอย่าง ${req.body.teacher}`);
  res.json({ ok: true, developmentOnly: true });
}));
authRouter.get("/login", route(async (req, res) => {
  limitLogin(req);
  if (production && (!frontend.startsWith("https://") || !apiOrigin.startsWith("https://"))) throw new HttpError(503, "Production authentication requires HTTPS origins");
  for (const [key, value] of pending) if (value.expires < Date.now()) pending.delete(key);
  if (pending.size >= 1000) throw new HttpError(429, "กรุณาลองใหม่ภายหลัง");
  const state = oidc.randomState();
  const verifier = oidc.randomPKCECodeVerifier();
  const nonce = oidc.randomNonce();
  pending.set(state, { verifier, nonce, expires: Date.now() + 300_000 });
  res.cookie("physics_oidc", state, { ...cookieOptions, maxAge: 300_000 });
  const authorization = oidc.buildAuthorizationUrl(await providerConfig(), {
    redirect_uri: `${apiOrigin}/api/auth/callback`, scope: "openid profile", state, nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: "S256",
  });
  res.redirect(authorization.href);
}));
authRouter.get("/callback", route(async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const attempt = pending.get(state);
  pending.delete(state);
  if (!attempt || attempt.expires < Date.now() || cookie(req, "physics_oidc") !== state) throw new HttpError(401, "Login state ไม่ถูกต้องหรือหมดอายุ");
  res.clearCookie("physics_oidc", cookieOptions);
  const tokens = await oidc.authorizationCodeGrant(await providerConfig(), new URL(req.originalUrl, apiOrigin), {
    pkceCodeVerifier: attempt.verifier, expectedState: state, expectedNonce: attempt.nonce, idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims?.sub || !(process.env.TEACHER_ALLOWED_SUBJECTS ?? "").split(",").map((value) => value.trim()).includes(claims.sub)) throw new HttpError(403, "บัญชีนี้ยังไม่ได้รับสิทธิ์ครู");
  await establish(res, `${process.env.OIDC_ISSUER}|${claims.sub}`, typeof claims.name === "string" ? claims.name : "ครู");
  res.redirect(`${frontend}/teacher`);
}));
authRouter.get("/me", teacherSession, (_req, res) => res.json(res.locals.teacher));
authRouter.post("/logout", route(async (req, res) => {
  const token = cookie(req, sessionCookie);
  if (token) await pool.query("DELETE FROM teacher_sessions WHERE token_hash=$1", [tokenHash(token)]);
  res.clearCookie(sessionCookie, cookieOptions).json({ ok: true });
}));
