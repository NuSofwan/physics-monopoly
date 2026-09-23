import { useEffect, useState, type FormEvent } from "react";
import { EquationText } from "../ui/EquationText";
import { MiniQr } from "../ui/MiniQr";
import { PdfImportPanel } from "./PdfImportPanel";
import { NumericFields } from "./NumericFields";
import { SourceCrop } from "./SourceCrop";
import { RevisionTools } from "./RevisionTools";
import { DemoLibrary } from "./DemoLibrary";
import { LiveRooms } from "./LiveRooms";
import { TeacherReport } from "./TeacherReport";
import { PrivacyControls } from "./PrivacyControls";
import type { NumericKey } from "@physics-monopoly/shared";
import { locations } from "@physics-monopoly/shared";
import { apiUrl as api } from "../net/colyseus";

type Row = { id: string; title: string; grade: number; topic: string; status?: string; question_count?: number };
type Draft = { id: string; body: Record<string, unknown>; answer_key: Record<string, unknown>; approved_at: string | null; review_status?: string; provenance?: { documentId: string; page: number } };
type SetDetail = Row & { questions: Draft[]; versions: Array<{ id: string; version: number }> };
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${api}/api/${path}`, { method, credentials: "include", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let parsed: any;
  try { parsed = text ? JSON.parse(text) : undefined; } catch { parsed = undefined; }
  if (!response.ok) throw new Error(parsed?.error ?? "เซิร์ฟเวอร์ไม่ตอบสนอง ลองใหม่อีกครั้ง");
  if (parsed === undefined) throw new Error("เซิร์ฟเวอร์ไม่ตอบสนอง ลองใหม่อีกครั้ง");
  return parsed as T;
}
const field = "mt-1 w-full rounded border border-slate-300 bg-white p-3";
const button = "rounded bg-slate-900 px-4 py-3 font-bold text-white disabled:opacity-40";
export function TeacherDashboard(): JSX.Element {
  const [teacher, setTeacher] = useState<{ display_name: string } | null>(null);
  const [config, setConfig] = useState({ devEnabled: false, oidcEnabled: false });
  const [classrooms, setClassrooms] = useState<Row[]>([]);
  const [sets, setSets] = useState<Row[]>([]);
  const [assignments, setAssignments] = useState<Row[]>([]);
  const [detail, setDetail] = useState<SetDetail | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [questionKind, setQuestionKind] = useState("choice");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [monitoring, setMonitoring] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    const [classes, questionSets, activities] = await Promise.all([request<Row[]>("teacher/classrooms"), request<Row[]>("teacher/question-sets"), request<Row[]>("teacher/assignments")]);
    setClassrooms(classes); setSets(questionSets); setAssignments(activities);
  }
  async function action(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (error) { setError(error instanceof Error ? error.message : "เกิดข้อผิดพลาด"); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let active = true;
    request<typeof config>("auth/config").then((value) => { if (active) setConfig(value); }).catch((error) => { if (active) setError(error.message); });
    request<{ display_name: string }>("auth/me").then(async (value) => { if (active) { setTeacher(value); await refresh(); } }).catch(() => {});
    return () => { active = false; };
  }, []);
  async function openSet(id: string): Promise<void> { setDetail(await request<SetDetail>(`teacher/question-sets/${id}`)); setEditing(null); setQuestionKind("choice"); }
  const submit = (handler: (form: FormData) => Promise<void>) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = event.currentTarget;
    void action(async () => { await handler(new FormData(form)); });
  };
  const draft = editing ? { ...editing.body, ...editing.answer_key } : {};
  return <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4"><div><a href="/" className="underline">เกมนักเรียน</a><h1 className="text-3xl font-black">พื้นที่ครู — Physics World</h1></div>{teacher ? <button className={button} disabled={busy} onClick={() => void action(async () => { await request("auth/logout", "POST"); setTeacher(null); setDetail(null); setJoinUrl(""); })}>ออกจากระบบ</button> : null}</header>
      {error ? <p role="alert" className="rounded bg-rose-100 p-4 text-rose-900">{error}</p> : null}
      {notice ? <p role="status" className="rounded bg-emerald-100 p-4">{notice}</p> : null}
      {!teacher ? <section className="space-y-4 rounded bg-white p-6"><h2 className="text-xl font-bold">เข้าสู่ระบบครู</h2>
        {config.oidcEnabled ? <a className={button} href={`${api}/api/auth/login`}>เข้าสู่ระบบด้วยบัญชีโรงเรียน</a> : <p>ยังไม่ได้ตั้งค่า OpenID Connect สำหรับใช้งานจริง</p>}
        {config.devEnabled ? <div className="space-y-3"><p>บัญชีตัวอย่างใช้ได้เฉพาะเครื่องพัฒนา ไม่ใช่ระบบเข้าสู่ระบบสำหรับเผยแพร่</p>{["A", "B"].map((name) => <button key={name} className={`${button} mr-3`} disabled={busy} onClick={() => void action(async () => { await request("auth/dev", "POST", { teacher: name }); setTeacher(await request("auth/me")); await refresh(); })}>ครูตัวอย่าง {name}</button>)}</div> : null}
      </section> : <>
        <p>ผู้ใช้: {teacher.display_name} · ข้อมูลเก็บใน PostgreSQL · การแก้โจทย์ไม่เปลี่ยนรุ่นที่เผยแพร่แล้ว</p>
        <PrivacyControls assignments={assignments} sets={sets} onChanged={async()=>{setDetail(null);await refresh();}}/>
        <DemoLibrary onCreated={async (id) => { await refresh(); await openSet(id); }} />
        <section className="grid gap-6 md:grid-cols-2">
          <form className="space-y-3 rounded bg-white p-5" onSubmit={submit(async (form) => { await request("teacher/classrooms", "POST", { title: form.get("title"), grade: Number(form.get("grade")), curriculumTrack: form.get("track"), term: form.get("term"), topic: form.get("topic"), objectives: String(form.get("objectives")).split("\n").filter(Boolean) }); await refresh(); setNotice("สร้างชั้นเรียนแล้ว"); })}>
            <h2 className="text-xl font-bold">สร้างชั้นเรียน</h2>
            <label className="block">ชื่อชั้นเรียน<input name="title" required maxLength={200} className={field} placeholder="ม.2/1" /></label>
            <label className="block">ระดับชั้น<select name="grade" className={field}>{[2,4,5].map((value) => <option key={value} value={value}>ม.{value}</option>)}</select></label>
            <label className="block">หลักสูตร<select name="track" className={field}><option>พื้นฐาน</option><option>เพิ่มเติม</option></select></label>
            <label className="block">ภาคเรียน / ปีการศึกษา<input name="term" required className={field} /></label>
            <label className="block">หน่วยการเรียนรู้<input name="topic" required className={field} /></label>
            <label className="block">เป้าหมาย (บรรทัดละข้อ)<textarea name="objectives" className={field} rows={3} /></label>
            <button disabled={busy} className={button}>บันทึกชั้นเรียน</button>
          </form>
          <div className="space-y-4"><section className="rounded bg-white p-5"><h2 className="text-xl font-bold">ชั้นเรียนของฉัน</h2>{classrooms.length ? <ul>{classrooms.map((row) => <li key={row.id} className="border-b py-3">{row.title} · ม.{row.grade} · {row.topic}</li>)}</ul> : <p>ยังไม่มีชั้นเรียน</p>}</section>
            <form className="space-y-3 rounded bg-white p-5" onSubmit={submit(async (form) => { const created = await request<Row>("teacher/question-sets", "POST", { title: form.get("title"), grade: Number(form.get("grade")), topic: form.get("topic") }); await refresh(); await openSet(created.id); })}>
              <h2 className="text-xl font-bold">สร้างชุดโจทย์</h2><label className="block">ชื่อชุดโจทย์<input name="title" required className={field} /></label>
              <label className="block">ระดับชุดโจทย์<select name="grade" className={field}>{[2,4,5].map((value) => <option key={value} value={value}>ม.{value}</option>)}</select></label>
              <label className="block">หัวข้อชุดโจทย์<input name="topic" required className={field} /></label><button className={button} disabled={busy}>สร้างฉบับร่าง</button>
            </form>
          </div>
        </section>
        <section className="space-y-3 rounded bg-white p-5"><h2 className="text-xl font-bold">ชุดโจทย์ของฉัน</h2><div className="flex flex-wrap gap-3">{sets.map((row) => <button key={row.id} className={button} disabled={busy} onClick={() => void action(() => openSet(row.id))}>{row.title} · ม.{row.grade} ({row.question_count} ข้อ)</button>)}</div></section>
        {detail ? <section className="space-y-5 rounded bg-white p-5"><h2 className="text-2xl font-bold">ตรวจทาน: {detail.title}</h2><PdfImportPanel key={detail.id} setId={detail.id} onRefresh={() => void action(() => openSet(detail.id))} /><RevisionTools key={`tools:${detail.id}`} questions={detail.questions} run={async (operation, ids) => { await request("teacher/question-revisions/restructure", "POST", { operation, ids }); await openSet(detail.id); }} />
          <div className="grid gap-5 lg:grid-cols-2"><form key={`${detail.id}:${editing?.id ?? "new"}`} className="space-y-3" onSubmit={submit(async (form) => {
            const body = { kind: questionKind, numericKey: questionKind === "numeric" ? { value: Number(form.get("numericValue")), unit: String(form.get("numericUnit")), allowedUnits: String(form.get("allowedUnits")).split(",").map((unit) => unit.trim()), absoluteTolerance: Number(form.get("absoluteTolerance")), relativeTolerance: Number(form.get("relativeTolerance")) } : undefined, prompt: form.get("prompt"), choices: String(form.get("choices")).split("\n").filter(Boolean), answerIndex: Number(form.get("answerIndex")) - 1, explanation: form.get("explanation"), hint: form.get("hint"), objective: form.get("objective"), topic: form.get("topic"), difficulty: form.get("difficulty"), timeLimitSec: Number(form.get("timeLimitSec")) };
            await request(editing ? `teacher/question-revisions/${editing.id}` : `teacher/question-sets/${detail.id}/questions`, editing ? "PATCH" : "POST", body); await openSet(detail.id); await refresh(); setNotice("บันทึกฉบับร่างแล้ว ต้องตรวจรับก่อนเผยแพร่");
          })}>
            <h3 className="font-bold">{editing ? "แก้ไขโจทย์ (จะยกเลิกสถานะตรวจรับเดิม)" : "เพิ่มโจทย์ใหม่"}</h3>
            <label className="block">ประเภทโจทย์<select className={field} value={questionKind} onChange={(event) => setQuestionKind(event.target.value)}><option value="choice">เลือกตอบ</option><option value="numeric">ตัวเลขพร้อมหน่วย</option></select></label>
            <label className="block">โจทย์<textarea name="prompt" required defaultValue={String(draft.prompt ?? "")} className={field} rows={3} /></label>
            {questionKind === "choice" ? <><label className="block">ตัวเลือก (บรรทัดละข้อ)<textarea name="choices" required defaultValue={Array.isArray(draft.choices) ? draft.choices.join("\n") : ""} className={field} rows={4} /></label>
            <label className="block">คำตอบที่ถูก (หมายเลข 1–5)<input type="number" min={1} max={5} name="answerIndex" required defaultValue={draft.answerIndex === null ? "" : Number(draft.answerIndex ?? 0) + 1} className={field} /></label></> : <NumericFields value={draft.numericKey as NumericKey | undefined} />}
            <label className="block">เฉลยเป็นขั้นตอน<textarea name="explanation" required defaultValue={String(draft.explanation ?? "")} className={field} rows={3} /></label>
            <label className="block">คำใบ้<input name="hint" required defaultValue={String(draft.hint ?? "")} className={field} /></label>
            <label className="block">ทักษะที่วัด<input name="objective" required defaultValue={String(draft.objective ?? "")} className={field} /></label>
            <label className="block">หมวด<select name="topic" defaultValue={String(draft.topic ?? "mechanics")} className={field}>{["mechanics", "electricity", "waves", "heat", "optics", "modern"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="block">ความยาก<select name="difficulty" defaultValue={String(draft.difficulty ?? "easy")} className={field}>{["easy", "medium", "hard"].map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="block">เวลาตอบ (วินาที)<input name="timeLimitSec" type="number" min={15} max={120} defaultValue={Number(draft.timeLimitSec ?? 45)} className={field} /></label>
            <button className={button} disabled={busy}>บันทึกโจทย์ฉบับร่าง</button>
          </form><div className="space-y-4">{detail.questions.map((question, index) => <article key={question.id} className="space-y-3 rounded border p-4"><h3 className="font-bold">ข้อ {index + 1} · {question.review_status === "REJECTED" ? "พักข้อ — ไม่เผยแพร่" : question.approved_at ? "ตรวจรับแล้ว" : "รอตรวจรับ"}</h3><EquationText text={String(question.body.prompt)} /><ol className="list-inside list-decimal">{(question.body.choices as string[]).map((choice) => <li key={choice}><EquationText text={choice} /></li>)}</ol><p>เฉลย: {question.body.kind === "numeric" ? `${(question.answer_key.numericKey as NumericKey | undefined)?.value ?? "ยังไม่ระบุ"} ${(question.answer_key.numericKey as NumericKey | undefined)?.unit ?? ""}` : `ข้อ ${Number(question.answer_key.answerIndex) + 1}`}</p><EquationText text={String(question.answer_key.explanation)} />{question.body.media ? <img className="max-h-64 object-contain" src={`${api}/api/teacher/question-revisions/${question.id}/media`} alt={String((question.body.media as { alt: string }).alt)} /> : null}{question.provenance?.documentId ? <SourceCrop revisionId={question.id} source={question.provenance} onSaved={() => void action(() => openSet(detail.id))} /> : null}<div className="flex gap-2"><button className={button} disabled={busy} onClick={() => { setEditing(question); setQuestionKind(String(question.body.kind ?? "choice")); }}>แก้ไข</button><button className={button} disabled={busy || Boolean(question.approved_at)} onClick={() => void action(async () => { await request(`teacher/question-revisions/${question.id}/approve`, "POST", {}); await openSet(detail.id); })}>ยืนยันตรวจรับ</button></div></article>)}</div></div>
          <button className={button} disabled={busy || detail.questions.filter((item) => item.approved_at).length < 10} onClick={() => void action(async () => { await request(`teacher/question-sets/${detail.id}/publish`, "POST", {}); await openSet(detail.id); setNotice("เผยแพร่เป็นรุ่นถาวรแล้ว"); })}>เผยแพร่รุ่นใหม่ (อย่างน้อย 10 ข้อที่ตรวจรับ)</button>
          {detail.versions.length ? <form className="space-y-3 border-t pt-5" onSubmit={submit(async (form) => { const assignment = await request<{ joinUrl: string }>("teacher/assignments", "POST", { title: form.get("title"), classroomId: form.get("classroomId"), versionId: form.get("versionId"), durationMinutes: Number(form.get("durationMinutes")), maps: form.getAll("maps"), questionTimeMultiplier: Number(form.get("questionTimeMultiplier")) }); setJoinUrl(assignment.joinUrl); await refresh(); })}><h3 className="text-xl font-bold">สร้างกิจกรรมจากรุ่นที่เผยแพร่</h3><label className="block">ชื่อกิจกรรม<input name="title" required className={field} /></label><label className="block">ชั้นเรียนกิจกรรม<select name="classroomId" className={field}>{classrooms.filter((row) => row.grade === detail.grade).map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label><label className="block">รุ่นชุดโจทย์<select name="versionId" className={field}>{detail.versions.map((version) => <option key={version.id} value={version.id}>รุ่น {version.version}</option>)}</select></label><label className="block">ระยะเวลา<select name="durationMinutes" defaultValue="30" className={field}>{[15,20,30,40].map((minutes) => <option key={minutes} value={minutes}>{minutes} นาที</option>)}</select></label><label className="block">เวลาเสริมสำหรับอ่านและตอบ (ทั้งห้อง ใช้โจทย์และคะแนนเดิม)<select name="questionTimeMultiplier" className={field} defaultValue="1"><option value="1">ปกติ</option><option value="1.5">1.5 เท่า</option><option value="2">2 เท่า</option></select></label><fieldset className="grid gap-2 sm:grid-cols-3"><legend>สถานที่ที่อนุญาต (เลือกอย่างน้อยหนึ่งแห่ง)</legend>{locations.map(location=><label key={location.id}><input type="checkbox" name="maps" value={location.id} defaultChecked/> {location.name}</label>)}</fieldset><button className={button} disabled={busy || !classrooms.some((row) => row.grade === detail.grade)}>สร้างลิงก์กิจกรรม</button></form> : null}
        </section> : null}
        {joinUrl ? <section className="space-y-3 rounded bg-emerald-50 p-5"><h2 className="font-bold">ลิงก์กิจกรรม — เก็บลิงก์นี้ไว้</h2><a href={joinUrl} className="break-all underline">{joinUrl}</a><MiniQr value={joinUrl} /><p>URL localhost เปิดได้เฉพาะเครื่องนี้ การทดสอบอีกอุปกรณ์ต้องตั้ง APP_ORIGIN เป็น LAN หรือ staging ที่เข้าถึงได้</p></section> : null}
        <section className="rounded bg-white p-5"><h2 className="text-xl font-bold">กิจกรรมของฉัน</h2>{assignments.map((row) => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3"><span>{row.title} · {row.status}</span><button className={button} onClick={() => setMonitoring(monitoring === row.id ? null : row.id)}>ดูห้อง / ควบคุม</button><button className={button} disabled={busy || row.status !== "open"} onClick={() => void action(async () => { await request(`teacher/assignments/${row.id}/close-entry`, "POST", {}); await refresh(); })}>ปิดรับผู้เล่นใหม่</button>{monitoring === row.id ? <><LiveRooms assignmentId={row.id} /><TeacherReport assignmentId={row.id} /></> : null}</article>)}</section>
      </>}
    </div>
  </main>;
}
