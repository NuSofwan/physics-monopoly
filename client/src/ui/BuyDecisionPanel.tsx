import { useEffect, useRef, useState } from "react";
import { BUY_DECISION_MS, type Tile } from "@physics-monopoly/shared";

/** Buy/Pass choice with a visible countdown; if the window lapses without a choice, says so instead of silently vanishing. */
export function BuyDecisionPanel({ open, tile, deadline, now, onBuy, onUpgrade, onPass }: { open: boolean; tile: Tile | null | undefined; deadline: number | null; now: number; onBuy: () => void; onUpgrade: () => void; onPass: () => void }): JSX.Element | null {
  const acted = useRef(false), wasOpen = useRef(false), lastTile = useRef<string | null>(null);
  const [expired, setExpired] = useState<string | null>(null);
  useEffect(() => {
    if (open) { acted.current = false; wasOpen.current = true; lastTile.current = tile?.name ?? null; setExpired(null); return; }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    if (acted.current || !lastTile.current) return;
    setExpired(lastTile.current);
    const timer = window.setTimeout(() => setExpired(null), 12000);
    return () => window.clearTimeout(timer);
  }, [open, tile?.name]);

  if (!open || !tile) return expired ? <div role="status" aria-live="polite" className="panel rounded-lg border-l-4 border-coral p-4">
    <p className="font-black text-coral">หมดเวลาตัดสินใจ</p>
    <p className="mt-1 text-sm text-slate-700">ไม่ได้ซื้อ {expired} ในรอบนี้ ครั้งหน้ากด “Buy with quiz” ภายใน {BUY_DECISION_MS / 1000} วินาที</p>
  </div> : null;

  const seconds = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const progress = seconds === null ? 1 : Math.min(1, seconds * 1000 / BUY_DECISION_MS);
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
    <p className="text-sm text-slate-600">Price ${tile.price?.toLocaleString("th-TH")} · Base rent ${tile.rentByLevel?.[0]}</p>
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
