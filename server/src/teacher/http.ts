import type { Request, Response, NextFunction, RequestHandler } from "express";
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export function route(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => { void handler(req, res).catch(next); };
}
export function text(value: unknown, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new HttpError(400, "ข้อมูลข้อความไม่ถูกต้อง");
  return value.trim();
}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) throw new HttpError(400, "รหัสข้อมูลไม่ถูกต้อง");
  return value;
}
export function grade(value: unknown): number {
  if (![2,4,5].includes(value as number)) throw new HttpError(400, "เลือกระดับ ม.2 ม.4 หรือ ม.5");
  return value as number;
}
export function handleError(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const parserError = error as { type?: string } | null;
  const status = error instanceof HttpError ? error.status : parserError?.type === "entity.too.large" ? 413 : parserError?.type === "entity.parse.failed" ? 400 : 500;
  if (status === 500) console.error("teacher_api_failed", error instanceof Error ? error.name : "UnknownError");
  if (res.headersSent) { _next(error); return; }
  res.status(status).json({ error: error instanceof HttpError ? error.message : status === 400 ? "รูปแบบ JSON ไม่ถูกต้อง" : status === 413 ? "ข้อมูลใหญ่เกินขนาดที่อนุญาต" : "ไม่สามารถดำเนินการได้ กรุณาลองใหม่" });
}
