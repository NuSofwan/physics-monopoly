import { locationById } from "@physics-monopoly/shared";
import { Quaternion, Shape, ShapeGeometry, Vector2, Vector3, type BufferGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { facadeTextures, surfaceTexture, waterNormalTexture, type Facade, type Surface } from "./SurfaceTextures";
import { useQuality } from "./RenderQuality";
import { PropertyArchitecture } from "./PropertyArchitecture";
type Position = [number,number,number];
const bevelled = new Map<string, BufferGeometry>();
const RIPPLE = new Vector2(.5, .5);
/** Shared chamfered boxes: soft edges catch the key light and read as finished toy-like models. */
function roundedBox([width,height,depth]: Position): BufferGeometry {
  const key = `${width}:${height}:${depth}`;
  let geometry = bevelled.get(key);
  if (!geometry) { geometry = new RoundedBoxGeometry(width, height, depth, 1, Math.min(.045, Math.min(width,height,depth) * .22)); bevelled.set(key, geometry); }
  return geometry;
}
export function Box({ at, size, color, rotation = 0, roughness = .78, metalness = 0, surface, emissive, emissiveIntensity = 0 }: { at: Position; size: Position; color: string; rotation?: number; roughness?: number; metalness?: number; surface?: Surface; emissive?: string; emissiveIntensity?: number }): JSX.Element {
  const materialMap = surface ?? (metalness === 0 && Math.max(...size) > .48 ? "plaster" : undefined);
  const bevel = useQuality() !== "low" && Math.min(...size) >= .035 && Math.max(...size) >= .14;
  return <mesh castShadow receiveShadow position={at} rotation={[0,rotation,0]} geometry={bevel ? roundedBox(size) : undefined}>{bevel ? null : <boxGeometry args={size} />}<meshStandardMaterial color={color} map={materialMap ? surfaceTexture(materialMap) : undefined} roughness={roughness} metalness={metalness} emissive={emissive} emissiveIntensity={emissiveIntensity}/></mesh>;
}
const GOLD = { metalness: .82, roughness: .28 } as const;
function Cone({ at, radius, height, color, sides = 4, metal = false }: { at: Position; radius: number; height: number; color: string; sides?: number; metal?: boolean }): JSX.Element {
  return <mesh castShadow position={at} rotation={[0,Math.PI / 4,0]}><coneGeometry args={[radius,height,sides]} /><meshStandardMaterial color={color} map={metal ? undefined : surfaceTexture(radius > 1 ? "stone" : "roof")} roughness={metal ? GOLD.roughness : .83} metalness={metal ? GOLD.metalness : 0}/></mesh>;
}
function Cylinder({ at, radius, height, color, metal = false, emissive, emissiveIntensity = 0, textured = height > .5 }: { at: Position; radius: number; height: number; color: string; metal?: boolean; emissive?: string; emissiveIntensity?: number; textured?: boolean }): JSX.Element {
  const segments = useQuality() === "low" ? 12 : 20;
  return <mesh castShadow position={at}><cylinderGeometry args={[radius,radius,height,segments]} /><meshStandardMaterial color={color} map={!metal && textured ? surfaceTexture("wood") : undefined} roughness={metal ? GOLD.roughness : .83} metalness={metal ? GOLD.metalness : 0} emissive={emissive} emissiveIntensity={emissiveIntensity}/></mesh>;
}
function Dome({ at, radius, color }: { at: Position; radius: number; color: string }): JSX.Element {
  return <mesh castShadow position={at}><sphereGeometry args={[radius,16,8,0,Math.PI*2,0,Math.PI/2]} /><meshStandardMaterial color={color} roughness={.9}/></mesh>;
}
function Arch({ at, radius, color }: { at: Position; radius: number; color: string }): JSX.Element {
  return <mesh castShadow position={at}><torusGeometry args={[radius,.15,6,20,Math.PI]} /><meshStandardMaterial color={color} /></mesh>;
}
const triangles = new Map<string, BufferGeometry>();
function triangle(width: number, rise: number): BufferGeometry {
  const key = `${width}:${rise}`;
  let geometry = triangles.get(key);
  if (!geometry) { const shape = new Shape(); shape.moveTo(-width/2,0); shape.lineTo(width/2,0); shape.lineTo(0,rise); shape.closePath(); geometry = new ShapeGeometry(shape); triangles.set(key, geometry); }
  return geometry;
}
/** Closed gable end so the roof never shows its dark underside; optional gold frame for temple pediments. */
function Pediment({ y, width, rise, z, color, frame }: { y: number; width: number; rise: number; z: number; color: string; frame?: string }): JSX.Element {
  return <>{[-1,1].map(side=><group key={side} position={[0,y,side*z]} rotation={[0,side<0?Math.PI:0,0]}>
    <mesh receiveShadow geometry={triangle(width,rise)}><meshStandardMaterial color={frame ?? color} metalness={frame ? .8 : 0} roughness={frame ? .3 : .85}/></mesh>
    {frame ? <mesh receiveShadow position={[0,rise*.08,.012]} geometry={triangle(width*.78,rise*.78)}><meshStandardMaterial color={color} roughness={.6}/></mesh> : null}
    {frame ? <mesh position={[0,rise*.3,.02]} rotation={[0,0,Math.PI/4]}><boxGeometry args={[rise*.22,rise*.22,.02]}/><meshStandardMaterial color={frame} metalness={.8} roughness={.3}/></mesh> : null}
  </group>)}</>;
}
function Gable({ y, width, depth, rise, color, surface = "roof", pediment, frame, inset = .1 }: { y: number; width: number; depth: number; rise: number; color: string; surface?: Surface; pediment?: string; frame?: string; inset?: number }): JSX.Element {
  const angle = Math.atan2(rise,width/2), length = Math.hypot(width/2,rise);
  return <group>
    {pediment ? <Pediment y={y} width={width*.95} rise={rise*.93} z={depth/2-inset} color={pediment} frame={frame}/> : null}
    <Box at={[0,y-.035,0]} size={[width+.08,.075,depth+.08]} color="#554536" />
    {[-1,1].map(side => <group key={side}>
      <mesh castShadow receiveShadow position={[side*width/4,y+rise/2,0]} rotation={[0,0,-side*angle]}><boxGeometry args={[length,.075,depth]}/><meshStandardMaterial color={color} map={surfaceTexture(surface)} roughness={.9}/></mesh>
      <mesh castShadow position={[side*width/4,y+rise/2,depth/2+.012]} rotation={[0,0,-side*angle]}><boxGeometry args={[length,.035,.04]}/><meshStandardMaterial color="#403934" roughness={.86}/></mesh>
      {[0,1,2,3,4].map(i=><mesh key={i} castShadow position={[side*width/4,y+rise/2,-depth/2+.08+i*(depth-.16)/4]} rotation={[0,0,-side*angle]}><boxGeometry args={[length,.012,.025]}/><meshStandardMaterial color="#81908a" roughness={.95}/></mesh>)}
    </group>)}
    <Box at={[0,y+rise+.018,0]} size={[.055,.055,depth+.07]} color="#313d3b" />
  </group>;
}
function FacadeWindow({ x, y, z, width, height, timber }: { x: number; y: number; z: number; width: number; height: number; timber: boolean }): JSX.Element {
  const frame = timber ? "#372d29" : "#e6d4ba";
  const glass = timber ? "#748c84" : "#638c9d";
  return <group>
    <Box at={[x,y,z]} size={[width+.055,height+.055,.025]} color={frame}/>
    <Box at={[x,y,z+.018]} size={[width,height,.016]} color={glass} roughness={.12} metalness={.2} emissive="#ffc877" emissiveIntensity={.62}/>
    <Box at={[x,y,z+.032]} size={[.018,height+.025,.018]} color={frame}/>
    <Box at={[x,y,z+.033]} size={[width+.025,.016,.018]} color={frame}/>
    <Box at={[x,y-height/2-.045,z+.035]} size={[width+.09,.038,.07]} color={timber?"#6c523c":"#d9c8ae"}/>
    <Box at={[x-width*.2,y+height*.21,z+.036]} size={[width*.09,height*.28,.009]} color="#b9cbc4" roughness={.25}/>
    {timber ? [-.34,.34].map(p=><Box key={p} at={[x+p*width,y,z+.041]} size={[.012,height,.014]} color="#3c3129"/>) : null}
  </group>;
}
function Entrance({ timber, wall, width }: { timber: boolean; wall: string; width: number }): JSX.Element {
  const frame = timber ? "#4b3427" : "#c5b397";
  return <group>
    <Box at={[0,.335,.35]} size={[width*.44,.45,.065]} color={frame}/>
    <Box at={[0,.34,.393]} size={[width*.36,.39,.018]} color={timber?"#765842":"#63777b"} roughness={.43}/>
    <Box at={[0,.34,.409]} size={[.018,.39,.018]} color={frame}/>
    <Box at={[width*.13,.36,.422]} size={[.018,.025,.018]} color="#dbbc76" metalness={.5}/>
    <Box at={[0,.11,.45]} size={[width*.6,.08,.29]} color={wall}/>
    <Box at={[0,.065,.57]} size={[width*.72,.04,.17]} color="#a8a297"/>
    <Box at={[0,.6,.4]} size={[width*.56,.045,.18]} color={timber?"#48382c":"#c2a889"}/>
  </group>;
}
function Balcony({ y, width, color }: { y: number; width: number; color: string }): JSX.Element {
  return <group><Box at={[0,y,.37]} size={[width,.045,.22]} color={color}/><Box at={[0,y+.12,.47]} size={[width,.035,.035]} color={color}/>{[-.4,-.2,0,.2,.4].filter(x=>Math.abs(x)<width/2).map(x=><Box key={x} at={[x,y+.06,.47]} size={[.025,.12,.025]} color={color}/>)}</group>;
}
export function LocalBuilding({ mapId, level, owned, variant = 0, tileIndex }: { mapId?: string; level: number; owned: boolean; variant?: number; tileIndex?: number }): JSX.Element {
  const city = locationById(mapId), id = city.id, v = variant % 2, height = [.08,.62,1.15,1.85][Math.min(3,Math.max(0,level))]!;
  if (!owned || level === 0) return <group>
    <Box at={[0,.31,0]} size={[1.02,.08,.8]} color="#a7a397"/>
    <Box at={[0,.36,0]} size={[.94,.035,.72]} color={owned ? "#79946b" : "#aa9579"}/>
    {v ? <><Box at={[.3,.44,0]} size={[.04,.15,.61]} color="#e7dfcb"/><Box at={[-.3,.44,0]} size={[.04,.15,.61]} color="#e7dfcb"/><Box at={[0,.44,-.28]} size={[.62,.025,.035]} color="#e7dfcb"/></> : <><Cylinder at={[.25,.47,-.16]} radius={.085} height={.17} color="#587b4c"/><Box at={[-.16,.38,.1]} size={[.39,.04,.32]} color="#cdbca1"/></>}
  </group>;
  if (tileIndex !== undefined) return <PropertyArchitecture mapId={id} tileIndex={tileIndex} level={level}/>;
  const timber = ["kyoto","zermatt"].includes(id) || (id === "bangkok" && level < 3);
  const modern = level === 3 && ["new-york","tokyo","singapore","sydney","bangkok"].includes(id);
  if (modern) return <ModernTower id={id} variant={v}/>;
  const base = id === "bangkok" && level === 1 ? .53 : .34;
  const top = base+height, width = v ? .68 : .88;
  const wall = modern ? (id === "new-york" ? "#758fa0" : "#c4d9d6") : city.wall;
  return <group>
    <Box at={[0,.28,0]} size={[1.08,.09,.84]} color="#96968e"/>
    <Box at={[0,.335,0]} size={[1.02,.025,.78]} color="#d4c9ae"/>
    <Box at={[0,base+height/2,0]} size={[width,height,.6]} color={wall} />
    <Box at={[0,base+.04,.32]} size={[width+.045,.055,.075]} color={timber?"#493b30":"#ccb89b"}/>
    <Box at={[0,top-.055,.32]} size={[width+.05,.07,.075]} color={timber?"#493b30":"#ccb89b"}/>
    <Box at={[-width/2-.017,base+height/2,.315]} size={[.045,height,.06]} color={timber?"#4c392c":"#d3bfa5"}/>
    <Box at={[width/2+.017,base+height/2,.315]} size={[.045,height,.06]} color={timber?"#4c392c":"#d3bfa5"}/>
    {v ? <><Box at={[.37,.34+height*.27,.04]} size={[.24,height*.54,.55]} color={wall}/><Box at={[.37,.37+height*.54,.04]} size={[.28,.05,.6]} color={city.roof}/></> : null}
    {id === "santorini" ? <><Dome at={[-.12,top,0]} radius={v?.23:.33} color={city.roof}/><Box at={[.26,top-.12,0]} size={[.22,.28,.62]} color={wall}/></>
      : id === "paris" ? <><mesh castShadow position={[0,top+.19,0]} rotation={[0,Math.PI/4,0]} scale={[1,1,.8]}><cylinderGeometry args={[.35,.68,.38,4]}/><meshStandardMaterial color={city.roof}/></mesh>{[-.22,.22].map(x=><group key={x}><Box at={[x,top+.16,.28]} size={[.17,.2,.16]} color={wall}/><Box at={[x,top+.17,.37]} size={[.09,.12,.015]} color="#426c85"/></group>)}<Box at={[.27,top+.4,-.1]} size={[.1,.25,.12]} color={wall}/></>
      : timber || (id === "venice") || (id === "rio" && level === 1) || (id === "sydney" && level === 1) || (id === "tokyo" && level === 1)
        ? <><Gable y={top} width={width+.22} depth={.81} rise={id==="zermatt"?.34:.24} color={city.roof} pediment={timber ? "#6b4c36" : wall} inset={.105}/>{id==="zermatt"?<Box at={[.25,top+.3,-.15]} size={[.12,.4,.12]} color="#806a5b"/>:null}</>
        : <><Box at={[0,top+.025,0]} size={[width+.09,.08,.7]} color={city.roof}/><RoofClutter y={top+.065} width={width} seed={level+v}/></>}
    {Array.from({ length: level }, (_, floor) => <group key={floor} position={[0,base+.25+floor*.5,.31]}>
      {(modern?[-.24,0,.24]:[-.21,.21]).filter(x=>Math.abs(x)<width/2).map((x) => <FacadeWindow key={x} x={x} y={0} z={.018} width={modern?.17:.19} height={modern?.33:.28} timber={timber}/>)}
      {id === "kyoto" ? <><Box at={[0,.205,.035]} size={[width-.1,.036,.1]} color="#3b312a"/>{[-.27,-.18,-.09,0,.09,.18,.27].map(x=><Box key={x} at={[x,0,.055]} size={[.017,.35,.023]} color="#b9946c"/>)}</> : null}
      {id === "singapore" ? <><Box at={[0,-.15,.04]} size={[width,.1,.16]} color="#8eac96"/><Box at={[0,-.08,.05]} size={[width-.04,.12,.14]} color="#398552"/></> : null}
    </group>)}
    {Array.from({ length: level }, (_, floor) => <group key={`rear:${floor}`} position={[0,base+.25+floor*.5,-.31]} rotation={[0,Math.PI,0]}>
      {[-.21,.21].filter(x=>Math.abs(x)<width/2).map((x) => <FacadeWindow key={x} x={x} y={0} z={.018} width={.19} height={.28} timber={timber}/>)}
    </group>)}
    <Entrance timber={timber} wall={wall} width={width}/>
    {timber ? <>{[-width/2,width/2].map(x=><Box key={x} at={[x,base+height/2,.365]} size={[.055,height,.065]} color="#543d2c"/>)}{Array.from({length:level+1},(_,floor)=><Box key={floor} at={[0,base+floor*height/level,.365]} size={[width,.045,.065]} color="#543d2c"/>)}{[-.29,.29].map(x=><Box key={x} at={[x,base+height/2,-.325]} size={[.04,height,.04]} color="#57412f"/>)}</> : null}
    {["paris","venice","rio","zermatt","sydney"].includes(id) ? Array.from({length:level},(_,floor)=><Balcony key={floor} y={base+.04+floor*.5} width={width+.05} color={timber?"#674831":"#657276"}/>) : null}
    {id === "bangkok" && level === 1 ? [-.33,.33].flatMap(x=>[-.23,.23].map(z=><Box key={`${x}:${z}`} at={[x,.43,z]} size={[.06,.23,.06]} color="#68492d"/>)) : null}
    {id === "bangkok" && level === 2 ? <><Balcony y={.86} width={width+.08} color="#806247"/><Box at={[0,.65,.41]} size={[width,.06,.25]} color={city.roof}/></> : null}
    {modern ? <><Box at={[v?-.12:0,top+.2,0]} size={[v?.35:.52,.3,.42]} color={wall}/>{id==="singapore"||id==="bangkok"?<Box at={[.27,top+.13,.16]} size={[.2,.14,.2]} color="#398552"/>:null}{id==="new-york"||id==="tokyo"?<Cylinder at={[0,top+.58,0]} radius={.02} height={.5} color="#c3cbd0"/>:null}</> : null}
    {id === "new-york" && level < 3 ? <><Box at={[0,top+.03,.32]} size={[width+.08,.12,.12]} color="#c3ac91"/><Box at={[0,.38,.43]} size={[.35,.09,.2]} color="#8e8277"/>{Array.from({length:level},(_,floor)=><Box key={floor} at={[width/2+.02,.65+floor*.5,0]} size={[.04,.24,.35]} color="#3e515e"/>)}</> : null}
    {id === "tokyo" && level > 1 ? <><Box at={[width/2+.02,.96,.24]} size={[.08,.65,.14]} color={v?"#51cad4":"#de6980"}/><Box at={[0,.71,.39]} size={[width,.12,.18]} color={city.roof}/></> : null}
    {id === "cairo-giza" ? <>{[-width/2,width/2].map(x=><Box key={x} at={[x,top+.13,-.2]} size={[.13,.22,.15]} color={wall}/>)}<Box at={[0,top+.1,-.27]} size={[width,.16,.08]} color={wall}/><Box at={[0,.71,.42]} size={[width,.055,.3]} color="#ad8d60"/>{[-width/2,width/2].map(x=><Cylinder key={x} at={[x,.51,.48]} radius={.025} height={.37} color="#ad8d60"/>)}</> : null}
  </group>;
}
const towerAccent: Record<string, string> = { bangkok: "#e3b34e", tokyo: "#e2566a", "new-york": "#cfd6db", singapore: "#5fbf87", sydney: "#f2efe4" };
const towerFacade: Record<string, Facade> = { bangkok: "glassTeal", singapore: "glassTeal", tokyo: "glass", "new-york": "glass", sydney: "glass" };
function GlassBlock({ at, size, facade }: { at: Position; size: Position; facade: Facade }): JSX.Element {
  const { map, emissiveMap } = facadeTextures(facade), bevel = useQuality() !== "low";
  return <mesh castShadow receiveShadow position={at} geometry={bevel ? roundedBox(size) : undefined}>{bevel ? null : <boxGeometry args={size}/>}<meshStandardMaterial color="#ffffff" map={map} emissiveMap={emissiveMap} emissive="#ffd9a6" emissiveIntensity={1.35} roughness={.14} metalness={.38}/></mesh>;
}
function RoofClutter({ y, width, seed = 0 }: { y: number; width: number; seed?: number }): JSX.Element {
  const flip = seed % 2 ? -1 : 1;
  return <group>
    <Box at={[flip*width*.22,y+.05,-.12]} size={[.18,.1,.14]} color="#b9c0c2" roughness={.5}/>
    <Box at={[flip*width*.22,y+.105,-.12]} size={[.12,.012,.1]} color="#5d676c"/>
    <Cylinder at={[-flip*width*.24,y+.09,.1]} radius={.075} height={.16} color="#8a9aa3"/>
    <Box at={[-flip*width*.05,y+.03,.14]} size={[.1,.06,.08]} color="#9aa4a7"/>
  </group>;
}
/** Level-3 skyline tower: stone podium, reflective glass shaft with lit rooms, glowing crown and a city-specific topper. */
function ModernTower({ id, variant }: { id: string; variant: number }): JSX.Element {
  const accent = towerAccent[id] ?? "#d8c08a", facade = towerFacade[id] ?? "glass";
  const width = variant ? .62 : .8, shift = variant ? -.1 : 0, podium = .36, shaftBottom = .34 + podium, top = 2.19 - variant * .12, shaftHeight = top - .2 - shaftBottom;
  const crown = shaftBottom + shaftHeight;
  return <group>
    <Box at={[0,.28,0]} size={[1.08,.09,.84]} color="#8f9291"/>
    <Box at={[0,.335,0]} size={[1.02,.025,.78]} color="#d9d2c2" surface="stone"/>
    <Box at={[0,.34+podium/2,0]} size={[.94,podium,.68]} color="#ece5d6"/>
    <Box at={[0,.34+podium*.42,.345]} size={[.66,podium*.62,.02]} color="#ffe4b8" emissive="#ffc46f" emissiveIntensity={.95} roughness={.2}/>
    {[-.34,-.11,.11,.34].map(x=><Box key={x} at={[x,.34+podium*.42,.36]} size={[.03,podium*.66,.03]} color="#3a4750" metalness={.5} roughness={.35}/>)}
    <Box at={[0,.34+podium*.84,.39]} size={[.78,.035,.16]} color="#26343d" metalness={.4} roughness={.4}/>
    <Box at={[0,.34+podium+.012,0]} size={[.98,.03,.72]} color={accent} metalness={.55} roughness={.35}/>
    <GlassBlock at={[shift,shaftBottom+shaftHeight/2,0]} size={[width,shaftHeight,.56]} facade={facade}/>
    {[-1,1].flatMap(sx=>[-1,1].map(sz=><Box key={`${sx}:${sz}`} at={[shift+sx*width/2,shaftBottom+shaftHeight/2,sz*.28]} size={[.045,shaftHeight+.02,.045]} color={accent} metalness={.6} roughness={.3}/>))}
    {variant ? <><GlassBlock at={[.33,shaftBottom+.36,.04]} size={[.28,.72,.44]} facade="office"/><Box at={[.33,shaftBottom+.74,.04]} size={[.31,.04,.47]} color="#e6dfd0"/><Dome at={[.33,shaftBottom+.76,.04]} radius={.1} color="#4f8c5c"/></> : null}
    <Box at={[shift,crown+.07,0]} size={[width-.08,.14,.46]} color="#ebe4d5"/>
    <Box at={[shift,crown+.155,0]} size={[width-.04,.03,.5]} color={accent} emissive={accent} emissiveIntensity={1.5} roughness={.3}/>
    <Box at={[shift,crown+.19,0]} size={[width,.04,.58]} color="#cfcabe"/>
    <RoofClutter y={crown+.21} width={width*.8} seed={variant}/>
    {id === "bangkok" ? <group position={[shift,crown+.21,0]}><Cylinder at={[0,.06,0]} radius={.12} height={.12} color="#e2ad3f" metal/><Cylinder at={[0,.16,0]} radius={.08} height={.08} color="#e8b64a" metal/><Cone at={[0,.44,0]} radius={.07} height={.48} color="#f0c257" sides={10} metal/></group>
      : id === "new-york" ? <group position={[shift,crown+.21,0]}><Box at={[0,.1,0]} size={[width*.55,.2,.34]} color="#e3dccd"/><Box at={[0,.27,0]} size={[width*.32,.14,.22]} color="#e3dccd"/><Cone at={[0,.46,0]} radius={.1} height={.24} color="#cfd6db" sides={8} metal/><Cylinder at={[0,.78,0]} radius={.014} height={.42} color="#d5dde2" metal/></group>
      : id === "tokyo" ? <group position={[shift,crown+.21,0]}><Cylinder at={[0,.3,0]} radius={.02} height={.6} color="#e5e5e5"/>{[.14,.3,.46].map(y=><Cylinder key={y} at={[0,y,0]} radius={.028} height={.05} color="#e2566a"/>)}<Cylinder at={[0,.62,0]} radius={.03} height={.03} color="#ff5a5a" emissive="#ff3b3b" emissiveIntensity={2.2}/></group>
      : id === "singapore" ? <group position={[shift,crown+.21,0]}><Box at={[0,.05,0]} size={[width+.34,.05,.32]} color="#e9e4d8"/>{[-.2,0,.2].map(x=><Dome key={x} at={[x,.07,0]} radius={.08} color="#4d9a5f"/>)}</group>
      : <group position={[shift,crown+.21,0]}><Cylinder at={[0,.02,0]} radius={.2} height={.03} color="#3a454c"/><Cylinder at={[0,.04,0]} radius={.16} height={.012} color="#ffd36b" emissive="#ffc94a" emissiveIntensity={1.4}/></group>}
  </group>;
}
/** Central skyline: brick walk-up, stepped deco tower with gold spire, tall glass tower and a garden-roofed block. */
function NewYorkSkyline(): JSX.Element {
  return <group>
    <group position={[-2,0,-.7]}>
      <Box at={[0,1.1,0]} size={[1,2.2,1.2]} color="#b8573f"/>
      <GlassBlock at={[0,1.15,.02]} size={[.86,1.9,1.18]} facade="office"/>
      <Box at={[0,2.24,0]} size={[1.06,.1,1.26]} color="#efe2c8"/>
      <Cylinder at={[.22,2.5,-.2]} radius={.2} height={.34} color="#8a5c3c"/>
      <Cone at={[.22,2.75,-.2]} radius={.24} height={.18} color="#5a4a3f" sides={12}/>
      {[-1,1].flatMap(x=>[-1,1].map(z=><Cylinder key={`${x}${z}`} at={[.22+x*.12,2.3,-.2+z*.12]} radius={.02} height={.2} color="#3d3a38"/>))}
    </group>
    <group position={[-.7,0,.3]}>
      <GlassBlock at={[0,1.3,0]} size={[.95,2.6,1.1]} facade="glass"/>
      <Box at={[0,2.66,0]} size={[.8,.14,.92]} color="#e8dcc0"/>
      <GlassBlock at={[0,2.95,0]} size={[.66,.46,.74]} facade="glass"/>
      <Box at={[0,3.22,0]} size={[.52,.1,.6]} color="#e8dcc0"/>
      <Cone at={[0,3.55,0]} radius={.3} height={.62} color="#d9dfe4" sides={8} metal/>
      <Cylinder at={[0,4.05,0]} radius={.025} height={.5} color="#e3b447" metal/>
      {[0,1,2,3].map(i=><Box key={i} at={[Math.cos(i*Math.PI/2)*.36,2.8,Math.sin(i*Math.PI/2)*.42]} size={[.1,.26,.1]} color="#e3b447" metalness={.8} roughness={.3}/>)}
    </group>
    <group position={[.7,0,-.7]}>
      <GlassBlock at={[0,2.05,0]} size={[.95,4.1,1.1]} facade="glassTeal"/>
      {[-1,1].flatMap(sx=>[-1,1].map(sz=><Box key={`${sx}${sz}`} at={[sx*.475,2.05,sz*.55]} size={[.06,4.12,.06]} color="#cfd6db" metalness={.6} roughness={.3}/>))}
      <Box at={[0,4.16,0]} size={[.9,.08,1.05]} color="#e9eef0"/>
      <Box at={[0,4.23,0]} size={[.84,.05,1]} color="#6fe2ff" emissive="#4fd4ff" emissiveIntensity={1.4}/>
      <Cylinder at={[0,4.7,0]} radius={.03} height={.9} color="#e5e5e5"/>
      <Cylinder at={[0,5.17,0]} radius={.05} height={.05} color="#ff5a5a" emissive="#ff3b3b" emissiveIntensity={2.2}/>
    </group>
    <group position={[2,0,.3]}>
      <Box at={[0,1.2,0]} size={[1,2.4,1.2]} color="#efe2c8"/>
      <GlassBlock at={[0,1.25,.02]} size={[.86,2.1,1.18]} facade="office"/>
      <Box at={[0,2.44,0]} size={[1.06,.1,1.26]} color="#3f8a97"/>
      <Box at={[0,2.52,0]} size={[.9,.06,1.1]} color="#6fb35e"/>
      {[-.28,0,.28].map((x,i)=><Dome key={x} at={[x,2.55,(i-1)*.25]} radius={.16} color="#4f9a57"/>)}
      <Box at={[0,.35,.64]} size={[.8,.06,.2]} color="#e8b140"/>
    </group>
  </group>;
}
function Strut({ from,to,color,metal = false,radius = .065 }: { from: Position; to: Position; color: string; metal?: boolean; radius?: number }): JSX.Element {
  const a = new Vector3(...from), b = new Vector3(...to), direction = b.clone().sub(a);
  return <mesh castShadow position={a.clone().add(b).multiplyScalar(.5)} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.clone().normalize())}><cylinderGeometry args={[radius,radius,direction.length(),6]} /><meshStandardMaterial color={color} metalness={metal ? GOLD.metalness : .35} roughness={metal ? GOLD.roughness : .5}/></mesh>;
}
function Tower({ color, japanese = false }: { color: string; japanese?: boolean }): JSX.Element {
  const levels = [[0,1.5],[1.5,.85],[3,.38],[4.5,.08]] as const;
  return <group>{levels.slice(0,-1).flatMap(([y,r],level) => {
    const [ny,nr] = levels[level+1]!;
    return [-1,1].flatMap((x) => [-1,1].map((z) => <group key={`${level}:${x}:${z}`}><Strut from={[x*r,y,z*r]} to={[x*nr,ny,z*nr]} color={color} /><Strut from={[x*r,y,z*r]} to={[-x*nr,ny,z*nr]} color={color} /></group>));
  })}<Box at={[0,1.5,0]} size={[2,.12,2]} color={japanese?"#ece9df":color} /><Box at={[0,3,0]} size={[1,.12,1]} color={japanese?"#ece9df":color} /><Cylinder at={[0,4.9,0]} radius={.045} height={.8} color={color} />{!japanese ? [0,Math.PI/2].map((rotation) => <group key={rotation} rotation={[0,rotation,0]}><Arch at={[0,.1,1.2]} radius={1.1} color={color} /></group>) : null}</group>;
}
function ThaiTemple(): JSX.Element {
  return <group>
    <Box at={[0,.12,0]} size={[5.4,.24,3.55]} color="#b7a58e" surface="stone"/>
    <Box at={[0,.29,0]} size={[5.08,.1,3.24]} color="#e6d1a2" surface="stone"/>
    {[-1,1].map(side=><group key={side}>
      <Box at={[0,.34,side*1.54]} size={[5,.1,.12]} color="#a27b42"/>
      {[-1.88,-1.13,-.38,.38,1.13,1.88].map(x=><group key={x}>
        <Cylinder at={[x,1.02,side*1.37]} radius={.085} height={1.35} color="#f4ecdc" textured={false}/>
        <Box at={[x,1.69,side*1.37]} size={[.24,.13,.24]} color="#e2b64f" {...GOLD}/>
        <Box at={[x,.45,side*1.37]} size={[.22,.12,.22]} color="#b78448"/>
      </group>)}
    </group>)}
    <Box at={[0,1.04,0]} size={[4.3,1.25,2.55]} color="#e7d2a7" surface="plaster"/>
    {[-1.5,-.75,0,.75,1.5].map(x=><group key={x}>
      <Box at={[x,.91,1.295]} size={[.36,.73,.04]} color={x===0?"#49392d":"#7c3d2c"} surface="wood"/>
      <Box at={[x,1.38,1.325]} size={[.48,.055,.1]} color="#d5b875"/>
      {x !== 0 ? <Box at={[x,.99,1.33]} size={[.17,.44,.02]} color="#e8b85a" {...GOLD}/> : null}
    </group>)}
    <Box at={[0,1.82,0]} size={[4.65,.14,2.75]} color="#d9a93f" {...GOLD}/>
    {[0,1].map((tier)=><group key={tier} position={[0,tier*.61,0]}>
      <Box at={[0,2.05,0]} size={[5.25-tier*.9,.12,3.28-tier*.44]} color="#e0b04a" {...GOLD}/>
      <Gable y={2.12} width={5.05-tier*.9} depth={3.15-tier*.42} rise={.54-tier*.05} color={tier?"#f0dbca":"#f7e3d0"} surface="thaiRoof" pediment="#8e2a22" frame="#e0ad45" inset={.16}/>
      {[-1,1].map(side=><group key={side}>
        <Strut from={[side*(2.53-tier*.45),2.03,1.51-tier*.21]} to={[side*(2.79-tier*.45),2.49,1.51-tier*.21]} color="#eab94c" metal/>
        <Strut from={[side*(2.53-tier*.45),2.03,-1.51+tier*.21]} to={[side*(2.79-tier*.45),2.49,-1.51+tier*.21]} color="#eab94c" metal/>
      </group>)}
    </group>)}
    <Cylinder at={[0,3.4,0]} radius={.3} height={.12} color="#dcaa3c" metal/>
    <Cone at={[0,3.94,0]} radius={.23} height={.95} color="#e4b13f" sides={12} metal/>
    <Cylinder at={[0,4.5,0]} radius={.035} height={.3} color="#f6d676" metal/>
    <Box at={[0,.13,2.15]} size={[1.8,.11,.78]} color="#d9c8a6" surface="stone"/>
    <Box at={[0,.065,2.75]} size={[2.1,.1,.65]} color="#bbab91" surface="stone"/>
  </group>;
}
function Landmark({ id }: { id: string }): JSX.Element {
  if (id === "paris" || id === "tokyo") return <Tower color={id === "paris" ? "#87664b" : "#d65340"} japanese={id === "tokyo"} />;
  if (id === "cairo-giza") return <group><Cone at={[-1,1.7,0]} radius={3.1} height={3.4} color="#d7b46c" /><Cone at={[2,1.1,1]} radius={1.9} height={2.2} color="#e3c17f" /><Box at={[-2,.4,2.5]} size={[2,.8,.7]} color="#cba870" /><Dome at={[-1.2,.8,2.5]} radius={.5} color="#cba870" /></group>;
  if (id === "kyoto") return <group>{[0,1,2,3].map((level) => <group key={level} position={[0,level*.95,0]}><Box at={[0,.4,0]} size={[2.3-level*.35,.8,2-level*.3]} color="#986546" /><Cone at={[0,1,0]} radius={2-level*.25} height={.6} color="#445d59" /></group>)}<Cylinder at={[0,4.6,0]} radius={.06} height={1.3} color="#c7a352" /><Box at={[-3,.9,1]} size={[.18,1.8,.18]} color="#be4237" /><Box at={[-1.7,.9,1]} size={[.18,1.8,.18]} color="#be4237" /><Box at={[-2.35,1.8,1]} size={[1.9,.2,.25]} color="#be4237" /></group>;
  if (id === "bangkok") return <ThaiTemple/>;
  if (id === "new-york") return <NewYorkSkyline/>;
  if (id === "singapore") return <group>{[-1.5,0,1.5].map((x) => <Box key={x} at={[x,1.5,0]} size={[.7,3,1.3]} color="#c0d8d8" />)}<Box at={[0,3.2,0]} size={[4.7,.35,1.7]} color="#5c9574" />{[-2.5,2.5].map((x) => <group key={x}><Cylinder at={[x,1.15,2]} radius={.14} height={2.3} color="#8a4b67" /><Cone at={[x,2.25,2]} radius={.85} height={.55} color="#789b60" sides={10} /></group>)}</group>;
  if (id === "zermatt") return <group><Cone at={[0,2,-.6]} radius={3.5} height={4.7} color="#82959a" sides={5} /><Cone at={[0,3.7,-.6]} radius={1.25} height={1.4} color="#f5f4e7" sides={5} /><Box at={[0,.2,3]} size={[6,.15,.65]} color="#788184" /><Box at={[-1,.55,3]} size={[1.5,.6,.55]} color="#c74d43" /><Box at={[-1,.6,3.29]} size={[1,.25,.03]} color="#bed5d9" /></group>;
  if (id === "santorini") return <group><Cone at={[0,.65,0]} radius={3.5} height={1.6} color="#b6a38c" sides={7} />{[-1.4,0,1.4].map((x,i)=><group key={x} position={[x,.7+i*.25,0]}><Box at={[0,.55,0]} size={[1.1,1.1,1.1]} color="#fff6e8" /><Dome at={[0,1.1,0]} radius={.65} color="#347bb7" /><Box at={[0,.5,.56]} size={[.25,.45,.03]} color="#436b95" /></group>)}</group>;
  if (id === "rio") return <group><Cone at={[-1,1.3,0]} radius={2.8} height={3.4} color="#567f63" sides={7} /><Cone at={[2,.9,0]} radius={1.8} height={2.5} color="#66896d" sides={8} /><Box at={[0,3,0]} size={[5,.055,.055]} color="#3d4d52" />{[-1.4,1.4].map((x)=><group key={x}><Cylinder at={[x,2.65,0]} radius={.025} height={.6} color="#3d4d52" /><Box at={[x,2.25,0]} size={[.65,.5,.45]} color="#e3b341" /><Box at={[x,2.32,.24]} size={[.45,.2,.02]} color="#b3d5da" /></group>)}</group>;
  if (id === "venice") return <group><Box at={[0,-.1,0]} size={[3,.12,8]} color="#469da9" /><Arch at={[0,0,1.3]} radius={1.6} color="#dbc5a3" /><Arch at={[0,0,.8]} radius={1.6} color="#dbc5a3" /><Box at={[0,1.2,1.05]} size={[3.6,.15,.7]} color="#e3cfab" />{[-2.6,2.6].map((x)=><group key={x}><Box at={[x,1,0]} size={[1.5,2,2.8]} color={x<0?"#dfa188":"#e4c184"}/><Cone at={[x,2.25,0]} radius={1.65} height={.7} color="#ad5d3e" /></group>)}<Box at={[0,.05,-2]} size={[.45,.18,1.8]} color="#344953" /></group>;
  return <group><Box at={[0,.25,0]} size={[5,.5,3.3]} color="#c3ac86" />{[-1.5,-.5,.5,1.5].map((x,i)=><group key={x} position={[x,.5,0]} rotation={[0,0,-.2+i*.12]}><Cone at={[0,1,0]} radius={1.25} height={2.3} color="#f7f1de" sides={3} /></group>)}<Arch at={[0,.2,-3.3]} radius={3} color="#526975" /></group>;
}
function Infrastructure({ id }: { id: string }): JSX.Element {
  if (["bangkok","paris","cairo-giza"].includes(id)) return <group>
    <Box at={[3,-.18,0]} size={[1.15,.08,9.6]} color={id==="cairo-giza"?"#49949c":"#4d9eaf"}/>
    {[-1,1].map(side=><Box key={side} at={[3+side*.64,-.1,0]} size={[.13,.18,9.6]} color="#c4b494"/>)}
    <Box at={[3,.1,2.6]} size={[1.7,.15,.65]} color={id==="bangkok"?"#866448":"#d0c4a9"}/>
    {[-.28,.28].map(z=><Box key={z} at={[3,.3,2.6+z]} size={[1.7,.035,.035]} color="#6d716c"/>)}
    <Box at={[3,-.04,-2.5]} size={[.42,.15,1.35]} color="#6f4e39"/><Box at={[3,.17,-2.5]} size={[.36,.18,.52]} color="#c3ad78"/>
  </group>;
  if (id==="tokyo" || id==="zermatt") return <group>
    <Box at={[0,-.12,-3.8]} size={[9.3,.12,.75]} color="#777e7b"/>
    {[-.22,.22].map(z=><Box key={z} at={[0,-.04,-3.8+z]} size={[9.3,.03,.035]} color="#c0c9ca"/>)}
    {[-1.7,-.2,1.3].map(x=><group key={x}><Box at={[x,.28,-3.8]} size={[1.35,.55,.52]} color={id==="tokyo"?"#e1e6db":"#ba5444"}/><Box at={[x,.3,-3.52]} size={[1.18,.17,.025]} color="#5e929f"/><Box at={[x,.1,-3.52]} size={[1.25,.08,.03]} color={id==="tokyo"?"#8eae6d":"#dbbc7b"}/></group>)}
  </group>;
  if(id==="new-york")return <group><Box at={[0,-.1,3.1]} size={[8.7,.06,1.1]} color="#687978"/>{[-3,-1.5,0,1.5,3].map(x=><Box key={x} at={[x,-.055,3.1]} size={[.65,.015,.045]} color="#ded3a6"/>)}<Box at={[2.6,.24,3.1]} size={[.85,.45,.42]} color="#d5b34d"/><Box at={[2.6,.53,3.1]} size={[.42,.16,.36]} color="#b7d1d7"/></group>;
  if(id==="kyoto")return <group><Box at={[0,-.14,3]} size={[8.7,.07,.7]} color="#ab8462"/>{Array.from({length:25},(_,i)=><Box key={i} at={[-4.2+i*.35,-.095,3]} size={[.03,.025,.7]} color="#795e49"/>)}<Box at={[-2.5,-.12,-2.1]} size={[2.4,.08,2]} color="#8dafa2"/>{[-1,0,1].map((x,i)=><Dome key={x} at={[-2.5+x*.55,.02,-2.1+i*.12]} radius={.3} color="#7d8c86"/>)}</group>;
  if(id==="rio" || id==="sydney" || id==="santorini")return <group><Box at={[0,-.18,3.85]} size={[9.4,.1,1.65]} color="#dbcea4"/>{[-2,2].map(x=><group key={x}><Cylinder at={[x,.45,4.05]} radius={.035} height={.95} color="#7d6446"/><Cone at={[x,.96,4.05]} radius={.56} height={.2} color={x<0?"#d8a36e":"#719fad"} sides={10}/><Box at={[x,.1,4.05]} size={[.3,.08,.65]} color="#f0e5c5"/></group>)}</group>;
  if(id==="singapore")return <group><Box at={[0,-.13,3.4]} size={[9.3,.08,.65]} color="#c1bca3"/>{[-3,-1.5,0,1.5,3].map(x=><group key={x}><Box at={[x,-.05,2.7]} size={[1,.18,.55]} color="#bcba99"/><Dome at={[x,.05,2.7]} radius={.4} color="#4f845a"/></group>)}</group>;
  return <group><Box at={[0,-.16,3.3]} size={[8.5,.08,1.1]} color="#d3c2a2"/>{[-3,-1.5,0,1.5,3].map(x=><Box key={x} at={[x,-.1,3.3]} size={[.045,.02,1.1]} color="#9d998b"/>)}</group>;
}
function LocalTree({id,x,z=-3.3}:{id:string;x:number;z?:number}):JSX.Element {
  const palm=["bangkok","rio","sydney","cairo-giza","singapore"].includes(id);
  return <group position={[x,0,z]}>
    <mesh castShadow position={[0,.58,0]} rotation={[0,0,.09]}><cylinderGeometry args={[.055,.11,1.18,8]}/><meshStandardMaterial color="#71513c" map={surfaceTexture("wood")} roughness={1}/></mesh>
    {palm ? Array.from({length:8},(_,i)=><group key={i} position={[0,1.18,0]} rotation={[0,i*Math.PI/4,0]}>
      <mesh castShadow position={[.39,.06,0]} rotation={[0,0,-.29]} scale={[1,.09,.3]}><sphereGeometry args={[.5,9,5]}/><meshStandardMaterial color={i%3===0?"#3f765d":"#548a62"} roughness={.96}/></mesh>
      <mesh castShadow position={[.55,.03,0]} rotation={[0,0,-.34]} scale={[1,.1,.34]}><sphereGeometry args={[.44,9,5]}/><meshStandardMaterial color={i%2?"#6a9c67":"#417653"} roughness={.98}/></mesh>
    </group>)
      :id==="kyoto"?[-.35,0,.35].map((a,i)=><mesh castShadow key={a} position={[a,1.18+Math.abs(a)*.3,i%2?.12:-.12]} scale={[1.2,.9,1]}><sphereGeometry args={[.46,10,7]}/><meshStandardMaterial color={i===1?"#f2c7ce":"#e9aabf"} roughness={1}/></mesh>)
      :id==="zermatt"?<><Cone at={[0,1.05,0]} radius={.55} height={1.25} color="#31594b" sides={8}/><Cone at={[0,1.47,0]} radius={.39} height={.84} color="#48785d" sides={8}/><Cone at={[0,1.8,0]} radius={.23} height={.45} color="#60896d" sides={8}/></>
      :[-.23,.16,.3].map((a,i)=><mesh castShadow key={i} position={[a,1.03+i*.12,(i-1)*.15]} scale={[1,.75,1]}><sphereGeometry args={[.49,11,7]}/><meshStandardMaterial color={i===1?"#4b795b":i===2?"#70936a":"#3c684f"} roughness={1}/></mesh>)}
  </group>;
}
const bloomColors = ["#ff8fb1", "#ffd45c", "#fff4ea", "#c79bff", "#ff9b6a"];
/** Flower clumps on the lawn ring outside the board; clumps that would sit under the promenade are skipped. */
function FlowerBeds(): JSX.Element | null {
  if (useQuality() === "low") return null;
  const clumps = Array.from({ length: 64 }, (_, i) => { const angle = i * Math.PI * 2 / 64 + (i % 3) * .03, radius = 8.35 + (i % 4) * .17; return { i, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }; })
    .filter(({ x, z }) => Math.max(Math.abs(x), Math.abs(z)) > 8.05);
  return <group>{clumps.map(({ i, x, z }) => <group key={i} position={[x,-.19,z]} rotation={[0,i*1.7,0]}>
    <mesh castShadow position={[0,.05,0]} scale={[1,.6,1]}><sphereGeometry args={[.15,10,6]}/><meshStandardMaterial color={i % 2 ? "#4f8f4f" : "#5d9c55"} roughness={.9}/></mesh>
    {[0,1,2].map(j=><mesh key={j} position={[Math.cos(j*2.1)*.09,.13,Math.sin(j*2.1)*.09]}><sphereGeometry args={[.045,8,6]}/><meshStandardMaterial color={bloomColors[(i+j)%bloomColors.length]!} roughness={.7}/></mesh>)}
  </group>)}</group>;
}
function AtomSculpture(): JSX.Element {
  return <group position={[-4.25,0,.25]}>
    <Cylinder at={[0,.02,0]} radius={.78} height={.16} color="#9b9c8d"/>
    <Cylinder at={[0,.13,0]} radius={.62} height={.1} color="#cbbd95"/>
    <Cylinder at={[0,.75,0]} radius={.06} height={1.25} color="#b4a06a"/>
    {[0,Math.PI/3,-Math.PI/3].map((rotation,i)=><mesh key={i} castShadow position={[0,1.44,0]} rotation={[0,rotation,Math.PI/2+i*.36]}><torusGeometry args={[.58,.028,6,40]}/><meshStandardMaterial color="#d6b56f" metalness={.72} roughness={.27}/></mesh>)}
    <mesh position={[0,1.44,0]}><sphereGeometry args={[.18,16,12]}/><meshStandardMaterial color="#96d9e3" emissive="#50c5d8" emissiveIntensity={.68} metalness={.45} roughness={.17}/></mesh>
  </group>;
}
export function CityEnvironment({ mapId }: { mapId?: string }): JSX.Element {
  const city = locationById(mapId);
  return <group>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.69,0]} receiveShadow><planeGeometry args={[170,170]}/><meshStandardMaterial color="#17627a" normalMap={waterNormalTexture()} normalScale={RIPPLE} metalness={.05} roughness={.26}/></mesh>
    <mesh position={[0,-.64,0]} receiveShadow><cylinderGeometry args={[9.75,10.35,.16,72]}/><meshStandardMaterial color="#e4cf9f" map={surfaceTexture("terrain")} roughness={.95}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.675,0]}><ringGeometry args={[10.3,10.75,72]}/><meshStandardMaterial color="#f4fbfb" transparent opacity={.55} roughness={.6}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.68,0]}><ringGeometry args={[10.75,11.6,72]}/><meshStandardMaterial color="#5fc1c9" transparent opacity={.35} roughness={.3}/></mesh>
    <mesh position={[0,-.43,0]} receiveShadow castShadow><cylinderGeometry args={[9.1,9.4,.47,64]}/><meshStandardMaterial color="#777c70" map={surfaceTexture("stone")} roughness={1}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.19,0]} receiveShadow><circleGeometry args={[9.13,64]}/><meshStandardMaterial color={city.ground} map={surfaceTexture("terrain")} roughness={1}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.178,0]} receiveShadow><ringGeometry args={[7.5,7.95,64]}/><meshStandardMaterial color="#aa9b82" map={surfaceTexture("stone")} roughness={.97}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.17,0]} receiveShadow><ringGeometry args={[8.16,8.2,64]}/><meshStandardMaterial color="#e7d4a4" roughness={.74}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.16,0]} receiveShadow><ringGeometry args={[3.4,3.94,64]}/><meshStandardMaterial color="#c8b99a" map={surfaceTexture("stone")} roughness={.97}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.15,0]} receiveShadow><ringGeometry args={[2.52,3.36,64]}/><meshStandardMaterial color="#2a8ea3" normalMap={waterNormalTexture()} normalScale={RIPPLE} metalness={.05} roughness={.26}/></mesh>
    {[2.66,2.88,3.15].map(radius=><mesh key={radius} rotation={[-Math.PI/2,0,0]} position={[0,-.143,0]}><ringGeometry args={[radius,radius+.018,64]}/><meshStandardMaterial color="#aad9d2" emissive="#69c5be" emissiveIntensity={.12} roughness={.25}/></mesh>)}
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.135,0]} receiveShadow><circleGeometry args={[2.49,64]}/><meshStandardMaterial color={city.ground} map={surfaceTexture("terrain")} roughness={.94}/></mesh>
    <Infrastructure id={city.id}/><Landmark id={city.id}/><AtomSculpture/><FlowerBeds/>
    {[-1,1].flatMap(side=>[-1,1].map((back,index)=><group key={`${side}:${back}`} position={[side*4.65,-.19,back*3.8]} rotation={[0,side>0?-.18:.18,0]} scale={index ? 1.25 : 1.4}><LocalBuilding mapId={city.id} level={back<0?3:2} variant={side>0?1:0} owned/></group>))}
    {[-3.8,3.8].map((x,i)=><LocalTree key={i} id={city.id} x={x} z={-4.8}/>)}
    {[-1,1].flatMap(side => [-5.9,-3.9,-1.9,1.9,3.9,5.9].map(z => <group key={`${side}:${z}`} scale={.7}><LocalTree id={city.id} x={side*10.7} z={z/.7}/></group>))}
    {Array.from({length:16},(_,i)=>{const angle=i*Math.PI/8+.15, radius=8.48+(i%3)*.11;return <mesh key={i} castShadow position={[Math.cos(angle)*radius,-.17,Math.sin(angle)*radius]} rotation={[0,angle,0]}><dodecahedronGeometry args={[.24+(i%4)*.065,0]}/><meshStandardMaterial color={i%3?"#777f79":"#a2a395"} map={surfaceTexture("stone")} roughness={1}/></mesh>;})}
    {Array.from({length:10},(_,i)=>{const angle=i*Math.PI/5+.2, x=Math.cos(angle)*7.18,z=Math.sin(angle)*7.18;return <group key={i} position={[x,0,z]}><Cylinder at={[0,.52,0]} radius={.035} height={1.08} color="#354550"/><Box at={[0,1.05,0]} size={[.24,.045,.24]} color="#c6a36b"/><mesh position={[0,1.14,0]}><sphereGeometry args={[.13,10,7]}/><meshStandardMaterial color="#ffdd9d" emissive="#ffbd61" emissiveIntensity={1.6} roughness={.25}/></mesh><Cone at={[0,1.28,0]} radius={.19} height={.16} color="#263e49" sides={6}/></group>;})}
    <Box at={[-3.7,.08,1.8]} size={[1,.15,.4]} color="#896b4e" surface="wood"/><Box at={[-3.7,.33,1.62]} size={[1,.4,.1]} color="#896b4e" surface="wood"/>
    <Box at={[-2.5,.08,3.7]} size={[.7,.25,.5]} color="#bca57c" surface="stone"/><Dome at={[-2.5,.24,3.7]} radius={.3} color="#789955"/>
    <Box at={[2.5,.08,3.7]} size={[.6,.3,.55]} color="#8c999e" surface="stone"/><Box at={[2.5,.3,3.7]} size={[.65,.12,.6]} color="#9cabb2" surface="stone"/>
    <Cylinder at={[3.5,.5,-1.8]} radius={.04} height={1} color="#66563e"/><Box at={[3.5,1,-1.8]} size={[.55,.38,.05]} color={city.roof}/>
  </group>;
}
function Plinth({ glow }: { glow: string }): JSX.Element {
  return <group>
    <Cylinder at={[0,.36,0]} radius={.36} height={.1} color="#e9e1cf"/>
    <Cylinder at={[0,.415,0]} radius={.31} height={.018} color={glow} emissive={glow} emissiveIntensity={1.1}/>
    <Cylinder at={[0,.44,0]} radius={.27} height={.04} color="#d6ae55" metal/>
  </group>;
}
/** Corner/special tile icons: each type gets a readable, glowing sculpture instead of a plain puck. */
export function TileMarker({ type }: { type: string }): JSX.Element {
  const flat = useQuality() === "low";
  if (type === "start") return <group>
    <Plinth glow="#39d98a"/>
    <mesh castShadow position={[.07,.62,0]} rotation={[0,0,Math.PI/2]}><boxGeometry args={[.13,.34,.1]}/><meshStandardMaterial color="#2fcf7f" emissive="#1fb86a" emissiveIntensity={.55} roughness={.35}/></mesh>
    <mesh castShadow position={[-.2,.62,0]} rotation={[0,0,Math.PI/2]}><coneGeometry args={[.19,.26,3]}/><meshStandardMaterial color="#2fcf7f" emissive="#1fb86a" emissiveIntensity={.55} roughness={.35}/></mesh>
  </group>;
  if (type === "challenge") return <group>
    <Plinth glow="#b07cff"/>
    <mesh castShadow position={[0,.82,0]} scale={[1,1.55,1]} rotation={[0,Math.PI/4,0]}><octahedronGeometry args={[.21,0]}/><meshStandardMaterial color="#a878f0" emissive="#8a4fe6" emissiveIntensity={.7} roughness={.12} metalness={.2} flatShading/></mesh>
    {[-1,1].map(side=><mesh key={side} castShadow position={[side*.19,.6,.05]} scale={[1,1.5,1]} rotation={[0,side,side*.35]}><octahedronGeometry args={[.07,0]}/><meshStandardMaterial color="#c9a6ff" emissive="#8a4fe6" emissiveIntensity={.7} roughness={.12} metalness={.2} flatShading/></mesh>)}
  </group>;
  if (type === "chance") return <group>
    <Plinth glow="#ffb347"/>
    <Cylinder at={[0,.53,0]} radius={.085} height={.13} color="#b9c3c8" metal/>
    <mesh castShadow position={[0,.63,0]}><cylinderGeometry args={[.12,.085,.1,flat?12:20]}/><meshStandardMaterial color="#ffe7a6" emissive="#ffc043" emissiveIntensity={1.6} roughness={.2}/></mesh>
    <mesh castShadow position={[0,.8,0]}><sphereGeometry args={[.2,flat?12:24,flat?8:16]}/><meshStandardMaterial color="#fff1c2" emissive="#ffc043" emissiveIntensity={1.6} roughness={.2}/></mesh>
  </group>;
  if (type === "tax") return <group>
    <Plinth glow="#ffd166"/>
    {[0,1,2,3].map(i=><Cylinder key={i} at={[(i%2)*.03-.015,.49+i*.055,0]} radius={.19} height={.045} color="#e6b447" metal/>)}
    <Cylinder at={[.24,.49,.14]} radius={.1} height={.045} color="#e6b447" metal/>
  </group>;
  if (type === "freeParking") return <group>
    <Plinth glow="#5ad1e6"/>
    <Cylinder at={[0,.5,0]} radius={.13} height={.06} color="#d9a93f" metal/>
    <Cylinder at={[0,.6,0]} radius={.035} height={.16} color="#e3b447" metal/>
    <mesh castShadow position={[0,.8,0]}><cylinderGeometry args={[.2,.08,.26,flat?12:20,1,true]}/><meshStandardMaterial color="#efc257" metalness={.85} roughness={.25} side={2}/></mesh>
    {[-1,1].map(side=><mesh key={side} castShadow position={[side*.21,.8,0]} rotation={[0,0,Math.PI/2]}><torusGeometry args={[.07,.018,6,14,Math.PI]}/><meshStandardMaterial color="#efc257" metalness={.85} roughness={.25}/></mesh>)}
  </group>;
  if (type === "jail") return <group>
    <Plinth glow="#ff8a5c"/>
    {Array.from({ length: 10 }, (_, i) => { const a = i * Math.PI / 5; return <Cylinder key={i} at={[Math.cos(a)*.24,.68,Math.sin(a)*.24]} radius={.016} height={.48} color="#56646c" metal/>; })}
    <Cylinder at={[0,.93,0]} radius={.28} height={.05} color="#3e4a51"/>
    <mesh castShadow position={[0,.955,0]}><sphereGeometry args={[.28,flat?12:24,8,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#3e4a51" roughness={.5} metalness={.4}/></mesh>
  </group>;
  if (type === "goToJail") return <group>
    <Plinth glow="#ff5a6e"/>
    <Cylinder at={[0,.52,0]} radius={.17} height={.12} color="#2c3a44"/>
    <mesh castShadow position={[-.05,.6,0]}><sphereGeometry args={[.13,flat?12:20,10,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#ff5a6e" emissive="#ff2d4a" emissiveIntensity={1.8} roughness={.2}/></mesh>
    <mesh castShadow position={[.1,.6,0]}><sphereGeometry args={[.09,flat?12:20,10,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#5aa8ff" emissive="#2d7dff" emissiveIntensity={1.8} roughness={.2}/></mesh>
  </group>;
  return <group><Plinth glow="#f49a45"/><Cylinder at={[0,.55,0]} radius={.22} height={.18} color="#f49a45"/></group>;
}
