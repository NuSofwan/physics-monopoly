import { useFrame, useThree } from "@react-three/fiber";
import type { Tile } from "@physics-monopoly/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending, BufferGeometry, CanvasTexture, CircleGeometry, Color, Euler, Float32BufferAttribute, Group, HalfFloatType, LatheGeometry,
  Object3D, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Points, Quaternion, SpotLight, Vector2, Vector3, WebGLRenderTarget,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { VignetteShader } from "three/examples/jsm/shaders/VignetteShader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { diceOrientations, pipPositions, tilePosition } from "../diceGeometry";
import type { RenderQuality } from "../RenderQuality";
import { OVERLAY_LAYER } from "../Atmosphere";
import { playSound } from "../../audio/sound";
import { cameraFocus, directorShot } from "./cameraFocus";
import { BILLS, BOARD_HALF, DECK_SIZE, DECK_SLOTS, billAtlas, boardFaceTexture, deckAtlas, deedAtlas, mortgagedSignTexture, walnutTexture } from "./TabletopTextures";
import { MetalToken, OwnershipPeg, PropertyPiece, TOKEN_KINDS } from "./TabletopPieces";

/** Board top surface height; tokens stand at y = 0.30 (see tokenPosition). */
export const BOARD_TOP = .3;
const BOARD_THICK = .07;
export const TABLE_TOP = BOARD_TOP - BOARD_THICK;
export const ROOM = { background: "#080503", fog: "#080503" } as const;
/** Local z of the printed colour band where buildings sit (see drawSpace). */
const BAND_Z = -.6;

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}
function atlasPlane(width: number, depth: number, u0: number, v0: number, u1: number, v1: number): PlaneGeometry {
  const plane = new PlaneGeometry(width, depth), uv = plane.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  plane.rotateX(-Math.PI / 2);
  return plane;
}

// ───────────────────────────── Static set dressing ─────────────────────────────

/** Polished walnut table, printed board, banknotes, deeds, card decks, mug, table lamp, spare dice and chairs. Static: safe inside StaticBatch. */
export function TabletopSet({ tiles, title, subtitle, quality }: { tiles: Tile[]; title: string; subtitle: string; quality: RenderQuality }): JSX.Element {
  const names = tiles.map(tile => `${tile.name}:${tile.price ?? ""}`).join("|");
  // 4096² only on the high tier (desktops); tablets/phones default to medium and keep a 2048² print (~16 MB less ×4).
  const face = useMemo(() => boardFaceTexture(tiles, title, subtitle, quality === "high" ? 4096 : 2048, tilePosition), [names, title, subtitle, quality]);
  useEffect(() => () => face.dispose(), [face]);
  const wood = useMemo(() => { const texture = walnutTexture().clone(); texture.repeat.set(2.2, 3.2); texture.needsUpdate = true; return texture; }, []);
  const boardBody = useMemo(() => new RoundedBoxGeometry(BOARD_HALF * 2, BOARD_THICK, BOARD_HALF * 2, 2, .035), []);
  const tableBody = useMemo(() => new RoundedBoxGeometry(36, 1.4, 28, 3, .35), []);
  useEffect(() => () => { boardBody.dispose(); tableBody.dispose(); wood.dispose(); }, [boardBody, tableBody, wood]);
  return <group name="tabletop:set">
    {/* Table: lacquered dark walnut with clearcoat so the lamp leaves a soft warm specular pool like the video. */}
    <mesh receiveShadow geometry={tableBody} position={[0, TABLE_TOP - .7, -1]}>
      <meshPhysicalMaterial color="#b88962" map={wood} roughness={.36} clearcoat={.78} clearcoatRoughness={.18}/>
    </mesh>
    {/* Board: deep navy/gold cloth-wrapped edge with the printed face on top. */}
    <mesh castShadow receiveShadow geometry={boardBody} position={[0, BOARD_TOP - BOARD_THICK / 2, 0]}>
      <meshStandardMaterial color="#101e33" roughness={.75}/>
    </mesh>
    <mesh receiveShadow position={[0, BOARD_TOP + .001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[BOARD_HALF * 2 - .04, BOARD_HALF * 2 - .04]}/>
      <meshStandardMaterial map={face} color="#e7ddca" roughness={.56} metalness={0}/>
    </mesh>
    <CardDecks/>
    <MoneyStacks/>
    <DeedFan tiles={tiles}/>
    {/* Coffee mug on saucer at upper-right of the board & coloured tokens/dice on the right like 00:00 of the video */}
    <Mug position={[6.8, TABLE_TOP, -10.2]}/>
    <Mug position={[-12.2, TABLE_TOP, -5.5]}/>
    <SpareTablePieces position={[10.8, TABLE_TOP, -7.8]}/>
    <TableLampShade position={[-9.5, TABLE_TOP, -12.8]}/>
    <Notebook position={[12.2, TABLE_TOP, -5.2]}/>
    <Chair position={[0, 0, -17.5]}/>
    <Chair position={[-19, 0, 2]} rotation={Math.PI / 2}/>
    {/* Floor far below: catches a little bounce so the room is not a void. */}
    <mesh receiveShadow position={[0, -9, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[160, 160]}/><meshStandardMaterial color="#160e09" roughness={.9}/></mesh>
  </group>;
}

/** Warm glowing pleated lampshade in the background (matches the warm desk/floor lamp in 00:03 of the video). */
function TableLampShade({ position }: { position: [number, number, number] }): JSX.Element {
  return <group position={position}>
    <mesh castShadow receiveShadow position={[0, .12, 0]}><cylinderGeometry args={[.75, .95, .24, 24]}/><meshStandardMaterial color="#3b2618" metalness={.4} roughness={.45}/></mesh>
    <mesh castShadow position={[0, 1.45, 0]}><cylinderGeometry args={[.14, .22, 2.5, 16]}/><meshStandardMaterial color="#b58942" metalness={.85} roughness={.28}/></mesh>
    <mesh position={[0, 2.85, 0]}><cylinderGeometry args={[.85, 1.35, 1.35, 28, 1, true]}/><meshStandardMaterial color="#ffdfa8" emissive="#ffae42" emissiveIntensity={.75} roughness={.65} side={2}/></mesh>
    <mesh position={[0, 2.75, 0]}><sphereGeometry args={[.35, 16, 12]}/><meshStandardMaterial color="#fff6dc" emissive="#ffd27d" emissiveIntensity={1.6}/></mesh>
  </group>;
}

/** Cluster of spare wooden houses, red hotel pieces and brass coins resting on the walnut table (upper-right in 00:00 of the video). */
function SpareTablePieces({ position }: { position: [number, number, number] }): JSX.Element {
  const pieces: Array<{ x: number; z: number; rot: number; color: string; hotel?: boolean }> = [
    { x: -.55, z: -.25, rot: .35, color: "#258944" },
    { x: .15, z: -.48, rot: -.4, color: "#258944" },
    { x: .58, z: .12, rot: .8, color: "#258944" },
    { x: -.18, z: .38, rot: -.22, color: "#c82321", hotel: true },
    { x: .85, z: -.38, rot: .15, color: "#c82321", hotel: true },
  ];
  return <group position={position}>
    {pieces.map((p, i) => (
      <group key={i} position={[p.x, 0, p.z]} rotation={[0, p.rot, 0]}>
        <mesh castShadow receiveShadow position={[0, p.hotel ? .24 : .16, 0]}>
          <boxGeometry args={p.hotel ? [.46, .48, .34] : [.34, .32, .28]}/>
          <meshStandardMaterial color={p.color} roughness={.32}/>
        </mesh>
      </group>
    ))}
  </group>;
}

function CardDecks(): JSX.Element {
  const texture = useMemo(() => deckAtlas(), []);
  const geometries = useMemo(() => DECK_SLOTS.map((slot, i) => atlasPlane(DECK_SIZE[0], DECK_SIZE[1], i * .5, 0, i * .5 + .5, 1)), []);
  const edge = useMemo(() => new RoundedBoxGeometry(DECK_SIZE[0], .22, DECK_SIZE[1], 1, .03), []);
  useEffect(() => () => { texture.dispose(); geometries.forEach(geometry => geometry.dispose()); edge.dispose(); }, [texture, geometries, edge]);
  return <group>{DECK_SLOTS.map((slot, i) => <group key={slot.kind} position={[slot.x, BOARD_TOP, slot.z]} rotation={[0, slot.rotation, 0]}>
    <mesh castShadow receiveShadow geometry={edge} position={[0, .11, 0]}><meshStandardMaterial color={slot.kind === "chance" ? "#e57822" : "#dfd5be"} roughness={.65}/></mesh>
    {/* Layered card edges read as a real stack. */}
    {[.04, .09, .14, .18].map(y => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[DECK_SIZE[0] + .006, .006, DECK_SIZE[1] + .006]}/><meshStandardMaterial color="#c9bfa8" roughness={.8}/></mesh>)}
    <mesh receiveShadow geometry={geometries[i]} position={[0, .222, 0]}><meshStandardMaterial map={texture} roughness={.42}/></mesh>
    {/* One card slightly askew on top. */}
    <mesh castShadow receiveShadow geometry={geometries[i]} position={[.06, .234, -.04]} rotation={[0, .07, 0]}><meshStandardMaterial map={texture} roughness={.42}/></mesh>
  </group>)}</group>;
}

function MoneyStacks(): JSX.Element {
  const texture = useMemo(() => billAtlas(), []);
  const rows = BILLS.length;
  const tops = useMemo(() => BILLS.map((_, i) => atlasPlane(2.05, .92, 0, 1 - (i + 1) / rows, 1, 1 - i / rows)), [rows]);
  useEffect(() => () => { texture.dispose(); tops.forEach(top => top.dispose()); }, [texture, tops]);
  const stacks = useMemo(() => {
    const next = random(9);
    // Clean banker's row of 4 crisp stacks (50, 20, 10, 100) right in front of the player (z ≈ 10.6) like 00:00–00:01 of the video, plus two side stacks!
    const layout: Array<{ x: number; z: number; yaw: number }> = [
      { x: -3.45, z: 10.75, yaw: -.03 },
      { x: -1.15, z: 10.82, yaw: .02 },
      { x: 1.15, z: 10.78, yaw: -.02 },
      { x: 3.45, z: 10.72, yaw: .04 },
      { x: -7.2, z: 9.85, yaw: .14 },
      { x: 7.2, z: 9.85, yaw: -.12 },
    ];
    return BILLS.map((bill, i) => {
      const pos = layout[i] ?? { x: (i - 2.5) * 2.3, z: 10.5, yaw: 0 };
      const count = 8 + Math.floor(next() * 6);
      const sheets = Array.from({ length: count }, (_, s) => ({ dx: (next() - .5) * .06, dz: (next() - .5) * .05, yaw: (next() - .5) * .05, y: s * .012 }));
      return { bill, i, x: pos.x, z: pos.z, yaw: pos.yaw, sheets };
    });
  }, []);
  return <group>{stacks.map(stack => <group key={stack.i} position={[stack.x, TABLE_TOP, stack.z]} rotation={[0, stack.yaw, 0]}>
    {stack.sheets.map((sheet, s) => <mesh key={s} castShadow receiveShadow position={[sheet.dx, .006 + sheet.y, sheet.dz]} rotation={[0, sheet.yaw, 0]}><boxGeometry args={[2.05, .01, .92]}/><meshStandardMaterial color={stack.bill.color} roughness={.82}/></mesh>)}
    <mesh receiveShadow geometry={tops[stack.i]} position={[0, .013 + (stack.sheets.length - 1) * .012, 0]}><meshStandardMaterial map={texture} roughness={.76}/></mesh>
  </group>)}</group>;
}

function DeedFan({ tiles }: { tiles: Tile[] }): JSX.Element {
  const deeds = useMemo(() => [1, 4, 11, 19, 24].map(index => tiles[index]).filter((tile): tile is Tile => tile?.type === "property"), [tiles]);
  const key = deeds.map(tile => tile.name).join("|");
  const texture = useMemo(() => deedAtlas(deeds), [key]);
  const cards = useMemo(() => deeds.map((_, i) => atlasPlane(1.26, 1.98, i / deeds.length, 0, (i + 1) / deeds.length, 1)), [key]);
  useEffect(() => () => { texture.dispose(); cards.forEach(card => card.dispose()); }, [texture, cards]);
  // Placed neatly between the board's near edge (z = 8.1) and the foreground money stacks (z = 10.75) like 00:00–00:01 of the video!
  return <group position={[.2, TABLE_TOP, 9.2]} rotation={[0, 0, 0]}>
    {cards.map((card, i) => <group key={i} position={[(i - 2) * 1.42, .005 + i * .004, (i % 2) * .06]} rotation={[0, (i - 2) * -.025, 0]}>
      <mesh castShadow receiveShadow position={[0, -.002, 0]}><boxGeometry args={[1.28, .008, 2]}/><meshStandardMaterial color="#ede6d6" roughness={.78}/></mesh>
      <mesh receiveShadow geometry={card} position={[0, .003, 0]}><meshStandardMaterial map={texture} roughness={.68}/></mesh>
    </group>)}
  </group>;
}

function Mug({ position }: { position: [number, number, number] }): JSX.Element {
  const { body, saucer } = useMemo(() => {
    const profile = [[0, .02], [.55, .02], [.62, .1], [.66, 1.05], [.6, 1.05], [.56, .14], [0, .14]].map(([x, y]) => new Vector2(x!, y!));
    const plate = [[0, 0], [1, 0], [1.08, .07], [1.02, .09], [.6, .05], [0, .05]].map(([x, y]) => new Vector2(x!, y!));
    return { body: new LatheGeometry(profile, 40), saucer: new LatheGeometry(plate, 40) };
  }, []);
  useEffect(() => () => { body.dispose(); saucer.dispose(); }, [body, saucer]);
  return <group position={position}>
    <mesh castShadow receiveShadow geometry={saucer}><meshPhysicalMaterial color="#f4efe6" roughness={.18} clearcoat={1}/></mesh>
    <group position={[0, .05, 0]}>
      <mesh castShadow receiveShadow geometry={body}><meshPhysicalMaterial color="#f4efe6" roughness={.18} clearcoat={1} side={2}/></mesh>
      <mesh position={[0, .92, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.6, 32]}/><meshPhysicalMaterial color="#2a160b" roughness={.08} clearcoat={1}/></mesh>
      <mesh castShadow position={[.7, .58, 0]}><torusGeometry args={[.24, .055, 10, 24, Math.PI * 1.25]}/><meshPhysicalMaterial color="#f4efe6" roughness={.18} clearcoat={1}/></mesh>
    </group>
  </group>;
}

function Notebook({ position }: { position: [number, number, number] }): JSX.Element {
  const texture = useMemo(() => {
    const element = document.createElement("canvas"); element.width = 512; element.height = 680;
    const context = element.getContext("2d")!;
    context.fillStyle = "#f7f3e6"; context.fillRect(0, 0, 512, 680);
    context.strokeStyle = "rgba(70,120,190,.35)"; context.lineWidth = 2;
    for (let y = 90; y < 680; y += 38) { context.beginPath(); context.moveTo(0, y); context.lineTo(512, y); context.stroke(); }
    context.strokeStyle = "rgba(200,60,60,.45)"; context.beginPath(); context.moveTo(70, 0); context.lineTo(70, 680); context.stroke();
    context.fillStyle = "#24365a"; context.font = "italic 30px Georgia, serif";
    ["F = ma", "v² = u² + 2as", "P = W/t", "V = IR", "f = v/λ"].forEach((line, i) => context.fillText(line, 90, 160 + i * 76));
    context.font = '600 26px "Noto Sans Thai", "Leelawadee UI", Tahoma, sans-serif'; context.fillText("สูตรที่ต้องจำ", 90, 70);
    const map = new CanvasTexture(element); map.colorSpace = "srgb"; map.anisotropy = 8; return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={position} rotation={[0, .28, 0]}>
    <mesh castShadow receiveShadow position={[0, .03, 0]}><boxGeometry args={[2.6, .06, 3.4]}/><meshStandardMaterial color="#5a3a24" roughness={.6}/></mesh>
    <mesh receiveShadow position={[.02, .062, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.5, 3.3]}/><meshStandardMaterial map={texture} roughness={.9}/></mesh>
    {/* Pencil */}
    <group position={[1.65, .08, .2]} rotation={[0, .5, Math.PI / 2]}>
      <mesh castShadow><cylinderGeometry args={[.055, .055, 2.4, 6]}/><meshStandardMaterial color="#e3a823" roughness={.5}/></mesh>
      <mesh castShadow position={[0, 1.32, 0]}><coneGeometry args={[.055, .24, 6]}/><meshStandardMaterial color="#e6c9a0" roughness={.8}/></mesh>
      <mesh position={[0, -1.25, 0]}><cylinderGeometry args={[.058, .058, .14, 10]}/><meshStandardMaterial color="#b8b4a8" metalness={.8} roughness={.3}/></mesh>
    </group>
  </group>;
}

function Chair({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }): JSX.Element {
  const wood = "#2a1a10";
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh castShadow receiveShadow position={[0, -1.6, 0]}><boxGeometry args={[5, .35, 4.4]}/><meshStandardMaterial color={wood} roughness={.55}/></mesh>
    {[-1, 1].map(side => <mesh key={side} castShadow position={[side * 2.2, 2.2, -1.9]}><boxGeometry args={[.36, 7.6, .36]}/><meshStandardMaterial color={wood} roughness={.55}/></mesh>)}
    {[3.6, 5.6].map(y => <mesh key={y} castShadow position={[0, y, -1.9]}><boxGeometry args={[4.4, .5, .24]}/><meshStandardMaterial color={wood} roughness={.55}/></mesh>)}
    {[-1.1, 0, 1.1].map(x => <mesh key={x} castShadow position={[x, 2.2, -1.9]}><boxGeometry args={[.22, 3, .16]}/><meshStandardMaterial color={wood} roughness={.55}/></mesh>)}
  </group>;
}

// ───────────────────────────── Room atmosphere & Cinematic Director ─────────────────────────────

/**
 * Warm lamp key from above-left, faint cool rim from behind, soft room IBL for metal and lacquer,
 * plus the subtle Camera Director hook that blends cinematic Fable-5.2-style camera angles during active FX moments.
 */
export function TabletopLighting({ quality }: { quality: RenderQuality }): JSX.Element {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, .04);
    const previous = scene.environment, previousIntensity = scene.environmentIntensity;
    scene.environment = target.texture; scene.environmentIntensity = .26;
    // Name badges and dust live on the overlay layer (kept out of AO); the camera must render it on every tier.
    camera.layers.enable(OVERLAY_LAYER);
    room.dispose(); pmrem.dispose();
    return () => {
      directorShot.active = false;
      directorShot.closeUp = false;
      scene.environment = previous; scene.environmentIntensity = previousIntensity; target.dispose();
    };
  }, [gl, scene, camera]);

  // Smoothly blend camera toward directorShot when a cinematic tabletop moment is active.
  useFrame((_state, delta) => {
    const persp = camera instanceof PerspectiveCamera ? camera : null;
    if (directorShot.active) {
      const k = Math.min(1, delta * directorShot.strength);
      camera.position.lerp(directorShot.position, k);
      cameraFocus.lerp(directorShot.target, k);
      camera.lookAt(cameraFocus);
      if (persp && Math.abs(persp.fov - directorShot.fov) > 0.05) {
        persp.fov += (directorShot.fov - persp.fov) * k;
        persp.updateProjectionMatrix();
      }
    } else if (persp && Math.abs(persp.fov - 36) > 0.05) {
      persp.fov += (36 - persp.fov) * Math.min(1, delta * 4);
      persp.updateProjectionMatrix();
    }
  });

  const spot = useRef<SpotLight>(null);
  useEffect(() => { if (spot.current) { spot.current.target.position.set(.5, 0, 1); spot.current.target.updateMatrixWorld(); } }, []);
  const map = quality === "high" ? 2048 : 1024;
  return <>
    <hemisphereLight args={["#ffe4c4", "#1b1008", .16]}/>
    <spotLight ref={spot} castShadow={quality !== "low"} color="#ffd59e" intensity={quality === "low" ? 3.2 : 3.15} decay={0} position={[-6, 19, 8]} angle={.64} penumbra={.88}
      shadow-mapSize={[map, map]} shadow-bias={-.00018} shadow-normalBias={.025} shadow-camera-near={8} shadow-camera-far={40}/>
    <directionalLight color="#b4c3e0" intensity={.26} position={[4, 7, -14]}/>
    <pointLight color="#ff9a4a" intensity={.26} decay={0} distance={0} position={[16, 9, -14]}/>
    <BackgroundGlow/>
  </>;
}

function BackgroundGlow(): JSX.Element {
  // Distant warm practical lights (shelf lamps / window glints) far behind the table.
  const lights = useMemo(() => { const next = random(3); return Array.from({ length: 18 }, () => ({ x: (next() - .5) * 70, y: 2 + next() * 12, z: -36 - next() * 10, r: .25 + next() * .55, warm: next() })); }, []);
  return <group>
    <mesh position={[0, 4, -48]}><planeGeometry args={[160, 60]}/><meshStandardMaterial color="#120c08" roughness={1}/></mesh>
    {lights.map((light, i) => <mesh key={i} position={[light.x, light.y, light.z]}><sphereGeometry args={[light.r, 10, 8]}/><meshBasicMaterial color={new Color().setHSL(.07 + light.warm * .04, .92, .56 + light.warm * .2)} toneMapped={false}/></mesh>)}
  </group>;
}

/** Dust drifting through the lamp's beam + Cinematic Vignette FX Manager (Mortgage sign & window zoom, Bank heist flying cash). */
export function DustMotes({ reducedMotion }: { reducedMotion: boolean }): JSX.Element {
  const ref = useRef<Points>(null);
  const { geometry, seeds } = useMemo(() => {
    const next = random(21), count = 280, positions = new Float32Array(count * 3), seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) { positions[i * 3] = (next() - .5) * 18; positions[i * 3 + 1] = .8 + next() * 11; positions[i * 3 + 2] = (next() - .5) * 18; seeds[i] = next() * 100; }
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return { geometry, seeds };
  }, []);
  const sprite = useMemo(() => {
    const element = document.createElement("canvas"); element.width = element.height = 64;
    const context = element.getContext("2d")!, g = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,232,192,1)"); g.addColorStop(1, "rgba(255,232,192,0)");
    context.fillStyle = g; context.fillRect(0, 0, 64, 64);
    return new CanvasTexture(element);
  }, []);
  useEffect(() => () => { geometry.dispose(); sprite.dispose(); }, [geometry, sprite]);
  useFrame(({ clock }, delta) => {
    if (reducedMotion || !ref.current) return;
    const position = geometry.getAttribute("position") as Float32BufferAttribute, t = clock.elapsedTime;
    for (let i = 0; i < position.count; i++) {
      const seed = seeds[i]!;
      let y = position.getY(i) + delta * (.06 + (seed % 1) * .05);
      if (y > 12) y = .8;
      position.setXYZ(i, position.getX(i) + Math.sin(t * .3 + seed) * delta * .05, y, position.getZ(i) + Math.cos(t * .25 + seed) * delta * .05);
    }
    position.needsUpdate = true;
  });
  return <>
    <points ref={ref} geometry={geometry} layers={OVERLAY_LAYER} frustumCulled={false}>
      <pointsMaterial map={sprite} size={.095} sizeAttenuation transparent opacity={.58} depthWrite={false} blending={AdditiveBlending} color="#ffdcae"/>
    </points>
    <CinematicMomentStage reducedMotion={reducedMotion}/>
  </>;
}

/**
 * Interactive & automatic Cinematic Story Moments from the video:
 * 1. "mortgaged": A tall red hotel gets a heavy "🔒 MORTGAGED" sign slammed onto its facade,
 *    then the camera dollies right into the glowing window revealing a cozy miniature room with a sad student & cat! (00:04–00:07)
 * 2. "heist": Top-down spinning crane shot as banknotes and coins erupt from the board into the lens,
 *    buildings topple/shake in shock, and the camera dives into the central emblem! (00:10–00:13)
 * Can be triggered automatically during gameplay (when properties are sold/mortgaged or big pot/bankruptcy happens)
 * OR on-demand via a custom window event `physics-monopoly:cinematic` from the UI toolbar!
 */
export type CinematicClip = "mortgaged" | "heist" | "chase" | "jail";

function CinematicMomentStage({ reducedMotion }: { reducedMotion: boolean }): JSX.Element | null {
  const [clip, setClip] = useState<{ kind: CinematicClip; tileIndex: number; startedAt: number } | null>(null);
  const groupRef = useRef<Group>(null);
  const signRef = useRef<Group>(null);
  const cashGroupRef = useRef<Group>(null);
  const signTex = useMemo(() => mortgagedSignTexture(), []);
  const billTex = useMemo(() => billAtlas(), []);
  const billGeo = useMemo(() => atlasPlane(1.55, .7, 0, .5, 1, .666), []);
  useEffect(() => () => billGeo.dispose(), [billGeo]);

  useEffect(() => {
    const handler = (event: Event) => {
      if (reducedMotion) return;
      const detail = (event as CustomEvent<{ kind: CinematicClip; tileIndex?: number }>).detail;
      if (!detail?.kind) return;
      setClip({ kind: detail.kind, tileIndex: detail.tileIndex ?? 4, startedAt: performance.now() });
      playSound(detail.kind === "mortgaged" ? "mortgage" : detail.kind === "heist" ? "heist" : detail.kind === "jail" ? "jail" : "step");
    };
    window.addEventListener("physics-monopoly:cinematic", handler);
    return () => {
      window.removeEventListener("physics-monopoly:cinematic", handler);
      directorShot.active = false;
      directorShot.closeUp = false;
    };
  }, [reducedMotion]);

  const flyers = useMemo(() => {
    const next = random(404);
    return Array.from({ length: 34 }, (_, i) => ({
      x0: (next() - .5) * 4.5,
      z0: (next() - .5) * 4.5,
      vx: (next() - .5) * 5.2,
      vz: (next() - .5) * 5.2,
      vy: 3.4 + next() * 5.2,
      rx: (next() - .5) * 9,
      ry: (next() - .5) * 9,
      rz: (next() - .5) * 9,
      delay: (i % 8) * .06,
    }));
  }, []);

  useFrame(() => {
    if (!clip || reducedMotion) return;
    const elapsed = (performance.now() - clip.startedAt) / 1000;
    const [tx, tz, rot] = tilePosition(clip.tileIndex);
    const forward = new Vector3(Math.sin(rot), 0, Math.cos(rot));
    const right = new Vector3(Math.cos(rot), 0, -Math.sin(rot));
    const base = new Vector3(tx, BOARD_TOP, tz).addScaledVector(forward, BAND_Z);

    if (clip.kind === "mortgaged") {
      // Total 4.4s: 0..2.1s low-angle looking up at the red hotel as the MORTGAGED sign drops & bounces;
      // 2.1..4.4s dramatic dolly zoom right up to the glowing ground-floor window to see the room interior!
      const duration = 4.5;
      if (elapsed >= duration) {
        directorShot.active = false;
        directorShot.closeUp = false;
        setClip(null);
        return;
      }
      directorShot.active = true;
      directorShot.closeUp = true;
      if (signRef.current) {
        const st = Math.min(1, elapsed / .75);
        const drop = (1 - st * st) * 1.8;
        const bounce = st < 1 ? Math.abs(Math.sin(st * Math.PI * 3.5)) * (1 - st) * .22 : 0;
        signRef.current.position.y = 0.88 + drop + bounce;
        signRef.current.rotation.z = Math.sin(elapsed * 9) * Math.max(0, 1 - elapsed / 1.4) * .08;
      }
      if (elapsed < 2.15) {
        // Shot 1 (00:04–00:05): Dramatic low-angle hero view of the hotel + MORTGAGED sign
        directorShot.position.copy(base).addScaledVector(forward, 3.1).addScaledVector(right, .55).add(new Vector3(0, .72, 0));
        directorShot.target.copy(base).add(new Vector3(0, .76, 0));
        directorShot.fov = 33;
        directorShot.strength = 6.5;
      } else {
        // Shot 2 (00:06–00:07): Push into the glowing lower-right window to reveal the sad occupant & cat inside!
        const wt = Math.min(1, (elapsed - 2.15) / 1.6);
        const ease = 1 - Math.pow(1 - wt, 3);
        const dist = 2.7 - ease * 1.75; // pulls right up to 0.95 units from the window
        directorShot.position.copy(base).addScaledVector(forward, dist).addScaledVector(right, .22).add(new Vector3(0, .38, 0));
        directorShot.target.copy(base).addScaledVector(right, .18).add(new Vector3(0, .34, 0));
        directorShot.fov = 28;
        directorShot.strength = 7.5;
      }
    } else if (clip.kind === "heist") {
      // Total 4.2s: 0..2.5s top-down bird's-eye view as banknotes fly upwards toward the camera (00:11);
      // 2.5..4.2s corkscrew spin diving straight into the central board logo (00:12–00:13)!
      const duration = 4.2;
      if (elapsed >= duration) {
        directorShot.active = false;
        directorShot.closeUp = false;
        setClip(null);
        return;
      }
      directorShot.active = true;
      directorShot.closeUp = false;
      if (cashGroupRef.current) {
        cashGroupRef.current.children.forEach((child, idx) => {
          const f = flyers[idx];
          if (!f) return;
          const lt = Math.max(0, elapsed - f.delay);
          child.position.set(f.x0 + f.vx * lt, .25 + f.vy * lt - .9 * lt * lt, f.z0 + f.vz * lt);
          child.rotation.set(f.rx * lt, f.ry * lt, f.rz * lt);
        });
      }
      if (elapsed < 2.35) {
        const angle = elapsed * .55;
        directorShot.position.set(Math.sin(angle) * 1.8, 15.8 - elapsed * .7, Math.cos(angle) * 1.8);
        directorShot.target.set(0, BOARD_TOP, 0);
        directorShot.fov = 38;
        directorShot.strength = 6;
      } else {
        const st = Math.min(1, (elapsed - 2.35) / 1.85);
        const ease = st * st * (3 - 2 * st);
        const spin = (elapsed - 2.35) * 4.2;
        const height = 14.2 - ease * 11.4;
        const radius = (1 - ease) * 1.5 + .05;
        directorShot.position.set(Math.sin(spin) * radius, height, Math.cos(spin) * radius);
        directorShot.target.set(0, BOARD_TOP, 0);
        directorShot.fov = 38 - ease * 12;
        directorShot.strength = 9;
      }
    } else if (clip.kind === "chase") {
      // Low-angle street-level tracking shot right behind the racecar on tile 1..6 (00:02–00:03)
      const duration = 3.4;
      if (elapsed >= duration) {
        directorShot.active = false;
        directorShot.closeUp = false;
        setClip(null);
        return;
      }
      directorShot.active = true;
      directorShot.closeUp = true;
      const progress = (elapsed / duration) * 5;
      const idx = Math.floor(progress) % 28;
      const frac = progress - Math.floor(progress);
      const [ax, az, arot] = tilePosition(idx);
      const [bx, bz] = tilePosition((idx + 1) % 28);
      const px = ax + (bx - ax) * frac, pz = az + (bz - az) * frac;
      const dir = new Vector3(bx - ax, 0, bz - az).normalize();
      const normal = new Vector3(Math.sin(arot), 0, Math.cos(arot));
      directorShot.position.set(px, BOARD_TOP + .62, pz).addScaledVector(dir, -2.55).addScaledVector(normal, .55);
      directorShot.target.set(px, BOARD_TOP + .28, pz).addScaledVector(dir, 1.8);
      directorShot.fov = 32;
      directorShot.strength = 8;
    } else if (clip.kind === "jail") {
      // Dramatic low-angle look at the JUST VISITING / IN JAIL corner as a heavy iron cage slams down (00:08–00:09)
      const duration = 3.6;
      if (elapsed >= duration) {
        directorShot.active = false;
        directorShot.closeUp = false;
        setClip(null);
        return;
      }
      directorShot.active = true;
      directorShot.closeUp = true;
      const [jx, jz] = tilePosition(7);
      directorShot.position.set(jx - 2.6, BOARD_TOP + 1.15, jz + 2.8);
      directorShot.target.set(jx, BOARD_TOP + .42, jz);
      directorShot.fov = 32;
      directorShot.strength = 7.5;
    }
  });

  if (!clip || reducedMotion) return null;
  const [tx, tz, rot] = tilePosition(clip.tileIndex);

  return <group ref={groupRef}>
    {clip.kind === "mortgaged" ? (
      <group position={[tx, BOARD_TOP, tz]} rotation={[0, rot, 0]}>
        <group position={[0, 0, BAND_Z]}>
          {/* Towering Crimson Red Hotel being mortgaged */}
          <PropertyPiece level={3} quality="high" paint="#c82321" accent="#efe2bf"/>
          {/* Hanging red "🔒 MORTGAGED" sign plate & brass chains on the front facade (00:04–00:05) */}
          <group ref={signRef} position={[0, .88, .33]}>
            {[-.32, .32].map((cx, i) => (
              <mesh key={i} castShadow position={[cx, .22, -.02]}>
                <cylinderGeometry args={[.012, .012, .32, 8]}/>
                <meshStandardMaterial color="#d4af37" metalness={.9} roughness={.25}/>
              </mesh>
            ))}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[1.05, .48, .045]}/>
              <meshStandardMaterial color="#a51916" roughness={.35}/>
            </mesh>
            <mesh position={[0, 0, .025]}>
              <planeGeometry args={[1.02, .45]}/>
              <meshStandardMaterial map={signTex} roughness={.35}/>
            </mesh>
          </group>
          {/* Miniature cozy lit interior room behind the lower-right window (person sitting knees-up + cat silhouette, 00:06–00:07!) */}
          <group position={[.205, .34, .22]}>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[.28, .26, .18]}/>
              <meshStandardMaterial color="#3c281a" emissive="#ffae42" emissiveIntensity={.45} side={1}/>
            </mesh>
            {/* Silhouette of seated person with head on knees */}
            <mesh position={[.03, -.04, .02]}>
              <sphereGeometry args={[.042, 12, 10]}/>
              <meshStandardMaterial color="#1b120c"/>
            </mesh>
            <mesh position={[.03, .025, .01]}>
              <sphereGeometry args={[.028, 12, 10]}/>
              <meshStandardMaterial color="#1b120c"/>
            </mesh>
            {/* Small cat silhouette sitting next to them */}
            <mesh position={[-.055, -.055, .025]}>
              <cylinderGeometry args={[.016, .022, .06, 10]}/>
              <meshStandardMaterial color="#16100c"/>
            </mesh>
            <mesh position={[-.055, -.015, .025]}>
              <sphereGeometry args={[.018, 10, 8]}/>
              <meshStandardMaterial color="#16100c"/>
            </mesh>
          </group>
        </group>
      </group>
    ) : null}

    {clip.kind === "heist" ? (
      <group ref={cashGroupRef}>
        {flyers.map((_, i) => (
          <mesh key={i} geometry={billGeo} castShadow>
            <meshStandardMaterial map={billTex} roughness={.65} side={2}/>
          </mesh>
        ))}
      </group>
    ) : null}

    {clip.kind === "jail" ? (
      <JailCage position={[tilePosition(7)[0], BOARD_TOP, tilePosition(7)[1]]} reducedMotion={false} immediate/>
    ) : null}
  </group>;
}

class OverlaySafeGTAO extends GTAOPass {
  private readonly view: PerspectiveCamera;
  constructor(scene: ConstructorParameters<typeof GTAOPass>[0], camera: PerspectiveCamera) { super(scene, camera, 1, 1); this.view = camera; }
  override render(...args: Parameters<GTAOPass["render"]>): void {
    this.view.layers.disable(OVERLAY_LAYER);
    try { super.render(...args); } finally { this.view.layers.enable(OVERLAY_LAYER); }
  }
}

/** High tier: AO → depth of field focused on the camera's look-at point → bloom on lit windows → vignette. */
export function TabletopPostEffects({ closeUp }: { closeUp: boolean }): null {
  const { gl, scene, camera, size } = useThree();
  const { composer, bokeh } = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    if (camera instanceof PerspectiveCamera) {
      const ao = new OverlaySafeGTAO(scene, camera);
      ao.updateGtaoMaterial({ radius: .45, distanceExponent: 1.4, thickness: 1, scale: 1, samples: 12, distanceFallOff: .9 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
      ao.blendIntensity = .85;
      composer.addPass(ao);
    }
    const bokeh = new BokehPass(scene, camera, { focus: 18, aperture: .0006, maxblur: .008 });
    composer.addPass(bokeh);
    composer.addPass(new UnrealBloomPass(new Vector2(256, 256), .48, .62, 1.02));
    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms.offset!.value = .95; vignette.uniforms.darkness!.value = 1.25;
    composer.addPass(vignette);
    composer.addPass(new OutputPass());
    return { composer, bokeh };
  }, [gl, scene, camera]);
  useEffect(() => { composer.setPixelRatio(gl.getPixelRatio()); composer.setSize(size.width, size.height); }, [composer, gl, size.width, size.height]);
  useEffect(() => {
    gl.info.autoReset = false;
    return () => { gl.info.autoReset = true; for (const pass of composer.passes) pass.dispose(); composer.dispose(); };
  }, [composer, gl]);
  const uniforms = bokeh.uniforms as Record<string, { value: number }>;
  useFrame((_state, delta) => {
    const distance = camera.position.distanceTo(cameraFocus);
    uniforms.focus!.value += (distance - uniforms.focus!.value) * Math.min(1, delta * 6);
    const activeCloseUp = closeUp || directorShot.closeUp;
    const aperture = activeCloseUp ? .0019 : .0006;
    uniforms.aperture!.value += (aperture - uniforms.aperture!.value) * Math.min(1, delta * 3);
    gl.info.reset(); composer.render(delta);
  }, 1);
  return null;
}

// ───────────────────────────── Pieces on the board ─────────────────────────────

/** Owner strip + building for one property space, placed on the printed colour band. */
export function TabletopProperty({ tile, ownerColor, quality, hidden = false }: { tile: Tile; ownerColor: string | null; quality: RenderQuality; hidden?: boolean }): JSX.Element | null {
  if (!ownerColor) return null;
  const [x, z, rotation] = tilePosition(tile.index), level = Math.min(3, tile.level ?? 0);
  return <group position={[x, BOARD_TOP, z]} rotation={[0, rotation, 0]}>
    {/* Enamel ownership strip along the inner edge of the space. */}
    <mesh receiveShadow position={[0, .006, -.86]}><boxGeometry args={[1.66, .012, .07]}/><meshStandardMaterial color={ownerColor} emissive={ownerColor} emissiveIntensity={.35} roughness={.3}/></mesh>
    {hidden ? null : level > 0
      ? <group position={[0, 0, BAND_Z]}><PropertyPiece level={level as 1 | 2 | 3} quality={quality} paint={tile.groupColor} accent="#efe2bf"/></group>
      : <group position={[.6, 0, BAND_Z]}><OwnershipPeg color={ownerColor}/></group>}
  </group>;
}

/** Purchase moment: the new piece drops onto its band with a wooden bounce and a slight spin. */
export function TabletopConstruction({ tile, ownerColor, quality }: { tile: Tile; ownerColor: string; quality: RenderQuality }): JSX.Element {
  const [x, z, rotation] = tilePosition(tile.index), level = Math.min(3, tile.level ?? 0);
  const ref = useRef<Group>(null), time = useRef(0);
  useEffect(() => { playSound("buy"); }, []);
  useFrame((_state, delta) => {
    time.current += delta;
    const t = Math.min(1, time.current / .9), fall = 1 - t * t;
    const bounce = t < 1 ? Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * .35 : 0;
    if (ref.current) { ref.current.position.y = fall * 3.2 + bounce * (t > .55 ? 1 : 0); ref.current.rotation.y = (1 - t) * .9; }
  });
  return <group position={[x, BOARD_TOP, z]} rotation={[0, rotation, 0]}>
    <group position={[level > 0 ? 0 : .6, 0, BAND_Z]}><group ref={ref} position={[0, 3.2, 0]}>
      {level > 0 ? <PropertyPiece level={level as 1 | 2 | 3} quality={quality} paint={tile.groupColor} accent="#efe2bf"/> : <OwnershipPeg color={ownerColor}/>}
    </group></group>
  </group>;
}

/** Painted-miniature pedestal under a character token: lacquered player colour with a brass rim. */
export function TokenPedestal({ color }: { color: string }): JSX.Element {
  return <group>
    <mesh castShadow receiveShadow position={[0, .03, 0]}><cylinderGeometry args={[.27, .3, .06, 32]}/><meshPhysicalMaterial color={color} roughness={.25} clearcoat={1} clearcoatRoughness={.1}/></mesh>
    <mesh castShadow position={[0, .062, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.265, .012, 8, 40]}/><meshStandardMaterial color="#c9a14a" metalness={1} roughness={.25}/></mesh>
  </group>;
}

/** Metal-token look for a player slot (stable per slot). */
export function TabletopMetalToken({ slot, color, quality }: { slot: number; color: string; quality: RenderQuality }): JSX.Element {
  return <group scale={1.25}><MetalToken kind={TOKEN_KINDS[slot % TOKEN_KINDS.length]!} color={color} quality={quality}/></group>;
}

/**
 * Square iron-bar prison cage that lowers on a heavy chain over a jailed player's token (matches 00:08–00:09 in the video!).
 * The server sets inJail together with the walk to the jail space, so the drop waits for that walk (~2.4 s)
 * unless `immediate` is set for a showcase vignette.
 */
export function JailCage({ position, reducedMotion, immediate = false }: { position: [number, number, number]; reducedMotion: boolean; immediate?: boolean }): JSX.Element {
  const ref = useRef<Group>(null), time = useRef(reducedMotion ? 10 : immediate ? 0 : -2.6);
  useFrame((_state, delta) => {
    time.current += delta;
    const group = ref.current;
    if (!group) return;
    group.visible = time.current >= 0;
    const t = Math.min(1, Math.max(0, time.current) / .95), eased = 1 - Math.pow(1 - t, 3);
    const settle = t >= 1 ? 0 : Math.abs(Math.sin(t * Math.PI * 3.5)) * (1 - t) * .16 * (t > .65 ? 1 : 0);
    group.position.y = (1 - eased) * 5.8 + settle;
  });
  const half = .38, height = 1.18;
  // Square grid of vertical iron bars along all 4 sides of the cage, like the drawing & 3D cage in 00:08–00:10!
  const barCoords: Array<[number, number]> = [];
  const steps = [-1, -.5, 0, .5, 1];
  for (const s of steps) {
    barCoords.push([s * half, -half], [s * half, half]);
    if (Math.abs(s) < 1) barCoords.push([-half, s * half], [half, s * half]);
  }
  return <group position={position}><group ref={ref} position={[0, 5.8, 0]} visible={reducedMotion || immediate}>
    {barCoords.map(([bx, bz], i) => (
      <mesh key={i} castShadow position={[bx, height / 2, bz]}>
        <cylinderGeometry args={[.017, .017, height, 8]}/>
        <meshStandardMaterial color="#232428" metalness={.92} roughness={.36}/>
      </mesh>
    ))}
    {/* Bottom, middle, and top square iron frames */}
    {[.025, height * .52, height].map(y => (
      <group key={y} position={[0, y, 0]}>
        {[-half, half].map(z => <mesh key={`z:${z}`} castShadow position={[0, 0, z]}><boxGeometry args={[half * 2 + .04, .042, .042]}/><meshStandardMaterial color="#232428" metalness={.92} roughness={.34}/></mesh>)}
        {[-half, half].map(x => <mesh key={`x:${x}`} castShadow position={[x, 0, 0]}><boxGeometry args={[.042, .042, half * 2 + .04]}/><meshStandardMaterial color="#232428" metalness={.92} roughness={.34}/></mesh>)}
      </group>
    ))}
    {/* Heavy roof plate & suspension ring */}
    <mesh castShadow position={[0, height + .035, 0]}><boxGeometry args={[half * 2 + .06, .035, half * 2 + .06]}/><meshStandardMaterial color="#1d1e22" metalness={.9} roughness={.38}/></mesh>
    {/* Heavy iron chain links ascending from the cage roof */}
    {Array.from({ length: 15 }, (_, i) => (
      <mesh key={i} castShadow position={[0, height + .16 + i * .16, 0]} rotation={[0, i % 2 ? Math.PI / 2 : 0, 0]}>
        <torusGeometry args={[.055, .016, 6, 12]}/>
        <meshStandardMaterial color="#4e4f54" metalness={1} roughness={.28}/>
      </mesh>
    ))}
  </group></group>;
}

// ───────────────────────────── Dice ─────────────────────────────

const DIE = .48;
/** Dice are thrown in from the near edge, tumble in low-angle slow motion across the board, bounce and settle on the server's result. */
export function TabletopDice({ dice, nonce, reducedMotion, animate = true }: { dice: [number, number]; nonce: number; reducedMotion: boolean; animate?: boolean }): JSX.Element {
  return <group name="asset:dice:pair">{dice.map((value, index) => <TabletopDie key={index} value={value} index={index} nonce={nonce} reducedMotion={reducedMotion || !animate}/>)}</group>;
}

function TabletopDie({ value, index, nonce, reducedMotion }: { value: number; index: number; nonce: number; reducedMotion: boolean }): JSX.Element {
  const ref = useRef<Group>(null), elapsed = useRef(10);
  const rest = useMemo(() => new Vector3(index === 0 ? -.48 : .98, BOARD_TOP + DIE / 2, index === 0 ? 4.15 : 3.78), [index]);
  const start = useMemo(() => new Vector3(rest.x + (index === 0 ? -1.8 : 1.4), BOARD_TOP + 3.4, rest.z + 6.8), [rest, index]);
  const target = useMemo(() => {
    const yaw = new Quaternion().setFromEuler(new Euler(0, (nonce * .73 + index * 1.9) % (Math.PI * 2), 0));
    return yaw.multiply(new Quaternion().setFromEuler(new Euler(...(diceOrientations[value] ?? diceOrientations[1]!))));
  }, [value, nonce, index]);
  const spin = useMemo(() => new Vector3(11 + index * 3, 5 - index * 2, 8 + index), [index]);
  // Only a new throw (nonce) restarts the tumble; the result value arriving a moment later just retargets the landing.
  useEffect(() => { if (!reducedMotion) elapsed.current = 0; }, [nonce]);
  useEffect(() => { if (reducedMotion) { elapsed.current = 10; if (ref.current) { ref.current.position.copy(rest); ref.current.quaternion.copy(target); } } }, [reducedMotion, rest, target]);
  useFrame((_state, delta) => {
    const die = ref.current;
    if (!die) return;
    elapsed.current += delta;
    const duration = 1.25, t = Math.min(1, elapsed.current / duration);
    if (t >= 1) { die.position.copy(rest); die.quaternion.slerp(target, Math.min(1, delta * 14)); return; }
    // Horizontal ease-out, vertical: parabola into two decaying bounces.
    die.position.lerpVectors(start, rest, 1 - Math.pow(1 - t, 2.2));
    const hops = t < .45 ? 1 - Math.pow(t / .45, 2) : t < .75 ? Math.sin((t - .45) / .3 * Math.PI) * .35 : Math.sin((t - .75) / .25 * Math.PI) * .09;
    die.position.y = rest.y + Math.max(0, hops) * (t < .45 ? 3.4 : 2.3);
    if (t < .78) { die.rotation.x += delta * spin.x * (1 - t); die.rotation.y += delta * spin.y * (1 - t); die.rotation.z += delta * spin.z * (1 - t); }
    else die.quaternion.slerp(target, Math.min(1, delta * 10));
  });
  const { body, pips } = useMemo(() => dieGeometry(), []);
  return <group ref={ref} position={rest.toArray()} quaternion={target} scale={DIE}>
    <mesh castShadow receiveShadow geometry={body}><meshPhysicalMaterial color="#f8f3e6" roughness={.18} clearcoat={1} clearcoatRoughness={.05} sheen={.25}/></mesh>
    <mesh geometry={pips}><meshStandardMaterial vertexColors roughness={.32}/></mesh>
  </group>;
}

let dieCache: { body: BufferGeometry; pips: BufferGeometry } | null = null;
function dieGeometry(): { body: BufferGeometry; pips: BufferGeometry } {
  if (dieCache) return dieCache;
  const faces: Array<{ value: number; position: [number, number, number]; rotation: [number, number, number] }> = [
    { value: 1, position: [0, .503, 0], rotation: [-Math.PI / 2, 0, 0] }, { value: 6, position: [0, -.503, 0], rotation: [Math.PI / 2, 0, 0] },
    { value: 2, position: [0, 0, .503], rotation: [0, 0, 0] }, { value: 5, position: [0, 0, -.503], rotation: [0, Math.PI, 0] },
    { value: 3, position: [.503, 0, 0], rotation: [0, Math.PI / 2, 0] }, { value: 4, position: [-.503, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  ];
  const ink = new Color("#141419"), ace = new Color("#b8221a");
  const parts = faces.flatMap(face => pipPositions(face.value).map(([x, y]) => {
    const pip = new CircleGeometry(face.value === 1 ? .115 : .08, 24);
    pip.translate(x, y, 0).rotateX(face.rotation[0]).rotateY(face.rotation[1]).rotateZ(face.rotation[2]).translate(...face.position);
    const tint = face.value === 1 ? ace : ink, count = pip.getAttribute("position").count;
    pip.setAttribute("color", new Float32BufferAttribute(Array.from({ length: count }, () => [tint.r, tint.g, tint.b]).flat(), 3));
    pip.deleteAttribute("uv");
    return pip;
  }));
  const pips = mergeGeometries(parts, false)!; parts.forEach(part => part.dispose());
  dieCache = { body: new RoundedBoxGeometry(1, 1, 1, 5, .16), pips };
  return dieCache;
}

/** Marks the token group so the cinematic camera can tell whether it is mid-walk. */
export function markMoving(object: Object3D | null, moving: boolean): void { if (object) object.userData.moving = moving; }
