import { baseTiles, locationById } from "@physics-monopoly/shared";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type BufferGeometry, type Texture } from "three";
import { surfaceTexture } from "./SurfaceTextures";
import { useQuality } from "./RenderQuality";

type Point = [number, number, number];
export const propertyTileIndices = baseTiles.filter(tile => tile.type === "property").map(tile => tile.index);
const forms = ["gate", "crossing", "station", "pagoda", "media", "boutique", "spire", "neon", "twins", "arena", "bridge", "shrine", "pavilion", "observatory"] as const;
const tokyoPlaces = ["ประตูคามินาริมง อาซากุสะ", "ทางข้ามชิบูย่า", "สถานีโตเกียว", "เจดีย์อุเอโนะ", "โอไดบะ", "ย่านกินซ่า", "โตเกียวสกายทรี", "ย่านอากิฮาบาระ", "ตึกคู่ชินจูกุ", "โตเกียวโดม", "สะพานเรนโบว์", "ศาลเจ้าเมจิ", "โตเกียวบิ๊กไซต์", "หอดูดาวรปปงงิ"];
const regionalNames = ["ประตูเมือง", "ย่านการค้า", "สถานีเก่า", "หอประวัติศาสตร์", "ศูนย์สื่อ", "ถนนศิลปะ", "หอชมวิว", "ย่านแสงสี", "อาคารคู่", "สนามกีฬา", "สะพานเมือง", "สวนวัฒนธรรม", "ศูนย์นิทรรศการ", "หอดูดาว"];
/** Bright, harmonious per-city palettes; each building draws wall/accent/roof from its own offset. */
const palettes: Record<string, string[]> = {
  bangkok: ["#f0c75e", "#d2493f", "#2f9a74", "#f6e7c8", "#3b73b8", "#ee8f3f"],
  tokyo: ["#e5503f", "#f6f1e8", "#f3a0b9", "#35548a", "#6ccac2", "#ffd166"],
  "new-york": ["#c0583f", "#efe2c8", "#3f8a97", "#e8b140", "#34506e", "#93c29a"],
  singapore: ["#f6f2e8", "#2fa07c", "#f4b947", "#e5705d", "#4aa8cf", "#8fca55"],
  paris: ["#f2e5cb", "#8198c0", "#bbd09f", "#eeaaa9", "#e0ab46", "#62719a"],
  kyoto: ["#c04a33", "#f4e9d6", "#8a6038", "#43675e", "#eaaec0", "#dfb95c"],
  "cairo-giza": ["#ecc57f", "#cf7f4c", "#3f98b1", "#f4e7c8", "#b9513f", "#72a872"],
  zermatt: ["#96623f", "#f6f1e6", "#cc4a40", "#548462", "#e8bb5c", "#7394b0"],
  santorini: ["#fcf8f0", "#2f73c6", "#f5cf72", "#eca191", "#80cde0", "#bcd98e"],
  rio: ["#f6da76", "#ec6d52", "#3ebdaf", "#f4a0c6", "#5f95dd", "#91d86e"],
  venice: ["#eeb897", "#c95a3e", "#f5d99f", "#62a8aa", "#bf6a86", "#f2e7d0"],
  sydney: ["#f5f0e4", "#e8935a", "#4aa8cf", "#f4c552", "#83b983", "#dd7272"],
};
const softened = new Map<string, BufferGeometry>();
function softenedBox(size: Point): BufferGeometry {
  const key = size.join(":");
  let geometry = softened.get(key);
  if (!geometry) {
    geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 1, Math.min(.022, Math.min(...size) * .16));
    softened.set(key, geometry);
  }
  return geometry;
}

export function propertyForm(tileIndex: number): number {
  const index = propertyTileIndices.indexOf(tileIndex);
  return index >= 0 ? index : ((tileIndex % forms.length) + forms.length) % forms.length;
}

export function propertyPlaceName(mapId: string, tileIndex: number): string {
  const form = propertyForm(tileIndex);
  const city = locationById(mapId);
  return city.id === "tokyo" ? tokyoPlaces[form]! : `${city.name} · ${form === 6 ? city.landmark : regionalNames[form]}`;
}

/**
 * Shared material. The low tier keeps only three looks (plain, metal, lit window) so the board's
 * StaticBatch merges all buildings into a handful of draw calls; colour survives as vertex colour.
 */
function Surface({ color, rough = .72, metal = 0, glow = 0, map }: { color: string; rough?: number; metal?: number; glow?: number; map?: Texture }): JSX.Element {
  if (useQuality() === "low") return <meshStandardMaterial color={color} roughness={metal >= .5 ? .3 : .7} metalness={metal >= .5 ? .75 : 0}/>;
  return <meshStandardMaterial color={color} map={map} roughness={rough} metalness={metal} emissive={glow ? color : "#000000"} emissiveIntensity={glow}/>;
}
function Block({ at, size, color, surface, glow = false, rotation = 0, metal = false }: { at: Point; size: Point; color: string; surface?: "plaster" | "roof" | "stone" | "wood"; glow?: boolean; rotation?: number; metal?: boolean }): JSX.Element {
  const low = useQuality() === "low", bevel = !low && Math.min(...size) >= .04;
  return <mesh castShadow receiveShadow position={at} rotation={[0,rotation,0]} geometry={bevel ? softenedBox(size) : undefined}>{bevel ? null : <boxGeometry args={size}/>}<Surface color={color} map={!low && surface ? surfaceTexture(surface) : undefined} rough={metal ? .3 : glow ? .28 : .72} metal={metal ? .75 : glow ? .16 : 0} glow={glow ? .55 : 0}/></mesh>;
}
function Post({ at, height, color, radius = .035, metal = false }: { at: Point; height: number; color: string; radius?: number; metal?: boolean }): JSX.Element {
  const low = useQuality() === "low";
  return <mesh castShadow position={at}><cylinderGeometry args={[radius,radius,height,low ? 8 : 14]}/><Surface color={color} metal={metal ? .75 : .15} rough={metal ? .3 : .55}/></mesh>;
}
function Ball({ at, radius, color, glow = false, scale }: { at: Point; radius: number; color: string; glow?: boolean; scale?: Point }): JSX.Element {
  const low = useQuality() === "low";
  return <mesh castShadow position={at} scale={scale}><sphereGeometry args={[radius,low ? 10 : 18,low ? 6 : 12]}/><Surface color={color} metal={glow ? .2 : 0} rough={glow ? .25 : .65} glow={glow ? .8 : 0}/></mesh>;
}
function Roof({ at, size, color, flat = false }: { at: Point; size: Point; color: string; flat?: boolean }): JSX.Element {
  const low = useQuality() === "low";
  if (flat) return <Block at={at} size={size} color={color} surface="roof"/>;
  return <mesh castShadow receiveShadow position={at} rotation={[0,Math.PI/4,0]}><coneGeometry args={[size[0]*.68,size[1],4]}/><Surface color={color} map={low ? undefined : surfaceTexture("roof")} rough={.7}/></mesh>;
}

/** Deterministic 0..1 noise so lit windows differ per building but never flicker between renders. */
const hash = (a: number, b: number, c: number) => { const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453; return v - Math.floor(v); };
/**
 * A grid of framed windows on one facade. The group sits on the wall surface facing +z (rotate it for other sides);
 * roughly 40% of panes glow warm so the city feels lived-in at dusk.
 */
function Windows({ at, rotation = 0, width, height, cols, rows, frame, seed, arched = false }: { at: Point; rotation?: number; width: number; height: number; cols: number; rows: number; frame: string; seed: number; arched?: boolean }): JSX.Element {
  const cellW = width / cols, cellH = height / rows, w = cellW * .62, h = cellH * .6;
  return <group position={at} rotation={[0,rotation,0]}>{Array.from({ length: rows * cols }, (_, i) => {
    const col = i % cols, row = Math.floor(i / cols), x = -width / 2 + cellW * (col + .5), y = -height / 2 + cellH * (row + .5), lit = hash(seed, col, row) > .58;
    return <group key={i} position={[x,y,0]}>
      <mesh position={[0,0,.006]}><boxGeometry args={[w + .024,h + .024,.012]}/><Surface color={frame} rough={.6}/></mesh>
      <mesh position={[0,0,.014]}><boxGeometry args={[w,h,.008]}/>{lit ? <meshStandardMaterial color="#ffe0a3" emissive="#ffc46b" emissiveIntensity={.9} roughness={.3}/> : <Surface color="#4f7f99" rough={.12} metal={.35}/>}</mesh>
      {arched ? <mesh position={[0,h / 2 + .004,.014]}><cylinderGeometry args={[w / 2,w / 2,.008,10,1,false,0,Math.PI]}/>{lit ? <meshStandardMaterial color="#ffe0a3" emissive="#ffc46b" emissiveIntensity={.9} roughness={.3}/> : <Surface color="#4f7f99" rough={.12} metal={.35}/>}</mesh> : null}
      <mesh position={[0,-h / 2 - .014,.018]}><boxGeometry args={[w + .04,.016,.03]}/><Surface color={frame} rough={.6}/></mesh>
    </group>;
  })}</group>;
}
/** Windows on all four walls of a box body. */
function BoxWindows({ center, size, cols, rows, frame, seed, sideCols }: { center: Point; size: Point; cols: number; rows: number; frame: string; seed: number; sideCols?: number }): JSX.Element {
  const [cx, cy, cz] = center, [w, h, d] = size, faceH = h * .78, y = cy + h * .02;
  return <>
    <Windows at={[cx,y,cz + d / 2]} width={w * .86} height={faceH} cols={cols} rows={rows} frame={frame} seed={seed}/>
    <Windows at={[cx,y,cz - d / 2]} rotation={Math.PI} width={w * .86} height={faceH} cols={cols} rows={rows} frame={frame} seed={seed + 7}/>
    {sideCols ? <>
      <Windows at={[cx + w / 2,y,cz]} rotation={Math.PI / 2} width={d * .8} height={faceH} cols={sideCols} rows={rows} frame={frame} seed={seed + 13}/>
      <Windows at={[cx - w / 2,y,cz]} rotation={-Math.PI / 2} width={d * .8} height={faceH} cols={sideCols} rows={rows} frame={frame} seed={seed + 19}/>
    </> : null}
  </>;
}
/** Striped canvas awning over a shopfront. */
function Awning({ at, width, colors }: { at: Point; width: number; colors: [string, string] }): JSX.Element {
  const stripes = Math.max(3, Math.round(width / .09));
  return <group position={at} rotation={[.5,0,0]}>{Array.from({ length: stripes }, (_, i) => <mesh key={i} castShadow position={[-width / 2 + width / stripes * (i + .5),0,0]}><boxGeometry args={[width / stripes,.012,.16]}/><Surface color={colors[i % 2]!} rough={.75}/></mesh>)}</group>;
}
function Shrub({ at, size = 1, color = "#4f9a57" }: { at: Point; size?: number; color?: string }): JSX.Element {
  return <group position={at} scale={size}><Ball at={[0,.06,0]} radius={.07} color={color} scale={[1,.85,1]}/><Ball at={[.05,.09,.02]} radius={.045} color="#6cb86a"/></group>;
}
function Planter({ at, flowers }: { at: Point; flowers: string }): JSX.Element {
  return <group position={at}><Block at={[0,.025,0]} size={[.2,.05,.07]} color="#8a6a4d" surface="wood"/>{[-.06,0,.06].map(x=><Ball key={x} at={[x,.065,0]} radius={.028} color={x === 0 ? "#fff3d6" : flowers}/>)}</group>;
}
function Lamp({ at }: { at: Point }): JSX.Element {
  return <group position={at}><Post at={[0,.16,0]} height={.32} color="#2f3b45" radius={.01}/><Ball at={[0,.33,0]} radius={.028} color="#ffe2a1" glow/></group>;
}
function Flag({ at, color }: { at: Point; color: string }): JSX.Element {
  return <group position={at}><Post at={[0,.12,0]} height={.24} color="#d8dde0" radius={.008} metal/><mesh castShadow position={[.045,.2,0]}><boxGeometry args={[.09,.055,.006]}/><Surface color={color} rough={.6}/></mesh></group>;
}
function WaterTower({ at }: { at: Point }): JSX.Element {
  return <group position={at}>{[-1,1].flatMap(x=>[-1,1].map(z=><Post key={`${x}${z}`} at={[x*.04,.06,z*.04]} height={.12} color="#3d3a38" radius={.007}/>))}<Post at={[0,.17,0]} height={.12} color="#8a5c3c" radius={.065}/><mesh castShadow position={[0,.26,0]}><coneGeometry args={[.07,.06,12]}/><Surface color="#5a4a3f"/></mesh></group>;
}
/** Landscaped plot shared by every property: paving, lawn corners, shrubs, planters and a lamp. */
function Plot({ accent, flowers }: { accent: string; flowers: string }): JSX.Element {
  return <group>
    <Block at={[0,.33,0]} size={[1.04,.14,.78]} color="#bdb3a0" surface="stone"/>
    <Block at={[0,.412,0]} size={[.98,.022,.72]} color="#e9e1cf" surface="stone"/>
    {[-1,1].map(side=><Block key={side} at={[side*.39,.428,-.25]} size={[.2,.012,.22]} color="#6fb35e"/>)}
    <Block at={[0,.425,.355]} size={[.98,.014,.03]} color={accent}/>
    <Shrub at={[-.4,.43,-.27]} size={.9}/><Shrub at={[.4,.43,-.25]} size={.8} color="#5fa55d"/>
    <Planter at={[-.36,.43,.3]} flowers={flowers}/><Planter at={[.36,.43,.3]} flowers={flowers}/>
    <Lamp at={[.46,.43,.02]}/>
  </group>;
}

function CitySignature({ id, wall, roof, trim, glass, accent }: { id: string; wall: string; roof: string; trim: string; glass: string; accent: string }): JSX.Element {
  if (id === "cairo-giza" || id === "zermatt") return <group>
    <mesh castShadow position={[0,.95,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[.62,1.05,4]}/><meshStandardMaterial color={id === "zermatt" ? "#7c8683" : "#d6ae71"} map={surfaceTexture("stone")}/></mesh>
    {id === "zermatt" ? <mesh castShadow position={[0,1.32,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[.25,.32,4]}/><Surface color="#f6f8f2"/></mesh> : <mesh castShadow position={[0,1.44,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[.1,.12,4]}/><Surface color="#e8c25a" rough={.3} metal={.8}/></mesh>}
    <Flag at={[.3,.43,.25]} color={accent}/>
  </group>;
  if (id === "santorini") return <group><Block at={[0,.78,0]} size={[.8,.67,.58]} color={wall} surface="plaster"/><Windows at={[0,.82,.29]} width={.6} height={.4} cols={3} rows={1} frame={roof} seed={3} arched/><mesh castShadow position={[0,1.12,0]}><sphereGeometry args={[.34,24,12,0,Math.PI*2,0,Math.PI/2]}/><Surface color={roof} rough={.35}/></mesh><Post at={[0,1.5,0]} height={.1} color={trim} radius={.02}/><Ball at={[0,1.58,0]} radius={.035} color={trim}/><Block at={[.33,.62,.3]} size={[.14,.3,.03]} color={roof}/></group>;
  if (id === "singapore") return <group>{[-.28,0,.28].map((x,i)=><group key={x}><Block at={[x,1.04+i*.13,0]} size={[.2,1.16+i*.26,.4]} color={glass} glow/><Windows at={[x,1.04+i*.13,.2]} width={.16} height={1+i*.22} cols={1} rows={6} frame="#e9eef0" seed={i}/></group>)}<Block at={[0,1.74,0]} size={[.96,.1,.5]} color={trim}/><Block at={[0,1.8,0]} size={[.8,.045,.42]} color="#5d9b67"/>{[-.3,0,.3].map(x=><Shrub key={x} at={[x,1.82,0]} size={.8}/>)}</group>;
  if (id === "sydney") return <group>{[-.25,0,.25].map((x,i)=><mesh key={x} castShadow position={[x,.86+(i===1?.08:0),0]} rotation={[0,0,i === 0 ? .45 : i === 2 ? -.45 : 0]}><coneGeometry args={[.28,.85,3]}/><Surface color="#fbf9f1" rough={.35}/></mesh>)}<Block at={[0,.5,0]} size={[.9,.14,.62]} color={wall}/><Block at={[0,.52,.3]} size={[.7,.08,.03]} color={glass} glow/></group>;
  if (id === "rio") return <group><mesh castShadow position={[0,.72,0]}><coneGeometry args={[.5,.55,14]}/><Surface color="#4f8a61"/></mesh><Shrub at={[-.2,.72,.15]} size={.8}/><Shrub at={[.2,.62,.2]} size={.8}/><Post at={[0,1.27,0]} height={.6} color={trim} radius={.075}/><Block at={[0,1.43,0]} size={[.54,.07,.12]} color={trim}/><Ball at={[0,1.62,0]} radius={.11} color={trim}/></group>;
  if (id === "paris") return <group>{[-.24,.24].map(x=><Post key={x} at={[x*.6,1.12,0]} height={1.28} color={roof} radius={.035}/>)}<Block at={[0,.74,0]} size={[.75,.07,.35]} color={roof}/><Block at={[0,1.14,0]} size={[.51,.06,.32]} color={roof}/><Block at={[0,1.67,0]} size={[.21,.06,.27]} color={roof}/><Post at={[0,1.98,0]} height={.58} color={roof} radius={.02}/><Ball at={[0,2.3,0]} radius={.03} color="#ffe2a1" glow/></group>;
  if (id === "bangkok" || id === "kyoto") return <group>{[0,1,2].map(i=><group key={i}><Block at={[0,.65+i*.42,0]} size={[.64-i*.1,.31,.47-i*.07]} color={wall} surface="plaster"/><Windows at={[0,.66+i*.42,.235-i*.035]} width={.44-i*.1} height={.2} cols={2} rows={1} frame={trim} seed={i}/><Roof at={[0,.86+i*.42,0]} size={[.84-i*.1,.25,.59-i*.07]} color={roof} flat/>{[-1,1].map(side=><Ball key={side} at={[side*(.42-i*.05),.9+i*.42,.3-i*.035]} radius={.028} color="#e6b84c"/>)}</group>)}<Post at={[0,1.91,0]} height={.35} color="#e6b84c" radius={.025} metal/></group>;
  if (id === "venice") return <group><Block at={[0,1.02,0]} size={[.42,1.33,.4]} color={wall} surface="plaster"/><Windows at={[0,1.1,.2]} width={.3} height={.9} cols={2} rows={3} frame={trim} seed={5} arched/><Roof at={[0,1.79,0]} size={[.63,.37,.57]} color={roof}/><Ball at={[0,2.02,0]} radius={.035} color="#e6b84c"/></group>;
  if (id === "new-york") return <group><Block at={[0,1.13,0]} size={[.54,1.48,.47]} color={wall} surface="stone"/><BoxWindows center={[0,1.13,0]} size={[.54,1.48,.47]} cols={3} rows={6} frame={trim} seed={11} sideCols={2}/><Block at={[0,1.93,0]} size={[.4,.15,.37]} color={accent}/><Block at={[0,2.06,0]} size={[.26,.12,.25]} color={trim}/><Post at={[0,2.3,0]} height={.36} color={trim} radius={.02} metal/></group>;
  return <group>{[0,1,2].map(step=><group key={step}><Post at={[0,.72+step*.42,0]} height={.42} color={step%2?roof:trim} radius={.25-step*.065}/><Block at={[0,.9+step*.42,0]} size={[.72-step*.17,.045,.52-step*.11]} color={trim}/></group>)}<Post at={[0,2.13,0]} height={.65} color={trim} radius={.025}/><Ball at={[0,2.46,0]} radius={.055} color="#ff6968" glow/></group>;
}

/** Every purchasable board position has a different silhouette; colours come from the city palette, details from shared props. */
export function PropertyArchitecture({ mapId, tileIndex, level }: { mapId: string; tileIndex: number; level: number }): JSX.Element {
  const city = locationById(mapId), form = propertyForm(tileIndex), tokyo = city.id === "tokyo";
  const palette = palettes[city.id] ?? palettes.bangkok!, pick = (offset: number) => palette[(form + offset) % palette.length]!;
  const wall = pick(0), accent = pick(2), roof = form % 3 === 0 ? city.roof : pick(4), flowers = pick(3);
  const trim = city.category === "ธรรมชาติ" ? "#f3ead2" : "#f1e6cf";
  const glass = tokyo ? "#76b5c2" : "#7fb3c0";
  const glow = form % 2 ? "#f5c56b" : "#86dce6";
  const neon = ["#ff5fa2", "#48e0f0", "#ffd84d", "#9d7bff"];
  const heightScale = .78 + Math.min(3,Math.max(1,level))*.12;
  return <group name={`property-form:${forms[form]}:${city.id}`}>
    <Plot accent={accent} flowers={flowers}/>
    <group scale={[1,heightScale,1]} position={[0,.43*(1-heightScale),0]}>
    {form === 0 ? <group>
      {[-.35,.35].map(x=><group key={x}><Post at={[x,1.03,0]} height={1.18} color={tokyo ? "#d94535" : wall} radius={.065}/><Block at={[x,.52,0]} size={[.17,.2,.2]} color={trim} surface="stone"/><Ball at={[x,1.66,0]} radius={.05} color="#e6b84c"/></group>)}
      <Block at={[0,1.5,0]} size={[.94,.1,.24]} color={tokyo ? "#d94535" : wall}/><Block at={[0,1.64,0]} size={[1.08,.08,.34]} color={roof} surface="roof"/>
      <Block at={[0,1.38,.13]} size={[.3,.14,.02]} color={accent}/>
      {[-.18,.18].map(x=><group key={x}><Post at={[x,1.3,.05]} height={.1} color="#3a2a22" radius={.006}/><Ball at={[x,1.18,.05]} radius={.07} color={tokyo ? "#e8513f" : glow} glow scale={[1,1.25,1]}/></group>)}
    </group> : null}
    {form === 1 ? <group>
      <Block at={[0,1.13,0]} size={[.76,1.42,.52]} color={wall} surface="plaster"/>
      <BoxWindows center={[0,1.05,0]} size={[.76,1.1,.52]} cols={3} rows={4} frame={trim} seed={form} sideCols={2}/>
      <Block at={[0,1.64,.275]} size={[.6,.26,.03]} color={neon[form % 4]!} glow/>
      <Awning at={[0,.66,.33]} width={.7} colors={[accent,"#fdf6ea"]}/>
      <Block at={[0,1.88,0]} size={[.82,.08,.58]} color={roof}/>
      {city.id === "new-york" ? <WaterTower at={[.22,1.92,-.1]}/> : <Block at={[.22,1.96,-.1]} size={[.16,.1,.14]} color="#b9c0c2"/>}
    </group> : null}
    {form === 2 ? <group>
      <Block at={[0,.8,0]} size={[.9,.72,.58]} color={wall} surface="plaster"/>
      <Windows at={[0,.86,.29]} width={.74} height={.34} cols={4} rows={1} frame={trim} seed={form} arched/>
      <Windows at={[0,.86,-.29]} rotation={Math.PI} width={.74} height={.34} cols={4} rows={1} frame={trim} seed={form+3} arched/>
      <Roof at={[0,1.3,0]} size={[.98,.46,.64]} color={roof}/>
      <Block at={[0,.62,.31]} size={[.2,.36,.03]} color="#3b5058"/>
      <Ball at={[0,1.3,.33]} radius={.1} color="#fff4d8" glow/><Block at={[0,1.3,.33]} size={[.012,.07,.02]} color="#333"/>
      <Awning at={[0,.84,.36]} width={.34} colors={[accent,"#fdf6ea"]}/>
      <Flag at={[0,1.5,0]} color={accent}/>
    </group> : null}
    {form === 3 ? <group>
      {[0,1,2].map(floor=><group key={floor}>
        <Block at={[0,.65+floor*.45,0]} size={[.73-floor*.12,.37,.55-floor*.08]} color={floor % 2 ? trim : wall} surface="plaster"/>
        <Windows at={[0,.66+floor*.45,.275-floor*.04]} width={.5-floor*.12} height={.22} cols={2} rows={1} frame={accent} seed={floor}/>
        <Roof at={[0,.89+floor*.45,0]} size={[.93-floor*.12,.08,.7-floor*.08]} color={roof} flat/>
        {[-1,1].flatMap(sx=>[-1,1].map(sz=><Ball key={`${sx}${sz}`} at={[sx*(.46-floor*.06),.93+floor*.45,sz*(.35-floor*.04)]} radius={.03} color="#e6b84c"/>))}
      </group>)}
      <Post at={[0,2.12,0]} height={.3} color="#e6b84c" radius={.025} metal/><Ball at={[0,2.3,0]} radius={.04} color="#e6b84c"/>
    </group> : null}
    {form === 4 ? <group>
      {[-.3,.3].map((x,i)=><group key={x}><Block at={[x,1.08,0]} size={[.23,1.25,.47]} color={wall} surface="plaster"/><Windows at={[x,1.02,.235]} width={.16} height={.9} cols={1} rows={5} frame={trim} seed={form+i}/><Windows at={[x,1.02,-.235]} rotation={Math.PI} width={.16} height={.9} cols={1} rows={5} frame={trim} seed={form+i+4}/></group>)}
      <Block at={[0,1.7,0]} size={[.86,.11,.5]} color={accent}/>
      <Ball at={[0,1.3,.05]} radius={.28} color={glass} glow/>
      <mesh position={[0,1.3,.05]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.32,.018,8,32]}/><Surface color="#e6b84c" rough={.3} metal={.8}/></mesh>
      <Post at={[0,2.03,0]} height={.42} color={trim} radius={.022} metal/><Ball at={[0,2.26,0]} radius={.035} color={neon[1]!} glow/>
    </group> : null}
    {form === 5 ? <group>
      <Block at={[-.09,1.02,0]} size={[.59,1.18,.52]} color={glass} glow/>
      {[.65,.93,1.21,1.49].map(y=><Block key={y} at={[-.09,y,.27]} size={[.63,.03,.04]} color={trim}/>)}
      {[-.3,-.09,.12].map(x=><Block key={x} at={[x,1.07,.27]} size={[.025,1.05,.035]} color={trim}/>)}
      <Block at={[.27,.78,.04]} size={[.26,.7,.48]} color={wall} surface="plaster"/>
      <Windows at={[.27,.84,.28]} width={.2} height={.4} cols={1} rows={2} frame={trim} seed={form}/>
      <Awning at={[-.09,.62,.36]} width={.55} colors={[accent,"#fdf6ea"]}/>
      <Block at={[-.09,1.63,0]} size={[.68,.09,.6]} color={roof}/><Shrub at={[-.2,1.68,0]} size={.9}/><Shrub at={[.05,1.68,.05]} size={.7}/>
    </group> : null}
    {form === 6 ? <CitySignature id={city.id} wall={wall} roof={roof} trim={trim} glass={glass} accent={accent}/> : null}
    {form === 7 ? <group>
      <Block at={[0,1.15,0]} size={[.66,1.48,.52]} color={wall} surface="plaster"/>
      <BoxWindows center={[0,1.08,0]} size={[.66,1.2,.52]} cols={3} rows={5} frame={trim} seed={form} sideCols={2}/>
      {[-.35,.35].map((x,i)=><Block key={x} at={[x,1.16,.27]} size={[.04,1.27,.03]} color={neon[i]!} glow/>)}
      <Block at={[.2,1.3,.3]} size={[.14,.5,.04]} color={neon[2]!} glow/>
      <Block at={[0,1.95,0]} size={[.73,.08,.6]} color={roof}/>
      <Block at={[0,2.12,-.05]} size={[.56,.24,.03]} color={neon[3]!} glow/>{[-.2,.2].map(x=><Post key={x} at={[x,2.02,-.05]} height={.1} color="#3b4148" radius={.01}/>)}
    </group> : null}
    {form === 8 ? <group>
      {[-.24,.24].map((x,i)=><group key={x}><Block at={[x,1.22+i*.11,0]} size={[.37,1.55+i*.22,.47]} color={i ? accent : wall} surface="plaster"/>
        <BoxWindows center={[x,1.18+i*.11,0]} size={[.37,1.3+i*.22,.47]} cols={2} rows={6} frame={trim} seed={form+i*5}/>
        <Block at={[x,2.03+i*.22,0]} size={[.28,.08,.36]} color={roof}/><Post at={[x,2.18+i*.22,0]} height={.22} color={trim} radius={.012} metal/></group>)}
      <Block at={[0,1.34,.02]} size={[.23,.12,.4]} color={glass} glow/>
    </group> : null}
    {form === 9 ? <group>
      <Post at={[0,.73,0]} height={.62} color={wall} radius={.42}/>
      {[.55,.9].map(y=><mesh key={y} position={[0,y,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.425,.022,6,40]}/><Surface color={accent} rough={.5}/></mesh>)}
      <mesh castShadow position={[0,1.04,0]}><sphereGeometry args={[.44,28,12,0,Math.PI*2,0,Math.PI/2]}/><Surface color={tokyo?"#eceae4":trim} rough={.4}/></mesh>
      {Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return <mesh key={i} position={[Math.cos(a)*.3,1.2,Math.sin(a)*.3]} rotation={[0,-a,.9]}><boxGeometry args={[.012,.3,.02]}/><Surface color={roof}/></mesh>; })}
      {[-.22,0,.22].map(x=><Block key={x} at={[x,.66,.41]} size={[.13,.22,.03]} color={glass} glow/>)}
      <Block at={[0,.84,.45]} size={[.62,.03,.12]} color={accent}/>
      {[-.3,0,.3].map((x,i)=><Flag key={x} at={[x,1.25+(i===1?.2:0),0]} color={neon[i]!}/>)}
    </group> : null}
    {form === 10 ? <group>
      {[-.37,.37].map(x=><group key={x}><Post at={[x,.86,0]} height={.78} color={roof} radius={.055}/><Post at={[x,1.31,0]} height={.23} color={trim} radius={.025}/><Ball at={[x,1.44,0]} radius={.035} color="#ffe2a1" glow/></group>)}
      <Block at={[0,.93,0]} size={[.93,.08,.34]} color={trim} surface="stone"/>
      {[-1,1].map(side=><Block key={side} at={[0,1,side*.16]} size={[.9,.05,.015]} color={accent}/>)}
      <mesh castShadow position={[0,1.18,.02]}><torusGeometry args={[.38,.04,10,40,Math.PI]}/><Surface color={accent} rough={.45}/></mesh>
      {[-.24,-.12,0,.12,.24].map(x=><Post key={x} at={[x,1.02+Math.sqrt(Math.max(0,.38*.38-x*x))*.5,.02]} height={Math.sqrt(Math.max(0,.38*.38-x*x))} color="#e7ecef" radius={.006}/>)}
      <Block at={[0,.5,0]} size={[.86,.025,.57]} color="#4fb3c9" glow/>
    </group> : null}
    {form === 11 ? <group>
      {[-.31,.31].flatMap(x=>[-.21,.21].map(z=><Post key={`${x}:${z}`} at={[x,.86,z]} height={.8} color={tokyo ? "#d94535" : accent} radius={.052}/>))}
      <Roof at={[0,1.36,0]} size={[1.02,.36,.7]} color={roof}/>
      <Block at={[0,1.2,0]} size={[.8,.06,.56]} color="#e6b84c" metal/>
      <Block at={[0,.72,0]} size={[.45,.3,.36]} color={wall} surface="plaster"/>
      <Ball at={[0,.9,.24]} radius={.08} color={glow} glow/>
      {[-.2,.2].map(x=><group key={x}><Post at={[x,.52,.33]} height={.16} color="#8f8a80" radius={.03}/><Ball at={[x,.63,.33]} radius={.045} color="#ffe2a1" glow/></group>)}
    </group> : null}
    {form === 12 ? <group>
      {[-.25,.25].flatMap(x=>[-.18,.18].map(z=><Post key={`${x}:${z}`} at={[x,.9,z]} height={.84} color={trim} radius={.04}/>))}
      <mesh castShadow position={[0,1.53,0]} rotation={[0,Math.PI/4,0]}><cylinderGeometry args={[.46,.21,.42,4]}/><Surface color={tokyo?"#dfe5e5":wall} rough={.45}/></mesh>
      {[0,1,2,3].map(i=><mesh key={i} position={[0,1.53,0]} rotation={[0,Math.PI/4+i*Math.PI/2,0]}><boxGeometry args={[.02,.44,.66]}/><Surface color={accent}/></mesh>)}
      <Block at={[0,1.78,0]} size={[.67,.06,.56]} color={roof}/>
      <Block at={[0,.72,0]} size={[.46,.52,.32]} color={glass} glow/>
      {[-.12,0,.12].map(x=><Block key={x} at={[x,.72,.17]} size={[.015,.5,.02]} color={trim}/>)}
      <Flag at={[.25,1.81,0]} color={neon[form % 4]!}/>
    </group> : null}
    {form === 13 ? <group>
      <Block at={[-.15,1.09,0]} size={[.43,1.36,.44]} color={wall} surface="plaster"/>
      <BoxWindows center={[-.15,1.02,0]} size={[.43,1.1,.44]} cols={2} rows={5} frame={trim} seed={form}/>
      <Block at={[.22,.83,.04]} size={[.3,.85,.47]} color={glass} glow/>
      <mesh position={[-.15,1.77,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.25,.02,6,32]}/><Surface color={accent}/></mesh>
      <mesh castShadow position={[-.15,1.8,0]}><sphereGeometry args={[.21,24,12,0,Math.PI*2,0,Math.PI/2]}/><Surface color="#e9edf0" rough={.25} metal={.6}/></mesh>
      <Block at={[-.15,1.9,.12]} size={[.06,.2,.05]} color="#2b3440"/>
      <mesh position={[-.02,1.97,.1]} rotation={[.9,0,-.4]}><cylinderGeometry args={[.025,.035,.26,10]}/><Surface color={accent} rough={.4} metal={.4}/></mesh>
      <Post at={[.22,1.37,.04]} height={.22} color={trim} radius={.015}/><Ball at={[.22,1.5,.04]} radius={.03} color={neon[0]!} glow/>
    </group> : null}
    {level >= 3 ? <Block at={[0,.45,.37]} size={[.5,.02,.04]} color="#e6b84c" metal/> : null}
    </group>
  </group>;
}
