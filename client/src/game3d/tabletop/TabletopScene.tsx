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
import { cameraFocus } from "./cameraFocus";
import { BILLS, BOARD_HALF, DECK_SIZE, DECK_SLOTS, billAtlas, boardFaceTexture, deckAtlas, deedAtlas, walnutTexture } from "./TabletopTextures";
import { MetalToken, OwnershipPeg, PropertyPiece, TOKEN_KINDS } from "./TabletopPieces";

/** Board top surface height; tokens stand at y = 0.30 (see tokenPosition). */
export const BOARD_TOP = .3;
const BOARD_THICK = .07;
export const TABLE_TOP = BOARD_TOP - BOARD_THICK;
export const ROOM = { background: "#0a0705", fog: "#0a0705" } as const;
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

/** Polished walnut table, printed board, banknotes, deeds, card decks, mug and chair. Static: safe inside StaticBatch. */
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
    {/* Table: lacquered walnut with clearcoat so the lamp leaves a soft specular pool. */}
    <mesh receiveShadow geometry={tableBody} position={[0, TABLE_TOP - .7, -1]}>
      <meshPhysicalMaterial color="#c9a07a" map={wood} roughness={.42} clearcoat={.65} clearcoatRoughness={.22}/>
    </mesh>
    {/* Board: navy cloth-wrapped edge with the printed face on top. */}
    <mesh castShadow receiveShadow geometry={boardBody} position={[0, BOARD_TOP - BOARD_THICK / 2, 0]}>
      <meshStandardMaterial color="#14243a" roughness={.8}/>
    </mesh>
    <mesh receiveShadow position={[0, BOARD_TOP + .001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[BOARD_HALF * 2 - .04, BOARD_HALF * 2 - .04]}/>
      <meshStandardMaterial map={face} color="#ddd3bf" roughness={.62} metalness={0}/>
    </mesh>
    <CardDecks/>
    <MoneyStacks/>
    <DeedFan tiles={tiles}/>
    <Mug position={[-12.2, TABLE_TOP, -5.5]}/>
    <Notebook position={[12, TABLE_TOP, -5]}/>
    <Chair position={[0, 0, -17.5]}/>
    <Chair position={[-19, 0, 2]} rotation={Math.PI / 2}/>
    {/* Floor far below: catches a little bounce so the room is not a void. */}
    <mesh receiveShadow position={[0, -9, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[160, 160]}/><meshStandardMaterial color="#1b120c" roughness={.9}/></mesh>
  </group>;
}

function CardDecks(): JSX.Element {
  const texture = useMemo(() => deckAtlas(), []);
  const geometries = useMemo(() => DECK_SLOTS.map((slot, i) => atlasPlane(DECK_SIZE[0], DECK_SIZE[1], i * .5, 0, i * .5 + .5, 1)), []);
  const edge = useMemo(() => new RoundedBoxGeometry(DECK_SIZE[0], .2, DECK_SIZE[1], 1, .03), []);
  useEffect(() => () => { texture.dispose(); geometries.forEach(geometry => geometry.dispose()); edge.dispose(); }, [texture, geometries, edge]);
  return <group>{DECK_SLOTS.map((slot, i) => <group key={slot.kind} position={[slot.x, BOARD_TOP, slot.z]} rotation={[0, slot.rotation, 0]}>
    <mesh castShadow receiveShadow geometry={edge} position={[0, .1, 0]}><meshStandardMaterial color="#efe6d0" roughness={.7}/></mesh>
    {/* Layered card edges read as a real stack. */}
    {[.04, .09, .14].map(y => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[DECK_SIZE[0] + .006, .006, DECK_SIZE[1] + .006]}/><meshStandardMaterial color="#c9bfa8" roughness={.8}/></mesh>)}
    <mesh receiveShadow geometry={geometries[i]} position={[0, .202, 0]}><meshStandardMaterial map={texture} roughness={.45}/></mesh>
    {/* One card slightly askew on top. */}
    <mesh castShadow receiveShadow geometry={geometries[i]} position={[.06, .214, -.04]} rotation={[0, .07, 0]}><meshStandardMaterial map={texture} roughness={.45}/></mesh>
  </group>)}</group>;
}

function MoneyStacks(): JSX.Element {
  const texture = useMemo(() => billAtlas(), []);
  const rows = BILLS.length;
  const tops = useMemo(() => BILLS.map((_, i) => atlasPlane(2.05, .9, 0, 1 - (i + 1) / rows, 1, 1 - i / rows)), [rows]);
  useEffect(() => () => { texture.dispose(); tops.forEach(top => top.dispose()); }, [texture, tops]);
  const stacks = useMemo(() => {
    const next = random(9);
    // Two loose stacks per side of the near edge, like a banker's tray laid out on the table.
    return BILLS.map((bill, i) => {
      const side = i < 3 ? -1 : 1, slot = i % 3;
      const x = side * (4.2 + slot * 2.35), z = 10.15 + (slot % 2) * .35, yaw = (next() - .5) * .25;
      const count = 6 + Math.floor(next() * 8);
      const sheets = Array.from({ length: count }, (_, s) => ({ dx: (next() - .5) * .08, dz: (next() - .5) * .06, yaw: (next() - .5) * .07, y: s * .012 }));
      return { bill, i, x, z, yaw, sheets };
    });
  }, []);
  return <group>{stacks.map(stack => <group key={stack.i} position={[stack.x, TABLE_TOP, stack.z]} rotation={[0, stack.yaw, 0]}>
    {stack.sheets.map((sheet, s) => <mesh key={s} castShadow receiveShadow position={[sheet.dx, .006 + sheet.y, sheet.dz]} rotation={[0, sheet.yaw, 0]}><boxGeometry args={[2.05, .01, .9]}/><meshStandardMaterial color={stack.bill.color} roughness={.85}/></mesh>)}
    <mesh receiveShadow geometry={tops[stack.i]} position={[0, .013 + (stack.sheets.length - 1) * .012, 0]}><meshStandardMaterial map={texture} roughness={.8}/></mesh>
  </group>)}</group>;
}

function DeedFan({ tiles }: { tiles: Tile[] }): JSX.Element {
  const deeds = useMemo(() => [1, 4, 11, 19, 24].map(index => tiles[index]).filter((tile): tile is Tile => tile?.type === "property"), [tiles]);
  const key = deeds.map(tile => tile.name).join("|");
  const texture = useMemo(() => deedAtlas(deeds), [key]);
  const cards = useMemo(() => deeds.map((_, i) => atlasPlane(1.24, 2, i / deeds.length, 0, (i + 1) / deeds.length, 1)), [key]);
  useEffect(() => () => { texture.dispose(); cards.forEach(card => card.dispose()); }, [texture, cards]);
  return <group position={[10.8, TABLE_TOP, 2.8]} rotation={[0, -.35, 0]}>
    {cards.map((card, i) => <group key={i} position={[(i - 2) * .42, .004 + i * .006, Math.abs(i - 2) * .12]} rotation={[0, (i - 2) * -.16, 0]}>
      <mesh castShadow receiveShadow position={[0, -.002, 0]}><boxGeometry args={[1.26, .006, 2.02]}/><meshStandardMaterial color="#e8e1d1" roughness={.8}/></mesh>
      <mesh receiveShadow geometry={card} position={[0, .002, 0]}><meshStandardMaterial map={texture} roughness={.7}/></mesh>
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

// ───────────────────────────── Room atmosphere ─────────────────────────────

/**
 * Warm lamp key from above-left, faint cool rim from behind, soft room IBL for metal and lacquer.
 * The background wall carries out-of-focus warm lights that turn into bokeh on the high tier.
 */
export function TabletopLighting({ quality }: { quality: RenderQuality }): JSX.Element {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, .04);
    const previous = scene.environment, previousIntensity = scene.environmentIntensity;
    scene.environment = target.texture; scene.environmentIntensity = .22;
    // Name badges and dust live on the overlay layer (kept out of AO); the camera must render it on every tier.
    camera.layers.enable(OVERLAY_LAYER);
    room.dispose(); pmrem.dispose();
    return () => { scene.environment = previous; scene.environmentIntensity = previousIntensity; target.dispose(); };
  }, [gl, scene, camera]);
  const spot = useRef<SpotLight>(null);
  useEffect(() => { if (spot.current) { spot.current.target.position.set(.5, 0, 1); spot.current.target.updateMatrixWorld(); } }, []);
  const map = quality === "high" ? 2048 : 1024;
  return <>
    <hemisphereLight args={["#ffe2bf", "#1d120a", .14]}/>
    <spotLight ref={spot} castShadow={quality !== "low"} color="#ffd6a3" intensity={quality === "low" ? 3 : 2.9} decay={0} position={[-6, 19, 8]} angle={.62} penumbra={.85}
      shadow-mapSize={[map, map]} shadow-bias={-.00018} shadow-normalBias={.025} shadow-camera-near={8} shadow-camera-far={40}/>
    <directionalLight color="#b4c3e0" intensity={.24} position={[4, 7, -14]}/>
    <pointLight color="#ff9a4a" intensity={.22} decay={0} distance={0} position={[16, 9, -14]}/>
    <BackgroundGlow/>
  </>;
}

function BackgroundGlow(): JSX.Element {
  // Distant warm practical lights (shelf lamps / window glints) far behind the table.
  const lights = useMemo(() => { const next = random(3); return Array.from({ length: 16 }, () => ({ x: (next() - .5) * 70, y: 2 + next() * 12, z: -36 - next() * 10, r: .25 + next() * .5, warm: next() })); }, []);
  return <group>
    <mesh position={[0, 4, -48]}><planeGeometry args={[160, 60]}/><meshStandardMaterial color="#120c08" roughness={1}/></mesh>
    {lights.map((light, i) => <mesh key={i} position={[light.x, light.y, light.z]}><sphereGeometry args={[light.r, 10, 8]}/><meshBasicMaterial color={new Color().setHSL(.07 + light.warm * .04, .9, .55 + light.warm * .2)} toneMapped={false}/></mesh>)}
  </group>;
}

/** Dust drifting through the lamp's beam — the volumetric feel of the reference without a costly fog pass. */
export function DustMotes({ reducedMotion }: { reducedMotion: boolean }): JSX.Element {
  const ref = useRef<Points>(null);
  const { geometry, seeds } = useMemo(() => {
    const next = random(21), count = 260, positions = new Float32Array(count * 3), seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) { positions[i * 3] = (next() - .5) * 18; positions[i * 3 + 1] = .8 + next() * 11; positions[i * 3 + 2] = (next() - .5) * 18; seeds[i] = next() * 100; }
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return { geometry, seeds };
  }, []);
  const sprite = useMemo(() => {
    const element = document.createElement("canvas"); element.width = element.height = 64;
    const context = element.getContext("2d")!, g = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,230,190,1)"); g.addColorStop(1, "rgba(255,230,190,0)");
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
  return <points ref={ref} geometry={geometry} layers={OVERLAY_LAYER} frustumCulled={false}>
    <pointsMaterial map={sprite} size={.09} sizeAttenuation transparent opacity={.55} depthWrite={false} blending={AdditiveBlending} color="#ffdcae"/>
  </points>;
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
    const bokeh = new BokehPass(scene, camera, { focus: 18, aperture: .0006, maxblur: .007 });
    composer.addPass(bokeh);
    composer.addPass(new UnrealBloomPass(new Vector2(256, 256), .45, .6, 1.05));
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
    const aperture = closeUp ? .0016 : .0006;
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
 * Cage that lowers on a chain over a jailed player's token. The server sets inJail together with the
 * walk to the jail space, so the drop waits for that walk (~2.4 s) instead of landing on a moving token.
 */
export function JailCage({ position, reducedMotion }: { position: [number, number, number]; reducedMotion: boolean }): JSX.Element {
  const ref = useRef<Group>(null), time = useRef(reducedMotion ? 10 : -2.6);
  useFrame((_state, delta) => {
    time.current += delta;
    const group = ref.current;
    if (!group) return;
    group.visible = time.current >= 0;
    const t = Math.min(1, Math.max(0, time.current) / 1.1), eased = 1 - Math.pow(1 - t, 3);
    const settle = t >= 1 ? 0 : Math.sin(t * Math.PI * 4) * (1 - t) * .12 * (t > .7 ? 1 : 0);
    group.position.y = (1 - eased) * 6 + settle;
  });
  const bars = 12, radius = .36, height = 1.15;
  return <group position={position}><group ref={ref} position={[0, 6, 0]} visible={reducedMotion}>
    {Array.from({ length: bars }, (_, i) => { const a = i / bars * Math.PI * 2; return <mesh key={i} castShadow position={[Math.cos(a) * radius, height / 2, Math.sin(a) * radius]}><cylinderGeometry args={[.016, .016, height, 6]}/><meshStandardMaterial color="#2b2b2e" metalness={.9} roughness={.4}/></mesh>; })}
    {[.02, height * .55, height].map(y => <mesh key={y} castShadow position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius, .025, 6, 32]}/><meshStandardMaterial color="#2b2b2e" metalness={.9} roughness={.35}/></mesh>)}
    <mesh castShadow position={[0, height + .05, 0]}><cylinderGeometry args={[radius + .02, radius + .02, .03, 24]}/><meshStandardMaterial color="#2b2b2e" metalness={.9} roughness={.4}/></mesh>
    {Array.from({ length: 14 }, (_, i) => <mesh key={i} castShadow position={[0, height + .18 + i * .16, 0]} rotation={[0, i % 2 ? Math.PI / 2 : 0, 0]}><torusGeometry args={[.05, .014, 6, 12]}/><meshStandardMaterial color="#56565a" metalness={1} roughness={.3}/></mesh>)}
  </group></group>;
}

// ───────────────────────────── Dice ─────────────────────────────

const DIE = .46;
/** Dice are thrown in from the near edge, tumble, bounce and settle on the server's result. */
export function TabletopDice({ dice, nonce, reducedMotion }: { dice: [number, number]; nonce: number; reducedMotion: boolean }): JSX.Element {
  return <group name="asset:dice:pair">{dice.map((value, index) => <TabletopDie key={index} value={value} index={index} nonce={nonce} reducedMotion={reducedMotion}/>)}</group>;
}

function TabletopDie({ value, index, nonce, reducedMotion }: { value: number; index: number; nonce: number; reducedMotion: boolean }): JSX.Element {
  const ref = useRef<Group>(null), elapsed = useRef(reducedMotion ? 10 : 0);
  const rest = useMemo(() => new Vector3(index === 0 ? -.45 : .95, BOARD_TOP + DIE / 2, index === 0 ? 4.15 : 3.8), [index]);
  const start = useMemo(() => new Vector3(rest.x + (index === 0 ? -1.5 : 1.2), BOARD_TOP + 3.2, rest.z + 6.5), [rest, index]);
  const target = useMemo(() => {
    const yaw = new Quaternion().setFromEuler(new Euler(0, (nonce * .73 + index * 1.9) % (Math.PI * 2), 0));
    return yaw.multiply(new Quaternion().setFromEuler(new Euler(...(diceOrientations[value] ?? diceOrientations[1]!))));
  }, [value, nonce, index]);
  const spin = useMemo(() => new Vector3(9 + index * 3, 4 - index * 2, 7 + index), [index]);
  useEffect(() => { elapsed.current = reducedMotion ? 10 : 0; if (reducedMotion && ref.current) { ref.current.position.copy(rest); ref.current.quaternion.copy(target); } }, [nonce, reducedMotion, rest, target]);
  useFrame((_state, delta) => {
    const die = ref.current;
    if (!die) return;
    elapsed.current += delta;
    const duration = 1.15, t = Math.min(1, elapsed.current / duration);
    if (t >= 1) { die.position.copy(rest); die.quaternion.slerp(target, Math.min(1, delta * 14)); return; }
    // Horizontal ease-out, vertical: parabola into two decaying bounces.
    die.position.lerpVectors(start, rest, 1 - Math.pow(1 - t, 2.2));
    const hops = t < .45 ? 1 - Math.pow(t / .45, 2) : t < .75 ? Math.sin((t - .45) / .3 * Math.PI) * .32 : Math.sin((t - .75) / .25 * Math.PI) * .08;
    die.position.y = rest.y + Math.max(0, hops) * (t < .45 ? 3.2 : 2.2);
    if (t < .78) { die.rotation.x += delta * spin.x * (1 - t); die.rotation.y += delta * spin.y * (1 - t); die.rotation.z += delta * spin.z * (1 - t); }
    else die.quaternion.slerp(target, Math.min(1, delta * 10));
  });
  const { body, pips } = useMemo(() => dieGeometry(), []);
  return <group ref={ref} position={rest.toArray()} quaternion={target} scale={DIE}>
    <mesh castShadow receiveShadow geometry={body}><meshPhysicalMaterial color="#f7f1e3" roughness={.22} clearcoat={1} clearcoatRoughness={.06} sheen={.2}/></mesh>
    <mesh geometry={pips}><meshStandardMaterial vertexColors roughness={.35}/></mesh>
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
  const ink = new Color("#15151a"), ace = new Color("#b3261e");
  const parts = faces.flatMap(face => pipPositions(face.value).map(([x, y]) => {
    const pip = new CircleGeometry(face.value === 1 ? .11 : .078, 24);
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
