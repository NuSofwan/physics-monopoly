import { BufferGeometry, BoxGeometry, Color, CylinderGeometry, ExtrudeGeometry, LatheGeometry, Shape, SphereGeometry, TorusGeometry, Vector2 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Geometry detail level for tabletop pieces. */
export type PieceQuality = "low" | "medium" | "high";
/** The available physics-inspired token designs. */
export const TOKEN_KINDS = ["solarCar", "rocket", "atom", "magnet", "flask", "bulb", "telescope", "apple"] as const;
/** A supported metal token design. */
export type TokenKind = typeof TOKEN_KINDS[number];

type Vec = [number, number, number];
type Finish = "wood" | "light" | "metal" | "brass" | "dark" | "panel" | "enamel";
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
    {finish === "metal" || finish === "brass" || finish === "dark" || finish === "panel" ?
      <meshPhysicalMaterial
        color={color ?? (finish === "dark" ? "#3b3936" : finish === "panel" ? "#6c8496" : finish === "brass" ? "#d5b27a" : "#d8d5ce")}
        metalness={1}
        roughness={finish === "dark" ? 0.45 : finish === "brass" ? 0.22 : 0.24}
        clearcoat={0.45}
      /> :
      <meshStandardMaterial
        color={color ?? (finish === "light" ? "#ffe3a3" : "#ffffff")}
        roughness={finish === "enamel" ? 0.18 : 0.3}
        metalness={finish === "enamel" ? 0.18 : 0.04}
        emissive={finish === "light" ? "#ffae42" : finish === "enamel" ? color : "#000000"}
        emissiveIntensity={finish === "light" ? 1.45 : finish === "enamel" ? 0.28 : 0}
      />}
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
    <Block size={[width + 0.024, height + 0.024, 0.016]} position={[0, 0, 0]} quality={quality} color="#3a1e16" rounded={false} />
    <Block size={[width, height, 0.013]} position={[0, 0, 0.012]} quality={quality} finish="light" rounded={false} />
    {/* Mullion crossbar for authentic miniature architectural window detail */}
    <Block size={[width, 0.012, 0.016]} position={[0, 0, 0.015]} quality={quality} color="#3a1e16" rounded={false} />
    <Block size={[0.012, height, 0.016]} position={[0, 0, 0.015]} quality={quality} color="#3a1e16" rounded={false} />
  </group>;
}
/** Darkens a hex colour for lacquer trim (roof, plinth, cornice). */
function shade(hex: string, factor: number): string {
  const value = new Color(hex).multiplyScalar(factor);
  return `#${value.getHexString()}`;
}

/**
 * Iconic Monopoly-style architectural pieces from the video:
 * - Level 1: Classic Emerald Green Cottage House with pitched gable roof, chimney & warm lit windows.
 * - Level 2: Twin Emerald Green Houses + Mid-Rise Tower with color-set cornice & glowing windows.
 * - Level 3: Tall Crimson Red Grand Hotel Tower (with color-set roof marquee & glowing multi-story windows,
 *   plus a miniature interior room vignette visible when the camera zooms into the ground-floor window!).
 */
export function PropertyPiece({ level, quality = "medium", accent = "#e6c687", paint: paintOverride }: { level: 1 | 2 | 3; quality?: PieceQuality; accent?: string; paint?: string }): JSX.Element {
  const groupTint = paintOverride ?? "#2f8f4e";
  if (level === 1) {
    // Classic Emerald Green House (matches the green pitched-roof houses in 00:01–00:03 of the video)
    const body = "#258944";
    const roofColor = "#1a6832";
    return <group>
      {/* Colour-set base plinth so the property's colour group still reads clearly */}
      <Block size={[0.5, 0.036, 0.41]} position={[0, 0.018, 0]} color={groupTint} quality={quality} />
      <Block size={[0.45, 0.31, 0.36]} position={[0, 0.18, 0]} color={body} quality={quality} />
      <Part geometry={roof(0.51, 0.19, 0.42)} position={[0, 0.335, 0]} color={roofColor} finish="wood" />
      <Block size={[0.068, 0.14, 0.072]} position={[-0.13, 0.43, -0.06]} color={shade(body, .78)} quality={quality} />
      <Block size={[0.095, 0.16, 0.02]} position={[0, 0.11, 0.187]} color={accent} quality={quality} />
      <Window position={[-0.145, 0.21, 0.188]} quality={quality} width={0.075} height={0.088} />
      <Window position={[0.145, 0.21, 0.188]} quality={quality} width={0.075} height={0.088} />
      <Window position={[-0.145, 0.21, -0.188]} quality={quality} width={0.075} height={0.088} />
      <Window position={[0.145, 0.21, -0.188]} quality={quality} width={0.075} height={0.088} />
      <Block size={[0.058, 0.09, 0.01]} position={[0, 0.125, 0.202]} quality={quality} finish="light" rounded={false} />
    </group>;
  }

  if (level === 2) {
    // Cluster of two emerald green houses side-by-side (classic multi-house build up before the red hotel!)
    const body = "#248843", roofColor = "#196630";
    return <group>
      <Block size={[1.06, 0.038, 0.44]} position={[0, 0.019, 0]} color={groupTint} quality={quality} />
      {[-0.27, 0.27].map((ox, idx) => (
        <group key={idx} position={[ox, 0.035, (idx === 0 ? -0.02 : 0.02)]}>
          <Block size={[0.44, 0.34, 0.36]} position={[0, 0.17, 0]} color={body} quality={quality} />
          <Part geometry={roof(0.49, 0.19, 0.4)} position={[0, 0.34, 0]} color={roofColor} finish="wood" />
          <Block size={[0.062, 0.13, 0.065]} position={[-0.12, 0.43, -0.06]} color={shade(body, .78)} quality={quality} />
          <Block size={[0.088, 0.15, 0.02]} position={[0, 0.085, 0.186]} color={accent} quality={quality} />
          <Window position={[-0.135, 0.2, 0.186]} quality={quality} width={0.07} height={0.085} />
          <Window position={[0.135, 0.2, 0.186]} quality={quality} width={0.07} height={0.085} />
          <Window position={[0, 0.2, -0.186]} quality={quality} width={0.085} height={0.085} />
        </group>
      ))}
    </group>;
  }

  // Level 3: Tall Crimson Red Grand Hotel Tower (like the towering red skyscrapers in 00:01–00:06 & 00:10 of the video)
  const width = 1.16;
  const depth = 0.56;
  const bodyHeight = 1.28;
  const paint = "#c82321"; // Classic Monopoly Crimson Red Hotel
  const trim = "#8f1615";
  const columns = 5;
  const rows = 6;
  return <group>
    {/* Property colour-group marble plinth at base */}
    <Block size={[width + 0.06, 0.06, depth + 0.06]} position={[0, 0.03, 0]} color={groupTint} quality={quality} />
    {/* Main Crimson Hotel Tower */}
    <Block size={[width, bodyHeight, depth]} position={[0, bodyHeight / 2 + 0.04, 0]} color={paint} quality={quality} />
    {/* Mid-tower architectural cornice belt & crown */}
    <Block size={[width + 0.045, 0.045, depth + 0.045]} position={[0, 0.48, 0]} color={trim} quality={quality} />
    <Block size={[width + 0.055, 0.06, depth + 0.055]} position={[0, bodyHeight + 0.04, 0]} color={trim} quality={quality} />
    {/* Stepped penthouse crown & pitched hotel roof crest */}
    <Block size={[0.92, 0.09, 0.44]} position={[0, bodyHeight + 0.11, 0]} color={paint} quality={quality} />
    <Part geometry={roof(0.96, 0.18, 0.46)} position={[0, bodyHeight + 0.155, 0]} color={trim} finish="wood" />
    {/* Golden hotel marquee & grand entrance */}
    <Block size={[0.38, 0.09, 0.04]} position={[0, bodyHeight + 0.22, 0.14]} color="#e5c168" quality={quality} />
    <Block size={[0.36, 0.04, 0.05]} position={[0, 0.27, depth / 2 + 0.022]} color={accent} quality={quality} />
    <Block size={[0.19, 0.21, 0.02]} position={[0, 0.145, depth / 2 + 0.014]} color={accent} quality={quality} />
    <Block size={[0.13, 0.18, 0.015]} position={[0, 0.14, depth / 2 + 0.024]} quality={quality} finish="light" rounded={false} />
    {/* Multi-story illuminated windows across all 4 facades */}
    {Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, col) => {
      const x = (col - (columns - 1) / 2) * 0.205;
      const y = 0.18 + row * 0.19;
      return <group key={`${row}:${col}`}>
        {!(row === 0 && col === 2) && <Window position={[x, y, depth / 2 + 0.007]} quality={quality} width={0.095} height={0.115} />}
        <Window position={[x, y, -depth / 2 - 0.007]} quality={quality} width={0.095} height={0.115} />
      </group>;
    }))}
    {Array.from({ length: rows }, (_, row) => [-1, 1].flatMap(side => [-1, 1].map(col => (
      <Window key={`${row}:${side}:${col}`} position={[side * (width / 2 + 0.007), 0.18 + row * 0.19, col * 0.135]} side quality={quality} width={0.095} height={0.115} />
    ))))}
  </group>;
}

/**
 * A cast-pewter / antique-brass playing token with a player-coloured enamel base ring.
 * Slot 0 (`solarCar`) is sculpted as the iconic vintage Monopoly grand-prix roadster from the video
 * (00:02 & 00:08) with long louvered hood, exposed spoke wheels, cockpit driver with goggles & tail fin!
 */
export function MetalToken({ kind, color, quality = "medium" }: { kind: TokenKind; color: string; quality?: PieceQuality }): JSX.Element {
  const n = quality === "low" ? 10 : quality === "high" ? 24 : 16;
  const rod = (radius: number, length: number, position: Vec, rotation: Vec = [0, 0, 0], finish: Finish = "metal") =>
    <Part geometry={cylinder(radius, radius, length, n)} position={position} rotation={rotation} finish={finish} />;
  let design: JSX.Element;
  switch (kind) {
    case "solarCar":
      // Vintage Pewter/Bronze Racing Roadster (matches the video's iconic racecar token at 00:02 & 00:08!)
      design = <group position={[0, 0.02, 0]}>
        {/* Streamlined cigar fuselage & long hood */}
        <Part geometry={cylinder(0.068, 0.092, 0.44, n)} position={[0, 0.135, 0.02]} rotation={[Math.PI / 2, 0, 0]} finish="brass" />
        {/* Rounded radiator nose cone & grille */}
        <Part geometry={sphere(0.072, n)} position={[0, 0.13, 0.23]} scale={[0.95, 0.9, 1.1]} finish="brass" />
        <Part geometry={cylinder(0.052, 0.052, 0.02, n)} position={[0, 0.13, 0.295]} rotation={[Math.PI / 2, 0, 0]} finish="dark" />
        {/* Boat-tail rear tapering fin */}
        <Part geometry={cylinder(0.018, 0.088, 0.18, n)} position={[0, 0.145, -0.25]} rotation={[-Math.PI / 2, 0, 0]} finish="brass" />
        {/* Side exhaust pipes along the hood */}
        {[-1, 1].map(side => (
          <Part key={side} geometry={cylinder(0.014, 0.014, 0.28, 10)} position={[side * 0.09, 0.125, 0.04]} rotation={[Math.PI / 2, 0, 0]} finish="metal" />
        ))}
        {/* Cockpit cowling & aero windscreen */}
        <Part geometry={torus(0.062, 0.014, 12, Math.PI)} position={[0, 0.185, -0.02]} rotation={[-0.4, 0, 0]} finish="metal" />
        {/* Vintage driver with racing helmet & goggles */}
        <Part geometry={sphere(0.052, n)} position={[0, 0.21, -0.075]} scale={[0.9, 1.1, 0.9]} finish="brass" />
        <Part geometry={sphere(0.044, n)} position={[0, 0.268, -0.07]} finish="brass" />
        <Part geometry={torus(0.032, 0.009, 10, Math.PI)} position={[0, 0.275, -0.035]} finish="dark" />
        {/*Steering wheel*/}
        <Part geometry={torus(0.032, 0.007, 10)} position={[0, 0.205, -0.02]} rotation={[0.6, 0, 0]} finish="dark" />
        {/* Four open-wheel axles, vintage tires & knock-off hubcaps */}
        {[-1, 1].flatMap(x => [[-0.17, 0.085], [0.18, 0.078]].map(([z, r], idx) => <group key={`${x}:${idx}`}>
          {rod(0.014, 0.27, [0, 0.1, z!], [0, 0, Math.PI / 2], "dark")}
          <Part geometry={cylinder(r!, r!, 0.042, n)} position={[x * 0.145, 0.105, z!]} rotation={[0, 0, Math.PI / 2]} finish="dark" />
          <Part geometry={torus(r! * 0.85, 0.018, n)} position={[x * 0.145, 0.105, z!]} rotation={[0, Math.PI / 2, 0]} finish="brass" />
          <Part geometry={cylinder(0.026, 0.026, 0.052, 10)} position={[x * 0.15, 0.105, z!]} rotation={[0, 0, Math.PI / 2]} finish="metal" />
        </group>))}
      </group>;
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
        <Part geometry={lathe("apple", [[0, 0.03, 0], [0.07, 0, 0], [0.14, 0.035, 0], [0.18, 0.12, 0], [0.185, 0.2, 0], [0.165, 0.28, 0], [0.11, 0.335, 0], [0.05, 0.335, 0], [0.015, 0.305, 0], [0, 0.3, 0]], n + 4)} position={[0, 0.045, 0]} />
        {rod(0.013, 0.09, [0.008, 0.385, 0], [0, 0, -0.22], "dark")}
        <Part geometry={sphere(1, n)} position={[0.075, 0.405, 0.01]} scale={[0.085, 0.014, 0.045]} rotation={[0.2, 0.3, 0.45]} finish="dark" />
      </>;
      break;
  }
  return <group>
    <Part geometry={cylinder(0.24, 0.25, 0.042, n * 2)} position={[0, 0.021, 0]} finish={kind === "solarCar" ? "brass" : "metal"} />
    <Part geometry={torus(0.22, 0.014, n * 2)} position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]} finish="enamel" color={color} />
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
