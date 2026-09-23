import { useEffect, useState } from "react";
import { parseJsonResponse, genericServerErrorTh } from "./safeJson";
import { apiUrl as api } from "../net/colyseus";
export function LiveRooms({ assignmentId }: { assignmentId: string }): JSX.Element {
  const [rooms, setRooms] = useState<Array<{ id: string; room_code: string; status: string; updated_at: string }>>([]);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let timer: number | undefined;
    const refresh = async () => {
      try {
        const response = await fetch(`${api}/api/teacher/assignments/${assignmentId}/rooms`, { credentials: "include", signal: controller.signal });
        const result = await parseJsonResponse<Array<{ id: string; room_code: string; status: string; updated_at: string }> & { error?: string }>(response);
        if (!response.ok) throw new Error((result as { error?: string } | undefined)?.error ?? genericServerErrorTh);
        if (!result) throw new Error(genericServerErrorTh);
        setRooms(result as Array<{ id: string; room_code: string; status: string; updated_at: string }>);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "อ่านห้องไม่ได้"); }
      if (!controller.signal.aborted) timer = window.setTimeout(refresh, 3000);
    };
    void refresh(); return () => { controller.abort(); window.clearTimeout(timer); };
  }, [assignmentId]);
  async function control(id: string, command: string): Promise<void> {
    if (busy) return;
    if (command === "end" && !window.confirm("จบห้องนี้ทันที? ข้อที่ยังตอบไม่เสร็จจะเป็น interrupted ไม่ใช่ตอบผิด")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${api}/api/teacher/assignments/${assignmentId}/rooms/${id}/control`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command }) });
      const result = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) throw new Error(result?.error ?? genericServerErrorTh);
    } catch (error) { setError(error instanceof Error ? error.message : "สั่งห้องไม่ได้"); }
    finally { setBusy(false); }
  }
  return <section className="w-full rounded bg-slate-50 p-3"><h3 className="font-bold">ห้องในกิจกรรม (อัปเดตทุก 3 วินาที)</h3>{rooms.length === 0 ? <p>ยังไม่มีห้อง</p> : rooms.map((room) => <div key={room.id} className="flex flex-wrap items-center gap-3 border-b py-3"><span>{room.room_code} · {room.status}</span>{([['pause','พักเกม'],['resume','เล่นต่อ'],['end','จบทันที']] as const).map(([command,label]) => <button key={command} className="rounded border p-2 disabled:opacity-40" disabled={busy || ["game_over","abandoned","interrupted"].includes(room.status)} onClick={() => void control(room.id, command)}>{label}</button>)}</div>)}{error ? <p role="alert" className="text-rose-700">{error}</p> : null}</section>;
}
