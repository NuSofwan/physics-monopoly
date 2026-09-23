import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { avatarById, type Appearance } from "@physics-monopoly/shared";
import { StaticBatch } from "./StaticBatch";
export type AvatarPose = "idle" | "walk" | "think" | "celebrate" | "wave";
export function AvatarFigure({ avatar, color, pose = "idle", reducedMotion = false, appearance = {}, badge = 0 }: { avatar: string; color: string; pose?: AvatarPose; reducedMotion?: boolean; appearance?: Appearance; badge?: number }): JSX.Element {
  const original = avatarById(avatar), preset = { ...original, suit: appearance.shirt ?? original.suit, skin: appearance.skin ?? original.skin, hair: appearance.hair ?? original.hair, role: appearance.equipment === false ? "none" : original.role }, chair = "wheelchair" in preset && preset.wheelchair;
  const senior = preset.age === "senior", young = preset.age === "youth" || preset.age === "teen", hair = senior ? "#c8c6c0" : "#352e29";
  const root = useRef<Group>(null), arms = useRef<Group>(null), wheels = useRef<Group>(null);
  const leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!root.current || !arms.current) return;
    const t = clock.elapsedTime;
    root.current.position.y = reducedMotion || chair ? 0 : pose === "walk" ? Math.abs(Math.sin(t*8))*.035 : pose === "celebrate" ? Math.abs(Math.sin(t*6))*.09 : 0;
    arms.current.rotation.z = reducedMotion ? 0 : pose === "think" ? -.45 : pose === "wave" ? -.75+Math.sin(t*5)*.25 : pose === "celebrate" ? -.8 : pose === "walk" ? Math.sin(t*8)*.16 : Math.sin(t*1.6)*.025;
    if (wheels.current && pose === "walk" && !reducedMotion) wheels.current.rotation.x = t*4;
    for (const [side,leg] of [[-1,leftLeg],[1,rightLeg]] as const) if (leg.current) leg.current.rotation.x = pose === "walk" && !reducedMotion && !chair ? Math.sin(t*8)*side*.32 : 0;
  });
  const helmet = ["engineer","firefighter"].includes(preset.role), longCoat = ["science","health","teacher"].includes(preset.role);
  return <group scale={[preset.build*(young?.83:1), young?.83:1,preset.build*(young?.83:1)]}>
    <mesh position={[0,.035,0]}><cylinderGeometry args={[.31,.33,.07,badge%4+3]} /><meshStandardMaterial color={appearance.base ?? color} /></mesh>
    <group ref={root} position={[0,0,0]}>
      <group position={[0,chair ? -.12 : 0,0]}>
        {[-1,1].map(side=><group key={side} ref={side<0?leftLeg:rightLeg} position={[side*.11,.42,0]}>
          <mesh castShadow position={[0,(chair?.37:.24)-.42,chair?.16:0]} rotation={[chair?Math.PI/2:0,0,0]}><capsuleGeometry args={[.065,.2,3,7]}/><meshStandardMaterial color="#405164"/></mesh>
          <mesh position={[0,(chair?.24:.09)-.42,chair?.23:.07]}><boxGeometry args={[.14,.11,.23]}/><meshStandardMaterial color="#26333f"/></mesh>
        </group>)}
        <StaticBatch version={`${avatar}:${JSON.stringify(appearance)}:body`}>
        <mesh castShadow position={[0,.55,0]}><cylinderGeometry args={[.19,longCoat?.25:.22,longCoat?.49:.4,10]} /><meshStandardMaterial color={preset.suit} /></mesh>
        {longCoat ? <mesh position={[0,.52,.2]}><boxGeometry args={[.025,.36,.025]} /><meshStandardMaterial color="#547983" /></mesh> : null}
        </StaticBatch>
        <group ref={arms} position={[0,.65,0]}>{[-1,1].map((side)=><group key={side} position={[side*.25,-.12,0]} rotation={[0,0,side*.2]}><mesh castShadow><capsuleGeometry args={[.06,.2,3,7]} /><meshStandardMaterial color={preset.suit} /></mesh><mesh position={[0,-.16,0]}><sphereGeometry args={[.065,8,6]} /><meshStandardMaterial color={preset.skin} /></mesh></group>)}</group>
        <StaticBatch version={`${avatar}:${JSON.stringify(appearance)}:head-equipment`}>
        <mesh castShadow position={[0,.93,0]} scale={[1,senior?1.05:1,1]}><sphereGeometry args={[young?.2:.185,14,10]} /><meshStandardMaterial color={preset.skin} /></mesh>
        <mesh position={[0,1.04,-.025]}><sphereGeometry args={[.19,12,8,0,Math.PI*2,0,Math.PI/2]} /><meshStandardMaterial color={hair} /></mesh>
        {preset.hair === "long" ? <mesh position={[0,.92,-.12]} scale={[1,.9,.65]}><sphereGeometry args={[.22,12,8]} /><meshStandardMaterial color={hair} /></mesh> : preset.hair === "curly" ? [-.14,0,.14].map((x)=><mesh key={x} position={[x,1.075,-.04]}><dodecahedronGeometry args={[.105,0]} /><meshStandardMaterial color={hair} /></mesh>) : null}
        {[-.065,.065].map((x)=><mesh key={x} position={[x,.94,.164]}><sphereGeometry args={[.021,7,5]} /><meshStandardMaterial color="#2c282b" /></mesh>)}
        {senior ? <>{[-.07,.07].map((x)=><mesh key={x} position={[x,.94,.185]}><torusGeometry args={[.046,.009,5,10]} /><meshStandardMaterial color="#5b6872" /></mesh>)}<mesh position={[0,.88,.18]}><boxGeometry args={[.1,.012,.01]} /><meshStandardMaterial color="#8a6154" /></mesh></> : null}
        {helmet || preset.role === "nature" ? <group position={[0,1.09,0]}><mesh><cylinderGeometry args={[.28,.28,.06,12]} /><meshStandardMaterial color={preset.role === "firefighter"?"#b34838":helmet?"#e9ba49":"#ac9061"} /></mesh><mesh position={[0,.06,0]}><sphereGeometry args={[.19,12,7,0,Math.PI*2,0,Math.PI/2]} /><meshStandardMaterial color={helmet?"#e8b745":"#9b8057"} /></mesh></group> : null}
        {preset.role === "space" ? <><mesh position={[0,.95,0]}><sphereGeometry args={[.25,16,12]} /><meshStandardMaterial color="#c4e6ee" transparent opacity={.2} roughness={.1} /></mesh><mesh position={[0,.57,-.24]}><boxGeometry args={[.3,.38,.18]} /><meshStandardMaterial color="#acb8c1" /></mesh></> : null}
        {preset.role === "science" ? <mesh position={[.3,.46,.13]}><coneGeometry args={[.09,.23,9]} /><meshStandardMaterial color="#65bfa4" /></mesh> : null}
        {preset.role === "teacher" || preset.role === "architect" ? <mesh position={[.29,.5,.12]} rotation={[0,0,.15]}><boxGeometry args={[.2,.3,.055]} /><meshStandardMaterial color={preset.role==="teacher"?"#b66655":"#79b0c5"} /></mesh> : null}
        {preset.role === "health" ? <mesh position={[0,.67,.22]}><torusGeometry args={[.07,.012,5,12]} /><meshStandardMaterial color="#425667" /></mesh> : null}
        {preset.role === "pilot" ? <><mesh position={[0,1.08,0]}><cylinderGeometry args={[.21,.22,.08,12]} /><meshStandardMaterial color="#334c73" /></mesh><mesh position={[0,1.04,.16]}><boxGeometry args={[.3,.035,.2]} /><meshStandardMaterial color="#c5a358" /></mesh></> : null}
        {preset.role === "firefighter" ? <mesh position={[0,.5,.23]}><boxGeometry args={[.4,.055,.025]} /><meshStandardMaterial color="#eee78c" /></mesh> : null}
        {preset.role === "artist" ? <group position={[.3,.5,.18]} rotation={[0,0,-.35]}><mesh scale={[1,1.3,.4]}><sphereGeometry args={[.15,10,8]} /><meshStandardMaterial color="#ad7544" /></mesh><mesh position={[0,.24,0]}><boxGeometry args={[.05,.3,.04]} /><meshStandardMaterial color="#825537" /></mesh></group> : null}
        {preset.role === "student" || preset.role === "nature" ? <mesh position={[0,.58,-.23]}><boxGeometry args={[.28,.3,.15]} /><meshStandardMaterial color={preset.role==="student"?"#986c85":"#756b4d"} /></mesh> : null}
        {preset.role === "athlete" ? <mesh position={[0,.65,.215]}><boxGeometry args={[.18,.17,.02]} /><meshStandardMaterial color="#e5e3d1" /></mesh> : null}
        </StaticBatch>
      </group>
      {chair ? <group><mesh position={[0,.37,-.06]}><boxGeometry args={[.46,.08,.43]} /><meshStandardMaterial color="#405a74" /></mesh><mesh position={[0,.59,-.24]}><boxGeometry args={[.46,.42,.065]} /><meshStandardMaterial color="#405a74" /></mesh><group ref={wheels} position={[0,.28,0]}>{[-.29,.29].map((x)=><group key={x} position={[x,0,0]}><mesh rotation={[0,Math.PI/2,0]}><torusGeometry args={[.23,.035,6,18]}/><meshStandardMaterial color="#353c47"/></mesh>{[0,Math.PI/2].map(angle=><mesh key={angle} rotation={[angle,0,0]}><boxGeometry args={[.025,.43,.025]}/><meshStandardMaterial color="#8096a2"/></mesh>)}</group>)}</group>{[-.22,.22].map((x)=><mesh key={x} position={[x,.12,.29]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.07,.07,.055,10]} /><meshStandardMaterial color="#424a53" /></mesh>)}</group> : null}
    </group>
  </group>;
}
