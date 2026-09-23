import { describe, expect, it } from "vitest";
import { Euler, Quaternion, Vector3 } from "three";
import { diceOrientations, pipPositions, tilePosition, tokenPosition } from "../client/src/game3d/diceGeometry";

describe("renderer contracts", () => {
  it("has the correct number of distinct pips on each face", () => {
    for (let value = 1; value <= 6; value++) {
      expect(pipPositions(value)).toHaveLength(value);
      expect(new Set(pipPositions(value).map((point) => point.join(","))).size).toBe(value);
    }
  });
  it("rotates the server value to the top for every die result", () => {
    const normals = [[0, 1, 0], [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 0, -1], [0, -1, 0]];
    for (let value = 1; value <= 6; value++) {
      const normal = new Vector3(...normals[value - 1] as [number, number, number]);
      normal.applyQuaternion(new Quaternion().setFromEuler(new Euler(...diceOrientations[value]!)));
      expect(normal.distanceTo(new Vector3(0, 1, 0))).toBeLessThan(1e-10);
    }
  });
  it("has 28 unique board positions and equal step lengths including wraparound", () => {
    const points = Array.from({ length: 28 }, (_, index) => tilePosition(index));
    expect(new Set(points.map(([x, z]) => `${x}:${z}`)).size).toBe(28);
    for (let index = 0; index < 28; index++) {
      const [x, z] = points[index]!;
      const [nx, nz] = points[(index + 1) % 28]!;
      expect(Math.hypot(nx - x, nz - z)).toBeCloseTo(1.75);
    }
  });
  it("keeps four tokens distinct and clear of buildings on all sides", () => {
    for (let index = 0; index < 28; index++) {
      const [x, z, rotation] = tilePosition(index);
      const points = Array.from({ length: 4 }, (_, slot) => tokenPosition(index, slot));
      for (const point of points) {
        const localZ = (point[0] - x) * Math.sin(rotation) + (point[2] - z) * Math.cos(rotation);
        expect(localZ - 0.32).toBeGreaterThan(-0.3 + 0.49);
        expect(Math.abs(point[0])+.32).toBeLessThan(7.85);
        expect(Math.abs(point[2])+.32).toBeLessThan(7.85);
        expect(Math.max(Math.abs(point[0]),Math.abs(point[2]))-.32).toBeGreaterThan(5.75);
        expect(point[1]).toBe(.30);
      }
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
        expect(new Vector3(...points[a]!).distanceTo(new Vector3(...points[b]!))).toBeGreaterThanOrEqual(0.61);
      }
    }
  });
});
