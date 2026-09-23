/** Pip positions in a face's local XY plane. Opposite faces sum to seven. */
export function pipPositions(value: number): Array<[number, number]> {
  const a = 0.25;
  switch (value) {
    case 1: return [[0, 0]];
    case 2: return [[-a, a], [a, -a]];
    case 3: return [[-a, a], [0, 0], [a, -a]];
    case 4: return [[-a, a], [a, a], [-a, -a], [a, -a]];
    case 5: return [...pipPositions(4), [0, 0]];
    case 6: return [[-a, a], [a, a], [-a, 0], [a, 0], [-a, -a], [a, -a]];
    default: return [];
  }
}

export const diceOrientations: Array<[number, number, number]> = [
  [0, 0, 0], [0, 0, 0], [-Math.PI / 2, 0, 0], [0, 0, Math.PI / 2],
  [0, 0, -Math.PI / 2], [Math.PI / 2, 0, 0], [Math.PI, 0, 0],
];

export function tilePosition(index: number): [number, number, number] {
  const step = 1.75;
  if (index <= 7) return [6.125 - index * step, 6.125, 0];
  if (index <= 14) return [-6.125, 6.125 - (index - 7) * step, -Math.PI / 2];
  if (index <= 21) return [-6.125 + (index - 14) * step, -6.125, Math.PI];
  return [6.125, -6.125 + (index - 21) * step, Math.PI / 2];
}

/** A separate walking lane keeps all four participants outside building bounds. */
export function tokenPosition(index: number, slot: number): [number, number, number] {
  const [x, z, rotation] = tilePosition(index);
  const localX = slot % 2 === 0 ? -0.36 : 0.36;
  const localZ = slot < 2 ? 0.52 : 1.18;
  return [x + localX * Math.cos(rotation) + localZ * Math.sin(rotation), 0.30, z - localX * Math.sin(rotation) + localZ * Math.cos(rotation)];
}
