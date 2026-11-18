import { Crown, Sparkles, WifiOff } from "lucide-react";
import { calculateNetWorth, type GameState, type Player } from "@physics-monopoly/shared";

interface Props {
  state: GameState;
  player: Player;
  active: boolean;
}

const slotAccents = [
  "from-emerald-500 to-teal-700 ring-emerald-400/50",
  "from-amber-400 to-amber-600 ring-amber-300/50",
  "from-pink-500 to-rose-700 ring-pink-400/50",
  "from-sky-400 to-blue-700 ring-sky-300/50",
];

export function PlayerPanel({ state, player, active }: Props): JSX.Element {
  const slot = Math.max(0, state.players.findIndex((item) => item.id === player.id));
  const ownedTiles = state.tiles.filter((tile) => tile.ownerId === player.id);
  const netWorth = state.classroomMode
    ? player.money + (player.invested ?? 0) - (player.supportDebt ?? 0)
    : calculateNetWorth(state, player.id);

  return (
    <div className={`panel player-card rounded-2xl p-3.5 transition-all duration-200 ${active ? "is-active" : ""} ${player.bankrupt ? "opacity-45 grayscale" : ""}`}>
      <div className="flex items-center gap-3">
        <div
          className={`player-symbol grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${slotAccents[slot % 4]} text-xl font-black text-white shadow-md ring-2`}
          aria-label="สัญลักษณ์ผู้เล่น"
        >
          {["△", "□", "⬟", "⬡"][slot % 4]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-black tracking-tight text-slate-900">{player.name}</p>
            {active && !player.bankrupt ? <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" title="ตาปัจจุบัน" /> : null}
            {state.winnerId === player.id ? <Crown className="h-4 w-4 shrink-0 text-amber-500" /> : null}
            {!player.connected ? <WifiOff className="h-4 w-4 shrink-0 text-coral" /> : null}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span>ช่อง {player.tileIndex + 1}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-amber-700"><Sparkles className="h-3 w-3" /> {player.xp} XP</span>
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <span className="player-stat rounded-xl px-2.5 py-2 font-black shadow-sm">
          <small className="uppercase tracking-wider">เงินสด</small>
          <span className="text-sm text-emerald-950">฿{player.money.toLocaleString("th-TH")}</span>
        </span>
        <span className="player-stat rounded-xl px-2.5 py-2 font-black shadow-sm">
          <small className="uppercase tracking-wider">มูลค่ารวม</small>
          <span className="text-sm text-slate-900">฿{netWorth.toLocaleString("th-TH")}</span>
        </span>
      </div>

      {ownedTiles.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1 pt-1" aria-label="โฉนดในครอบครอง">
          {ownedTiles.map((tile) => (
            <span
              key={tile.index}
              title={`${tile.name} (ระดับ ${tile.level ?? 0})`}
              className="inline-block h-2.5 w-4 rounded-sm border border-black/20 shadow-sm"
              style={{ backgroundColor: tile.groupColor ?? "#64748b" }}
            />
          ))}
        </div>
      ) : null}

      {player.inJail ? <p className="mt-2.5 rounded-lg bg-gradient-to-r from-amber-900 to-slate-900 px-2.5 py-1 text-center text-xs font-bold text-amber-200 shadow-inner">⛓️ อยู่ในคุก</p> : null}
    </div>
  );
}
