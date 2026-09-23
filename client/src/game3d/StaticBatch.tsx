import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Group, Mesh, MeshStandardMaterial, Matrix4, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
/** Bake only static environment/building transforms; animated tokens/dice stay separate. */
export function StaticBatch({ children, version, name }: { children: ReactNode; version: string; name?: string }): JSX.Element {
  const source = useRef<Group>(null), output = useRef<Group>(null);
  useLayoutEffect(() => {
    const root = source.current, target = output.current;
    if (!root || !target) return;
    root.updateWorldMatrix(true, true);
    const inverseRoot = new Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map<string, { material: MeshStandardMaterial; geometries: BufferGeometry[] }>();
    root.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
      const material = object.material;
      const key = [material.color.getHex(), material.roughness, material.metalness, material.emissive.getHex(), material.emissiveIntensity, material.opacity, material.transparent, material.side].join(":");
      let group = groups.get(key);
      if (!group) { group = { material: material.clone(), geometries: [] }; groups.set(key, group); }
      group.geometries.push(object.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld)));
    });
    const created: Mesh[] = [];
    for (const { material,geometries } of groups.values()) {
      const geometry = mergeGeometries(geometries, false);
      for (const temporary of geometries) temporary.dispose();
      if (!geometry) { material.dispose(); continue; }
      const mesh = new Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
      target.add(mesh); created.push(mesh);
    }
    return () => { for (const mesh of created) { target.remove(mesh); mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose(); } };
  }, [version]);
  return <><group ref={source} visible={false}>{children}</group><group ref={output} name={name} /></>;
}
