import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Copy, Dice5, DoorOpen, Link, Play, UserMinus, Volume2 } from "lucide-react";
import { currentPlayer, locations, avatarPresets, type Appearance } from "@physics-monopoly/shared";
import { AccessibleBoard } from "./game2d/AccessibleBoard";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import {
  createGame,
  joinGame,
  leaveGame,
  savedRoomCode,
  sendBuy,
  sendJailQuestion,
  sendKickPlayer,
  sendPayJailFine,
  sendReady,
  sendRoll,
  sendSkipBuy,
  sendStart,
  sendUpgrade,
  sendMap,
} from "./net/colyseus";
import { playSound, setMuted } from "./audio/sound";
import { useGameStore } from "./store/gameStore";
import { MiniQr } from "./ui/MiniQr";
import { PlayerPanel } from "./ui/PlayerPanel";
import { PropertyPortfolio } from "./ui/PropertyPortfolio";
import { QuestionModal } from "./ui/QuestionModal";
import { GameResults } from "./ui/GameResults";
import type { ActivitySummary } from "./teacher/ActivityEntry";
import { AppearanceEditor } from "./ui/AppearanceEditor";

const avatarOptions = avatarPresets.map((preset) => preset.id);
const Board3D = lazy(() => import("./game3d/Board3D").then((module) => ({ default: module.Board3D })));
const PhaserGame = lazy(() => import("./game/PhaserGame").then((module) => ({ default: module.PhaserGame })));

export function App({ activity }: { activity?: ActivitySummary } = {}): JSX.Element {
  const [profile] = useState(loadProfile);
  const queryRoom = new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? savedRoomCode() ?? "";
  const { state, playerId, moveEvent, answerResult, learningReceipt, error, setError, connected } = useGameStore();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [appearance, setAppearance] = useState<Appearance>(profile.appearance);
  const [mapId, setMapId] = useState(activity?.rules?.maps?.[0] ?? "bangkok");
  const [roomCode, setRoomCode] = useState(queryRoom);
  const [joining, setJoining] = useState(false);
  const activityClosed = Boolean(activity && activity.status !== "open");
  const [renderer, setRenderer] = useState(new URLSearchParams(window.location.search).get("renderer") ?? "3d");
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [quality, setQuality] = useState<"low" | "medium">("low");
  const [textScale, setTextScale] = useState(100);
  const [now, setNow] = useState(Date.now());
  const [mute, setMute] = useState(() => localStorage.getItem("physics-monopoly-muted") === "true");
  // Once the 3D canvas is unmounted (renderer switches to "html"), its
  // webglcontextrestored listener is torn down with it, so we can never observe
  // the context coming back on its own. The "ลองใหม่" banner therefore offers a
  // retry as soon as we know the context was lost, instead of waiting for a
  // restored event that will never fire while the canvas stays unmounted.
  const [lostGraphicsContext, setLostGraphicsContext] = useState(false);
  const fallbackToHtml = useCallback(() => { setRenderer("html"); setLostGraphicsContext(true); }, []);
  const retry3d = useCallback(() => { setLostGraphicsContext(false); setRenderer("3d"); }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { setMuted(mute); localStorage.setItem("physics-monopoly-muted", String(mute)); }, [mute]);
  useEffect(() => {
    const previous = document.documentElement.style.fontSize;
    document.documentElement.style.fontSize = `${textScale}%`;
    return () => { document.documentElement.style.fontSize = previous; };
  }, [textScale]);

  const isHost = Boolean(state && (state.hostId ?? state.players[0]?.id) === playerId);
  const shareUrl = useMemo(() => {
    if (!state?.roomCode) return "";
    const url = new URL(window.location.href);
    url.searchParams.set("room", state.roomCode);
    return url.toString();
  }, [state?.roomCode]);

  async function connect(mode: "create" | "join"): Promise<void> {
    try {
      setJoining(true);
      if (mode === "create") await createGame(name, avatar, mapId, appearance);
      else await joinGame(roomCode, name, avatar, appearance);
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
                  เกมกระดานฟิสิกส์สำหรับห้องเรียน: ตอบคำถาม สร้างเมือง และเรียนรู้ร่วมกันได้ 1–4 คน
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold">ชื่อเล่น</span>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3" value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="block">
                <span className="text-sm font-bold">รหัสห้อง</span>
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 uppercase" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              {avatarOptions.map((item) => (
                <button
                  key={item}
                  aria-label={item}
                  aria-pressed={avatar === item}
                  disabled={Boolean(state)}
                  className={`focus-ring rounded-lg border px-4 py-3 font-black uppercase ${avatar === item ? "border-ink bg-ink text-white" : "border-slate-200 bg-white"}`}
                  onClick={() => setAvatar(item)}
                >
                  {avatarPresets.find((preset) => preset.id === item)?.label}
                </button>
              ))}
            </div>

            <AppearanceEditor avatar={avatar} value={appearance} onChange={setAppearance} disabled={Boolean(state)}/>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
              <label className="block w-full">สถานที่<select aria-label="สถานที่" className="ml-3 rounded border p-3" value={state?.mapId ?? mapId} disabled={Boolean(state) && !isHost} onChange={(event) => { setMapId(event.target.value); if (state) sendMap(event.target.value); }}>{locations.filter((location) => !activity?.rules?.maps || activity.rules.maps.includes(location.id)).map((location) => <option key={location.id} value={location.id}>{location.name} · {location.category}</option>)}</select></label><a href={`/asset-lab?map=${state?.mapId ?? mapId}`} target="_blank" rel="noreferrer" className="underline">ดูตัวอย่างเมืองหมุนได้ (เปิดแท็บใหม่)</a>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-coral px-5 py-3 font-black text-white disabled:opacity-50" disabled={joining || activityClosed} onClick={() => connect("create")}>
                <Play className="h-5 w-5" />
                สร้างห้อง
              </button>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 font-black text-ink disabled:opacity-50" disabled={joining || !roomCode || (activityClosed && savedRoomCode() !== roomCode)} onClick={() => connect("join")}>
                <DoorOpen className="h-5 w-5" />
                {savedRoomCode() === roomCode ? "กลับเข้าเกมเดิม" : "เข้าห้อง"}
              </button>
            </div>
            {error ? <p className="mt-4 rounded-lg bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">{error}</p> : null}
            {!activity ? <a href="/teacher" className="mt-5 inline-block underline">พื้นที่ครู / สร้างกิจกรรม</a> : null}
          </div>

          <div className="panel min-w-0 max-w-full overflow-hidden rounded-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">ห้องรอเล่น</h2>
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

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <button className="rounded-lg bg-white px-4 py-3 font-bold" onClick={sendReady}>พร้อมเล่น</button>
                  <button className="rounded-lg bg-ink px-4 py-3 font-bold text-white disabled:opacity-40" disabled={!isHost || !state.players.every((player) => player.ready)} onClick={sendStart}>เริ่มเกม</button>
                </div>
                <button className="mt-3 rounded-lg bg-white px-4 py-3 font-bold" onClick={leaveGame}>ออกจากห้อง / ล้างตัวตน</button>
              </>
            ) : (
              <div className="mt-4 rounded-lg bg-white p-4 text-sm text-slate-600">สร้างห้องหรือใส่รหัสห้องเพื่อเริ่มเล่น</div>
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
  const turnSeconds = state.turnDeadline ? Math.max(0, Math.ceil((state.turnDeadline - now) / 1000)) : null;

  return (
    <main className="game-shell min-h-screen p-3 text-ink md:p-5">
      {error || !connected ? <div role="status" className="mb-3 rounded-lg bg-amber-100 p-3 font-bold">{error ?? "กำลังเชื่อมต่อใหม่…"}</div> : null}
      {state.endsAt&&state.phase!=="game_over"?<p role="status" className="mb-3 rounded bg-white p-3">{state.paused?"หยุดนับเวลา":state.endsAt-now<=60_000?"เหลือไม่เกิน 1 นาที — เตรียมสรุปผล":state.endsAt-now<=300_000?"เหลือไม่เกิน 5 นาที":"เวลากิจกรรม"} · {Math.max(0,Math.ceil((state.endsAt-(state.paused?.since??now))/60_000))} นาที{(state.questionTimeMultiplier??1)>1?` · เวลาอ่าน/ตอบเสริม ${state.questionTimeMultiplier} เท่า`:""}</p>:null}
      <div className="mx-auto grid max-w-[1700px] gap-3 xl:grid-cols-[220px_minmax(720px,1fr)_260px] 2xl:grid-cols-[240px_minmax(900px,1fr)_300px]">
        <aside className="order-3 grid content-start gap-3 sm:grid-cols-2 xl:order-1 xl:grid-cols-1" aria-label="ผู้เล่นและคะแนน">
          {state.players.map((player, index) => (
            <PlayerPanel key={player.id} state={state} player={player} active={index === state.currentPlayerIndex} />
          ))}
        </aside>

        <section className="order-1 min-w-0 xl:order-2">
          <div className="mb-2 flex flex-wrap gap-3 rounded-lg bg-white p-3">
            <label>กระดาน <select aria-label="กระดาน" className="min-h-11 max-w-full rounded border p-2" value={renderer} onChange={(event) => setRenderer(event.target.value)}><option value="3d">3 มิติ</option><option value="html">ข้อความ (ประหยัดเครื่อง)</option><option value="2d">2 มิติเดิม</option></select></label>
            <label>คุณภาพ <select aria-label="คุณภาพ" className="min-h-11 rounded border p-2" value={quality} onChange={(event) => setQuality(event.target.value as "low" | "medium")}><option value="low">ต่ำ</option><option value="medium">กลาง</option></select></label>
            <label>ขนาดข้อความ <select aria-label="ขนาดข้อความ" className="min-h-11 rounded border p-2" value={textScale} onChange={event=>setTextScale(Number(event.target.value))}><option value={100}>ปกติ</option><option value={125}>ใหญ่ 125%</option><option value={150}>ใหญ่พิเศษ 150%</option></select></label>
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />ลดการเคลื่อนไหว</label>
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={mute} onChange={(event) => setMute(event.target.checked)} />ปิดเสียง</label>
          </div>
          {renderer === "html" && lostGraphicsContext ? (
            <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg bg-white p-3">
              <span>กราฟิก 3 มิติขัดข้อง สลับไปใช้กระดานข้อความชั่วคราว</span>
              <button type="button" className="rounded bg-emerald-500 px-3 py-2 font-bold text-white" onClick={retry3d}>ลองใหม่</button>
            </div>
          ) : null}
          <ErrorBoundary key={renderer} fallback={<AccessibleBoard state={state} />}>
            <Suspense fallback={<AccessibleBoard state={state} />}>
              {renderer === "3d" ? <Board3D state={state} moveEvent={moveEvent} reducedMotion={reducedMotion} quality={quality} onUnavailable={fallbackToHtml} /> : renderer === "2d" ? <PhaserGame state={state} moveEvent={moveEvent} /> : <AccessibleBoard state={state} />}
            </Suspense>
          </ErrorBoundary>
          {renderer !== "html" ? <details className="mt-2"><summary className="cursor-pointer rounded bg-white p-3 font-bold">รายชื่อช่อง ราคา และผู้ถือครอง (คีย์บอร์ด)</summary><AccessibleBoard state={state} /></details> : null}
        </section>

        <aside className="order-2 grid min-w-0 content-start gap-4 xl:order-3" aria-label="คำสั่งและรายละเอียดตา">
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
              disabled={!connected || !isMyTurn || state.phase !== "rolling"}
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
              <p className="text-sm font-black text-coral">{landedTile.ownerId ? "ทรัพย์สินของคุณ" : "ที่ดินว่าง"}</p>
              <h3 className="mt-1 text-lg font-black">{landedTile.name}</h3>
              <p className="text-sm text-slate-600">Price ${landedTile.price?.toLocaleString("th-TH")} · Base rent ${landedTile.rentByLevel?.[0]}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button className="rounded-lg bg-ink px-3 py-2 font-bold text-white" onClick={landedTile.ownerId ? sendUpgrade : sendBuy}>{landedTile.ownerId ? "Upgrade with quiz" : "Buy with quiz"}</button>
                <button className="rounded-lg bg-white px-3 py-2 font-bold" onClick={sendSkipBuy}>Pass</button>
              </div>
            </div>
          ) : null}

          {!state.classroomMode && landedTile?.type === "property" && landedTile.ownerId === playerId && state.phase === "rolling" ? (
            <button className="panel rounded-lg p-4 text-left font-black" onClick={sendUpgrade}>Upgrade {landedTile.name}</button>
          ) : null}

          <PropertyPortfolio state={state} playerId={playerId} />

          <div className="panel rounded-lg p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black">Tools</h3>
              <Volume2 className="h-4 w-4" />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button className="rounded-lg bg-white px-3 py-2 text-sm font-bold" onClick={leaveGame}>ออกจากเกม / ล้างตัวตน</button>
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
        {state.paused ? <div role="alert" className="fixed inset-0 z-[60] grid place-items-center bg-ink/80 p-6"><div className="rounded-xl bg-white p-8 text-center text-xl font-bold">พักเกม: {state.paused.reason === "teacher" ? "ครูหยุดเพื่ออธิบาย กรุณารอครูให้เล่นต่อ" : "รอกลับเข้าเกมเดิม"}<p className="mt-3 text-base font-normal">เวลาตอบที่เหลือจะคงไว้ ไม่ต้องส่งคำตอบซ้ำ</p></div></div> : null}
        {state.pendingQuestion ? <QuestionModal key={state.pendingQuestion.id} pending={state.pendingQuestion} answerResult={answerResult} receipt={learningReceipt} revealDeadline={state.phase === "reveal" ? state.turnDeadline ?? undefined : undefined} isMine={connected && (state.pendingQuestion.group || state.pendingQuestion.playerId === playerId)} /> : null}
      </AnimatePresence>

      {state.phase === "game_over" ? <GameResults state={state}/> : null}
    </main>
  );
}
function loadProfile(): { name: string; avatar: string; appearance: Appearance } {
  try {
    const saved = JSON.parse(localStorage.getItem("physics-monopoly-profile") ?? "{}") as Partial<{ name: string; avatar: string; appearance: Appearance }>;
    return { name: saved.name ?? "Physics Student", avatar: saved.avatar ?? "astro", appearance: saved.appearance ?? {} };
  } catch {
    return { name: "Physics Student", avatar: "astro", appearance: {} };
  }
}
