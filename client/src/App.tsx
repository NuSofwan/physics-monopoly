import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Copy, Dice5, DoorOpen, Link, Play, RefreshCw, Shield, UserMinus, Volume2 } from "lucide-react";
import { currentPlayer } from "@physics-monopoly/shared";
import { PhaserGame } from "./game/PhaserGame";
import {
  createGame,
  joinGame,
  sendAddBot,
  sendBuy,
  sendJailQuestion,
  sendKickPlayer,
  sendPayJailFine,
  sendReady,
  sendRoll,
  sendSkipBuy,
  sendStart,
  sendUpgrade,
} from "./net/colyseus";
import { playSound } from "./audio/sound";
import { useGameStore } from "./store/gameStore";
import { AuctionModal } from "./ui/AuctionModal";
import { MiniQr } from "./ui/MiniQr";
import { PlayerPanel } from "./ui/PlayerPanel";
import { PropertyPortfolio } from "./ui/PropertyPortfolio";
import { QuestionModal } from "./ui/QuestionModal";
import { ResultSummary } from "./ui/ResultSummary";
import { TradeModal } from "./ui/TradeModal";

const avatarOptions = ["astro", "robot", "girl", "boy"];

export function App(): JSX.Element {
  const profile = loadProfile();
  const queryRoom = new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? "";
  const { state, playerId, room, moveEvent, answerResult, error, setError } = useGameStore();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [roomCode, setRoomCode] = useState(queryRoom || profile.roomCode);
  const [joining, setJoining] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);

  const isHost = Boolean(state?.players[0]?.id && state.players[0].id === playerId);
  const shareUrl = useMemo(() => {
    if (!state?.roomCode) return "";
    const url = new URL(window.location.href);
    url.searchParams.set("room", state.roomCode);
    return url.toString();
  }, [state?.roomCode]);

  async function connect(mode: "create" | "join"): Promise<void> {
    try {
      setJoining(true);
      if (mode === "create") await createGame(name, avatar);
      else await joinGame(roomCode, name, avatar);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to the room");
    } finally {
      setJoining(false);
    }
  }

  if (!state || state.phase === "lobby") {
    return (
      <main className="game-shell grid min-h-screen place-items-center p-4">
        <section className="grid w-full min-w-0 max-w-[calc(100vw-2rem)] gap-5 lg:max-w-6xl lg:grid-cols-[1.1fr_0.9fr]">
          <div className="panel min-w-0 max-w-full overflow-hidden rounded-lg p-6 md:p-8">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className="grid h-14 w-14 place-items-center rounded-lg bg-coral text-2xl font-black text-white">PM</div>
              <div className="min-w-0 max-w-full">
                <h1 className="break-words text-2xl font-black text-ink sm:text-3xl md:text-5xl">Physics Monopoly</h1>
                <p className="mt-2 max-w-full break-words text-sm leading-7 text-slate-600 sm:text-base">
                  Multiplayer Monopoly with physics questions, auctions, bots, trading, jail choices, and final learning reports.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold">Player name</span>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="block">
                <span className="text-sm font-bold">Room code</span>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 uppercase" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              {avatarOptions.map((item) => (
                <button
                  key={item}
                  className={`focus-ring rounded-lg border px-4 py-3 font-black uppercase ${avatar === item ? "border-ink bg-ink text-white" : "border-slate-200 bg-white"}`}
                  onClick={() => setAvatar(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-coral px-5 py-3 font-black text-white disabled:opacity-50" disabled={joining} onClick={() => connect("create")}>
                <Play className="h-5 w-5" />
                Create room
              </button>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 font-black text-ink disabled:opacity-50" disabled={joining || !roomCode} onClick={() => connect("join")}>
                <DoorOpen className="h-5 w-5" />
                Join room
              </button>
            </div>
            {error ? <p className="mt-4 rounded-lg bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">{error}</p> : null}
          </div>

          <div className="panel min-w-0 max-w-full overflow-hidden rounded-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">Lobby</h2>
              {state ? <span className="rounded-lg bg-white px-3 py-1 text-sm font-black">{state.players.length}/4</span> : null}
            </div>
            {state ? (
              <>
                <div className="mt-3 grid gap-3 rounded-lg bg-white p-4 sm:grid-cols-[1fr_auto]">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-500">Room code</p>
                    <button className="mt-1 inline-flex max-w-full items-center gap-2 break-all text-2xl font-black" onClick={() => navigator.clipboard.writeText(state.roomCode)}>
                      {state.roomCode}
                      <Copy className="h-4 w-4 shrink-0" />
                    </button>
                    {shareUrl ? (
                      <button className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-left text-xs font-bold text-slate-600" onClick={() => navigator.clipboard.writeText(shareUrl)}>
                        <Link className="h-4 w-4 shrink-0" />
                        <span className="truncate">Copy invite link</span>
                      </button>
                    ) : null}
                  </div>
                  <MiniQr value={shareUrl || state.roomCode} />
                </div>

                <div className="mt-4 grid gap-3">
                  {state.players.map((player, index) => (
                    <div key={player.id} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <PlayerPanel state={state} player={player} active={index === state.currentPlayerIndex} />
                      {isHost && player.id !== playerId ? (
                        <button className="rounded-lg bg-white px-3 py-2 text-sm font-black text-rose-700" onClick={() => sendKickPlayer(player.id)} title="Remove player">
                          <UserMinus className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  <button className="rounded-lg bg-white px-4 py-2 font-bold" onClick={sendReady}>Ready</button>
                  <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 font-bold disabled:opacity-40" disabled={!isHost || state.players.length >= 4} onClick={sendAddBot}>
                    <Bot className="h-4 w-4" />
                    Add bot
                  </button>
                  <button className="rounded-lg bg-ink px-4 py-2 font-bold text-white disabled:opacity-40" disabled={!isHost} onClick={sendStart}>Start</button>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-lg bg-white p-4 text-sm text-slate-600">Create or join a room to begin.</div>
            )}
          </div>
        </section>
      </main>
    );
  }

  const me = state.players.find((player) => player.id === playerId);
  const active = currentPlayer(state);
  const isMyTurn = active?.id === playerId;
  const landedTile = active ? state.tiles[active.tileIndex] : null;
  const turnSeconds = state.turnDeadline ? Math.max(0, Math.ceil((state.turnDeadline - Date.now()) / 1000)) : null;

  return (
    <main className="game-shell min-h-screen p-3 text-ink md:p-5">
      <div className="mx-auto grid max-w-[1500px] gap-4 xl:grid-cols-[280px_minmax(420px,1fr)_320px]">
        <aside className="grid content-start gap-3">
          {state.players.map((player, index) => (
            <PlayerPanel key={player.id} state={state} player={player} active={index === state.currentPlayerIndex} />
          ))}
        </aside>

        <section className="min-h-[420px]">
          <PhaserGame state={state} moveEvent={moveEvent} />
        </section>

        <aside className="grid content-start gap-4">
          <div className="panel rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-coral">Current turn</p>
                <h2 className="text-xl font-black">{active?.name ?? "Waiting"}</h2>
              </div>
              <div className="rounded-lg bg-white px-3 py-2 text-center font-black">
                {state.dice ? `${state.dice[0]} + ${state.dice[1]}` : turnSeconds !== null ? `${turnSeconds}s` : "--"}
              </div>
            </div>
            <button
              className="focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-coral px-5 py-4 text-lg font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!isMyTurn || state.phase !== "rolling"}
              onClick={() => {
                playSound("dice");
                sendRoll();
              }}
            >
              <Dice5 className="h-6 w-6" />
              Roll dice
            </button>
            {me?.inJail && isMyTurn ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="rounded-lg bg-white px-3 py-2 text-sm font-bold" onClick={sendPayJailFine}>Pay $500</button>
                <button className="rounded-lg bg-white px-3 py-2 text-sm font-bold" onClick={sendJailQuestion}>Solve jail quiz</button>
              </div>
            ) : null}
          </div>

          {state.phase === "buying" && isMyTurn && landedTile?.type === "property" ? (
            <div className="panel rounded-lg p-4">
              <p className="text-sm font-black text-coral">Unowned property</p>
              <h3 className="mt-1 text-lg font-black">{landedTile.name}</h3>
              <p className="text-sm text-slate-600">Price ${landedTile.price?.toLocaleString("th-TH")} · Base rent ${landedTile.rentByLevel?.[0]}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="rounded-lg bg-ink px-3 py-2 font-bold text-white" onClick={sendBuy}>Buy with quiz</button>
                <button className="rounded-lg bg-white px-3 py-2 font-bold" onClick={sendSkipBuy}>Auction</button>
              </div>
            </div>
          ) : null}

          {landedTile?.type === "property" && landedTile.ownerId === playerId && state.phase === "rolling" ? (
            <button className="panel rounded-lg p-4 text-left font-black" onClick={sendUpgrade}>Upgrade {landedTile.name}</button>
          ) : null}

          <PropertyPortfolio state={state} playerId={playerId} />

          <div className="panel rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black">Tools</h3>
              <Volume2 className="h-4 w-4" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="rounded-lg bg-white px-3 py-2 text-sm font-bold" onClick={() => setTradeOpen(true)}>Trade</button>
              <button className="rounded-lg bg-white px-3 py-2 text-sm font-bold" onClick={() => room?.leave()}>Leave</button>
            </div>
          </div>

          <div className="panel max-h-64 overflow-auto rounded-lg p-4">
            <h3 className="font-black">Log</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {state.log.slice(0, 12).map((line, index) => (
                <li key={`${line}-${index}`} className="rounded-md bg-white px-3 py-2">{line}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {state.pendingQuestion ? <QuestionModal key={state.pendingQuestion.id} pending={state.pendingQuestion} answerResult={answerResult} isMine={state.pendingQuestion.playerId === playerId} /> : null}
      </AnimatePresence>

      <AuctionModal state={state} playerId={playerId} />
      {tradeOpen && playerId ? <TradeModal state={state} myId={playerId} onClose={() => setTradeOpen(false)} /> : null}

      {state.phase === "game_over" ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4">
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel w-full max-w-4xl rounded-lg p-6">
            <div className="mb-5 flex items-center gap-3">
              <Shield className="h-9 w-9 text-gold" />
              <div>
                <p className="text-sm font-black text-coral">Result</p>
                <h2 className="text-3xl font-black">Winner: {state.players.find((player) => player.id === state.winnerId)?.name ?? "Unknown"}</h2>
              </div>
            </div>
            <ResultSummary state={state} />
            <button className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white" onClick={() => window.location.reload()}>
              <RefreshCw className="h-5 w-5" />
              Play again
            </button>
          </motion.div>
        </div>
      ) : null}
    </main>
  );
}

function loadProfile(): { name: string; avatar: string; roomCode: string } {
  try {
    const saved = JSON.parse(localStorage.getItem("physics-monopoly-profile") ?? "{}") as Partial<{ name: string; avatar: string; roomCode: string }>;
    return { name: saved.name ?? "Physics Student", avatar: saved.avatar ?? "astro", roomCode: saved.roomCode ?? "" };
  } catch {
    return { name: "Physics Student", avatar: "astro", roomCode: "" };
  }
}
