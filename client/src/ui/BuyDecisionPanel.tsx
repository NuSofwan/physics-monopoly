import { useEffect, useRef, useState } from "react";
import { BUY_DECISION_MS, type Tile } from "@physics-monopoly/shared";

/** Buy/Pass choice with a visible countdown; if the window lapses without a choice, says so instead of silently vanishing. */
export function BuyDecisionPanel({ open, tile, deadline, now, onBuy, onUpgrade, onPass }: { open: boolean; tile: Tile | null | undefined; deadline: number | null; now: number; onBuy: () => void; onUpgrade: () => void; onPass: () => void }): JSX.Element | null {
  const acted = useRef(false), wasOpen = useRef(false), lastTile = useRef<string | null>(null);
  // Length of this decision window (free play 30 s, classroom 15 s), measured from the deadline when it opens.
  const windowMs = useRef<number | null>(null);
  const [expired, setExpired] = useState<string | null>(null);
  if (open && windowMs.current === null && deadline) windowMs.current = Math.max(1000, Math.round((deadline - now) / 1000) * 1000);
  if (open) lastTile.current = tile?.name ?? lastTile.current;
  // Depends only on `open`: the tile prop follows whoever is moving, and must not cancel the expiry notice timer.
  useEffect(() => {
    if (open) { acted.current = false; wasOpen.current = true; setExpired(null); return; }
    if (!wasOpen.current) return;
    wasOpen.current = false; windowMs.current = null;
    if (acted.current || !lastTile.current) return;
    setExpired(lastTile.current);
    const timer = window.setTimeout(() => setExpired(null), 12000);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open || !tile) return expired ? <div role="status" aria-live="polite" className="panel rounded-lg border-l-4 border-coral p-4">
    <p className="font-black text-coral">หมดเวลาตัดสินใจ</p>
    <p className="mt-1 text-sm text-slate-700">ไม่ได้ซื้อ {expired} ในรอบนี้ ครั้งหน้ากด “Buy with quiz” ก่อนหมดเวลา</p>
  </div> : null;

  const seconds = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const total = windowMs.current ?? (deadline ? Math.max(1000, deadline - now) : BUY_DECISION_MS);
  const progress = seconds === null ? 1 : Math.min(1, seconds * 1000 / total);
  const urgent = seconds !== null && seconds <= 10;
  const choose = (action: () => void) => () => { acted.current = true; action(); };
  return <div className="panel rounded-lg p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-black text-coral">{tile.ownerId ? "ทรัพย์สินของคุณ" : "ที่ดินว่าง"}</p>
        <h3 className="mt-1 text-lg font-black">{tile.name}</h3>
      </div>
      {seconds !== null ? <div role="timer" aria-label={`เหลือเวลาตัดสินใจ ${seconds} วินาที`} className={`rounded-lg px-3 py-2 text-center font-black ${urgent ? "bg-coral text-white" : "bg-white text-ink"}`}>{seconds}s</div> : null}
    </div>
    <p className="text-sm text-slate-600">ราคา ฿{(tile.price ?? 0).toLocaleString("th-TH")} · ค่าเช่าเริ่มต้น ฿{(tile.rentByLevel?.[0] ?? 0).toLocaleString("th-TH")}</p>
    {seconds !== null ? <>
      <div className="question-timer-track mt-3"><div style={{ width: `${progress * 100}%` }}/></div>
      <p className={`mt-1 text-xs font-bold ${urgent ? "text-coral" : "text-slate-500"}`}>{urgent ? "ใกล้หมดเวลาแล้ว รีบตัดสินใจ!" : "ตัดสินใจก่อนหมดเวลา ไม่งั้นจะข้ามการซื้อ"}</p>
    </> : null}
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button className="rounded-lg bg-ink px-3 py-2 font-bold text-white" onClick={choose(tile.ownerId ? onUpgrade : onBuy)}>{tile.ownerId ? "Upgrade with quiz" : "Buy with quiz"}</button>
      <button className="rounded-lg bg-white px-3 py-2 font-bold" onClick={choose(onPass)}>Pass</button>
    </div>
  </div>;
}
