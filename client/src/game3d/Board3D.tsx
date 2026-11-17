import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { locationById, type GameState, type Tile } from "@physics-monopoly/shared";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { CanvasTexture, CircleGeometry, Color, Euler, Float32BufferAttribute, Group, LinearFilter, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3, type Object3D } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { MoveEvent } from "../store/gameStore";
import { Character } from "./Character";
import { Box, CityEnvironment, LocalBuilding, TileMarker } from "./CityKit";
import type { AvatarPose } from "./AvatarFigure";
import { StaticBatch } from "./StaticBatch";
import { PlayerBadge } from "./PlayerBadge";
import { AssetMetrics } from "./AssetMetrics";
import { diceOrientations, pipPositions, tilePosition, tokenPosition } from "./diceGeometry";
import { PerformanceGuard, PostEffects, SKY, SceneLights, SkyAndEnvironment, WaterMotion } from "./Atmosphere";
import { QualityContext, type RenderQuality } from "./RenderQuality";
import { Ambience } from "./Ambience";
import { cameraFocus } from "./tabletop/cameraFocus";
import { DustMotes, JailCage, ROOM, TabletopConstruction, TabletopDice, TabletopLighting, TabletopMetalToken, TabletopPostEffects, TabletopProperty, TabletopSet, TokenPedestal } from "./tabletop/TabletopScene";

/** "tabletop": a real board game on a lamp-lit wooden table (default). "city": the original island-city diorama. */
export type BoardStyle = "tabletop" | "city";
/** Tabletop tokens: a painted miniature of the player's character, or a cast-metal physics token. */
export type PieceStyle = "figure" | "metal";

const playerColors = ["#34d399", "#f8c24a", "#f472b6", "#60a5fa", "#a78bfa", "#fb923c", "#2dd4bf", "#e879f9"];
const tileColors = ["#d99a36", "#2a9b9b", "#c75f46", "#f0dfb9", "#1f6f94"];

export function Board3D({ state, moveEvent, reducedMotion = false, quality: requestedQuality = "low", onUnavailable, onRestored, measureAssets = false, boardStyle = "tabletop", pieceStyle = "figure" }: { state: GameState; moveEvent: MoveEvent | null; reducedMotion?: boolean; quality?: RenderQuality; onUnavailable: () => void; onRestored?: () => void; measureAssets?: boolean; boardStyle?: BoardStyle; pieceStyle?: PieceStyle }): JSX.Element {
  const [reset, setReset] = useState(0);
  const [slowDevice, setSlowDevice] = useState(false);
  useEffect(() => setSlowDevice(false), [requestedQuality]);
  const quality: RenderQuality = requestedQuality === "high" && slowDevice ? "medium" : requestedQuality;
  const markSlow = useCallback(() => setSlowDevice(true), []);
  const [follow, setFollow] = useState(false);
  useEffect(() => setFollow(false), [state.currentPlayerIndex, reducedMotion]);
  const buildingsKey=state.tiles.map(tile=>`${tile.ownerId??""}:${tile.level??0}`).join(";");
  const priorBuildings=useRef(buildingsKey),[construction,setConstruction]=useState<number|null>(null);
  useEffect(()=>{
    const previous=priorBuildings.current.split(";");priorBuildings.current=buildingsKey;
    const next=buildingsKey.split(";"),changed=next.findIndex((value,index)=>value!==previous[index]);
    // Animate purchases/upgrades only; a property released by bankruptcy or a sale simply disappears.
    if(changed<0||reducedMotion||next[changed]!.startsWith(":")){setConstruction(null);return;}
    setConstruction(changed);const timer=window.setTimeout(()=>setConstruction(null),1900);return()=>window.clearTimeout(timer);
  },[buildingsKey,reducedMotion]);
  const city = locationById(state.mapId);
  if (boardStyle === "tabletop") return <TabletopBoard state={state} moveEvent={moveEvent} reducedMotion={reducedMotion} quality={quality} markSlow={markSlow} onUnavailable={onUnavailable} onRestored={onRestored} measureAssets={measureAssets} pieceStyle={pieceStyle} construction={construction} buildingsKey={buildingsKey} cityName={city.name}/>;
  return (
    <div className="board-frame relative h-[60vh] min-h-[360px] w-full" style={{ aspectRatio: "auto" }} aria-label={`กระดานสามมิติ${city.name}`}>
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2"><button className="rounded-lg bg-white px-3 py-3 font-bold" onClick={() => { setFollow(false); setReset(value => value+1); }}>ภาพรวม / รีเซ็ตกล้อง</button><button aria-pressed={follow} disabled={reducedMotion} className="rounded-lg bg-white px-3 py-3 font-bold disabled:opacity-50" onClick={()=>setFollow(value=>!value)}>ตามผู้เล่น{reducedMotion?" (ปิดเมื่อใช้ลดการเคลื่อนไหว)":""}</button></div>
      <Canvas shadows={quality !== "low"} camera={{ position: [0, 12, 15], fov: 38, near: .5, far: 220 }} dpr={quality === "low" ? 1 : quality === "high" ? [1, 1.75] : [1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.toneMappingExposure = 1.12; }} fallback={<p>ไม่สามารถเปิด 3 มิติ กรุณาเลือกกระดานข้อความ</p>}>
        <QualityContext.Provider value={quality}>
        {measureAssets ? <AssetMetrics/> : null}
        <CameraControls reset={reset} onUnavailable={onUnavailable} onRestored={onRestored} initialPosition={[0,12,15]} followTile={follow&&!reducedMotion?state.players[state.currentPlayerIndex]?.tileIndex:undefined} />
        <color attach="background" args={[SKY.fog]} />
        <fog attach="fog" args={[SKY.fog, 30, 72]} />
        <SkyAndEnvironment/>
        <SceneLights quality={quality}/>
        <WaterMotion reducedMotion={reducedMotion}/>
        {quality === "high" ? <><PostEffects/><PerformanceGuard onSlow={markSlow}/></> : null}
        <Ambience reducedMotion={reducedMotion}/>
        <StaticBatch version={`${city.id}:${buildingsKey}:${construction}`} name="asset:board-static">
          <CityEnvironment mapId={city.id} />
          <WalkingRing/>
          {state.tiles.map((tile) => <TileModel key={tile.index} mapId={city.id} tile={tile} hideBuilding={construction===tile.index} ownerIndex={state.players.findIndex((player) => player.id === tile.ownerId)} />)}
        </StaticBatch>
        <TileLabels tiles={state.tiles}/>
        {construction!==null&&state.tiles[construction]?.type==="property"?<Construction key={`${construction}:${buildingsKey}`} tile={state.tiles[construction]!} mapId={city.id}/>:null}
<group name="asset:tokens">{state.players.map((player, index) => <Token key={player.id} pose={state.phase === "answering" || state.phase === "reveal" ? "think" : state.phase === "moving" && index === state.currentPlayerIndex ? "walk" : "idle"} xp={player.xp} tileIndex={player.tileIndex} name={player.name} avatar={player.avatar} appearance={player.appearance} moveEvent={moveEvent?.playerId === player.id ? moveEvent : null} reducedMotion={reducedMotion} slot={index} color={playerColors[index % playerColors.length] ?? "#34d399"} />)}</group>
        {state.dice ? <Dice dice={state.dice} nonce={moveEvent?.nonce ?? 0} reducedMotion={reducedMotion} /> : null}
        </QualityContext.Provider>
      </Canvas>
    </div>
  );
}

const TABLETOP_CAMERA: [number,number,number] = [0, 10.5, 15.5];
const TABLETOP_TARGET: [number,number,number] = [0, 0, 1];

/** The lamp-lit tabletop scene: printed board, wooden pieces, money and cards, with cinematic camera moments. */
function TabletopBoard({ state, moveEvent, reducedMotion, quality, markSlow, onUnavailable, onRestored, measureAssets, pieceStyle, construction, buildingsKey, cityName }: { state: GameState; moveEvent: MoveEvent | null; reducedMotion: boolean; quality: RenderQuality; markSlow: () => void; onUnavailable: () => void; onRestored?: () => void; measureAssets: boolean; pieceStyle: PieceStyle; construction: number | null; buildingsKey: string; cityName: string }): JSX.Element {
  const [reset, setReset] = useState(0);
  const [cinematic, setCinematic] = useState(true);
  const mover = useRef<Group | null>(null);
  const tracking = cinematic && !reducedMotion;
  const ownerColor = (tile: Tile): string | null => { const owner = state.players.findIndex(player => player.id === tile.ownerId); return owner >= 0 ? playerColors[owner % playerColors.length] ?? "#34d399" : null; };
  const constructionTile = construction !== null ? state.tiles[construction] : undefined;
  const constructionColor = constructionTile ? ownerColor(constructionTile) : null;
  // Only real rolls (events that carry dice) re-throw the dice; forced moves such as "go to jail" do not.
  const throwNonce = useRef(0);
  if (moveEvent?.dice && moveEvent.nonce !== throwNonce.current) throwNonce.current = moveEvent.nonce;
  // Whatever was already true when the board mounted (reload, reconnect, renderer switch) is shown settled, not replayed.
  const mountedThrow = useRef(throwNonce.current), mountedAt = useRef(performance.now());
  const freshThrow = throwNonce.current !== mountedThrow.current;
  const diceValues: [number, number] | null = moveEvent?.dice && moveEvent.nonce === throwNonce.current ? moveEvent.dice : state.dice;
  return (
    <div className="board-frame tabletop-frame relative h-[60vh] min-h-[360px] w-full" aria-label={`กระดานเกมบนโต๊ะ ${cityName}`}>
      <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-2 sm:left-3 sm:top-3"><button className="min-h-11 rounded-lg bg-white/90 px-2 text-sm font-bold sm:px-3 sm:text-base" onClick={() => setReset(value => value + 1)}>ภาพรวม / รีเซ็ตกล้อง</button><button aria-pressed={tracking} disabled={reducedMotion} title={reducedMotion ? "ปิดอยู่เพราะเลือกลดการเคลื่อนไหว" : undefined} className="min-h-11 rounded-lg bg-white/90 px-2 text-sm font-bold disabled:opacity-50 sm:px-3 sm:text-base" onClick={() => setCinematic(value => !value)}>กล้องตามตัวเดิน: {tracking ? "เปิด" : "ปิด"}</button></div>
      <Canvas shadows={quality !== "low"} camera={{ position: TABLETOP_CAMERA, fov: 36, near: .3, far: 160 }} dpr={quality === "low" ? 1 : quality === "high" ? [1, 1.75] : [1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} onCreated={({ gl }) => { gl.toneMappingExposure = 1.05; }} fallback={<p>ไม่สามารถเปิด 3 มิติ กรุณาเลือกกระดานข้อความ</p>}>
        <QualityContext.Provider value={quality}>
        {measureAssets ? <AssetMetrics/> : null}
        <CameraControls reset={reset} onUnavailable={onUnavailable} onRestored={onRestored} initialPosition={TABLETOP_CAMERA} initialTarget={TABLETOP_TARGET} minDistance={5} maxDistance={30} trackRef={tracking ? mover : undefined}/>
        <color attach="background" args={[ROOM.background]}/>
        <fog attach="fog" args={[ROOM.fog, 26, 70]}/>
        <TabletopLighting quality={quality}/>
        {quality === "high" ? <><TabletopPostEffects closeUp={tracking && state.phase === "moving"}/><PerformanceGuard onSlow={markSlow}/></> : null}
        {quality !== "low" ? <DustMotes reducedMotion={reducedMotion}/> : null}
        <StaticBatch version={`tabletop:${cityName}:${buildingsKey}:${construction}:${quality}`} name="asset:board-static">
          <TabletopSet tiles={state.tiles} title="เศรษฐีฟิสิกส์" subtitle={cityName} quality={quality}/>
          {state.tiles.map(tile => tile.type === "property" ? <TabletopProperty key={tile.index} tile={tile} ownerColor={ownerColor(tile)} quality={quality} hidden={construction === tile.index}/> : null)}
        </StaticBatch>
        {constructionTile?.type === "property" && constructionColor ? <TabletopConstruction key={`${construction}:${buildingsKey}`} tile={constructionTile} ownerColor={constructionColor} quality={quality}/> : null}
        <group name="asset:tokens">{state.players.map((player, index) => <Token key={player.id} look={pieceStyle} quality={quality} groupRef={index === state.currentPlayerIndex ? mover : undefined} pose={state.phase === "answering" || state.phase === "reveal" ? "think" : state.phase === "moving" && index === state.currentPlayerIndex ? "walk" : "idle"} xp={player.xp} tileIndex={player.tileIndex} name={player.name} avatar={player.avatar} appearance={player.appearance} moveEvent={moveEvent?.playerId === player.id ? moveEvent : null} reducedMotion={reducedMotion} slot={index} color={playerColors[index % playerColors.length] ?? "#34d399"} />)}</group>
        {state.players.map((player, index) => player.inJail && !player.bankrupt ? <JailCage key={`jail:${player.id}`} position={tokenPosition(player.tileIndex, index)} reducedMotion={reducedMotion || performance.now() - mountedAt.current < 1500}/> : null)}
        {diceValues ? <TabletopDice dice={diceValues} nonce={throwNonce.current} animate={freshThrow} reducedMotion={reducedMotion}/> : null}
        </QualityContext.Provider>
      </Canvas>
    </div>
  );
}

function WalkingRing(): JSX.Element {
  // A continuous raised promenade supports the second row of tokens outside tile
  // footprints. Top is just below tile tops, avoiding coplanar z-fighting.
  return <group>{[-1,1].map(side=><group key={side}>
    <Box at={[0,.015,side*6.8]} size={[15.7,.48,2.1]} color="#a39c8c" roughness={.82} surface="stone"/>
    <Box at={[side*6.8,.015,0]} size={[2.1,.48,11.5]} color="#a39c8c" roughness={.82} surface="stone"/>
    <Box at={[0,.262,side*7.78]} size={[15.7,.03,.07]} color="#d8b366" metalness={.8} roughness={.3}/>
    <Box at={[side*7.78,.262,0]} size={[.07,.03,11.5]} color="#d8b366" metalness={.8} roughness={.3}/>
    <Box at={[0,.262,side*5.82]} size={[13.6,.03,.05]} color="#d8b366" metalness={.8} roughness={.3}/>
  </group>)}</group>;
}

export function CameraControls({ reset, onUnavailable, onRestored, followTile, initialPosition = [0,17,18], initialTarget = [0,0,0], minDistance = 12, maxDistance = 32, trackRef }: { reset: number; onUnavailable: () => void; onRestored?: () => void; followTile?: number; initialPosition?: [number,number,number]; initialTarget?: [number,number,number]; minDistance?: number; maxDistance?: number; trackRef?: MutableRefObject<Object3D | null> }): null {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const desiredTarget = useMemo(() => { const [x,z] = tilePosition(followTile ?? 0); return followTile === undefined ? new Vector3(...initialTarget) : new Vector3(x*.7,0,z*.7); },[followTile,initialTarget[0],initialTarget[1],initialTarget[2]]);
  const shift = useMemo(() => new Vector3(), []);
  const sampleAt = useRef(0);
  const frames=useRef(0);
  // Cinematic tracking: while the tracked token walks (userData.moving) the camera glides to it and dollies in,
  // lingers briefly after it stops, then eases back to the distance and look-at point the player had before.
  // `suppressed`: the player grabbed the camera (orbit/zoom/reset) during this walk, so stop steering it until the walk ends.
  const track = useMemo(() => ({ active: false, linger: 0, restore: 0, suppressed: false, point: new Vector3(), offset: new Vector3() }), []);
  // Callbacks live in refs so a parent re-render with new function identities never rebuilds (and snaps) the camera.
  const callbacks = useRef({ onUnavailable, onRestored });
  callbacks.current = { onUnavailable, onRestored };
  useFrame(({ clock },delta) => {
    const controls = controlsRef.current;
    const tracked = trackRef?.current, walking = Boolean(tracked?.userData.moving);
    if (!walking && track.linger <= 0) track.suppressed = false;
    track.linger = walking ? 1.3 : Math.max(0, track.linger - delta);
    if (controls && tracked && track.linger > 0 && !track.suppressed) {
      if (!track.active) { track.active = true; track.restore = camera.position.distanceTo(controls.target); }
      tracked.getWorldPosition(track.point); track.point.y += .45;
      shift.copy(track.point).sub(controls.target).multiplyScalar(Math.min(1,delta*2.6));
      controls.target.add(shift); camera.position.add(shift);
      track.offset.copy(camera.position).sub(controls.target);
      const distance = track.offset.length(), close = Math.max(minDistance, 7.5);
      if (distance > close) camera.position.copy(controls.target).addScaledVector(track.offset.normalize(), distance + (close - distance) * Math.min(1, delta * 1.6));
      controls.update();
    } else if (controls) {
      if (controls.target.distanceToSquared(desiredTarget) > .00001) {
        shift.copy(desiredTarget).sub(controls.target).multiplyScalar(Math.min(1,delta*3));
        controls.target.add(shift); camera.position.add(shift);
      }
      if (track.active) {
        track.offset.copy(camera.position).sub(controls.target);
        const distance = track.offset.length();
        if (Math.abs(track.restore - distance) < .05) track.active = false;
        else camera.position.copy(controls.target).addScaledVector(track.offset.normalize(), distance + (track.restore - distance) * Math.min(1, delta * 1.8));
      }
      controls.update();
    }
    if (controls) cameraFocus.copy(controls.target);
    frames.current++;
    if (clock.elapsedTime - sampleAt.current < 1) return;
    gl.domElement.dataset.fps=(frames.current/(clock.elapsedTime-sampleAt.current)).toFixed(1);frames.current=0;
    sampleAt.current = clock.elapsedTime;
    gl.domElement.dataset.drawCalls = String(gl.info.render.calls);
    gl.domElement.dataset.triangles = String(gl.info.render.triangles);
    gl.domElement.dataset.cameraPosition = camera.position.toArray().map((value) => value.toFixed(2)).join(",");
  });
  useEffect(() => {
    camera.position.set(...initialPosition);
    const controls = new OrbitControls(camera, gl.domElement);
    controlsRef.current = controls; track.active = false; track.linger = 0;
    // A reset (or remount) mid-walk shows the overview instead of being dragged straight back to the token.
    track.suppressed = Boolean(trackRef?.current?.userData.moving);
    const grabbed = () => { track.suppressed = Boolean(trackRef?.current); track.active = false; };
    controls.addEventListener("start", grabbed);
    controls.target.set(...initialTarget);
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    controls.minPolarAngle = Math.PI / 6;
    controls.maxPolarAngle = Math.PI / 2.4;
    controls.enablePan = false;
    controls.update();
    const lost = (event: Event) => { event.preventDefault(); callbacks.current.onUnavailable(); };
    const restored = () => callbacks.current.onRestored?.();
    gl.domElement.addEventListener("webglcontextlost", lost);
    gl.domElement.addEventListener("webglcontextrestored", restored);
    if (gl.getContext().isContextLost()) callbacks.current.onUnavailable();
    return () => { controlsRef.current = null; controls.removeEventListener("start", grabbed); controls.dispose(); gl.domElement.removeEventListener("webglcontextlost", lost); gl.domElement.removeEventListener("webglcontextrestored", restored); };
  }, [camera, gl, reset, initialPosition[0],initialPosition[1],initialPosition[2],initialTarget[0],initialTarget[1],initialTarget[2],minDistance,maxDistance,track]);
  return null;
}

function BangkokEnvironment(): JSX.Element {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]}>
        <planeGeometry args={[28, 28]} />
        <meshStandardMaterial color="#5ab4d5" roughness={0.38} metalness={0.05} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color="#6ea866" roughness={0.9} />
      </mesh>
      <ThaiLandmark />
      {Array.from({ length: 10 }, (_, index) => <Tree key={index} position={[-3.5 + (index % 5) * 1.75, 0, -3.5 + Math.floor(index / 5) * 7]} />)}
    </group>
  );
}

function ThaiLandmark(): JSX.Element {
  return (
    <group position={[0, 0, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.7, 0]}><boxGeometry args={[5, 1.4, 3]} /><meshStandardMaterial color="#f4e4b4" /></mesh>
      <mesh castShadow position={[0, 1.65, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[3.2, 1.4, 4]} /><meshStandardMaterial color="#b83a2e" metalness={0.15} /></mesh>
      <mesh castShadow position={[0, 3.1, 0]}><coneGeometry args={[0.28, 2.6, 5]} /><meshStandardMaterial color="#e5b844" metalness={0.5} /></mesh>
      <mesh castShadow position={[4.2, 0.4, 0]}><boxGeometry args={[0.35, 0.8, 8]} /><meshStandardMaterial color="#9b5d39" /></mesh>
      <mesh castShadow position={[-4.2, 0.4, 0]}><boxGeometry args={[0.35, 0.8, 8]} /><meshStandardMaterial color="#9b5d39" /></mesh>
    </group>
  );
}

function Tree({ position }: { position: [number, number, number] }): JSX.Element {
  return <group position={position}><mesh castShadow position={[0, 0.5, 0]}><cylinderGeometry args={[0.12, 0.18, 1]} /><meshStandardMaterial color="#70452d" /></mesh><mesh castShadow position={[0, 1.35, 0]}><coneGeometry args={[0.75, 1.5, 7]} /><meshStandardMaterial color="#2e804d" /></mesh></group>;
}

function TileModel({ tile, ownerIndex, mapId, hideBuilding = false }: { tile: Tile; ownerIndex: number; mapId: string; hideBuilding?: boolean }): JSX.Element {
  const [x, z, rotation] = tilePosition(tile.index);
  const isProperty = tile.type === "property";
  const color = isProperty ? tile.groupColor ?? tileColors[tile.index % tileColors.length] ?? "#d99a36" : "#d2bd91";
  const owner = ownerIndex >= 0 ? playerColors[ownerIndex % playerColors.length] ?? "#34d399" : null;
  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <Box at={[0,.15,0]} size={[1.65,.3,1.15]} color="#1a3140" roughness={.5} surface="stone"/>
      <Box at={[0,.306,0]} size={[1.56,.018,1.06]} color={isProperty?"#48697a":"#d8ccb2"} roughness={.55} surface={isProperty?"stone":"plaster"}/>
      {[-1,1].map(side=><group key={side}>
        <Box at={[0,.318,side*.535]} size={[1.58,.022,.03]} color="#d8b366" metalness={.8} roughness={.3}/>
        <Box at={[side*.785,.318,0]} size={[.03,.022,1.1]} color="#d8b366" metalness={.8} roughness={.3}/>
      </group>)}
      <Box at={[0,.322,.465]} size={[1.52,.014,.13]} color={color} emissive={color} emissiveIntensity={.4} roughness={.35}/>
      <group position={[0, 0, -0.3]}>{isProperty ? hideBuilding ? null : <LocalBuilding mapId={mapId} tileIndex={tile.index} variant={tile.index % 2} level={tile.level ?? 0} owned={Boolean(tile.ownerId)} /> : <TileMarker type={tile.type} />}</group>
      {owner ? <group position={[.68,0,-.47]}>
        <mesh position={[0,.34,0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.1, ownerIndex + 3]} /><meshStandardMaterial color={owner} emissive={owner} emissiveIntensity={.5}/></mesh>
        <mesh castShadow position={[0,.6,0]}><cylinderGeometry args={[.012,.012,.56,6]}/><meshStandardMaterial color="#d8dde0" metalness={.8} roughness={.3}/></mesh>
        <mesh castShadow position={[-.08,.8,0]}><boxGeometry args={[.16,.11,.012]}/><meshStandardMaterial color={owner} emissive={owner} emissiveIntensity={.35} roughness={.5}/></mesh>
      </group> : null}
    </group>
  );
}

function TileLabels({ tiles }: { tiles: Tile[] }): JSX.Element {
  const names = tiles.map(tile => `${tile.index}:${tile.name}`).join("|");
  const { texture, geometry } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024; canvas.height = 448;
    const context = canvas.getContext("2d")!;
    const parts = tiles.map((tile,index) => {
      const column = index % 4, row = Math.floor(index / 4);
      const px = column * 256, py = row * 64;
      context.fillStyle = tile.type === "property" ? "#eef8fa" : "#1e3b4b";
      context.font = '700 29px "Noto Sans Thai", sans-serif';
      context.textAlign = "center"; context.textBaseline = "middle";
      let label = tile.name;
      while (context.measureText(label).width > 238 && label.length > 3) label = label.slice(0,-1);
      if (label !== tile.name) label += "…";
      context.fillText(label, px+128, py+33);
      const plane = new PlaneGeometry(1.34,.25);
      const uv = plane.getAttribute("uv");
      for (let vertex=0;vertex<uv.count;vertex++) {
        uv.setXY(vertex,(column+uv.getX(vertex))/4,1-(row+1-uv.getY(vertex))/7);
      }
      const [x,z,rotation] = tilePosition(tile.index);
      plane.rotateX(-Math.PI/2).translate(0,.345,.24).rotateY(rotation).translate(x,0,z);
      return plane;
    });
    const merged = mergeGeometries(parts,false)!;
    parts.forEach(part => part.dispose());
    const map = new CanvasTexture(canvas);
    map.colorSpace = SRGBColorSpace; map.minFilter = LinearFilter; map.magFilter = LinearFilter;
    return { texture: map, geometry: merged };
  },[names]);
  useEffect(() => () => { texture.dispose(); geometry.dispose(); },[texture,geometry]);
  return <mesh geometry={geometry} renderOrder={2}><meshBasicMaterial map={texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1}/></mesh>;
}

function Construction({tile,mapId}:{tile:Tile;mapId:string}):JSX.Element {
  const [x,z,rotation]=tilePosition(tile.index),root=useRef<Group>(null),progress=useRef(0);
  useFrame((_state,delta)=>{progress.current=Math.min(1,progress.current+delta/1.8);if(root.current)root.current.scale.y=1-Math.pow(1-progress.current,3);});
  return <group position={[x,0,z]} rotation={[0,rotation,0]}><group position={[0,0,-.3]} ref={root} scale={[1,.01,1]}><LocalBuilding mapId={mapId} tileIndex={tile.index} variant={tile.index%2} level={tile.level??0} owned={Boolean(tile.ownerId)}/></group></group>;
}

export function Building({ level, owned }: { level: number; owned: boolean }): JSX.Element {
  if (!owned || level === 0) return <mesh position={[0, 0.35, 0]}><boxGeometry args={[0.95, 0.08, 0.7]} /><meshStandardMaterial color={owned ? "#a8bb76" : "#96744b"} /></mesh>;
  const height = [0, 0.7, 1.25, 2.05][Math.min(3, level)] ?? 0.7;
  return <group>
    <mesh castShadow receiveShadow position={[0, 0.34 + height / 2, 0]}><boxGeometry args={[0.86, height, 0.72]} /><meshStandardMaterial color={level === 3 ? "#e6c36e" : "#f4e2bf"} roughness={0.5} /></mesh>
    <mesh castShadow position={[0, 0.42 + height, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[0.72, 0.45, 4]} /><meshStandardMaterial color={level === 3 ? "#bd4034" : "#b46a45"} /></mesh>
    {Array.from({ length: level }, (_, floor) => <mesh key={floor} position={[0, 0.6 + floor * 0.5, 0.365]}><boxGeometry args={[0.6, 0.18, 0.015]} /><meshStandardMaterial color="#447b93" metalness={0.35} roughness={0.22} /></mesh>)}
  </group>;
}

function Token({ tileIndex, slot, color, avatar, moveEvent, reducedMotion, pose, xp, appearance, name, look = "city", quality = "medium", groupRef }: { name: string; tileIndex: number; slot: number; color: string; avatar: string; moveEvent: MoveEvent | null; reducedMotion: boolean; pose: AvatarPose; xp: number; appearance?: import("@physics-monopoly/shared").Appearance; look?: "city" | PieceStyle; quality?: RenderQuality; groupRef?: MutableRefObject<Group | null> }): JSX.Element {
  const previousXp = useRef(xp), [celebrating, setCelebrating] = useState(false);
  useEffect(() => {
    if (xp <= previousXp.current) return;
    previousXp.current = xp; setCelebrating(true);
    const timer = window.setTimeout(() => setCelebrating(false), 1800);
    return () => window.clearTimeout(timer);
  }, [xp]);
  function targetFor(index: number): Vector3 {
    return new Vector3(...tokenPosition(index, slot));
  }
  const initial = useRef(targetFor(tileIndex));
  const ref = useRef<Group | null>(null);
  const attach = useCallback((group: Group | null) => { ref.current = group; if (groupRef) groupRef.current = group; }, [groupRef]);
  useEffect(() => { if (groupRef) groupRef.current = ref.current; return () => { if (groupRef && groupRef.current === ref.current) groupRef.current = null; }; }, [groupRef]);
  const queue = useRef<Vector3[]>([]);
  const hop = useRef(0);
  const speed = useRef(5);
  // The move event already in the store when this token mounted is history: never replay it.
  const lastNonce = useRef<number | null>(moveEvent?.nonce ?? null);
  useEffect(() => {
    const destination = targetFor(tileIndex), nonce = moveEvent?.nonce ?? null;
    const fresh = nonce !== null && nonce !== lastNonce.current;
    if (fresh) lastNonce.current = nonce;
    if (reducedMotion) { queue.current = []; ref.current?.position.copy(destination); return; }
    if (fresh && moveEvent) {
      queue.current = moveEvent.path.map(targetFor);
      let previous = ref.current?.position ?? destination, distance = 0;
      for (const point of queue.current) { distance += previous.distanceTo(point); previous = point; }
      speed.current = Math.max(5, distance / 2.4);
      if (!queue.current.length) ref.current?.position.copy(destination);
      return;
    }
    // A snapshot changed the tile (or seat) without a new move event.
    if (queue.current.length) {
      // Mid-walk: keep walking, but make sure the walk ends on the authoritative space.
      if (!queue.current.at(-1)!.equals(destination)) queue.current.push(destination);
      return;
    }
    // Idle: the snapshot may simply have beaten its move event over the network, so wait briefly before snapping.
    const timer = window.setTimeout(() => { if (!queue.current.length) ref.current?.position.copy(targetFor(tileIndex)); }, 650);
    return () => window.clearTimeout(timer);
  }, [moveEvent?.nonce, tileIndex, slot, reducedMotion]);
  useFrame((_state, delta) => {
    const token = ref.current;
    const target = queue.current[0];
    if (token) token.userData.moving = Boolean(target);
    if (!token || !target) return;
    const distance = Math.hypot(target.x - token.position.x, target.z - token.position.z);
    const step = Math.min(1, delta * speed.current / Math.max(distance, 0.001));
    token.rotation.y = Math.atan2(target.x - token.position.x, target.z - token.position.z);
    token.position.x += (target.x - token.position.x) * step; token.position.z += (target.z - token.position.z) * step;
    // Metal tokens are lifted and hopped space to space, the way a hand moves a real piece.
    if (look === "metal") { hop.current += delta * speed.current / 1.75 * Math.PI; token.position.y = target.y + Math.abs(Math.sin(hop.current)) * .32; } else token.position.y = target.y;
    if (distance < 0.03) { token.position.set(target.x, look === "metal" ? token.position.y : target.y, target.z); queue.current.shift(); if (!queue.current.length) { hop.current = 0; token.position.y = target.y; } }
  });
  const figure = <Character appearance={appearance} badge={slot} avatar={avatar} color={color} pose={celebrating ? "celebrate" : pose} reducedMotion={reducedMotion} />;
  return <group ref={attach} position={initial.current}>
    {look === "city" ? figure : look === "metal" ? <TabletopMetalToken slot={slot} color={color} quality={quality}/> : <><TokenPedestal color={color}/><group position={[0,.065,0]} scale={.82}>{figure}</group></>}
    <PlayerBadge name={name} slot={slot}/>
  </group>;
}

function Dice({ dice, nonce, reducedMotion }: { dice: [number, number]; nonce: number; reducedMotion: boolean }): JSX.Element {
  return <group name="asset:dice:pair" position={[0, 1.1, 4.5]}>{dice.map((value, index) => <group key={index} position={[index === 0 ? -0.75 : 0.75, 0, 0]}><Die value={value} nonce={nonce} reducedMotion={reducedMotion} /></group>)}</group>;
}

function Die({ value, nonce, reducedMotion }: { value: number; nonce: number; reducedMotion: boolean }): JSX.Element {
  const ref = useRef<Group>(null);
  const elapsed = useRef(0);
  const target = useMemo(() => new Quaternion().setFromEuler(new Euler(...(diceOrientations[value] ?? diceOrientations[1]!))), [value]);
  useEffect(() => { elapsed.current = 0; if (reducedMotion) ref.current?.quaternion.copy(target); }, [nonce, reducedMotion, target]);
  useFrame((_state, delta) => {
    if (!ref.current || reducedMotion) return;
    elapsed.current += delta;
    if (elapsed.current < 0.6) { ref.current.rotation.x += delta * 12; ref.current.rotation.z += delta * 9; }
    else ref.current.quaternion.slerp(target, Math.min(1, delta * 12));
  });
  const faces: Array<{ value: number; position: [number, number, number]; rotation: [number, number, number] }> = [
    { value: 1, position: [0, 0.502, 0], rotation: [-Math.PI / 2, 0, 0] },
    { value: 6, position: [0, -0.502, 0], rotation: [Math.PI / 2, 0, 0] },
    { value: 2, position: [0, 0, 0.502], rotation: [0, 0, 0] },
    { value: 5, position: [0, 0, -0.502], rotation: [0, Math.PI, 0] },
    { value: 3, position: [0.502, 0, 0], rotation: [0, Math.PI / 2, 0] },
    { value: 4, position: [-0.502, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  ];
  const { pips, body } = useMemo(() => {
    const ink = new Color("#1c2638"), ace = new Color("#c9303e");
    const parts = faces.flatMap((face) => pipPositions(face.value).map(([x,y]) => {
      const pip = new CircleGeometry(face.value === 1 ? .1 : .072,20).translate(x,y,0).rotateX(face.rotation[0]).rotateY(face.rotation[1]).rotateZ(face.rotation[2]).translate(...face.position);
      const tint = face.value === 1 ? ace : ink, count = pip.getAttribute("position").count;
      pip.setAttribute("color", new Float32BufferAttribute(Array.from({ length: count }, () => [tint.r, tint.g, tint.b]).flat(), 3));
      return pip;
    }));
    const merged = mergeGeometries(parts, false)!; parts.forEach((part) => part.dispose());
    return { pips: merged, body: new RoundedBoxGeometry(1, 1, 1, 4, .13) };
  }, []);
  useEffect(() => () => { pips.dispose(); body.dispose(); }, [pips, body]);
  return <group ref={ref}>
    <mesh castShadow receiveShadow geometry={body}><meshPhysicalMaterial color="#fffaf0" roughness={.32} clearcoat={1} clearcoatRoughness={.12}/></mesh>
    <mesh geometry={pips}><meshStandardMaterial vertexColors roughness={.35}/></mesh>
  </group>;
}

