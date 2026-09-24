import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from "three";

/** Point on a sphere around the head centre; phi = PI/2 faces the front (+z), matching SphereGeometry. */
export function sphere(theta: number, phi: number, radius: number): Vector3 {
  return new Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).multiplyScalar(radius);
}

/**
 * A flattened, tapering anime hair lock swept along a smooth curve. The wide axis lies along the head
 * surface (derived from the outward direction), so locks overlap like layered hair instead of spikes.
 * Coordinates are relative to the head centre.
 */
export function strandGeometry(points: Vector3[], width: number, thickness: number, segments = 7, radial = 5): BufferGeometry {
  const curve = new CatmullRomCurve3(points, false, "centripetal");
  const positions: number[] = [], indices: number[] = [];
  const tangent = new Vector3(), outward = new Vector3(), side = new Vector3(), lift = new Vector3(), point = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, point); curve.getTangentAt(t, tangent);
    outward.copy(point).normalize();
    side.crossVectors(tangent, outward);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    lift.crossVectors(side, tangent).normalize();
    // Full body near the root, then a soft point: reads as a brush-stroke lock.
    const taper = Math.pow(1 - t, .75) * (t < .12 ? .75 + t * 2.1 : 1);
    for (let j = 0; j < radial; j++) {
      const angle = j / radial * Math.PI * 2;
      positions.push(
        point.x + side.x * Math.cos(angle) * width * taper + lift.x * Math.sin(angle) * thickness * taper,
        point.y + side.y * Math.cos(angle) * width * taper + lift.y * Math.sin(angle) * thickness * taper,
        point.z + side.z * Math.cos(angle) * width * taper + lift.z * Math.sin(angle) * thickness * taper,
      );
    }
  }
  for (let i = 0; i < segments; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(new Array(positions.length / 3 * 2).fill(0), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export interface HairPlan { strands: BufferGeometry[]; highlight: BufferGeometry[] }
const R = 1; // unit head; callers scale by head radius
const plans = new Map<string, HairPlan>();
/** Builds (once per haircut) the lock layout. Everything is in unit-head space (radius 1, centre at origin). */
export function hairPlan(cut: string, young: boolean): HairPlan {
  const cacheKey = `${cut}:${young}`, cached = plans.get(cacheKey);
  if (cached) return cached;
  const plan = buildPlan(cut, young);
  plans.set(cacheKey, plan);
  return plan;
}
function buildPlan(cut: string, young: boolean): HairPlan {
  const strands: BufferGeometry[] = [], highlight: BufferGeometry[] = [];
  const lock = (points: Vector3[], width: number, thickness = width * .42) => strands.push(strandGeometry(points, width, thickness));
  const front = Math.PI / 2, spiky = cut === "spiky" || cut === "swept" || cut === "tousled", sweep = cut === "swept" ? .35 : 0;
  // Bangs: layered locks from under the crown that curve over the forehead and stop above the eyes.
  for (const offset of [-.78, -.52, -.26, 0, .26, .52, .78]) {
    const phi = front + offset, drift = -offset * .18 + sweep;
    const length = spiky ? 1.36 : 1.3 + (Math.abs(offset) > .6 ? .12 : 0);
    lock([sphere(.35, phi, .96 * R), sphere(.8, phi + drift * .4, 1.1 * R), sphere(1.1, phi + drift * .8, 1.12 * R), sphere(length, phi + drift, 1.06 * R)], spiky ? .19 : .2, .07);
  }
  // Face-framing side locks in front of the ears.
  for (const sideSign of [-1, 1]) {
    const phi = front + sideSign * 1.12, long = cut === "long" || cut === "bob" || cut === "ponytail" || cut === "braid";
    lock([sphere(.7, phi, 1 * R), sphere(1.25, phi, 1.1 * R), sphere(1.75, phi - sideSign * .08, 1.08 * R), sphere(long ? 2.35 : 2.0, phi - sideSign * .18, 1.02 * R)], .2, .07);
  }
  // Crown layer: locks radiating from the whorl and combing back/down over the scalp.
  const crownCount = spiky ? 9 : 11;
  for (let i = 0; i < crownCount; i++) {
    const phi = front + .75 + i * (Math.PI * 2 - 1.5) / (crownCount - 1), end = spiky ? 1.6 : cut === "bob" ? 2.2 : cut === "long" ? 2.1 : 1.95;
    lock([sphere(.05, phi, .95 * R), sphere(.6, phi, 1.1 * R), sphere(1.3, phi + .05, 1.14 * R), sphere(end, phi + .1, 1.08 * R)], .32, .09);
  }
  if (spiky) {
    // Chunky swept-back shonen spikes: broad at the root, hugging the skull, flicking out at the tips.
    const count = cut === "tousled" ? 8 : 9;
    for (let i = 0; i < count; i++) {
      const phi = front + .7 + i * (Math.PI * 2 - 1.4) / (count - 1), theta = .5 + (i % 2) * .38;
      const reach = cut === "tousled" ? 1.3 : 1.45;
      lock([sphere(theta - .25, phi, .98 * R), sphere(theta + .1, phi, 1.14 * R), sphere(theta + .35, phi + sweep * .6, 1.24 * R), sphere(theta + .45, phi + sweep, reach * R).add(new Vector3(sweep * .3, .12, 0))], .44, .15);
    }
    for (const offset of [-.35, .35]) lock([sphere(.15, front + offset, .98 * R), sphere(.25, front + offset * 1.4, 1.2 * R), sphere(.2, front + offset * 2, 1.42 * R).add(new Vector3(sweep, .18, -.1))], .36, .13);
  }
  if (cut === "long") for (let i = 0; i < 9; i++) {
    const phi = front + 1.25 + i * (Math.PI * 2 - 2.5) / 8;
    lock([sphere(1.2, phi, 1.08 * R), sphere(1.75, phi, 1.14 * R), sphere(2.2, phi, 1.15 * R).add(new Vector3(0, -.55 * R, 0)), sphere(2.4, phi, 1.2 * R).add(new Vector3(0, -1.25 * R, 0))], .34, .1);
  }
  if (cut === "bob") for (let i = 0; i < 7; i++) {
    const phi = front + 1.4 + i * (Math.PI * 2 - 2.8) / 6;
    lock([sphere(1.3, phi, 1.1 * R), sphere(1.9, phi, 1.18 * R), sphere(2.35, phi, 1.12 * R), sphere(2.45, phi, .95 * R)], .32, .1);
  }
  if (cut === "ponytail") for (let i = 0; i < 5; i++) {
    const spread = (i - 2) * .12, tie = new Vector3(0, .55 * R, -1.02 * R);
    lock([tie, tie.clone().add(new Vector3(spread, .15, -.35)), tie.clone().add(new Vector3(spread * 2, -.45, -.75)), tie.clone().add(new Vector3(spread * 2.5, -1.35, -.6))], .22, .09);
  }
  if (young) lock([sphere(.12, front - .2, .95 * R), new Vector3(.08, 1.45 * R, .18), new Vector3(.3, 1.55 * R, .45), new Vector3(.38, 1.35 * R, .55)], .09, .04);
  return { strands, highlight };
}
