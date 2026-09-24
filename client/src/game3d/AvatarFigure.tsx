import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Group, type MeshBasicMaterial } from "three";
import { avatarById, type Appearance } from "@physics-monopoly/shared";
import { StaticBatch } from "./StaticBatch";
import { useQuality } from "./RenderQuality";
import { FACE_PHI, FACE_THETA, FACE_THETA_START, faceTexture, type Expression } from "./AnimeFace";
import { hairPlan, sphere } from "./HairStrands";
import { toonGradient } from "./Toon";
export type AvatarPose = "idle" | "walk" | "think" | "celebrate" | "wave";

/** Chibi proportions: big head, compact body; heights are in avatar units before build/age scaling. */
const HEAD_Y = .96, HEAD_R = .27, SHOULDER_Y = .63, HIP_Y = .34;
/** Ink line for the anime outline pass (medium/high tiers only). */
const INK = { color: "#2b2230", pixels: 1.7 };
const mix = (a: string, b: string, t: number) => `#${new Color(a).lerp(new Color(b), t).getHexString()}`;
/** Anime palettes are cleaner and more saturated than the preset swatches. */
function vivid(hex: string, saturation = 1.3, lightness = .04): string {
  const hsl = { h: 0, s: 0, l: 0 }, color = new Color(hex);
  color.getHSL(hsl);
  return `#${color.setHSL(hsl.h, Math.min(1, hsl.s * saturation), Math.min(.92, hsl.l + lightness)).getHexString()}`;
}

/** Cel-shaded material: three hard light bands; colour becomes vertex colour inside StaticBatch. */
function Toon({ color, glow = 0 }: { color: string; glow?: number }): JSX.Element {
  return <meshToonMaterial color={color} gradientMap={toonGradient()} emissive={glow ? color : "#000000"} emissiveIntensity={glow}/>;
}

export function AvatarFigure({ avatar, color, pose = "idle", reducedMotion = false, appearance = {}, badge = 0 }: { avatar: string; color: string; pose?: AvatarPose; reducedMotion?: boolean; appearance?: Appearance; badge?: number }): JSX.Element {
  const original = avatarById(avatar), preset = { ...original, suit: vivid(appearance.shirt ?? original.suit), accent: vivid(original.accent, 1.35, .02), skin: vivid(appearance.skin ?? original.skin, 1.05, .07), role: appearance.equipment === false ? "none" : original.role }, chair = "wheelchair" in preset && preset.wheelchair;
  const senior = preset.age === "senior", young = preset.age === "youth" || preset.age === "teen", hair = vivid(preset.hairColor, 1.35, .1);
  const cut = appearance.hair === "long" ? "long" : appearance.hair === "curly" ? "curly" : appearance.hair === "short" ? "swept" : preset.cut;
  const low = useQuality() === "low", lod = low ? .5 : 1, seg = (count: number) => Math.max(6, Math.round(count * lod));
  const outline = low ? undefined : INK, look = low ? "flat" : "ink";
  const pants = mix(preset.suit, "#1d2330", .55), shoe = mix(preset.accent, "#20242c", .45), panel = mix(preset.suit, "#1f2530", .35), shine = mix(hair, "#ffffff", .38), scalp = mix(hair, "#141018", .15);
  const fur = ["ninja", "celestial", "pirate", "guardian", "explorer"].includes(preset.role);
  const style = useMemo(() => ({ eyes: vivid(preset.eyes, 1.4, .06), brows: mix(hair, "#1c1620", .35), lashes: preset.gender === "female" ? "long" as const : "soft" as const, senior }), [preset.eyes, hair, preset.gender, senior]);
  const plan = useMemo(() => hairPlan(cut, young), [cut, young]);
  const phase = useMemo(() => [...avatar].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 7, [avatar]);
  const key = `${avatar}:${JSON.stringify(appearance)}:${lod}:${look}`;
  const root = useRef<Group>(null), body = useRef<Group>(null), head = useRef<Group>(null), leftArm = useRef<Group>(null), rightArm = useRef<Group>(null), wheels = useRef<Group>(null);
  const leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null), face = useRef<MeshBasicMaterial>(null), shown = useRef<Expression>("normal");
  useFrame(({ clock }) => {
    if (!root.current || !leftArm.current || !rightArm.current || !head.current || !body.current) return;
    const t = clock.elapsedTime + phase, still = reducedMotion;
    const walk = pose === "walk" && !still, cheer = pose === "celebrate" && !still, swing = walk ? Math.sin(t * 9) : 0;
    root.current.position.y = chair || still ? 0 : walk ? Math.abs(Math.sin(t * 9)) * .05 : cheer ? Math.abs(Math.sin(t * 6)) * .15 : 0;
    root.current.rotation.x = walk ? .07 : 0;
    body.current.scale.y = still ? 1 : 1 + Math.sin(t * 2.2) * .014;
    head.current.rotation.set(pose === "think" ? -.05 : cheer ? -.12 : walk ? Math.sin(t * 18) * .025 : 0, still ? 0 : pose === "idle" ? Math.sin(t * .7) * .14 : 0, pose === "think" ? .18 : still ? 0 : Math.sin(t * 1.3) * .045);
    leftArm.current.rotation.set(walk ? swing * .7 : 0, 0, cheer ? -2.45 + Math.sin(t * 12) * .15 : -.28 - (still ? 0 : Math.sin(t * 2.2) * .03));
    if (pose === "think") rightArm.current.rotation.set(-2.05, 0, -.45);
    else if (pose === "wave" && !still) rightArm.current.rotation.set(0, 0, 2.35 + Math.sin(t * 7) * .32);
    else if (cheer) rightArm.current.rotation.set(0, 0, 2.45 - Math.sin(t * 12) * .15);
    else rightArm.current.rotation.set(walk ? -swing * .7 : 0, 0, .28 + (still ? 0 : Math.sin(t * 2.2) * .03));
    if (wheels.current && walk) wheels.current.rotation.x = t * 4;
    for (const [side, leg] of [[-1, leftLeg], [1, rightLeg]] as const) if (leg.current) leg.current.rotation.x = chair ? -Math.PI / 2 : walk ? swing * side * .55 : 0;
    // Expressions: cheer/wave smile, thinking glances aside, otherwise blink every few seconds.
    const expression: Expression = cheer || (pose === "wave" && !still) ? "happy" : pose === "think" ? "think" : !still && (t % 3.7) < .13 ? "blink" : "normal";
    if (face.current && expression !== shown.current) { shown.current = expression; face.current.map = faceTexture(style, expression); }
  });
  const buildScale = preset.build * (young ? .86 : 1);
  return <group scale={[buildScale, young ? .86 : 1, buildScale]}>
    <mesh castShadow receiveShadow position={[0,.035,0]}><cylinderGeometry args={[.31,.33,.07,badge%4+3]} /><meshStandardMaterial color={appearance.base ?? color} roughness={.3} metalness={.1} emissive={appearance.base ?? color} emissiveIntensity={.28}/></mesh>
    {low ? null : <mesh position={[0,.073,0]}><cylinderGeometry args={[.255,.27,.012,badge%4+3]} /><meshStandardMaterial color="#e3bb5c" metalness={.85} roughness={.25}/></mesh>}
    <group ref={root}>
      <group position={[0, chair ? -.08 : 0, 0]}>
        {[-1,1].map(side=><group key={side} ref={side<0?leftLeg:rightLeg} position={[side*.075,HIP_Y,chair?.02:0]} rotation={[chair?-Math.PI/2:0,0,0]}><StaticBatch version={`${key}:${side}:leg`} outline={outline}>
          <mesh castShadow position={[0,-.09,0]}><capsuleGeometry args={[.058,.08,4,seg(12)]}/><Toon color={pants}/></mesh>
          <mesh position={[0,-.165,0]}><cylinderGeometry args={[.056,.058,.05,seg(14)]}/><Toon color="#f6f2ea"/></mesh>
          <mesh castShadow position={[0,-.225,.035]} scale={[.85,.62,1.3]}><sphereGeometry args={[.085,seg(16),10]}/><Toon color={shoe}/></mesh>
          <mesh position={[0,-.262,.035]} scale={[1,1,1.35]}><cylinderGeometry args={[.07,.074,.022,seg(14)]}/><Toon color={chair ? shoe : mix(shoe,"#f4efe6",.7)}/></mesh>
        </StaticBatch></group>)}
        <group ref={body}>
          <StaticBatch version={`${key}:body`} outline={outline}>
            <mesh castShadow position={[0,.37,0]}><cylinderGeometry args={[.15,.165,.1,seg(24)]}/><Toon color={pants}/></mesh>
            <mesh castShadow position={[0,.52,0]}><cylinderGeometry args={[.145,.178,.3,seg(22)]}/><Toon color={preset.suit}/></mesh>
            <mesh position={[0,.385,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.172,.022,8,seg(22)]}/><Toon color={panel}/></mesh>
            <mesh position={[0,.415,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.168,.013,6,seg(22)]}/><Toon color="#2a2f38"/></mesh>
            <mesh position={[0,.415,.17]}><boxGeometry args={[.06,.036,.022]}/><Toon color="#f2c65a"/></mesh>
            {/* Open jacket front: shirt panel, V lapels and buttons. */}
            <mesh position={[0,.56,.152]} rotation={[-.12,0,0]}><boxGeometry args={[.1,.22,.012]}/><Toon color="#f8f4ec"/></mesh>
            {[-1,1].map(side=><mesh key={side} position={[side*.055,.575,.158]} rotation={[-.12,0,side*.32]}><boxGeometry args={[.035,.21,.014]}/><Toon color={panel}/></mesh>)}
            {[.5,.45].map(y=><mesh key={y} position={[0,y,.173]}><sphereGeometry args={[.011,8,6]}/><Toon color="#f2c65a"/></mesh>)}
            {[-1,1].map(side=><mesh key={`s${side}`} castShadow position={[side*.152,.64,0]} scale={[1,.6,1]}><sphereGeometry args={[.07,seg(16),10]}/><Toon color={preset.suit}/></mesh>)}
            {fur ? <mesh castShadow position={[0,.685,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.105,.05,10,seg(24)]}/><Toon color="#fbf7ef"/></mesh>
              : <group>
                <mesh position={[0,.685,0]}><cylinderGeometry args={[.1,.12,.05,seg(20)]}/><Toon color={preset.suit}/></mesh>
                {[-1,1].map(side=><mesh key={side} position={[side*.045,.68,.1]} rotation={[.5,0,side*.9]} scale={[1,1,.35]}><coneGeometry args={[.04,.08,3]}/><Toon color="#f8f4ec"/></mesh>)}
                {[-1,1].map(side=><mesh key={`b${side}`} position={[side*.033,.655,.155]} rotation={[0,0,side*Math.PI/2]} scale={[1,1,.4]}><coneGeometry args={[.028,.05,8]}/><Toon color={preset.accent}/></mesh>)}
                <mesh position={[0,.655,.16]}><sphereGeometry args={[.016,8,6]}/><Toon color={preset.accent}/></mesh>
              </group>}
            <Accessories role={preset.role} accent={preset.accent} suit={preset.suit} lod={lod}/>
          </StaticBatch>
        </group>
        {[-1,1].map(side=><group key={side} ref={side<0?leftArm:rightArm} position={[side*.19,SHOULDER_Y,0]}><StaticBatch version={`${key}:${side}:arm`} outline={outline}>
          <mesh castShadow position={[0,-.085,0]}><capsuleGeometry args={[.05,.09,4,seg(12)]}/><Toon color={preset.suit}/></mesh>
          <mesh position={[0,-.16,0]}><cylinderGeometry args={[.056,.056,.035,seg(14)]}/><Toon color={preset.accent}/></mesh>
          <mesh castShadow position={[0,-.215,.005]} scale={[1,1.05,.9]}><sphereGeometry args={[.058,seg(16),seg(12)]}/><Toon color={preset.skin}/></mesh>
          {preset.role === "alchemy" && side > 0 ? <group position={[0,-.27,.04]}><mesh><sphereGeometry args={[.05,12,10]}/><Toon color="#7fe0c4" glow={.4}/></mesh><mesh position={[0,.06,0]}><cylinderGeometry args={[.016,.02,.05,8]}/><Toon color="#d8f2ec"/></mesh></group> : null}
          {["detective","scholar"].includes(preset.role) && side < 0 ? <mesh position={[0,-.24,.07]} rotation={[.3,0,.1]}><boxGeometry args={[.13,.17,.04]}/><Toon color={preset.accent}/></mesh> : null}
        </StaticBatch></group>)}
        <group ref={head} position={[0,HEAD_Y-.2,0]}>
          <group position={[0,.2-HEAD_Y,0]}>
            <StaticBatch version={`${key}:head`} outline={outline}>
              <mesh castShadow position={[0,HEAD_Y,0]} scale={[1,.95,.97]}><sphereGeometry args={[HEAD_R,seg(28),seg(20)]}/><Toon color={preset.skin}/></mesh>
              {/* Scalp base under the locks; the back reaches the nape so no skin shows between strands. */}
              <mesh castShadow position={[0,HEAD_Y+.012,-.008]}><sphereGeometry args={[HEAD_R*1.05,seg(24),seg(10),0,Math.PI*2,0,1.2]}/><Toon color={scalp}/></mesh>
              <mesh castShadow position={[0,HEAD_Y+.005,-.02]}><sphereGeometry args={[HEAD_R*1.04,seg(16),seg(10),Math.PI,Math.PI,0,cut === "long" || cut === "braid" || cut === "bob" ? 2.5 : 2.1]}/><Toon color={scalp}/></mesh>
              <group position={[0,HEAD_Y,0]} scale={HEAD_R}>
                {plan.strands.map((geometry,i)=><mesh key={i} castShadow geometry={geometry}><Toon color={hair}/></mesh>)}
                {plan.highlight.map((geometry,i)=><mesh key={`h${i}`} geometry={geometry}><Toon color={shine}/></mesh>)}
              </group>
              {cut === "curly" ? Array.from({ length: 12 }, (_, i) => { const p = sphere(.35 + (i % 3) * .45, Math.PI * .85 + i * .49, HEAD_R * 1.04); return <mesh key={i} castShadow position={[p.x,p.y+HEAD_Y,p.z]}><sphereGeometry args={[.085,seg(10),7]}/><Toon color={hair}/></mesh>; }) : null}
              {cut === "braid" ? [0,1,2,3,4].map(i=><mesh key={i} castShadow position={[0,HEAD_Y-.14-i*.1,-.25-i*.02]} scale={[1,.8,1]}><sphereGeometry args={[.07-i*.006,seg(12),8]}/><Toon color={hair}/></mesh>) : null}
              {cut === "ponytail" || cut === "braid" ? <mesh position={[0,HEAD_Y+.14,-.27]} rotation={[.9,0,0]}><torusGeometry args={[.045,.02,6,12]}/><Toon color={preset.accent}/></mesh> : null}
              {senior && !["mechanic","inventor","alchemy"].includes(preset.role) ? [-1,1].map(side=><mesh key={side} position={[side*.1,HEAD_Y-.035,HEAD_R*.95]}><torusGeometry args={[.06,.008,6,20]}/><Toon color="#d6a94e"/></mesh>) : null}
              <HeadGear role={preset.role} accent={preset.accent} suit={preset.suit}/>
            </StaticBatch>
            <mesh position={[0,HEAD_Y,0]} scale={[1,.95,.97]} renderOrder={1}><sphereGeometry args={[HEAD_R*1.004,seg(24),seg(16),Math.PI/2-FACE_PHI/2,FACE_PHI,FACE_THETA_START,FACE_THETA]}/><meshBasicMaterial ref={face} map={faceTexture(style,"normal")} color="#f1f1f1" transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2}/></mesh>
          </group>
        </group>
      </group>
      {chair ? <group><mesh position={[0,.3,-.04]}><boxGeometry args={[.42,.07,.4]} /><Toon color="#4a6a8a"/></mesh><mesh position={[0,.52,-.23]}><boxGeometry args={[.42,.4,.06]} /><Toon color="#4a6a8a"/></mesh><group ref={wheels} position={[0,.24,0]}>{[-.26,.26].map((x)=><group key={x} position={[x,0,0]}><mesh rotation={[0,Math.PI/2,0]}><torusGeometry args={[.2,.032,8,24]}/><Toon color="#353c47"/></mesh>{[0,Math.PI/2].map(angle=><mesh key={angle} rotation={[angle,0,0]}><boxGeometry args={[.022,.38,.022]}/><Toon color="#a9bcc6"/></mesh>)}</group>)}</group>{[-.2,.2].map((x)=><mesh key={x} position={[x,.1,.26]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.06,.06,.05,10]} /><Toon color="#424a53"/></mesh>)}</group> : null}
    </group>
  </group>;
}

/** Torso/back props that tell each original character's role at a glance. */
function Accessories({ role, accent, suit, lod }: { role: string; accent: string; suit: string; lod: number }): JSX.Element | null {
  if (role === "sword" || role === "duelist") return <group position={[0,.52,-.19]} rotation={[0,0,role === "sword" ? .7 : -.7]}>
    <mesh><boxGeometry args={[.034,.6,.014]}/><Toon color="#e9f0f6"/></mesh>
    <mesh position={[0,-.33,0]}><cylinderGeometry args={[.055,.055,.02,12]}/><Toon color="#e8bd57"/></mesh>
    <mesh position={[0,-.42,0]}><cylinderGeometry args={[.022,.022,.16,8]}/><Toon color={accent}/></mesh>
  </group>;
  if (role === "ninja") return <group>
    <mesh position={[0,.7,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.12,.04,8,20]}/><Toon color={accent}/></mesh>
    {[-1,1].map(side=><mesh key={side} position={[side*.05,.58,-.17]} rotation={[.35,0,side*.25]}><boxGeometry args={[.06,.24,.015]}/><Toon color={accent}/></mesh>)}
    <mesh position={[.13,.33,.08]}><boxGeometry args={[.07,.09,.05]}/><Toon color={suit}/></mesh>
  </group>;
  if (role === "celestial" || role === "guardian") return <group>
    <mesh position={[0,.58,.18]} rotation={[0,0,Math.PI/4]}><octahedronGeometry args={[.055,0]}/><Toon color={accent} glow={.5}/></mesh>
    {[-1,1].map(side=><mesh key={side} castShadow position={[side*.19,.69,0]} scale={[1,.55,1]}><sphereGeometry args={[.085,lod<1?10:16,10]}/><Toon color={role === "guardian" ? "#d9dee6" : accent}/></mesh>)}
    {role === "guardian" ? <mesh castShadow position={[0,.53,-.2]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.16,.16,.03,lod<1?12:24]}/><Toon color={accent}/></mesh> : null}
  </group>;
  if (role === "archer") return <group>
    <mesh position={[.02,.55,-.2]} rotation={[0,Math.PI/2,.2]}><torusGeometry args={[.3,.014,6,24,Math.PI]}/><Toon color={accent}/></mesh>
    <mesh position={[-.1,.58,-.19]} rotation={[0,0,-.3]}><cylinderGeometry args={[.045,.04,.3,10]}/><Toon color="#8a6a4a"/></mesh>
  </group>;
  if (role === "healer") return <group>
    <mesh position={[0,.5,.176]}><boxGeometry args={[.04,.1,.02]}/><Toon color={accent}/></mesh>
    <mesh position={[0,.5,.18]}><boxGeometry args={[.1,.04,.02]}/><Toon color={accent}/></mesh>
    <mesh position={[.14,.36,.1]}><sphereGeometry args={[.06,10,8]}/><Toon color="#8fcca6"/></mesh>
  </group>;
  if (role === "mechanic" || role === "inventor" || role === "explorer") return <group position={[0,.54,-.2]}>
    <mesh castShadow><boxGeometry args={[.25,.26,.11]}/><Toon color={role === "explorer" ? "#8a7658" : "#6d7e8c"}/></mesh>
    <mesh position={[0,.08,.02]}><boxGeometry args={[.26,.05,.13]}/><Toon color={accent}/></mesh>
  </group>;
  if (role === "performer") return <mesh position={[0,.46,.172]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.04,.014,6,14]}/><Toon color={accent}/></mesh>;
  return null;
}

/** Hats, goggles and halos sit on the head group so they move with head tilts. */
function HeadGear({ role, accent, suit }: { role: string; accent: string; suit: string }): JSX.Element | null {
  const top = HEAD_Y + HEAD_R * 1.02;
  if (role === "mage") return <group position={[0,top,0]} rotation={[-.12,0,.12]}>
    <mesh castShadow><cylinderGeometry args={[.38,.38,.025,28]}/><Toon color={suit}/></mesh>
    <mesh castShadow position={[0,.2,0]} rotation={[.1,0,-.15]}><coneGeometry args={[.2,.42,20]}/><Toon color={suit}/></mesh>
    <mesh position={[0,.04,0]}><cylinderGeometry args={[.205,.205,.05,20]}/><Toon color={accent}/></mesh>
    <mesh position={[.06,.18,.17]} rotation={[0,0,Math.PI/4]}><octahedronGeometry args={[.045,0]}/><Toon color="#ffd66b" glow={.6}/></mesh>
  </group>;
  if (role === "pirate") return <group position={[0,top-.02,0]}>
    <mesh castShadow><cylinderGeometry args={[.36,.36,.03,24]}/><Toon color={suit}/></mesh>
    <mesh castShadow position={[0,.09,0]}><cylinderGeometry args={[.19,.22,.16,20]}/><Toon color={suit}/></mesh>
    <mesh position={[0,.04,0]}><cylinderGeometry args={[.222,.222,.035,20]}/><Toon color={accent}/></mesh>
    <mesh position={[0,.1,.2]}><sphereGeometry args={[.035,10,8]}/><Toon color="#f2efe6"/></mesh>
  </group>;
  if (role === "explorer") return <group position={[0,top-.03,0]}>
    <mesh castShadow><cylinderGeometry args={[.38,.38,.025,24]}/><Toon color="#d9bd86"/></mesh>
    <mesh castShadow position={[0,.08,0]} scale={[1,.7,1]}><sphereGeometry args={[.23,20,12,0,Math.PI*2,0,Math.PI/2]}/><Toon color="#d9bd86"/></mesh>
    <mesh position={[0,.03,0]}><cylinderGeometry args={[.232,.232,.035,20]}/><Toon color={accent}/></mesh>
  </group>;
  if (role === "detective") return <group position={[.03,top-.03,0]} rotation={[0,0,-.2]} scale={[1,.45,1]}><mesh castShadow><sphereGeometry args={[.29,20,12]}/><Toon color={accent}/></mesh></group>;
  if (role === "mechanic" || role === "inventor" || role === "alchemy") return <group position={[0,HEAD_Y+.16,0]} rotation={[-.35,0,0]}>
    <mesh><torusGeometry args={[HEAD_R*1.12,.02,6,32]}/><Toon color="#3b3f47"/></mesh>
    {[-1,1].map(side=><group key={side} position={[side*.09,0,HEAD_R*1.1]}><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.065,.065,.05,16]}/><Toon color="#d0a05a"/></mesh><mesh position={[0,0,.027]}><circleGeometry args={[.05,16]}/><Toon color={role === "alchemy" ? "#8ff0d4" : "#9fdcf2"} glow={.3}/></mesh></group>)}
  </group>;
  if (role === "celestial") return <mesh position={[0,top+.2,0]} rotation={[Math.PI/2-.25,0,0]}><torusGeometry args={[.17,.014,6,32]}/><Toon color={accent} glow={.9}/></mesh>;
  if (role === "performer") return <mesh position={[.25,HEAD_Y+.13,.02]} rotation={[0,1.3,-.4]} scale={[1,1.2,.4]}><sphereGeometry args={[.065,14,10]}/><Toon color="#f7ecd9"/></mesh>;
  if (role === "sword") return <mesh position={[0,HEAD_Y+.1,-.3]} rotation={[.5,0,0]}><torusGeometry args={[.06,.024,6,14]}/><Toon color={accent}/></mesh>;
  return null;
}
