import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import { useQuality } from "./RenderQuality";

/** Decorative life around the island: sailboats bobbing along the shore and slow clouds on the horizon. Purely visual, never occludes the board. */
export function Ambience({ reducedMotion = false }: { reducedMotion?: boolean }): JSX.Element {
  const quality = useQuality();
  // Low tier keeps the draw-call budget for the board itself.
  if (quality === "low") return <group name="ambience"/>;
  return <group name="ambience">
    <Boat radius={11.6} start={.6} speed={.035} hull="#f4f1ea" stripe="#c9493d" sail="#fff8ec" reducedMotion={reducedMotion}/>
    <Boat radius={12.8} start={2.7} speed={-.028} hull="#2f5d7c" stripe="#e8c25b" sail="#f6ead6" reducedMotion={reducedMotion}/>
    <Boat radius={11.9} start={4.6} speed={.03} hull="#f1e3c8" stripe="#3f8f86" sail="#ffe1c4" reducedMotion={reducedMotion}/>
    <>
      <Cloud at={[-17, 5.2, -15]} scale={1.5} drift={.05} reducedMotion={reducedMotion}/>
      <Cloud at={[19, 6, -12]} scale={1.8} drift={-.04} reducedMotion={reducedMotion}/>
      <Cloud at={[4, 6.8, -24]} scale={2.2} drift={.03} reducedMotion={reducedMotion}/>
      <Cloud at={[-24, 5.5, 4]} scale={1.6} drift={-.035} reducedMotion={reducedMotion}/>
      <Cloud at={[23, 5, 8]} scale={1.3} drift={.045} reducedMotion={reducedMotion}/>
    </>
  </group>;
}

function Boat({ radius, start, speed, hull, stripe, sail, reducedMotion }: { radius: number; start: number; speed: number; hull: string; stripe: string; sail: string; reducedMotion: boolean }): JSX.Element {
  const ref = useRef<Group>(null), angle = useRef(start);
  useFrame(({ clock }, delta) => {
    const boat = ref.current;
    if (!boat) return;
    if (!reducedMotion) angle.current += delta * speed;
    const a = angle.current, t = clock.elapsedTime;
    boat.position.set(Math.cos(a) * radius, -.62 + (reducedMotion ? 0 : Math.sin(t * 1.3 + start) * .035), Math.sin(a) * radius);
    boat.rotation.set(reducedMotion ? 0 : Math.sin(t * 1.1 + start) * .05, -a + (speed > 0 ? -Math.PI / 2 : Math.PI / 2), reducedMotion ? 0 : Math.cos(t * .9 + start) * .04);
  });
  return <group ref={ref} scale={.9}>
    <mesh castShadow position={[0,.1,0]} scale={[1,.55,.42]}><sphereGeometry args={[.6,20,10,0,Math.PI*2,Math.PI/2,Math.PI/2]}/><meshStandardMaterial color={hull} roughness={.4}/></mesh>
    <mesh position={[0,.1,0]} rotation={[Math.PI/2,0,0]} scale={[1,.42,1]}><torusGeometry args={[.6,.035,6,32]}/><meshStandardMaterial color={stripe} roughness={.45}/></mesh>
    <mesh position={[0,.095,0]} rotation={[-Math.PI/2,0,0]} scale={[1,.42,1]}><circleGeometry args={[.6,32]}/><meshStandardMaterial color="#c89b6d" roughness={.7}/></mesh>
    <mesh castShadow position={[.14,.22,0]}><boxGeometry args={[.32,.18,.26]}/><meshStandardMaterial color="#fbf7ef" roughness={.5}/></mesh>
    <mesh position={[.3,.22,0]}><boxGeometry args={[.02,.1,.2]}/><meshStandardMaterial color="#6fa9c2" roughness={.1} metalness={.3}/></mesh>
    <mesh castShadow position={[-.12,.72,0]}><cylinderGeometry args={[.018,.022,1.05,8]}/><meshStandardMaterial color="#8a6a4a" roughness={.6}/></mesh>
    <mesh castShadow position={[-.3,.66,0]} scale={[1,1,.06]} rotation={[0,0,0]}><coneGeometry args={[.26,.9,3]}/><meshStandardMaterial color={sail} roughness={.75} side={2}/></mesh>
  </group>;
}

function Cloud({ at, scale, drift, reducedMotion }: { at: [number, number, number]; scale: number; drift: number; reducedMotion: boolean }): JSX.Element {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    ref.current.position.x = at[0] + Math.sin(clock.elapsedTime * drift) * 3;
  });
  const puffs: Array<[number, number, number, number]> = [[0,0,0,1], [.95,-.1,.1,.75], [-.9,-.15,-.05,.7], [.35,.35,-.1,.72], [-.4,.25,.15,.6], [1.6,-.25,0,.45], [-1.55,-.28,.05,.42]];
  return <group ref={ref} position={at} scale={scale}>
    {puffs.map(([x,y,z,r],i)=><mesh key={i} position={[x,y,z]} scale={[1,.78,.85]}><sphereGeometry args={[r,18,12]}/><meshStandardMaterial color="#fff7ef" emissive="#ffe7d2" emissiveIntensity={.18} roughness={1}/></mesh>)}
  </group>;
}
