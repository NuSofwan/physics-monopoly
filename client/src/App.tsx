import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Dice5, DoorOpen, Play, RefreshCw, Shield, Volume2 } from "lucide-react";
import { currentPlayer, physicsMvp } from "@physics-monopoly/shared";
import { PhaserGame } from "./game/PhaserGame";
import {
  createGame,
  joinGame,
  sendBuy,
  sendJailQuestion,
  sendPayJailFine,
  sendReady,
  sendRoll,
  sendSkipBuy,
  sendStart,
  sendUpgrade,
} from "./net/colyseus";
import { playSound } from "./audio/sound";
import { useGameStore } from "./store/gameStore";
import { PlayerPanel } from "./ui/PlayerPanel";
import { QuestionModal } from "./ui/QuestionModal";
import { TradeModal } from "./ui/TradeModal";

const avatarOptions = ["astro", "robot", "girl", "boy"];

export function App(): JSX.Element {
  const { state, playerId, room, moveEvent, answerResult, error, setError } = useGameStore();
  const [name, setName] = useState(() => loadProfile().name);
  const [avatar, setAvatar] = useState(() => loadProfile().avatar);
  const [roomCode, setRoomCode] = useState(() => loadProfile().roomCode);
  const [joining, setJoining] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);

  async function connect(mode: "create" | "join"): Promise<void> {
    try {
      setJoining(true);
      if (mode === "create") await createGame(name, avatar);
      else await joinGame(roomCode, name, avatar);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เชื่อมต่อไม่ได้");
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
              <div className="grid h-14 w-14 place-items-center rounded-lg bg-coral text-2xl font-black text-white">⚛</div>
              <div className="min-w-0 max-w-full">
                <h1 className="break-words text-2xl font-black text-ink sm:text-3xl md:text-5xl">Physics Monopoly</h1>
                <p className="mt-2 max-w-full break-words text-sm leading-7 text-slate-600 sm:text-base">เกมเศรษฐีฟิสิกส์ออนไลน์ 4 คน ซื้อที่ดินด้วยโจทย์ ม.ปลาย และให้ server ถือเฉลยทั้งหมด</p>
              </div>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold">ชื่อผู้เล่น</span>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="block">
                <span className="text-sm font-bold">roomCode</span>
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
              <button className="focus-ring inline-flex items-center gap-2 rounded-lg bg-coral px-5 py-3 font-black text-white disabled:opacity-50" disabled={joining} onClick={() => connect("create")}>
                <Play className="h-5 w-5" />
                สร้างห้อง
              </button>
              <button className="focus-ring inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-black text-ink disabled:opacity-50" disabled={joining || !roomCode} onClick={() => connect("join")}>
                <DoorOpen className="h-5 w-5" />
                เข้าร่วมห้อง
              </button>
            </div>
            {error ? <p className="mt-4 rounded-lg bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">{error}</p> : null}
          </div>

          <div className="panel min-w-0 max-w-full overflow-hidden rounded-lg p-5">
            <h2 className="text-xl font-black">Lobby</h2>
            {state ? (
              <>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-white px-4 py-3">
                  <span className="text-sm text-slate-500">roomCode</span>
                  <button className="inline-flex items-center gap-2 font-black" onClick={() => navigator.clipboard.writeText(state.roomCode)}>
                    {state.roomCode}
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 grid gap-3">
                  {state.players.map((player, index) => (
                    <PlayerPanel key={player.id} state={state} player={player} active={index === state.currentPlayerIndex} />
                  ))}
                </div>
                <div className="mt-5 flex gap-3">
                  <button className="rounded-lg bg-white px-4 py-2 font-bold" onClick={sendReady}>
                    พร้อม
                  </button>
                  <button className="rounded-lg bg-ink px-4 py-2 font-bold text-white" onClick={sendStart}>
                    เริ่มเกม
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-lg bg-white p-4 text-sm text-slate-600">สร้างห้องหรือเข้าร่วมห้องเพื่อเริ่ม</div>
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
  const mvp = physicsMvp(state);

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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase text-coral">ตาปัจจุบัน</p>
                <h2 className="text-xl font-black">{active?.name ?? "รอผู้เล่น"}</h2>
              </div>
              <div className="rounded-lg bg-white px-3 py-2 text-center font-black">
                {state.dice ? `${state.dice[0]} + ${state.dice[1]}` : "--"}
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
              ทอยลูกเต๋า
            </button>
            {me?.inJail && isMyTurn ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="rounded-lg bg-white px-3 py-2 text-sm font-bold" onClick={sendPayJailFine}>
                  จ่าย ฿500
                </button>
                <button className="rounded-lg bg-white px-3 py-2 text-sm font-bold" onClick={sendJailQuestion}>
                  ตอบโจทย์ออกคุก
                </button>
              </div>
            ) : null}
          </div>

          {state.phase === "buying" && isMyTurn && landedTile?.type === "property" ? (
            <div className="panel rounded-lg p-4">
              <p className="text-sm font-black text-coral">ทรัพย์สินว่าง</p>
              <h3 className="mt-1 text-lg font-black">{landedTile.name}</h3>
              <p className="text-sm text-slate-600">ราคา ฿{landedTile.price?.toLocaleString("th-TH")} · ค่าเช่าเริ่ม ฿{landedTile.rentByLevel?.[0]}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="rounded-lg bg-ink px-3 py-2 font-bold text-white" onClick={sendBuy}>
                  ซื้อด้วยโจทย์
                </button>
                <button className="rounded-lg bg-white px-3 py-2 font-bold" onClick={sendSkipBuy}>
                  ไม่ซื้อ
                </button>
              </div>
            </div>
          ) : null}

          {landedTile?.type === "property" && landedTile.ownerId === playerId && state.phase === "rolling" ? (
            <button className="panel rounded-lg p-4 text-left font-black" onClick={sendUpgrade}>
              อัปเกรด {landedTile.name}
            </button>
          ) : null}

          <div className="panel rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black">เครื่องมือ</h3>
              <Volume2 className="h-4 w-4" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="rounded-lg bg-white px-3 py-2 text-sm font-bold" onClick={() => setTradeOpen(true)}>
                Trade
              </button>
              <button className="rounded-lg bg-white px-3 py-2 text-sm font-bold" onClick={() => room?.leave()}>
                ออก
              </button>
            </div>
          </div>

          <div className="panel max-h-64 overflow-auto rounded-lg p-4">
            <h3 className="font-black">Log</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {state.log.slice(0, 12).map((line, index) => (
                <li key={`${line}-${index}`} className="rounded-md bg-white px-3 py-2">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {state.pendingQuestion ? (
          <QuestionModal key={state.pendingQuestion.id} pending={state.pendingQuestion} answerResult={answerResult} isMine={state.pendingQuestion.playerId === playerId} />
        ) : null}
      </AnimatePresence>

      {tradeOpen && playerId ? <TradeModal state={state} myId={playerId} onClose={() => setTradeOpen(false)} /> : null}

      {state.phase === "game_over" ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4">
          <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel w-full max-w-2xl rounded-lg p-6">
            <div className="flex items-center gap-3">
              <Shield className="h-9 w-9 text-gold" />
              <div>
                <p className="text-sm font-black text-coral">Result</p>
                <h2 className="text-3xl font-black">ผู้ชนะ: {state.players.find((player) => player.id === state.winnerId)?.name ?? "ยังไม่ระบุ"}</h2>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {rankedPlayers(state).map((player, index) => (
                <div key={player.id} className="rounded-lg bg-white p-4">
                  <p className="text-sm font-black">#{index + 1} {player.name}</p>
                  <p className="text-sm text-slate-600">เงิน ฿{player.money.toLocaleString("th-TH")} · XP {player.xp}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-mint/20 px-4 py-3 font-bold">Physics MVP: {mvp?.name ?? "-"} จากคะแนน XP และคำตอบถูก</p>
            <button className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-3 font-black text-white" onClick={() => window.location.reload()}>
              <RefreshCw className="h-5 w-5" />
              เล่นอีกครั้ง
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
    return { name: saved.name ?? "นักฟิสิกส์", avatar: saved.avatar ?? "astro", roomCode: saved.roomCode ?? "" };
  } catch {
    return { name: "นักฟิสิกส์", avatar: "astro", roomCode: "" };
  }
}

function rankedPlayers(state: NonNullable<ReturnType<typeof useGameStore.getState>["state"]>) {
  return [...state.players].sort((a, b) => b.money + b.xp * 10 - (a.money + a.xp * 10));
}
