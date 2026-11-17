import { Canvas } from "@react-three/fiber";
import { useCallback, useState,useMemo,useEffect } from "react";
import { locations, locationById, avatarPresets, baseTiles } from "@physics-monopoly/shared";
import { CameraControls,Board3D } from "./Board3D";
import { createInitialGameState,createPlayer } from "@physics-monopoly/shared";
import { Character } from "./Character";
import { CityEnvironment, LocalBuilding } from "./CityKit";
import type { AvatarPose } from "./AvatarFigure";
import { AssetMetrics } from "./AssetMetrics";
import { StaticBatch } from "./StaticBatch";
import { QualityContext, type RenderQuality } from "./RenderQuality";
import { Ambience } from "./Ambience";
import { PostEffects, SKY, SceneLights, SkyAndEnvironment, WaterMotion } from "./Atmosphere";
import { propertyPlaceName, propertyTileIndices } from "./PropertyArchitecture";
import { MetalToken, OwnershipPeg, PropertyPiece, TOKEN_KINDS } from "./tabletop/TabletopPieces";
import { ROOM, TABLE_TOP, TabletopLighting, TabletopPostEffects } from "./tabletop/TabletopScene";
import { walnutTexture } from "./tabletop/TabletopTextures";

/**
 * Simulated turns on the tabletop board (no server): dice throw → walk with the follow camera →
 * buy/upgrade (building drop) → "go to jail" lowers the cage. Clearly a demo, not a live game.
 */
function TabletopTurnDemo({ quality, pieces }: { quality: RenderQuality; pieces: "figure" | "metal" }): JSX.Element {
  const [game, setGame] = useState(() => {
    const state = createInitialGameState("DEMO01"); state.classroomMode = true; state.phase = "rolling";
    state.players = ["girl", "scientist", "astro", "engineer"].map((avatar, index) => createPlayer(`demo${index}`, `ผู้เล่น ${index + 1}`, avatar));
    return { state, moveEvent: null as import("../store/gameStore").MoveEvent | null };
  });
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setGame(({ state, moveEvent }) => {
      const next = structuredClone(state), player = next.players[next.currentPlayerIndex]!;
      if (next.phase !== "moving") {
        // Every fourth roll aims for "go to jail" (when reachable) so the cage moment shows up in the demo.
        const roll = (moveEvent?.nonce ?? 0) + 1, toJail = (14 - player.tileIndex + 28) % 28;
        const dice: [number, number] = roll % 4 === 3 && toJail >= 2 && toJail <= 12 ? [Math.min(6, toJail - 1), toJail - Math.min(6, toJail - 1)] : [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
        const total = dice[0] + dice[1], path = Array.from({ length: total }, (_, i) => (player.tileIndex + i + 1) % next.tiles.length);
        player.inJail = false; player.tileIndex = path[path.length - 1]!; next.dice = dice; next.phase = "moving";
        return { state: next, moveEvent: { playerId: player.id, path, dice, nonce: (moveEvent?.nonce ?? 0) + 1 } };
      }
      const tile = next.tiles[player.tileIndex]!;
      if (tile.type === "property" && (!tile.ownerId || tile.ownerId === player.id)) { tile.ownerId = player.id; tile.level = Math.min(3, (tile.ownerId === player.id && tile.level !== undefined ? tile.level : -1) + 1); }
      next.phase = "rolling"; next.currentPlayerIndex = (next.currentPlayerIndex + 1) % next.players.length;
      if (tile.type === "goToJail") { player.tileIndex = 7; player.inJail = true; return { state: next, moveEvent: { playerId: player.id, path: [7], dice: null, nonce: (moveEvent?.nonce ?? 0) + 1 } }; }
      return { state: next, moveEvent };
    }), game.state.phase === "moving" ? 4200 : 2600);
    return () => window.clearTimeout(timer);
  }, [step, game.state.phase]);
  useEffect(() => setStep(value => value + 1), [game]);
  return <><p className="mb-2 font-bold">ตัวอย่างจำลองตา (ไม่ใช่เกมสด): ทอยเต๋า → เดิน → ซื้อ/อัปเกรด → ช่อง "ไปคุก" กรงจะหล่นลงมา</p>
    <Board3D state={game.state} moveEvent={game.moveEvent} quality={quality} onUnavailable={() => undefined} pieceStyle={pieces}/></>;
}

/** Close-up gallery of the tabletop pieces on the walnut table under the same lamp as the game. */
function TabletopPieceGallery({ quality }: { quality: RenderQuality }): JSX.Element {
  const [reset, setReset] = useState(0);
  const colors = ["#34d399","#f8c24a","#f472b6","#60a5fa"];
  return <div className="relative h-[68vh] min-h-[450px] overflow-hidden rounded-2xl border border-slate-700 shadow-xl" aria-label="ชิ้นเกมบนโต๊ะ">
    <button className="absolute left-3 top-3 z-10 rounded bg-white/90 p-3 font-bold" onClick={() => setReset(value => value + 1)}>รีเซ็ตกล้อง</button>
    <Canvas shadows camera={{ position: [0, 3.2, 6.2], fov: 34 }} dpr={[1, 1.75]}>
      <QualityContext.Provider value={quality}>
        <AssetMetrics/>
        <CameraControls reset={reset} onUnavailable={() => undefined} initialPosition={[0, 3.2, 6.2]} initialTarget={[0, .45, 0]} minDistance={2.5} maxDistance={14}/>
        <color attach="background" args={[ROOM.background]}/><fog attach="fog" args={[ROOM.fog, 14, 40]}/>
        <TabletopLighting quality={quality}/>
        {quality === "high" ? <TabletopPostEffects closeUp/> : null}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, TABLE_TOP, 0]}><planeGeometry args={[30, 20]}/><meshPhysicalMaterial color="#c9a07a" map={walnutTexture()} roughness={.42} clearcoat={.65} clearcoatRoughness={.22}/></mesh>
        <group position={[0, TABLE_TOP, -1.1]}>
          {([1, 2, 3] as const).map((level, index) => <group key={level} name={`asset:piece:${level}`} position={[-2.2 + index * 1.75, 0, 0]}><PropertyPiece level={level} quality={quality} accent="#e3b44f"/></group>)}
          <group position={[2.9, 0, 0]}><OwnershipPeg color="#f472b6"/></group>
        </group>
        <group position={[0, TABLE_TOP, .9]}>
          {TOKEN_KINDS.map((kind, index) => <group key={kind} name={`asset:token:${kind}`} position={[-2.8 + index * .8, 0, (index % 2) * .35]} rotation={[0, -.5 + index * .15, 0]} scale={1.25}><MetalToken kind={kind} color={colors[index % 4]!} quality={quality}/></group>)}
        </group>
      </QualityContext.Provider>
    </Canvas>
  </div>;
}

/** Asset inspection is never presented as a live or purchased game state. */
export function AssetLab(): JSX.Element {
  const query = new URLSearchParams(window.location.search);
  const [map, setMap] = useState(locationById(query.get("map") ?? undefined).id);
  const [mode, setMode] = useState(query.get("mode") ?? "city");
  const [pose, setPose] = useState<AvatarPose>("idle");
  const [reset, setReset] = useState(0), [failed, setFailed] = useState(false);
  const [compact, setCompact] = useState(() => window.innerWidth < 1100);
  const [tall, setTall] = useState(() => window.innerHeight / window.innerWidth > .7);
  useEffect(() => { const update = () => { setCompact(window.innerWidth < 1100); setTall(window.innerHeight / window.innerWidth > .7); }; window.addEventListener("resize",update); return () => window.removeEventListener("resize",update); },[]);
  const fail = useCallback(() => setFailed(true), []);
  // Budget measurements default to the low tier; ?quality=medium|high previews the richer tiers.
  const requested = (["low","medium","high"] as const).find(value => value === query.get("quality"));
  const labQuality: RenderQuality = requested ?? "low", previewQuality: RenderQuality = requested ?? "medium";
  const galleryPosition: [number,number,number] = mode === "buildings" ? compact ? [0,10,22] : [0,7,13] : mode === "properties" ? compact ? [0,8,15] : [0,6,11] : mode === "city" ? compact ? [9,10,15] : [8,6.5,10] : compact ? [0,12,23] : tall ? [0,9,17] : [0,7,12];
  const galleryTarget: [number,number,number] = mode === "buildings" || mode === "properties" ? [0,1.2,0] : mode === "city" ? [0,1,0] : [0,.7,0];
  const budgetState=useMemo(()=>{
    const state=createInitialGameState("ASSETQ");state.mapId=map;state.classroomMode=true;state.phase="answering";state.dice=[6,6];
    state.players=["astro","engineer-wheelchair","scientist","girl"].map((avatar,index)=>{const player=createPlayer(`qa${index}`,`QA ${index+1}`,avatar);player.tileIndex=index*7;return player;});
    state.tiles=structuredClone(baseTiles).map(tile=>tile.type==="property"?{...tile,ownerId:state.players[tile.index%4]!.id,level:3}:tile);return state;
  },[map]);
  return <main className="asset-lab min-h-screen p-5">
    <a href="/" className="font-bold underline">กลับเข้าเกม</a><h1 className="my-3 text-2xl font-black">ห้องตรวจโมเดล 3 มิติ</h1>
    <p>12 เมือง / อาคารช่องซื้อ 14 แบบ / อาคารระดับ 0–3 สองรูปทรงต่อระดับ / ตัวละครอนิเมะต้นฉบับ 24 แบบ • เป็นตัวอย่าง asset ไม่ใช่เกมสด</p>
    <div className="my-3 flex flex-wrap gap-3"><label>สถานที่<select aria-label="สถานที่" className="ml-2 rounded border p-3" value={map} onChange={(event) => setMap(locationById(event.target.value).id)}>{locations.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
      <label>ชุดภาพ<select aria-label="ชุดภาพ" className="ml-2 rounded border p-3" value={mode} onChange={(event) => setMode(event.target.value)}><option value="city">เมืองและจุดเด่น</option><option value="buildings">อาคาร 0–3 × 2 รูปทรง</option><option value="properties">อาคารช่องซื้อ 14 ตำแหน่ง</option><option value="avatars">ตัวละคร 24 แบบ</option><option value="board">ตรวจงบฉาก: 4 ตัวละคร + อาคารเต็ม</option><option value="pieces">ชิ้นเกมบนโต๊ะ: บ้านไม้ + หมากโลหะ 8 แบบ</option><option value="turn">จำลองตาเดินบนโต๊ะ (ทอย เดิน ซื้อ ติดคุก)</option></select></label>
      {mode === "avatars" ? <label>ท่าทาง<select aria-label="ท่าทาง" className="ml-2 rounded border p-3" value={pose} onChange={(event) => setPose(event.target.value as AvatarPose)}>{(["idle","walk","think","celebrate","wave"] as const).map((value) => <option key={value}>{value}</option>)}</select></label> : null}
      <button className="rounded bg-white p-3" onClick={() => setReset((value) => value + 1)}>รีเซ็ตกล้อง</button>
    </div>
    <p>โมเดล 3 มิติสร้างในเครื่อง พร้อมพื้นผิว แสงเงา และฉากเฉพาะเมือง · เลื่อนเมาส์เพื่อดูรายละเอียด</p>
    {mode === "pieces" ? <TabletopPieceGallery quality={previewQuality}/> : mode === "turn" ? <TabletopTurnDemo quality={previewQuality} pieces={query.get("pieces") === "metal" ? "metal" : "figure"}/> : mode === "board" ? <Board3D state={budgetState} moveEvent={null} reducedMotion quality={labQuality} onUnavailable={fail} measureAssets boardStyle={query.get("style") === "city" ? "city" : "tabletop"} pieceStyle={query.get("pieces") === "metal" ? "metal" : "figure"}/> : failed ? <p role="alert">WebGL ไม่พร้อมใช้งาน ใช้กระดานข้อความในเกมได้</p> : <div className="h-[68vh] min-h-[450px] overflow-hidden rounded-2xl border border-slate-200 shadow-xl" aria-label="ตัวอย่างโมเดลสามมิติ"><Canvas shadows camera={{ position: galleryPosition, fov:42 }} dpr={[1,1.5]}>
      <AssetMetrics/>
      <CameraControls reset={reset} onUnavailable={fail} initialPosition={galleryPosition} initialTarget={galleryTarget} minDistance={mode === "buildings" ? 6 : 7}/><color attach="background" args={[mode === "city" ? SKY.fog : "#dce4e4"]} />{mode === "city" ? <fog attach="fog" args={[SKY.fog,30,72]}/> : null}<SkyAndEnvironment showSky={mode === "city"}/><SceneLights quality={previewQuality} extent={13}/><WaterMotion/>{previewQuality === "high" ? <PostEffects/> : null}<QualityContext.Provider value={previewQuality}>
      {mode === "city" ? <group name={`asset:city:${map}`}><StaticBatch version={map}><CityEnvironment mapId={map}/></StaticBatch><Ambience/></group> : <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-.1,0]}><planeGeometry args={[24,19]} /><meshStandardMaterial color="#c8d0cb" roughness={1} /></mesh>}
      {mode === "buildings" ? [0,1,2,3].flatMap((level) => [0,1].map((variant) => <group name={`asset:building:${map}:${level}:${variant}`} key={level+":"+variant} position={[-6+level*4,0,-2.5+variant*5]} scale={1.8}>
        <mesh receiveShadow castShadow position={[0,.065,0]}><boxGeometry args={[1.65,.13,1.4]}/><meshStandardMaterial color="#e9e5db" roughness={.9}/></mesh>
        <mesh receiveShadow position={[0,.14,0]}><boxGeometry args={[1.53,.03,1.28]}/><meshStandardMaterial color="#b3aaa0" roughness={.94}/></mesh>
        <LocalBuilding mapId={map} level={level} variant={variant} owned />
      </group>)) : null}
      {mode === "properties" ? propertyTileIndices.map((tileIndex,index)=><group name={`asset:property:${map}:${tileIndex}`} key={tileIndex} position={[-6+(index%7)*2,0,-2.3+Math.floor(index/7)*4.6]} scale={1.45}>
        <LocalBuilding mapId={map} tileIndex={tileIndex} level={3} owned/>
      </group>) : null}
      {mode === "avatars" ? avatarPresets.map((preset,index) => <group name={`asset:avatar:${preset.id}`} key={preset.id} position={[-6.25+(index%6)*2.5,0,-4.5+Math.floor(index/6)*3]} scale={1.6}><Character avatar={preset.id} color={["#dcac4d","#629cac","#bb7194","#7c9e60"][index%4]!} pose={pose} /></group>) : null}
    </QualityContext.Provider></Canvas></div>}
    <p className="mt-3">ลากเพื่อหมุน · เลื่อนเพื่อซูม · {mode === "buildings" ? "คอลัมน์ซ้ายไปขวา: ที่ดิน, ระดับ 1, 2, 3 / แถว: รูปทรง A และ B" : mode === "properties" ? "ช่องซื้อเรียงซ้ายไปขวา แถวละ 7 ตำแหน่ง" : mode === "avatars" ? "เรียงซ้ายไปขวา แถวละ 6 ตามรายการด้านล่าง" : locationById(map).landmark}</p>
    {mode === "properties" ? <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">{propertyTileIndices.map(index=><li key={index} className="rounded-lg border border-white/20 bg-white/5 p-2">{index}. {propertyPlaceName(map,index)}</li>)}</ol> : null}
    {mode === "avatars" ? <ol className="mt-3 grid list-inside list-decimal gap-2 sm:grid-cols-6">{avatarPresets.map((preset) => <li key={preset.id}>{preset.label}</li>)}</ol> : null}
    <p className="mt-3 text-sm">โมเดล procedural สร้างโดยโครงการเอง อ้างอิงบรรยากาศสถานที่ ไม่ใช่สำเนาทางสถาปัตยกรรมหรือแบบจำลองฟิสิกส์เชิงปริมาณ</p>
  </main>;
}
