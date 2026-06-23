import { useMemo, useState } from "react";
import { Gavel } from "lucide-react";
import type { GameState } from "@physics-monopoly/shared";
import { sendAuctionBid, sendAuctionPass } from "../net/colyseus";

interface Props {
  state: GameState;
  playerId: string | null;
}

export function AuctionModal({ state, playerId }: Props): JSX.Element | null {
  const auction = state.pendingAuction;
  const [bid, setBid] = useState(0);
  const tile = auction ? state.tiles[auction.tileIndex] : null;
  const me = state.players.find((player) => player.id === playerId);
  const minimum = auction ? (auction.bidderId ? auction.currentBid + 100 : auction.currentBid) : 0;
  const seconds = auction ? Math.max(0, Math.ceil((auction.deadline - Date.now()) / 1000)) : 0;
  const suggested = useMemo(() => Math.max(minimum, bid || minimum), [bid, minimum]);
  if (!auction || !tile) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4">
      <div className="panel w-full max-w-lg rounded-lg p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-gold text-ink"><Gavel className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-black uppercase text-coral">Auction</p>
            <h2 className="text-2xl font-black">{tile.name}</h2>
          </div>
          <div className="ml-auto rounded-lg bg-white px-3 py-2 font-black">{seconds}s</div>
        </div>
        <div className="mt-4 grid gap-3 rounded-lg bg-white p-4 text-sm">
          <p>Minimum bid <b>${minimum.toLocaleString("th-TH")}</b></p>
          <p>Leading bidder <b>{state.players.find((player) => player.id === auction.bidderId)?.name ?? "No bids yet"}</b></p>
          <p>Passes {auction.passes.length}/{state.players.filter((player) => !player.bankrupt).length}</p>
        </div>
        <label className="mt-4 block text-sm font-bold">Your bid</label>
        <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3" type="number" value={suggested} min={minimum} step={100} onChange={(event) => setBid(Number(event.target.value))} />
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="rounded-lg bg-ink px-4 py-3 font-black text-white disabled:opacity-40" disabled={!me || me.money < suggested} onClick={() => sendAuctionBid(suggested)}>Bid</button>
          <button className="rounded-lg bg-white px-4 py-3 font-black" onClick={sendAuctionPass}>Pass</button>
        </div>
      </div>
    </div>
  );
}
