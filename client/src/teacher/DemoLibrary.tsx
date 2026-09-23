import { useEffect, useState } from "react";
import { parseJsonResponse, genericServerErrorTh } from "./safeJson";
import { apiUrl as api } from "../net/colyseus";
export function DemoLibrary({ onCreated }: { onCreated: (id: string) => Promise<void> }): JSX.Element {
  const [sets, setSets] = useState<Array<{ id: string; title: string; grade: number }>>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${api}/api/teacher/demos`, { credentials: "include", signal: controller.signal }).then(async (response) => { if (!response.ok) throw new Error("อ่านคลังตัวอย่างไม่ได้"); setSets((await parseJsonResponse<Array<{ id: string; title: string; grade: number }>>(response)) ?? []); }).catch((error) => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : genericServerErrorTh); });
    return () => controller.abort();
  }, []);
  async function create(id: string): Promise<void> {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${api}/api/teacher/demos/${id}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await parseJsonResponse<{ error?: string; id: string }>(response);
      if (!response.ok) throw new Error(result?.error ?? genericServerErrorTh);
      if (!result) throw new Error(genericServerErrorTh);
      await onCreated(result.id);
    } catch (error) { setError(error instanceof Error ? error.message : "สร้างชุดตัวอย่างไม่ได้"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded bg-white p-5"><h2 className="text-xl font-bold">ชุดฝึกตัวอย่าง — ครูต้องตรวจรับก่อนใช้จริง</h2><p>ชั้นละ 2 หัวข้อ หัวข้อละ 30 ข้อ เป็นโจทย์ฝึกแบบเปลี่ยนค่าตัวเลข ไม่ใช่แบบสอบมาตรฐานหรือหลักฐานว่าสอดคล้องทุกโรงเรียน</p><div className="flex flex-wrap gap-3">{sets.map((set) => <button key={set.id} disabled={busy} className="rounded border p-3 disabled:opacity-40" onClick={() => void create(set.id)}>ม.{set.grade} · {set.title}</button>)}</div>{error ? <p role="alert">{error}</p> : null}</section>;
}
