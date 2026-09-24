import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Mesh, InstancedMesh } from "three";

/** QA-only measurement of rendered geometry, excluding hidden batching sources. */
export function AssetMetrics(): null {
  const { scene, gl } = useThree(), sampled = useRef(-1);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - sampled.current < .5) return;
    sampled.current = clock.elapsedTime;
    const counts: Record<string,number> = {};
    scene.traverseVisible(root => {
      if (!root.name.startsWith("asset:")) return;
      let triangles = 0;
      root.traverseVisible(object => {
        // Outline passes re-draw a batch's existing geometry (like the shadow pass); count the shape once.
        if (!(object instanceof Mesh) || object.userData.outlinePass) return;
        const count = object.geometry.index?.count ?? object.geometry.getAttribute("position")?.count ?? 0;
        triangles += count / 3 * (object instanceof InstancedMesh ? object.count : 1);
      });
      counts[root.name.slice(6)] = triangles;
    });
    gl.domElement.dataset.assetGeometry = JSON.stringify(counts);
  });
  return null;
}
