import { useEffect, useState } from "react";
import { App } from "../App";
import { assignmentToken, apiUrl } from "../net/colyseus";
export interface ActivitySummary { id: string; title: string; grade: number; topic: string; status: string; rules?: { maps?: string[] } }
export function ActivityEntry(): JSX.Element {
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const token = assignmentToken();
    if (!token) { setError("รูปแบบลิงก์กิจกรรมไม่ถูกต้อง"); return; }
    fetch(`${apiUrl}/api/play/${token}`, { signal: controller.signal })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result as ActivitySummary; })
      .then(setActivity).catch((error) => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);
  if (error) return <main className="p-8"><p role="alert">{error}</p><a href="/" className="underline">กลับหน้าหลัก</a></main>;
  if (!activity) return <p role="status" className="p-8">กำลังตรวจลิงก์กิจกรรม…</p>;
  return <><header className="bg-emerald-100 p-4 text-slate-900"><strong>{activity.title}</strong> · ม.{activity.grade} · {activity.topic}{activity.status !== "open" ? " · ปิดรับผู้เล่นใหม่แล้ว ผู้มี session เดิมกลับเข้าห้องได้" : ""}</header><App activity={activity} /></>;
}
