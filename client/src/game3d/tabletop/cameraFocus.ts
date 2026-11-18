import { Vector3 } from "three";

/** World point the orbit camera is looking at; the depth-of-field pass focuses on it. */
export const cameraFocus = new Vector3();

/**
 * Shared narrative director state so `TabletopScene` can steer the camera during cinematic moments
 * (e.g. dice throw sweep, low-angle ground chase, mortgage lock & window zoom, jail cage slam,
 * bank heist overhead spin) without altering `Board3D.tsx`.
 */
export interface DirectorShot {
  active: boolean;
  position: Vector3;
  target: Vector3;
  fov: number;
  strength: number;
  closeUp: boolean;
}

export const directorShot: DirectorShot = {
  active: false,
  position: new Vector3(0, 10.5, 15.5),
  target: new Vector3(0, 0, 1),
  fov: 36,
  strength: 6,
  closeUp: false,
};
