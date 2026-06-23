import { Award, Target } from "lucide-react";
import { calculateNetWorth, exportTopicReport, physicsMvp, type GameState } from "@physics-monopoly/shared";

const topicLabels: Record<string, string> = {
  mechanics: "Mechanics",
  electricity: "Electricity",
  waves: "Waves",
  heat: "Heat",
  optics: "Optics",
  modern: "Modern physics",
};

export function ResultSummary({ state }: { state: GameState }): JSX.Element {
  const mvp = physicsMvp(state);
  const ranked = [...state.players].sort((a, b) => calculateNetWorth(state, b.id) - calculateNetWorth(state, a.id));
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-mint/20 p-4">
        <div className="flex items-center gap-2 font-black"><Award className="h-5 w-5" /> Physics MVP: {mvp?.name ?? "-"}</div>
        <p className="mt-1 text-sm text-slate-600">Awarded from correct answers and XP growth.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {ranked.map((player, index) => (
          <div key={player.id} className="rounded-lg bg-white p-4">
            <p className="font-black">#{index + 1} {player.name}</p>
            <p className="text-sm text-slate-600">Net worth ${calculateNetWorth(state, player.id).toLocaleString("th-TH")} · XP {player.xp}</p>
            <div className="mt-3 space-y-2">
              {exportTopicReport(player).map((row) => (
                <div key={row.topic}>
                  <div className="flex justify-between text-xs font-bold"><span>{topicLabels[row.topic]}</span><span>{row.correct}/{row.total} · {row.accuracy}%</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-coral" style={{ width: row.accuracy + "%" }} /></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-600"><Target className="h-4 w-4" /> Use the topic report to pick the next review set.</p>
    </div>
  );
}
