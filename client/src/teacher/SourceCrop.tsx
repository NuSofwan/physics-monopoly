import { useState, type FormEvent } from "react";
import { parseJsonResponse, genericServerErrorTh } from "./safeJson";
import { apiUrl as api } from "../net/colyseus";
export function SourceCrop({ revisionId, source, onSaved }: { revisionId: string; source: { documentId: string; page: number }; onSaved: () => void }): JSX.Element {
  const [region, setRegion] = useState({ x: 5, y: 5, width: 90, height: 30 });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const outOfBounds = region.x + region.width > 100 || region.y + region.height > 100;
  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy || outOfBounds) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch(`${api}/api/teacher/question-revisions/${revisionId}/crop`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...source, region: Object.fromEntries(Object.entries(region).map(([key, value]) => [key, value / 100])), alt: form.get("alt"), noAnswer: form.get("noAnswer") === "on" }) });
      const result = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result?.error ?? genericServerErrorTh);
      onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : "บันทึกภาพไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <details className="rounded border bg-slate-50 p-3"><summary className="cursor-pointer font-bold">ตรวจต้นฉบับหน้า {source.page} / ตัดภาพเฉพาะโจทย์</summary>
    <p className="my-2 text-sm">กรอบสีน้ำเงินคือพื้นที่ที่จะส่งให้นักเรียน ปรับพิกัดเป็นร้อยละจากมุมซ้ายบน ต้องไม่ติดตัวเลือกที่บอกคำตอบหรือเฉลย</p>
    <div className="relative"><img className="block w-full" src={`${api}/api/teacher/imports/documents/${source.documentId}/pages/${source.page}`} alt={`ต้นฉบับส่วนตัวของครู หน้า ${source.page}`} /><div aria-hidden="true" className="pointer-events-none absolute border-4 border-blue-600 bg-blue-400/15" style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%` }} /></div>
    <form className="mt-3 space-y-3" onSubmit={(event) => void save(event)}><div className="grid grid-cols-2 gap-2">{([['x','ซ้าย'],['y','บน'],['width','กว้าง'],['height','สูง']] as const).map(([key, label]) => <label key={key}>{label} (%)<input className="block w-full rounded border p-2" type="number" min={key === "x" || key === "y" ? 0 : 1} max={100} step={0.1} required value={region[key]} onChange={(event) => setRegion({ ...region, [key]: Number(event.target.value) })} /></label>)}</div>
      <label className="block">คำอธิบายภาพสำหรับผู้อ่านหน้าจอ<input className="block w-full rounded border p-2" name="alt" maxLength={1000} required /></label>
      <label className="flex items-start gap-2"><input type="checkbox" name="noAnswer" required />ฉันตรวจแล้วว่าภาพนี้ไม่มีเฉลยหรือเครื่องหมายบอกคำตอบ</label>
      {outOfBounds ? <p role="alert" className="text-rose-700">กรอบตัดภาพเกินขอบเขตของภาพต้นฉบับ กรุณาปรับค่าซ้าย/บน/กว้าง/สูงให้อยู่ในขอบเขต 100%</p> : null}
      {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
      <button disabled={busy || outOfBounds} className="rounded bg-blue-800 p-3 text-white disabled:opacity-40">บันทึกภาพและส่งกลับรอตรวจรับ</button>
    </form></details>;
}
