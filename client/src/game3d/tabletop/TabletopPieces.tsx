import { BufferGeometry, BoxGeometry, CylinderGeometry, ExtrudeGeometry, LatheGeometry, Shape, SphereGeometry, TorusGeometry, Vector2 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Geometry detail level for tabletop pieces. */
export type PieceQuality = "low" | "medium" | "high";
/** The available physics-inspired token designs. */
export const TOKEN_KINDS = ["solarCar", "rocket", "atom", "magnet", "flask", "bulb", "telescope", "apple"] as const;
/** A supported metal token design. */
export type TokenKind = typeof TOKEN_KINDS[number];

type Vec = [number, number, number];
type Finish = "wood" | "light" | "metal" | "dark" | "panel" | "enamel";
const geometries = new Map<string, BufferGeometry>();
function cached(key: string, create: () => BufferGeometry): BufferGeometry {
  let geometry = geometries.get(key);
  if (!geometry) { geometry = create(); geometries.set(key, geometry); }
  return geometry;
}
function box(size: Vec, quality: PieceQuality, rounded = true): BufferGeometry {
  const [x, y, z] = size;
  return cached(`box:${size}:${quality}:${rounded}`, () => quality === "low" || !rounded
    ? new BoxGeometry(x, y, z)
    : new RoundedBoxGeometry(x, y, z, quality === "high" ? 2 : 1, Math.min(x, y, z) * 0.12));
}
function cylinder(top: number, bottom: number, height: number, segments: number): BufferGeometry {
  return cached(`cyl:${top}:${bottom}:${height}:${segments}`, () => new CylinderGeometry(top, bottom, height, segments));
}
function sphere(radius: number, segments: number): BufferGeometry {
  return cached(`sphere:${radius}:${segments}`, () => new SphereGeometry(radius, segments, Math.max(6, Math.floor(segments * 0.7))));
}
function torus(radius: number, tube: number, segments: number, arc = Math.PI * 2): BufferGeometry {
  return cached(`torus:${radius}:${tube}:${segments}:${arc}`, () => new TorusGeometry(radius, tube, 6, segments, arc));
}
function roof(width: number, height: number, depth: number): BufferGeometry {
  return cached(`roof:${width}:${height}:${depth}`, () => {
    const shape = new Shape();
    shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, height); shape.closePath();
    const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  });
}
function lathe(name: string, points: Vec[], segments: number): BufferGeometry {
  return cached(`lathe:${name}:${segments}`, () => new LatheGeometry(points.map(([x, y]) => new Vector2(x, y)), segments));
}
function Part({ geometry, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], finish = "metal", color }: {
  geometry: BufferGeometry; position?: Vec; rotation?: Vec; scale?: Vec; finish?: Finish; color?: string;
}): JSX.Element {
  return <mesh geometry={geometry} position={position} rotation={rotation} scale={scale} castShadow receiveShadow dispose={null}>
    {finish === "metal" || finish === "dark" || finish === "panel" ?
      <meshPhysicalMaterial color={color ?? (finish === "dark" ? "#6f6c66" : finish === "panel" ? "#758894" : "#c9c7c0")} metalness={1} roughness={finish === "dark" ? 0.5 : 0.28} clearcoat={0.3} /> :
      <meshStandardMaterial color={color ?? (finish === "light" ? "#ffe0a1" : "#ffffff")} roughness={finish === "enamel" ? 0.2 : 0.35} metalness={finish === "enamel" ? 0.15 : 0} emissive={finish === "light" ? "#ffb85c" : finish === "enamel" ? color : "#000000"} emissiveIntensity={finish === "light" ? 1.2 : finish === "enamel" ? 0.25 : 0} />}
  </mesh>;
}
function Block({ size, position, color, quality, finish = "wood", rotation, rounded = true }: {
  size: Vec; position: Vec; color?: string; quality: PieceQuality; finish?: Finish; rotation?: Vec; rounded?: boolean;
}): JSX.Element {
  return <Part geometry={box(size, quality, rounded)} position={position} rotation={rotation} color={color} finish={finish} />;
}
function Window({ position, side = false, quality, width = 0.095, height = 0.105 }: { position: Vec; side?: boolean; quality: PieceQuality; width?: number; height?: number }): JSX.Element {
  const angle = side ? (position[0] < 0 ? -Math.PI / 2 : Math.PI / 2) : (position[2] < 0 ? Math.PI : 0);
  return <group position={position} rotation={[0, angle, 0]}>
    <Block size={[width + 0.025, height + 0.025, 0.016]} position={[0, 0, 0]} quality={quality} color="#49362c" rounded={false} />
    <Block size={[width, height, 0.012]} position={[0, 0, 0.012]} quality={quality} finish="light" rounded={false} />
  </group>;
}
/** A lacquered house, condominium, or hotel, standing on the tabletop. */
export function PropertyPiece({ level, quality = "medium", accent = "#66432e" }: { level: 1 | 2 | 3; quality?: PieceQuality; accent?: string }): JSX.Element {
  if (level === 1) return <group>
    <Block size={[0.45, 0.31, 0.36]} position={[0, 0.155, 0]} color="#2f8f4e" quality={quality} />
    <Part geometry={roof(0.49, 0.18, 0.4)} position={[0, 0.31, 0]} color="#216a3b" finish="wood" />
    <Block size={[0.065, 0.13, 0.07]} position={[-0.12, 0.405, -0.06]} color="#287b46" quality={quality} />
    <Block size={[0.095, 0.16, 0.02]} position={[0, 0.09, 0.187]} color={accent} quality={quality} />
    <Window position={[-0.15, 0.19, 0.19]} quality={quality} width={0.075} height={0.085} />
    <Window position={[0.15, 0.19, 0.19]} quality={quality} width={0.075} height={0.085} />
    <Block size={[0.06, 0.09, 0.01]} position={[0, 0.11, 0.202]} quality={quality} finish="light" rounded={false} />
  </group>;
  const hotel = level === 3;
  const width = hotel ? 1.2 : 0.9;
  const depth = hotel ? 0.55 : 0.48;
  const bodyHeight = hotel ? 0.91 : 0.63;
  const paint = hotel ? "#c8242b" : "#2b7fa3";
  const columns = hotel ? 7 : 5;
  const rows = hotel ? 5 : 3;
  return <group>
    <Block size={[width, bodyHeight, depth]} position={[0, bodyHeight / 2, 0]} color={paint} quality={quality} />
    <Block size={[width + 0.025, 0.055, depth + 0.025]} position={[0, 0.0275, 0]} color={hotel ? "#9c2026" : "#226680"} quality={quality} />
    <Block size={[width + 0.035, 0.055, depth + 0.035]} position={[0, bodyHeight, 0]} color={paint} quality={quality} />
    {hotel ? <>
      <Block size={[0.94, 0.075, 0.43]} position={[0, 0.98, 0]} color="#a81e26" quality={quality} />
      <Block size={[0.65, 0.065, 0.34]} position={[0, 1.05, 0]} color={paint} quality={quality} />
      <Block size={[0.32, 0.09, 0.035]} position={[0, 1.125, 0.1]} color="#e0bd78" quality={quality} />
      <Block size={[0.32, 0.035, 0.035]} position={[0, 0.23, depth / 2 + 0.0175]} color={accent} quality={quality} />
      <Block size={[0.17, 0.19, 0.018]} position={[0, 0.115, depth / 2 + 0.012]} color={accent} quality={quality} />
    </> : <>
      <Block size={[width, 0.08, 0.04]} position={[0, 0.695, -depth / 2 + 0.02]} color={paint} quality={quality} />
      <Block size={[0.24, 0.09, 0.2]} position={[0.18, 0.70, 0]} color="#246e8c" quality={quality} />
    </>}
    {Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, col) => {
      const x = (col - (columns - 1) / 2) * 0.15;
      const y = (hotel ? 0.14 : 0.13) + row * (hotel ? 0.15 : 0.16);
      return <group key={`${row}:${col}`}>
        {!(hotel && row === 0 && col === 3) && <Window position={[x, y, depth / 2 + 0.006]} quality={quality} width={0.075} height={0.09} />}
        <Window position={[x, y, -depth / 2 - 0.006]} quality={quality} width={0.075} height={0.09} />
      </group>;
    }))}
    {Array.from({ length: rows }, (_, row) => [-1, 1].flatMap(side => [-1, 1].map(col => <Window key={`${row}:${side}:${col}`} position={[side * (width / 2 + 0.006), (hotel ? 0.14 : 0.13) + row * (hotel ? 0.15 : 0.16), col * 0.12]} side quality={quality} width={0.075} height={0.09} />)))}
  </group>;
}

/** A cast-pewter playing token with a player-coloured enamel base ring. */
export function MetalToken({ kind, color, quality = "medium" }: { kind: TokenKind; color: string; quality?: PieceQuality }): JSX.Element {
  const n = quality === "low" ? 10 : quality === "high" ? 24 : 16;
  const rod = (radius: number, length: number, position: Vec, rotation: Vec = [0, 0, 0], finish: Finish = "metal") =>
    <Part geometry={cylinder(radius, radius, length, n)} position={position} rotation={rotation} finish={finish} />;
  let design: JSX.Element;
  switch (kind) {
    case "solarCar":
      design = <>
        <Part geometry={sphere(1, n)} position={[0, 0.17, 0]} scale={[0.145, 0.075, 0.225]} />
        <Block size={[0.19, 0.025, 0.24]} position={[0, 0.232, -0.025]} rotation={[-0.13, 0, 0]} quality={quality} finish="panel" />
        {[-1, 1].flatMap(x => [-1, 1].map(z => <group key={`${x}:${z}`}>
          {rod(0.059, 0.042, [x * 0.142, 0.12, z * 0.133], [0, 0, Math.PI / 2], "dark")}
          {rod(0.026, 0.045, [x * 0.144, 0.12, z * 0.133], [0, 0, Math.PI / 2])}
        </group>))}
        <Part geometry={sphere(1, n)} position={[0, 0.27, -0.08]} scale={[0.085, 0.045, 0.09]} finish="dark" />
      </>;
      break;
    case "rocket":
      design = <>
        {rod(0.045, 0.07, [0, 0.095, 0], [0, 0, 0], "dark")}
        <Part geometry={lathe("rocket", [[0.075, 0, 0], [0.105, 0.05, 0], [0.105, 0.28, 0], [0.075, 0.36, 0], [0, 0.45, 0]], n)} position={[0, 0.12, 0]} />
        {[0, 1, 2].map(i => <Block key={i} size={[0.04, 0.15, 0.11]} position={[Math.sin(i * Math.PI * 2 / 3) * 0.105, 0.18, Math.cos(i * Math.PI * 2 / 3) * 0.105]} rotation={[0, i * Math.PI * 2 / 3, 0]} quality={quality} finish="metal" />)}
        {rod(0.045, 0.018, [0, 0.37, 0.102], [Math.PI / 2, 0, 0], "dark")}
        {rod(0.029, 0.021, [0, 0.37, 0.11], [Math.PI / 2, 0, 0])}
      </>;
      break;
    case "atom":
      design = <>
        {rod(0.025, 0.11, [0, 0.105, 0])}
        {[0, 1, 2].map(i => <Part key={i} geometry={torus(0.18, 0.009, n * 2)} position={[0, 0.34, 0]} rotation={[i * Math.PI / 3, i * Math.PI / 3, 0]} scale={[1, 1.25, 1]} />)}
        {[[0, 0.34, 0], [0.04, 0.37, 0], [-0.035, 0.365, 0.02], [0.005, 0.31, 0.03]].map((p, i) => <Part key={i} geometry={sphere(0.045, n)} position={p as Vec} finish={i === 1 ? "dark" : "metal"} />)}
      </>;
      break;
    case "magnet":
      design = <>
        <Part geometry={torus(0.13, 0.045, n, Math.PI)} position={[0, 0.22, 0]} rotation={[0, 0, Math.PI]} />
        {[-1, 1].map(i => <group key={i}>
          {rod(0.045, 0.22, [i * 0.13, 0.33, 0])}
          {rod(0.048, 0.055, [i * 0.13, 0.455, 0], [0, 0, 0], "dark")}
        </group>)}
      </>;
      break;
    case "flask":
      design = <>
        <Part geometry={lathe("flask", [[0, 0, 0], [0.14, 0, 0], [0.15, 0.025, 0], [0.055, 0.28, 0], [0.055, 0.4, 0], [0.07, 0.4, 0], [0.07, 0.425, 0], [0, 0.425, 0]], n)} position={[0, 0.05, 0]} />
        <Part geometry={torus(0.104, 0.008, n)} position={[0, 0.20, 0]} rotation={[Math.PI / 2, 0, 0]} finish="dark" />
        {rod(0.045, 0.008, [0, 0.48, 0], [0, 0, 0], "dark")}
      </>;
      break;
    case "bulb":
      design = <>
        {rod(0.075, 0.15, [0, 0.135, 0], [0, 0, 0], "dark")}
        {[0.09, 0.125, 0.16, 0.195].map(y => <Part key={y} geometry={torus(0.076, 0.009, n)} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} />)}
        <Part geometry={lathe("bulb", [[0.065, 0, 0], [0.08, 0.08, 0], [0.14, 0.16, 0], [0.15, 0.23, 0], [0.12, 0.31, 0], [0.07, 0.35, 0], [0, 0.365, 0]], n)} position={[0, 0.20, 0]} />
        <Part geometry={torus(0.055, 0.008, n, Math.PI)} position={[0, 0.37, 0.132]} finish="dark" />
      </>;
      break;
    case "telescope":
      design = <>
        {[-1, 0, 1].map((i) => <Part key={i} geometry={cylinder(0.012, 0.017, 0.27, n)} position={[i * 0.075, 0.18, i === 0 ? -0.08 : 0.04]} rotation={[i === 0 ? -0.55 : 0.28, 0, i * 0.5]} />)}
        <group position={[0, 0.34, 0]} rotation={[-0.42, 0, 0]}>
          {rod(0.055, 0.31, [0, 0, 0], [Math.PI / 2, 0, 0])}
          {rod(0.073, 0.06, [0, 0, 0.16], [Math.PI / 2, 0, 0])}
          {rod(0.057, 0.008, [0, 0, 0.195], [Math.PI / 2, 0, 0], "dark")}
          {rod(0.033, 0.07, [0, 0, -0.18], [Math.PI / 2, 0, 0], "dark")}
        </group>
      </>;
      break;
    case "apple":
      design = <>
        {/* Apple body: a dimpled lathe profile (wide shoulders, tapered base) so it never reads as a sphere. */}
        <Part geometry={lathe("apple", [[0, 0.03, 0], [0.07, 0, 0], [0.14, 0.035, 0], [0.18, 0.12, 0], [0.185, 0.2, 0], [0.165, 0.28, 0], [0.11, 0.335, 0], [0.05, 0.335, 0], [0.015, 0.305, 0], [0, 0.3, 0]], n + 4)} position={[0, 0.045, 0]} />
        {rod(0.013, 0.09, [0.008, 0.385, 0], [0, 0, -0.22], "dark")}
        <Part geometry={sphere(1, n)} position={[0.075, 0.405, 0.01]} scale={[0.085, 0.014, 0.045]} rotation={[0.2, 0.3, 0.45]} finish="dark" />
      </>;
      break;
  }
  return <group>
    <Part geometry={cylinder(0.24, 0.24, 0.04, n * 2)} position={[0, 0.02, 0]} />
    <Part geometry={torus(0.218, 0.012, n * 2)} position={[0, 0.044, 0]} rotation={[Math.PI / 2, 0, 0]} finish="enamel" color={color} />
    {design}
  </group>;
}

/** A small lacquered wooden ownership marker. */
export function OwnershipPeg({ color }: { color: string }): JSX.Element {
  return <group>
    <Part geometry={cylinder(0.13, 0.15, 0.04, 10)} position={[0, 0.02, 0]} finish="wood" color={color} />
    <Part geometry={cylinder(0.035, 0.055, 0.23, 10)} position={[0, 0.155, 0]} finish="wood" color={color} />
    <Part geometry={sphere(0.065, 10)} position={[0, 0.285, 0]} finish="wood" color={color} />
  </group>;
}
