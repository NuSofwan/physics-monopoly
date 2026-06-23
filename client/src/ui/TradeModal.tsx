import { useState } from "react";
import type { GameState } from "@physics-monopoly/shared";
import { sendTrade } from "../net/colyseus";

interface Props {
  state: GameState;
  myId: string;
  onClose: () => void;
}

export function TradeModal({ state, myId, onClose }: Props): JSX.Element {
  const myProperties = state.tiles.filter((tile) => tile.ownerId === myId);
  const targets = state.players.filter((player) => player.id !== myId && !player.bankrupt);
  const [tileIndex, setTileIndex] = useState(myProperties[0]?.index ?? 0);
  const [toPlayerId, setToPlayerId] = useState(targets[0]?.id ?? "");
  const [money, setMoney] = useState(500);

  function submit(): void {
    if (!toPlayerId) return;
    sendTrade(toPlayerId, tileIndex, money);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/55 p-4">
      <div className="panel w-full max-w-md rounded-lg p-5">
        <h2 className="text-lg font-black">แลกเปลี่ยนทรัพย์สิน</h2>
        <label className="mt-4 block text-sm font-bold">ทรัพย์สิน</label>
        <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={tileIndex} onChange={(event) => setTileIndex(Number(event.target.value))}>
          {myProperties.map((tile) => (
            <option key={tile.index} value={tile.index}>
              {tile.name}
            </option>
          ))}
        </select>
        <label className="mt-3 block text-sm font-bold">ผู้รับ</label>
        <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" value={toPlayerId} onChange={(event) => setToPlayerId(event.target.value)}>
          {targets.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <label className="mt-3 block text-sm font-bold">เงินที่ผู้รับจ่าย</label>
        <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="number" value={money} onChange={(event) => setMoney(Number(event.target.value))} />
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg bg-white px-4 py-2 font-bold" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="rounded-lg bg-ink px-4 py-2 font-bold text-white disabled:opacity-40" disabled={myProperties.length === 0 || targets.length === 0} onClick={submit}>
            ส่งข้อเสนอ
          </button>
        </div>
      </div>
    </div>
  );
}
