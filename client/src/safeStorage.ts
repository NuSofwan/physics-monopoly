/**
 * Web Storage that never throws. Blocked cookies, some LMS iframes and older private browsing modes make
 * `localStorage`/`sessionStorage` throw on access; the game must keep working (just without persistence).
 */
type Area = "local" | "session";

function area(kind: Area): Storage | null {
  try { return kind === "local" ? window.localStorage : window.sessionStorage; } catch { return null; }
}

export function storageGet(kind: Area, key: string): string | null {
  try { return area(kind)?.getItem(key) ?? null; } catch { return null; }
}

export function storageSet(kind: Area, key: string, value: string): void {
  try { area(kind)?.setItem(key, value); } catch { /* storage unavailable or full: keep playing without it */ }
}

export function storageRemove(kind: Area, key: string): void {
  try { area(kind)?.removeItem(key); } catch { /* storage unavailable */ }
}

/** Parses a fetch response as JSON, turning HTML error pages (e.g. a cold-starting server) into a readable Thai error. */
export async function readJson<T>(response: Response): Promise<T> {
  try { return (await response.json()) as T; }
  catch { throw new Error(response.ok ? "เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง กรุณาลองใหม่" : `เซิร์ฟเวอร์ยังไม่พร้อม (${response.status}) กรุณารอสักครู่แล้วลองใหม่`); }
}
