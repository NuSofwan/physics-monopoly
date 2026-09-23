import { locationById, type GameState } from "@physics-monopoly/shared";

export function AccessibleBoard({ state }: { state: GameState }): JSX.Element {
  return <section className="panel max-h-[65vh] overflow-auto rounded-lg p-4" aria-label="กระดานแบบข้อความ">
    <h2 className="text-lg font-black">กระดาน{locationById(state.mapId).name} · 28 ช่อง</h2>
    <p className="my-2 text-sm">ใช้ข้อมูลห้องเดียวกับกระดาน 3 มิติ ปุ่มทอยและตอบโจทย์อยู่ในแผงเกม</p>
    <ol className="grid gap-2 sm:grid-cols-2">
      {state.tiles.map((tile) => {
        const owner = state.players.find((player) => player.id === tile.ownerId);
        const visitors = state.players.filter((player) => player.tileIndex === tile.index);
        return <li key={tile.index} tabIndex={0} className="focus-ring rounded-lg border border-slate-200 bg-white p-3">
          <strong>{tile.index + 1}. {tile.name}</strong>
          {tile.type === "property" ? <p>ราคา {tile.price?.toLocaleString("th-TH")} · {owner ? `เจ้าของ ${owner.name} · ระดับ ${tile.level ?? 0}` : "ยังไม่มีเจ้าของ"}</p> : null}
          {visitors.length ? <p className="font-bold text-indigo-700">ผู้เล่น: {visitors.map((player) => player.name).join(", ")}</p> : null}
        </li>;
      })}
    </ol>
  </section>;
}
