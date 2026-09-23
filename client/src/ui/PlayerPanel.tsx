import { Crown, WifiOff } from "lucide-react";
import { calculateNetWorth, type GameState, type Player } from "@physics-monopoly/shared";

interface Props {
  state: GameState;
  player: Player;
  active: boolean;
}

export function PlayerPanel({ state, player, active }: Props): JSX.Element {
  return (
    <div className={`panel rounded-lg p-3 transition ${active ? "ring-4 ring-gold" : ""} ${player.bankrupt ? "opacity-45" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-ink text-xl font-black text-white" aria-label="สัญลักษณ์ผู้เล่น">{["△","□","⬟","⬡"][state.players.findIndex(item=>item.id===player.id)%4]}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-black">{player.name}</p>
            {state.winnerId === player.id ? <Crown className="h-4 w-4 text-gold" /> : null}
            {!player.connected ? <WifiOff className="h-4 w-4 text-coral" /> : null}
          </div>
          <p className="text-xs text-slate-500">ช่อง {player.tileIndex} · XP {player.xp}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <span className="rounded-md bg-white px-2 py-1 font-bold">฿{player.money.toLocaleString("th-TH")}</span>
        <span className="rounded-md bg-white px-2 py-1 font-bold">มูลค่า ฿{(state.classroomMode ? player.money + (player.invested ?? 0) - (player.supportDebt ?? 0) : calculateNetWorth(state, player.id)).toLocaleString("th-TH")}</span>
      </div>
      {player.inJail ? <p className="mt-2 rounded-md bg-ink px-2 py-1 text-xs font-bold text-white">อยู่ในคุก</p> : null}
    </div>
  );
}
