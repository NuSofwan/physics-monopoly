import { useEffect, useRef } from "react";
import { Trophy } from "lucide-react";
import type { GameState } from "@physics-monopoly/shared";
import { ResultSummary } from "./ResultSummary";

/** Long personal reviews remain scrollable and keyboard-contained on a phone. */
export function GameResults({ state }: { state: GameState }): JSX.Element {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = panel.current!;
    root.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const targets = [...root.querySelectorAll<HTMLElement>("button:not(:disabled), summary, a[href], input:not(:disabled), select:not(:disabled)")].filter(item => item.getClientRects().length);
      const first = targets[0], last = targets.at(-1);
      if (!first || !last) { event.preventDefault(); root.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="question-backdrop fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="results-title">
    <div ref={panel} tabIndex={-1} className="panel results-card max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl p-5 sm:p-7">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Trophy className="h-6 w-6"/></div>
      <p className="text-sm font-bold text-sky-800">ผลกิจกรรม</p>
      <h2 id="results-title" className="mb-5 break-words text-2xl font-black">{state.classroomMode ? state.players.length === 1 ? "สรุปการฝึกของคุณ" : `นักพัฒนาเมือง: ${state.players.filter(player => state.winnerIds?.includes(player.id)).map(player => player.name).join(" / ")}` : `Winner: ${state.players.find(player => player.id === state.winnerId)?.name ?? "Unknown"}`}</h2>
      <ResultSummary state={state}/>
      <button className="game-primary mt-5 rounded-lg px-5 py-3 font-bold text-white" onClick={() => window.location.reload()}>Play again</button>
    </div>
  </div>;
}
