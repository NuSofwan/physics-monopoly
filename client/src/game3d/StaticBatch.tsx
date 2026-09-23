import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Matrix4, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
const quantise = (value: number, step: number) => Math.round(value / step) * step;
/** Bake only static environment/building transforms; animated tokens/dice stay separate. */
export function StaticBatch({ children, version, name }: { children: ReactNode; version: string; name?: string }): JSX.Element {
  const source = useRef<Group>(null), output = useRef<Group>(null);
  useLayoutEffect(() => {
    const root = source.current, target = output.current;
    if (!root || !target) return;
    root.updateWorldMatrix(true, true);
    const inverseRoot = new Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map<string, { material: MeshStandardMaterial; geometries: BufferGeometry[]; castShadow: boolean }>();
    root.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial)) return;
      const material = object.material;
      // Quantised surface values keep the draw-call count low without visible change;
      // only transparent layers keep their own shadow flag (opaque groups cast if any member does).
      const roughness = quantise(material.roughness, .1), metalness = quantise(material.metalness, .2), glow = material.emissive.getHex() === 0 ? 0 : quantise(material.emissiveIntensity, .1);
      const key = [material.type, material.map?.uuid ?? "none", material.normalMap?.uuid ?? "none", material.emissiveMap?.uuid ?? "none", roughness, metalness, glow ? material.emissive.getHex() : 0, glow, material.envMapIntensity, material.opacity, material.transparent, material.side, material.flatShading, "clearcoat" in material ? material.clearcoat : 0, material.transparent && object.castShadow].join(":");
      let group = groups.get(key);
      if (!group) {
        const batchMaterial = material.clone();
        batchMaterial.color.setRGB(1,1,1); batchMaterial.vertexColors = true;
        batchMaterial.roughness = roughness; batchMaterial.metalness = metalness; batchMaterial.emissiveIntensity = glow;
        group = { material: batchMaterial, geometries: [], castShadow: false }; groups.set(key, group);
      }
      group.castShadow ||= object.castShadow;
      const geometry = object.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld));
      const count = geometry.getAttribute("position").count, colors = new Float32Array(count*3);
      for (let i=0;i<count;i++) { colors[i*3]=material.color.r; colors[i*3+1]=material.color.g; colors[i*3+2]=material.color.b; }
      geometry.setAttribute("color",new Float32BufferAttribute(colors,3));
      // Polyhedra are non-indexed; give them a trivial index so they merge with indexed primitives.
      if (!geometry.index) geometry.setIndex(Array.from({ length: count }, (_, i) => i));
      group.geometries.push(geometry);
    });
    const created: Mesh[] = [];
    for (const { material,geometries,castShadow } of groups.values()) {
      const geometry = mergeGeometries(geometries, false);
      for (const temporary of geometries) temporary.dispose();
      if (!geometry) { material.dispose(); continue; }
      const mesh = new Mesh(geometry, material); mesh.castShadow = castShadow; mesh.receiveShadow = true;
      target.add(mesh); created.push(mesh);
    }
    return () => { for (const mesh of created) { target.remove(mesh); mesh.geometry.dispose(); (mesh.material as MeshStandardMaterial).dispose(); } };
  }, [version]);
  return <><group ref={source} visible={false}>{children}</group><group ref={output} name={name} /></>;
}
