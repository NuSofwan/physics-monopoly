import { AvatarFigure, type AvatarPose } from "./AvatarFigure";
/** Original procedural characters; the old robot remains a compatible saved-profile fallback. */
export function Character({ avatar, color, pose, reducedMotion, appearance, badge }: { avatar: string; color: string; pose?: AvatarPose; reducedMotion?: boolean; appearance?: import("@physics-monopoly/shared").Appearance; badge?: number }): JSX.Element {
  if (avatar !== "robot") return <AvatarFigure avatar={avatar} color={color} pose={pose} reducedMotion={reducedMotion} appearance={appearance} badge={badge} />;
  return <LegacyRobot avatar={avatar} color={color} />;
}
function LegacyRobot({ avatar, color }: { avatar: string; color: string }): JSX.Element {
  const robot = avatar === "robot";
  const suit = avatar === "scientist" || avatar === "teacher" ? "#f2eee4" : avatar === "astro" ? "#d6e4eb" : color;
  const skin = avatar === "teacher" || avatar === "explorer" ? "#9a6544" : "#d8a47c";
  return <group>
    <mesh castShadow position={[0, 0.045, 0]}><cylinderGeometry args={[0.3, 0.32, 0.09, 16]} /><meshStandardMaterial color={color} /></mesh>
    {[-0.105, 0.105].map((x) => <group key={x} position={[x, 0, 0]}>
      <mesh castShadow position={[0, 0.22, 0]}><boxGeometry args={[0.13, 0.32, 0.15]} /><meshStandardMaterial color={robot ? "#5c727e" : "#34435e"} /></mesh>
      <mesh castShadow position={[0, 0.1, 0.06]}><boxGeometry args={[0.16, 0.1, 0.23]} /><meshStandardMaterial color="#22313c" /></mesh>
    </group>)}
    <mesh castShadow position={[0, 0.53, 0]}>
      {robot ? <boxGeometry args={[0.4, 0.4, 0.27]} /> : <cylinderGeometry args={[0.19, 0.23, 0.4, 10]} />}
      <meshStandardMaterial color={suit} metalness={robot ? 0.6 : 0} roughness={0.65} />
    </mesh>
    {[-1, 1].map((side) => <mesh key={side} castShadow position={[side * 0.255, 0.5, 0]} rotation={[0, 0, side * 0.18]}><capsuleGeometry args={[0.065, 0.22, 4, 8]} /><meshStandardMaterial color={suit} /></mesh>)}
    <mesh castShadow position={[0, 0.9, 0]}>
      {robot ? <boxGeometry args={[0.34, 0.28, 0.28]} /> : <sphereGeometry args={[0.185, 16, 12]} />}
      <meshStandardMaterial color={robot ? "#92afbd" : skin} />
    </mesh>
    {[-0.065, 0.065].map((x) => <mesh key={x} position={[x, 0.92, 0.165]}><sphereGeometry args={[0.025, 8, 6]} /><meshStandardMaterial color={robot ? "#59f4f6" : "#292638"} /></mesh>)}
    {avatar === "astro" ? <>
      <mesh position={[0, 0.92, 0]}><sphereGeometry args={[0.245, 20, 16]} /><meshStandardMaterial color="#c3edff" transparent opacity={0.24} roughness={0.08} /></mesh>
      <mesh position={[0, 0.55, -0.23]}><boxGeometry args={[0.33, 0.38, 0.2]} /><meshStandardMaterial color="#dce7ed" /></mesh>
    </> : null}
    {avatar === "engineer" || avatar === "explorer" ? <group position={[0, 1.03, 0]}>
      <mesh><cylinderGeometry args={[0.3, 0.3, 0.06, 16]} /><meshStandardMaterial color={avatar === "engineer" ? "#ffc247" : "#ac8056"} /></mesh>
      <mesh position={[0, 0.065, 0]}><sphereGeometry args={[0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={avatar === "engineer" ? "#ffc247" : "#ac8056"} /></mesh>
    </group> : null}
    {avatar === "girl" ? <mesh position={[0, 0.98, -0.11]}><sphereGeometry args={[0.22, 12, 12]} /><meshStandardMaterial color="#42302b" /></mesh> : null}
    {avatar === "boy" ? <mesh position={[0, 1.04, 0]}><sphereGeometry args={[0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#42302b" /></mesh> : null}
    {avatar === "scientist" ? <>
      <mesh position={[0, 1.055, -0.045]}><dodecahedronGeometry args={[0.21, 0]} /><meshStandardMaterial color="#d8d5cf" /></mesh>
      <mesh position={[0.28, 0.4, 0.12]}><coneGeometry args={[0.1, 0.22, 12]} /><meshStandardMaterial color="#76dbbb" /></mesh>
    </> : null}
    {avatar === "teacher" ? <mesh position={[0.3, 0.46, 0.08]} rotation={[0.1, 0.2, 0]}><boxGeometry args={[0.15, 0.25, 0.07]} /><meshStandardMaterial color="#b85451" /></mesh> : null}
    {robot ? <mesh position={[0, 1.15, 0]}><cylinderGeometry args={[0.03, 0.03, 0.22, 8]} /><meshStandardMaterial color="#ea7a49" /></mesh> : null}
  </group>;
}
