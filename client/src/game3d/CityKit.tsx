import { locationById } from "@physics-monopoly/shared";
import { Quaternion, Vector3 } from "three";
type Position = [number,number,number];
function Box({ at, size, color, rotation = 0 }: { at: Position; size: Position; color: string; rotation?: number }): JSX.Element {
  return <mesh castShadow receiveShadow position={at} rotation={[0,rotation,0]}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.65} /></mesh>;
}
function Cone({ at, radius, height, color, sides = 4 }: { at: Position; radius: number; height: number; color: string; sides?: number }): JSX.Element {
  return <mesh castShadow position={at} rotation={[0,Math.PI / 4,0]}><coneGeometry args={[radius,height,sides]} /><meshStandardMaterial color={color} /></mesh>;
}
function Cylinder({ at, radius, height, color }: { at: Position; radius: number; height: number; color: string }): JSX.Element {
  return <mesh castShadow position={at}><cylinderGeometry args={[radius,radius,height,12]} /><meshStandardMaterial color={color} /></mesh>;
}
function Dome({ at, radius, color }: { at: Position; radius: number; color: string }): JSX.Element {
  return <mesh castShadow position={at}><sphereGeometry args={[radius,16,8,0,Math.PI*2,0,Math.PI/2]} /><meshStandardMaterial color={color} /></mesh>;
}
function Arch({ at, radius, color }: { at: Position; radius: number; color: string }): JSX.Element {
  return <mesh castShadow position={at}><torusGeometry args={[radius,.15,6,20,Math.PI]} /><meshStandardMaterial color={color} /></mesh>;
}
function Gable({ y, width, depth, rise, color }: { y: number; width: number; depth: number; rise: number; color: string }): JSX.Element {
  const angle = Math.atan2(rise,width/2), length = Math.hypot(width/2,rise);
  return <group>{[-1,1].map(side => <mesh key={side} castShadow position={[side*width/4,y+rise/2,0]} rotation={[0,0,-side*angle]}><boxGeometry args={[length,.055,depth]}/><meshStandardMaterial color={color}/></mesh>)}</group>;
}
function Balcony({ y, width, color }: { y: number; width: number; color: string }): JSX.Element {
  return <group><Box at={[0,y,.37]} size={[width,.045,.22]} color={color}/><Box at={[0,y+.12,.47]} size={[width,.035,.035]} color={color}/>{[-.4,-.2,0,.2,.4].filter(x=>Math.abs(x)<width/2).map(x=><Box key={x} at={[x,y+.06,.47]} size={[.025,.12,.025]} color={color}/>)}</group>;
}
export function LocalBuilding({ mapId, level, owned, variant = 0 }: { mapId?: string; level: number; owned: boolean; variant?: number }): JSX.Element {
  const city = locationById(mapId), id = city.id, v = variant % 2, height = [.08,.62,1.15,1.85][Math.min(3,Math.max(0,level))]!;
  if (!owned || level === 0) return <group><Box at={[0,.34,0]} size={[.95,.08,.7]} color={owned ? "#9aaf72" : "#b59671"} />{v ? <><Box at={[.3,.43,0]} size={[.05,.15,.6]} color="#ece0bc" /><Box at={[-.3,.43,0]} size={[.05,.15,.6]} color="#ece0bc" /></> : <Cylinder at={[.25,.43,-.16]} radius={.1} height={.16} color="#71984e" />}</group>;
  const timber = ["kyoto","zermatt"].includes(id) || (id === "bangkok" && level < 3);
  const modern = level === 3 && ["new-york","tokyo","singapore","sydney","bangkok"].includes(id);
  const base = id === "bangkok" && level === 1 ? .53 : .34;
  const top = base+height, width = v ? .68 : .88;
  const wall = modern ? (id === "new-york" ? "#758fa0" : "#c4d9d6") : city.wall;
  return <group>
    <Box at={[0,.32,0]} size={[1,.06,.76]} color="#b6b4a3"/>
    <Box at={[0,base+height/2,0]} size={[width,height,.6]} color={wall} />
    {v ? <><Box at={[.37,.34+height*.27,.04]} size={[.24,height*.54,.55]} color={wall}/><Box at={[.37,.37+height*.54,.04]} size={[.28,.05,.6]} color={city.roof}/></> : null}
    {id === "santorini" ? <><Dome at={[-.12,top,0]} radius={v?.23:.33} color={city.roof}/><Box at={[.26,top-.12,0]} size={[.22,.28,.62]} color={wall}/></>
      : id === "paris" ? <><mesh castShadow position={[0,top+.19,0]} rotation={[0,Math.PI/4,0]} scale={[1,1,.8]}><cylinderGeometry args={[.35,.68,.38,4]}/><meshStandardMaterial color={city.roof}/></mesh>{[-.22,.22].map(x=><group key={x}><Box at={[x,top+.16,.28]} size={[.17,.2,.16]} color={wall}/><Box at={[x,top+.17,.37]} size={[.09,.12,.015]} color="#426c85"/></group>)}<Box at={[.27,top+.4,-.1]} size={[.1,.25,.12]} color={wall}/></>
      : timber || (id === "venice") || (id === "rio" && level === 1) || (id === "sydney" && level === 1) || (id === "tokyo" && level === 1)
        ? <><Gable y={top} width={width+.22} depth={.81} rise={id==="zermatt"?.34:.24} color={city.roof}/>{id==="zermatt"?<Box at={[.25,top+.3,-.15]} size={[.12,.4,.12]} color="#806a5b"/>:null}</>
        : <Box at={[0,top+.025,0]} size={[width+.09,.08,.7]} color={city.roof}/>}
    {Array.from({ length: level }, (_, floor) => <group key={floor} position={[0,base+.25+floor*.5,.31]}>
      {(modern?[-.24,0,.24]:[-.21,.21]).filter(x=>Math.abs(x)<width/2).map((x) => <group key={x}><Box at={[x,0,0]} size={[modern?.19:.15,modern?.34:.2,.025]} color={id === "cairo-giza" ? "#765536" : "#426c85"}/>{["venice","paris","santorini"].includes(id)?<Box at={[x,-.12,.02]} size={[.21,.035,.05]} color="#e8dec8"/>:null}</group>)}
      {id === "kyoto" ? [-.27,-.18,-.09,0,.09,.18,.27].map(x=><Box key={x} at={[x,0,.025]} size={[.015,.22,.02]} color="#d2b189"/>) : null}
      {id === "singapore" ? <><Box at={[0,-.15,.04]} size={[width,.1,.16]} color="#8eac96"/><Box at={[0,-.08,.05]} size={[width-.04,.12,.14]} color="#398552"/></> : null}
    </group>)}
    <Box at={[0,base+.14,.317]} size={[.16,.28,.025]} color={timber?"#4f3a2b":"#435766"}/>
    {timber ? <>{[-width/2,width/2].map(x=><Box key={x} at={[x,(base+top)/2,.325]} size={[.055,height,.065]} color="#543d2c"/>)}{[0,1].map(floor=><Box key={floor} at={[0,base+floor*height,.325]} size={[width,.055,.065]} color="#543d2c"/>)}</> : null}
    {["paris","venice","rio","zermatt","sydney"].includes(id) ? Array.from({length:level},(_,floor)=><Balcony key={floor} y={base+.04+floor*.5} width={width+.05} color={timber?"#674831":"#657276"}/>) : null}
    {id === "bangkok" && level === 1 ? [-.33,.33].flatMap(x=>[-.23,.23].map(z=><Box key={`${x}:${z}`} at={[x,.43,z]} size={[.06,.23,.06]} color="#68492d"/>)) : null}
    {id === "bangkok" && level === 2 ? <><Balcony y={.86} width={width+.08} color="#806247"/><Box at={[0,.65,.41]} size={[width,.06,.25]} color={city.roof}/></> : null}
    {modern ? <><Box at={[v?-.12:0,top+.2,0]} size={[v?.35:.52,.3,.42]} color={wall}/>{id==="singapore"||id==="bangkok"?<Box at={[.27,top+.13,.16]} size={[.2,.14,.2]} color="#398552"/>:null}{id==="new-york"||id==="tokyo"?<Cylinder at={[0,top+.58,0]} radius={.02} height={.5} color="#c3cbd0"/>:null}</> : null}
    {id === "new-york" && level < 3 ? <><Box at={[0,top+.03,.32]} size={[width+.08,.12,.12]} color="#c3ac91"/><Box at={[0,.38,.43]} size={[.35,.09,.2]} color="#8e8277"/>{Array.from({length:level},(_,floor)=><Box key={floor} at={[width/2+.02,.65+floor*.5,0]} size={[.04,.24,.35]} color="#3e515e"/>)}</> : null}
    {id === "tokyo" && level > 1 ? <><Box at={[width/2+.02,.96,.24]} size={[.08,.65,.14]} color={v?"#51cad4":"#de6980"}/><Box at={[0,.71,.39]} size={[width,.12,.18]} color={city.roof}/></> : null}
    {id === "cairo-giza" ? <>{[-width/2,width/2].map(x=><Box key={x} at={[x,top+.13,-.2]} size={[.13,.22,.15]} color={wall}/>)}<Box at={[0,top+.1,-.27]} size={[width,.16,.08]} color={wall}/><Box at={[0,.71,.42]} size={[width,.055,.3]} color="#ad8d60"/>{[-width/2,width/2].map(x=><Cylinder key={x} at={[x,.51,.48]} radius={.025} height={.37} color="#ad8d60"/>)}</> : null}
  </group>;
}
function Strut({ from,to,color }: { from: Position; to: Position; color: string }): JSX.Element {
  const a = new Vector3(...from), b = new Vector3(...to), direction = b.clone().sub(a);
  return <mesh castShadow position={a.clone().add(b).multiplyScalar(.5)} quaternion={new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction.clone().normalize())}><cylinderGeometry args={[.065,.065,direction.length(),5]} /><meshStandardMaterial color={color} /></mesh>;
}
function Tower({ color, japanese = false }: { color: string; japanese?: boolean }): JSX.Element {
  const levels = [[0,1.5],[1.5,.85],[3,.38],[4.5,.08]] as const;
  return <group>{levels.slice(0,-1).flatMap(([y,r],level) => {
    const [ny,nr] = levels[level+1]!;
    return [-1,1].flatMap((x) => [-1,1].map((z) => <group key={`${level}:${x}:${z}`}><Strut from={[x*r,y,z*r]} to={[x*nr,ny,z*nr]} color={color} /><Strut from={[x*r,y,z*r]} to={[-x*nr,ny,z*nr]} color={color} /></group>));
  })}<Box at={[0,1.5,0]} size={[2,.12,2]} color={japanese?"#ece9df":color} /><Box at={[0,3,0]} size={[1,.12,1]} color={japanese?"#ece9df":color} /><Cylinder at={[0,4.9,0]} radius={.045} height={.8} color={color} />{!japanese ? [0,Math.PI/2].map((rotation) => <group key={rotation} rotation={[0,rotation,0]}><Arch at={[0,.1,1.2]} radius={1.1} color={color} /></group>) : null}</group>;
}
function Landmark({ id }: { id: string }): JSX.Element {
  if (id === "paris" || id === "tokyo") return <Tower color={id === "paris" ? "#87664b" : "#d65340"} japanese={id === "tokyo"} />;
  if (id === "cairo-giza") return <group><Cone at={[-1,1.7,0]} radius={3.1} height={3.4} color="#d7b46c" /><Cone at={[2,1.1,1]} radius={1.9} height={2.2} color="#e3c17f" /><Box at={[-2,.4,2.5]} size={[2,.8,.7]} color="#cba870" /><Dome at={[-1.2,.8,2.5]} radius={.5} color="#cba870" /></group>;
  if (id === "kyoto") return <group>{[0,1,2,3].map((level) => <group key={level} position={[0,level*.95,0]}><Box at={[0,.4,0]} size={[2.3-level*.35,.8,2-level*.3]} color="#986546" /><Cone at={[0,1,0]} radius={2-level*.25} height={.6} color="#445d59" /></group>)}<Cylinder at={[0,4.6,0]} radius={.06} height={1.3} color="#c7a352" /><Box at={[-3,.9,1]} size={[.18,1.8,.18]} color="#be4237" /><Box at={[-1.7,.9,1]} size={[.18,1.8,.18]} color="#be4237" /><Box at={[-2.35,1.8,1]} size={[1.9,.2,.25]} color="#be4237" /></group>;
  if (id === "bangkok") return <group><Box at={[0,.6,0]} size={[4,1.2,2.4]} color="#f0d7a3" /><Cone at={[0,1.55,0]} radius={2.8} height={1.1} color="#a9362b" /><Cone at={[0,2.1,0]} radius={1.7} height={.9} color="#ba4930" /><Cone at={[0,3.2,0]} radius={.18} height={1.8} color="#d8b341" sides={6} />{[-1.5,1.5].map((x) => <Cylinder key={x} at={[x,.65,1.25]} radius={.12} height={1.3} color="#e5c17e" />)}</group>;
  if (id === "new-york") return <group>{[-2,-.7,.7,2].map((x,i) => <group key={x}><Box at={[x,(2+i%3)/2,-.7+i%2]} size={[1,2+i%3,1.3]} color={["#667f92","#b58d69","#71939c","#9aa6a1"][i]!} /><Box at={[x,2+i%3+.3,-.7+i%2]} size={[.65,.6,.9]} color="#d5cdb4" />{Array.from({length:4},(_,n)=><Box key={n} at={[x,.5+n*.55,.01+i%2]} size={[.7,.12,.025]} color="#d8e7d9" />)}</group>)}</group>;
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
function LocalTree({id,x}:{id:string;x:number}):JSX.Element {
  const palm=["bangkok","rio","sydney","cairo-giza","singapore"].includes(id);
  return <group position={[x,0,-3.3]}><Cylinder at={[0,.5,0]} radius={.09} height={1} color="#795c42"/>
    {palm?[-1,1].flatMap(a=>[-1,1].map(b=><group key={`${a}:${b}`} position={[a*.24,1.08,b*.24]} rotation={[a*.25,0,b*.25]}><Box at={[0,0,0]} size={[.65,.045,.22]} rotation={a*b*Math.PI/4} color="#467c55"/></group>))
      :id==="kyoto"?[-.3,0,.3].map(a=><Dome key={a} at={[a,1.05+Math.abs(a)*.4,0]} radius={.43} color="#e7aec4"/>)
      :id==="zermatt"?<><Cone at={[0,1.1,0]} radius={.5} height={1.2} color="#467c55" sides={7}/><Cone at={[0,1.52,0]} radius={.3} height={.4} color="#edf1e6" sides={7}/></>
      :<Dome at={[0,.95,0]} radius={.6} color="#467c55"/>}
  </group>;
}
export function CityEnvironment({ mapId }: { mapId?: string }): JSX.Element {
  const city = locationById(mapId);
  return <group><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.28,0]} receiveShadow><planeGeometry args={[28,28]} /><meshStandardMaterial color="#58a9c4" roughness={.35} /></mesh><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.23,0]} receiveShadow><planeGeometry args={[18,18]} /><meshStandardMaterial color={city.ground} /></mesh><Infrastructure id={city.id}/><Landmark id={city.id} />
    {/* Six distinct prop families; all remain inside the pedestrian ring. */}
    {[-4.1,4.1].map(x=><LocalTree key={x} id={city.id} x={x}/>)}
    <Box at={[-3.7,.35,1.8]} size={[1,.15,.4]} color="#896b4e" /><Box at={[-3.7,.6,1.62]} size={[1,.4,.1]} color="#896b4e" />
    <Cylinder at={[3.7,.75,1.8]} radius={.04} height={1.5} color="#445767" /><Dome at={[3.7,1.55,1.8]} radius={.2} color="#f8d587" />
    <Box at={[-2.5,.1,3.7]} size={[.7,.25,.5]} color="#bca57c" /><Dome at={[-2.5,.24,3.7]} radius={.3} color="#789955" />
    <Box at={[2.5,.15,3.7]} size={[.6,.3,.55]} color="#8c999e" /><Box at={[2.5,.36,3.7]} size={[.65,.12,.6]} color="#9cabb2" />
    <Cylinder at={[3.5,.5,-1.8]} radius={.04} height={1} color="#66563e" /><Box at={[3.5,1,-1.8]} size={[.55,.38,.05]} color={city.roof} />
  </group>;
}
