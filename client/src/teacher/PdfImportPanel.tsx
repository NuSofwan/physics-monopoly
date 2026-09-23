import { useEffect, useState, type FormEvent } from "react";
import { parseJsonResponse, genericServerErrorTh } from "./safeJson";
import { apiUrl as api } from "../net/colyseus";
type Job = { id: string; status: string; progress: number; error?: string; document_id: string; filename: string; pages: Array<{ page: number; method: string; extracted_text: string }> };
export function PdfImportPanel({ setId, onRefresh }: { setId: string; onRefresh: () => void }): JSX.Element {
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${api}/api/teacher/imports/sets/${setId}`, { credentials: "include", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("อ่านประวัตินำเข้าไม่สำเร็จ");
      const jobs = (await parseJsonResponse<Array<{ id: string }>>(response)) ?? []; if (jobs[0]) setJobId(jobs[0].id);
    }).catch((error) => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [setId]);
  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    let timer: number | undefined;
    const poll = async () => {
      try {
        const response = await fetch(`${api}/api/teacher/imports/jobs/${jobId}`, { credentials: "include", signal: controller.signal });
        const result = await parseJsonResponse<Job>(response);
        if (!response.ok) throw new Error(result?.error ?? genericServerErrorTh);
        if (!result) throw new Error(genericServerErrorTh);
        setJob(result);
        if (["queued", "running"].includes(result.status)) timer = window.setTimeout(poll, 1000);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "อ่านสถานะไม่ได้"); }
    };
    void poll();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [jobId, revision]);
  async function control(action: "cancel" | "retry"): Promise<void> {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${api}/api/teacher/imports/jobs/${jobId}/${action}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result?.error ?? genericServerErrorTh);
      setRevision((value) => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : "ดำเนินการไม่ได้"); }
    finally { setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    const body = new FormData(event.currentTarget);
    const file = body.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 20 * 1024 * 1024) { setError("เลือก PDF ขนาดไม่เกิน 20 MB"); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`${api}/api/teacher/imports/${setId}`, { method: "POST", credentials: "include", body });
      const result = await parseJsonResponse<{ error?: string; jobId: string }>(response);
      if (!response.ok) throw new Error(result?.error ?? genericServerErrorTh);
      if (!result) throw new Error(genericServerErrorTh);
      setJob(null); setPage(1); setJobId(result.jobId);
    } catch (error) { setError(error instanceof Error ? error.message : "อัปโหลดไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  const selected = job?.pages.find((item) => item.page === page);
  return <section className="space-y-4 rounded border border-slate-300 bg-slate-50 p-4">
    <h3 className="text-xl font-bold">นำเข้า PDF</h3>
    <p>ครั้งละ 1 ไฟล์ ไม่เกิน 20 MB / 80 หน้า · OCR ภาษาไทย/อังกฤษในเครื่อง · ต้องตรวจต้นฉบับ ตัวเลือก เฉลย และคำใบ้ก่อนเผยแพร่</p>
    <form className="flex flex-wrap items-center gap-3" onSubmit={(event) => void upload(event)}><label>ไฟล์ PDF<input className="block p-3" name="file" type="file" accept="application/pdf" required /></label><button disabled={busy} className="rounded bg-slate-900 p-3 text-white disabled:opacity-40">{busy ? "กำลังส่งไฟล์…" : "อัปโหลดและอ่าน PDF"}</button></form>
    {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
    {job ? <div className="space-y-3"><p role="status">{job.filename} · {job.status} · {job.progress}%</p>{job.error ? <p role="alert" className="text-rose-700">{job.error}</p> : null}
      {["queued", "running"].includes(job.status) ? <button disabled={busy} className="rounded border p-3" onClick={() => void control("cancel")}>ยกเลิกงานนำเข้า</button> : null}
      {["failed", "cancelled"].includes(job.status) ? <button disabled={busy} className="rounded border p-3" onClick={() => void control("retry")}>ลองประมวลผลใหม่</button> : null}
      {job.status === "review" ? <><p className="rounded bg-amber-100 p-3">อ่านไฟล์แล้ว แต่ยังไม่ถือว่าข้อความหรือเฉลยถูกต้อง หากหลายคอลัมน์/รูปแบบซับซ้อนให้แก้หรือเพิ่มข้อด้วยมือจากภาพต้นฉบับ</p><button className="rounded bg-slate-900 p-3 text-white" onClick={onRefresh}>โหลดโจทย์จาก PDF เพื่อตรวจทาน</button>
        <label className="block">หน้าต้นฉบับ<select className="ml-3 rounded border p-3" value={page} onChange={(event) => setPage(Number(event.target.value))}>{job.pages.map((item) => <option key={item.page} value={item.page}>หน้า {item.page} · {item.method}</option>)}</select></label>
        {selected?.method === "manual_required" ? <p role="alert">หน้านี้ต้องถอดข้อความด้วยมือ ยังไม่ได้นับว่า OCR สำเร็จ</p> : null}
        <div className="grid gap-4 lg:grid-cols-2"><img className="w-full rounded border" src={`${api}/api/teacher/imports/documents/${job.document_id}/pages/${page}`} alt={`ต้นฉบับ PDF หน้า ${page}`} /><div><h4 className="font-bold">ข้อความที่อ่านได้ (ใช้ตรวจเทียบ ไม่ใช่คำตอบรับรอง)</h4><pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-sm">{selected?.extracted_text}</pre></div></div>
      </> : null}</div> : null}
  </section>;
}
