import { Banknote, Building, Home, Hotel, Landmark } from "lucide-react";
import { mortgageValue, type GameState } from "@physics-monopoly/shared";
import { sendSellProperty } from "../net/colyseus";

interface Props {
  state: GameState;
  playerId: string | null;
}

const levelLabels = ["ที่ดินเปล่า", "บ้าน 1 หลัง", "บ้านคู่ / คอนโด", "โรงแรมแกรนด์"];

export function PropertyPortfolio({ state, playerId }: Props): JSX.Element {
  const owned = state.tiles.filter((tile) => tile.ownerId === playerId);
  return (
    <div className="panel rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-amber-800/80">TITLE DEEDS</p>
          <h3 className="font-black text-slate-900">โฉนดทรัพย์สิน{owned.length > 0 ? ` (${owned.length})` : ""}</h3>
        </div>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100/80 text-amber-800">
          <Landmark className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 grid max-h-64 gap-2.5 overflow-auto pr-0.5">
        {owned.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-4 text-center text-sm text-slate-500">
            ยังไม่มีโฉนดในครอบครอง
          </div>
        ) : null}
        {owned.map((tile) => {
          const lvl = Math.min(3, tile.level ?? 0);
          return (
            <div key={tile.index} className="deed-card overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
              <div
                className="flex items-center justify-between px-3 py-1.5 text-white"
                style={{ backgroundColor: tile.groupColor ?? "#475569" }}
              >
                <span className="text-[10px] font-black uppercase tracking-widest opacity-90">TITLE DEED · ช่อง {tile.index + 1}</span>
                <span className="rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-bold">
                  {lvl === 3 ? "🏨 HOTEL" : lvl > 0 ? `🏠 ×${lvl}` : "LAND"}
                </span>
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-slate-900">{tile.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-slate-600">
                      {lvl === 3 ? <Hotel className="h-3.5 w-3.5 text-rose-600" /> : lvl === 2 ? <Building className="h-3.5 w-3.5 text-emerald-700" /> : <Home className="h-3.5 w-3.5 text-emerald-600" />}
                      <span>{levelLabels[lvl]} · ค่าเช่า <strong className="text-slate-900">฿{tile.rentByLevel?.[lvl]?.toLocaleString("th-TH")}</strong></span>
                    </p>
                  </div>
                </div>
                {!state.classroomMode ? (
                  <button
                    className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs font-black text-rose-900 hover:bg-rose-100"
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent("physics-monopoly:cinematic", { detail: { kind: "mortgaged", tileIndex: tile.index } }));
                      sendSellProperty(tile.index);
                    }}
                  >
                    <Banknote className="h-3.5 w-3.5" /> จำนอง / ขายคืน ฿{mortgageValue(tile).toLocaleString("th-TH")}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
