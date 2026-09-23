import { Banknote, Landmark } from "lucide-react";
import { mortgageValue, type GameState } from "@physics-monopoly/shared";
import { sendSellProperty } from "../net/colyseus";

interface Props {
  state: GameState;
  playerId: string | null;
}

export function PropertyPortfolio({ state, playerId }: Props): JSX.Element {
  const owned = state.tiles.filter((tile) => tile.ownerId === playerId);
  return (
    <div className="panel rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-black">Portfolio{owned.length > 0 ? ` (${owned.length})` : ""}</h3>
        <Landmark className="h-4 w-4 text-slate-500" />
      </div>
      <div className="mt-3 grid max-h-64 gap-2 overflow-auto">
        {owned.length === 0 ? <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500">No properties yet.</p> : null}
        {owned.map((tile) => (
          <div key={tile.index} className="rounded-lg bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-black">{tile.name}</p>
                <p className="text-xs text-slate-500">Level {tile.level ?? 0} · Rent ${tile.rentByLevel?.[tile.level ?? 0]?.toLocaleString("th-TH")}</p>
              </div>
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: tile.groupColor }} />
            </div>
            {!state.classroomMode ? <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-ink" onClick={() => sendSellProperty(tile.index)}>
              <Banknote className="h-4 w-4" /> Sell ${mortgageValue(tile).toLocaleString("th-TH")}
            </button> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
