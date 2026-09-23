import { useState } from "react";
type Revision = { id: string; body: Record<string, unknown>; review_status?: string };
export function RevisionTools({ questions, run }: { questions: Revision[]; run: (operation: string, ids: string[]) => Promise<void> }): JSX.Element {
  const [ids, setIds] = useState<string[]>([]), [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function execute(operation: string): Promise<void> {
    if (busy) return;
    setBusy(true); setError("");
    try { await run(operation, ids); setIds([]); }
    catch (error) { setError(error instanceof Error ? error.message : "จัดข้อไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <details className="rounded border p-4"><summary className="cursor-pointer font-bold">แยกข้อ / รวมข้อคร่อมหน้า / พักข้อที่ไม่ใช้</summary>
    <p className="my-3">แยกข้อจะสร้างร่าง 2 ส่วนให้แก้ข้อความและตัวเลือกเอง รวมข้อจะต่อข้อความตามลำดับในชุด ทั้งสองแบบต้องกรอกเฉลยและตรวจรับใหม่ ต้นฉบับเดิมถูกพักแต่ไม่ลบทิ้ง</p>
    <div className="max-h-72 overflow-auto">{questions.filter((q) => q.review_status !== "REJECTED").map((q) => <label key={q.id} className="flex gap-3 border-b p-2"><input type="checkbox" checked={ids.includes(q.id)} onChange={(event) => setIds(event.target.checked ? [...ids, q.id] : ids.filter((id) => id !== q.id))} />{String(q.body.prompt).slice(0, 140)}</label>)}</div>
    <div className="mt-3 flex flex-wrap gap-3">{([['split','แยกเป็น 2 ร่าง'],['merge','รวมข้อที่เลือก'],['reject','พักข้อที่เลือก']] as const).map(([operation,label]) => <button key={operation} className="rounded border p-3 disabled:opacity-40" disabled={busy || ids.length < 1 || ids.length > 5 || (operation === "split" && ids.length !== 1) || (operation === "merge" && ids.length < 2)} onClick={() => void execute(operation)}>{label}</button>)}</div>
    {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
  </details>;
}
