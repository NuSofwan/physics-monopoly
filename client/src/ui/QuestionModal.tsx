import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { AnswerResult, PendingQuestion, LearningReceipt } from "@physics-monopoly/shared";
import { sendAnswer, sendNumericAnswer, sendHint, sendReflection, apiUrl } from "../net/colyseus";
import { playSound } from "../audio/sound";
import { EquationText } from "./EquationText";

interface Props {
  receipt?: LearningReceipt | null;
  pending: PendingQuestion;
  answerResult: AnswerResult | null;
  isMine: boolean;
  revealDeadline?: number;
}

export function QuestionModal({ pending, answerResult, isMine, revealDeadline, receipt }: Props): JSX.Element {
  const [selected, setSelected] = useState<number | null>(null);
  const [numericValue, setNumericValue] = useState("");
  const [unit, setUnit] = useState(pending.question.allowedUnits?.[0] ?? "");
  const [now, setNow] = useState(Date.now());
  const panel = useRef<HTMLDivElement>(null);
  const canSubmit = isMine && (!pending.group || receipt?.status === "open" || receipt?.status === "retry_open");
  useEffect(() => {
    if (receipt?.status === "retry_open") { setSelected(null); setNumericValue(""); }
  }, [receipt?.status]);
  const secondsLeft = Math.max(0, Math.ceil(((revealDeadline ?? pending.deadline) - now) / 1000));
  const progress = useMemo(() => {
    const total = (pending.stage==="retry"?20:pending.question.timeLimitSec) * 1000 * (pending.timeMultiplier??1);
    return Math.max(0, Math.min(1, (pending.deadline - now) / total));
  }, [now, pending]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = panel.current;
    const selector = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)";
    (root?.querySelector<HTMLElement>(selector) ?? root)?.focus();
    const keepFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !root) return;
      const buttons = [...root.querySelectorAll<HTMLElement>(selector)];
      const first = buttons[0];
      const last = buttons.at(-1);
      if (!first || !last) { event.preventDefault(); root.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keepFocus);
    return () => { document.removeEventListener("keydown", keepFocus); if (previous?.isConnected) previous.focus(); };
  }, []);

  function choose(index: number): void {
    if (!canSubmit || selected !== null || answerResult || secondsLeft === 0) return;
    setSelected(index);
    sendAnswer(pending.id, index);
  }

  useEffect(() => {
    if (!answerResult) return;
    playSound(answerResult.correct ? "good" : "bad");
  }, [answerResult]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="question-title" className="question-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <motion.div
        ref={panel}
        tabIndex={-1}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="panel question-card max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl p-5 sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-coral">{labelForReason(pending.reason)}</p>
            <h2 id="question-title" className="mt-1 text-2xl font-black text-ink">โจทย์ฟิสิกส์</h2>
          </div>
          <div className="grid h-16 w-16 place-items-center rounded-full border-8 border-mint bg-white text-lg font-black" style={{ borderColor: `rgba(52, 211, 153, ${0.25 + progress * 0.75})` }}>
            <span aria-label={revealDeadline ? `อ่านเฉลยอีก ${secondsLeft} วินาที` : `เหลือ ${secondsLeft} วินาที`}>{secondsLeft}</span>
          </div>
        </div>
        <div className="question-timer-track mt-5"><div style={{width:`${progress*100}%`}}/></div>
        <p className="question-prompt mt-5 rounded-xl p-5 text-lg leading-8 text-slate-800">
          <EquationText text={pending.question.prompt} />
        </p>
        {pending.group ? <div className="mt-3 space-y-2 rounded bg-sky-50 p-3"><p className="font-bold">{pending.repeated ? "รอบทบทวน · แยกผลจากข้อใหม่" : "โจทย์กลุ่ม · ทุกคนตอบบนเครื่องตนเอง"} · {pending.stage === "retry" ? `ช่วงลองใหม่ ${20*(pending.timeMultiplier??1)} วินาที` : pending.stage === "reveal" ? "อ่านวิธีทำ" : "คำตอบครั้งแรก"}</p>
          {receipt?.hint ? <p role="status">คำใบ้: {receipt.hint}</p> : null}
          {receipt?.status === "retry_wait" ? <p role="status">ยังไม่ถูก ลองทบทวนคำใบ้ก่อน ช่วงลองใหม่จะเปิดเมื่อทุกคนส่งครั้งแรกหรือหมดเวลา</p> : null}
          {receipt?.status === "closed" && !answerResult ? <p role="status">บันทึกแล้ว รอเพื่อนปิดคำตอบทั้งหมดก่อนดูเฉลย ใช้เวลานี้จดวิธีคิดของตนเอง</p> : null}
          {!answerResult && receipt?.status === "open" && !receipt.hint ? <button className="rounded border p-3" onClick={() => sendHint(pending.id)}>ขอคำใบ้ (บันทึกการใช้แยกจากความถูกต้อง)</button> : null}
        </div> : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {pending.question.media ? <img className="max-h-72 max-w-full object-contain sm:col-span-2" src={`${apiUrl}${pending.question.media.url}`} alt={pending.question.media.alt} /> : null}
          {pending.question.choices.map((choice, index) => {
            const isCorrect = answerResult?.correctChoice === index;
            const isSelected = selected === index;
            const done = Boolean(answerResult);
            return (
              <button
                key={choice}
                disabled={!canSubmit || done || selected !== null || secondsLeft === 0}
                onClick={() => choose(index)}
                className={`focus-ring answer-option flex items-center gap-3 rounded-xl border px-4 py-3 text-left font-bold transition ${
                  done && isCorrect
                    ? "border-mint bg-mint/20"
                    : done && isSelected
                      ? "border-coral bg-coral/15"
                      : "border-slate-200 bg-white hover:border-gold"
                }`}
              >
                <span aria-hidden="true" className="answer-letter grid h-8 w-8 shrink-0 place-items-center rounded-lg">{String.fromCharCode(65+index)}</span><span><EquationText text={choice} /></span>
              </button>
            );
          })}
        </div>
        {pending.question.kind === "numeric" ? <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit || selected !== null || answerResult || secondsLeft === 0) return;
          if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d{1,3})?$/.test(numericValue.trim()) || !Number.isFinite(Number(numericValue)) || Math.abs(Number(numericValue)) > 1e12) return;
          setSelected(-1); sendNumericAnswer(pending.id, numericValue, unit);
        }}><label>คำตอบตัวเลข<input className="block rounded border p-3" inputMode="decimal" required maxLength={32} value={numericValue} onChange={(event) => setNumericValue(event.target.value)} disabled={!canSubmit || selected !== null || Boolean(answerResult)} pattern="[+\-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+\-]?[0-9]{1,3})?" /></label><label>หน่วย<select aria-label="หน่วย" className="block rounded border p-3" value={unit} onChange={(event) => setUnit(event.target.value)} disabled={!canSubmit || selected !== null || Boolean(answerResult)}>{pending.question.allowedUnits?.map((unit) => <option key={unit}>{unit}</option>)}</select></label><button className="rounded bg-ink p-3 font-bold text-white disabled:opacity-40" disabled={!canSubmit || selected !== null || Boolean(answerResult) || secondsLeft === 0}>ส่งคำตอบตัวเลข</button></form> : null}
        {!isMine ? <p className="mt-4 rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-600">รอผู้เล่นเจ้าของตาตอบโจทย์</p> : null}
        {answerResult ? (
          <div className="mt-5 rounded-lg bg-white p-4">
            <p className={`font-black ${answerResult.correct ? "text-emerald-600" : "text-rose-600"}`}>
              {answerResult.correct ? "ตอบถูก" : "ตอบผิด"} · เงิน {answerResult.moneyDelta >= 0 ? "+" : ""}
              {answerResult.moneyDelta.toLocaleString("th-TH")} · XP +{answerResult.xpDelta}
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              <EquationText text={answerResult.explanation} />
            </p>
            {pending.group ? <button className="mt-3 rounded border p-3 disabled:opacity-50" disabled={receipt?.reflectionSaved} onClick={() => sendReflection(pending.id)}>{receipt?.reflectionSaved ? "เก็บไว้ทบทวนแล้ว" : "อ่านวิธีทำแล้ว · เก็บไว้ทบทวน"}</button> : null}
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

function labelForReason(reason: PendingQuestion["reason"]): string {
  return {
    buy: "ซื้อหรืออัปเกรด",
    challenge: "ช่องท้าทาย",
    jail: "ออกจากคุก",
    chance: "การ์ดโอกาส",
  }[reason];
}
