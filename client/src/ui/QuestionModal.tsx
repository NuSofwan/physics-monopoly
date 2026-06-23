import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { AnswerResult, PendingQuestion } from "@physics-monopoly/shared";
import { sendAnswer } from "../net/colyseus";
import { playSound } from "../audio/sound";
import { EquationText } from "./EquationText";

interface Props {
  pending: PendingQuestion;
  answerResult: AnswerResult | null;
  isMine: boolean;
}

export function QuestionModal({ pending, answerResult, isMine }: Props): JSX.Element {
  const [selected, setSelected] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const secondsLeft = Math.max(0, Math.ceil((pending.deadline - now) / 1000));
  const progress = useMemo(() => {
    const total = pending.question.timeLimitSec * 1000;
    return Math.max(0, Math.min(1, (pending.deadline - now) / total));
  }, [now, pending]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  function choose(index: number): void {
    if (!isMine || selected !== null) return;
    setSelected(index);
    sendAnswer(pending.id, index);
  }

  useEffect(() => {
    if (!answerResult) return;
    playSound(answerResult.correct ? "good" : "bad");
  }, [answerResult]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/68 p-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="panel w-full max-w-2xl rounded-lg p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-coral">{labelForReason(pending.reason)}</p>
            <h2 className="mt-1 text-xl font-black text-ink">โจทย์ฟิสิกส์</h2>
          </div>
          <div className="grid h-16 w-16 place-items-center rounded-full border-8 border-mint bg-white text-lg font-black" style={{ borderColor: `rgba(52, 211, 153, ${0.25 + progress * 0.75})` }}>
            {secondsLeft}
          </div>
        </div>
        <p className="mt-4 text-lg leading-8 text-slate-800">
          <EquationText text={pending.question.prompt} />
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {pending.question.choices.map((choice, index) => {
            const isCorrect = answerResult?.correctChoice === index;
            const isSelected = selected === index;
            const done = Boolean(answerResult);
            return (
              <button
                key={choice}
                disabled={!isMine || done}
                onClick={() => choose(index)}
                className={`focus-ring rounded-lg border px-4 py-3 text-left font-bold transition ${
                  done && isCorrect
                    ? "border-mint bg-mint/20"
                    : done && isSelected
                      ? "border-coral bg-coral/15"
                      : "border-slate-200 bg-white hover:border-gold"
                }`}
              >
                <EquationText text={choice} />
              </button>
            );
          })}
        </div>
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
