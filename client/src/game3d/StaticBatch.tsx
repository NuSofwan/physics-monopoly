import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, MeshToonMaterial, Matrix4, type BufferGeometry, type Material } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createOutlineMaterial, trackResolution } from "./Toon";
const quantise = (value: number, step: number) => Math.round(value / step) * step;
type Batchable = MeshStandardMaterial | MeshToonMaterial;
/**
 * Bake only static environment/building transforms; animated tokens/dice stay separate.
 * `outline` adds an anime ink line per opaque group: a second mesh that shares the group's geometry
 * (no extra buffers) and is flagged `userData.outlinePass` so geometry metrics count the shape once.
 */
export function StaticBatch({ children, version, name, outline }: { children: ReactNode; version: string; name?: string; outline?: { color: string; pixels: number } }): JSX.Element {
  const source = useRef<Group>(null), output = useRef<Group>(null);
  useLayoutEffect(() => {
    const root = source.current, target = output.current;
    if (!root || !target) return;
    root.updateWorldMatrix(true, true);
    const inverseRoot = new Matrix4().copy(root.matrixWorld).invert();
    const groups = new Map<string, { material: Batchable; geometries: BufferGeometry[]; castShadow: boolean }>();
    root.traverse((object) => {
      if (!(object instanceof Mesh) || !(object.material instanceof MeshStandardMaterial || object.material instanceof MeshToonMaterial)) return;
      const material: Batchable = object.material, standard = material instanceof MeshStandardMaterial;
      // Quantised surface values keep the draw-call count low without visible change;
      // only transparent layers keep their own shadow flag (opaque groups cast if any member does).
      const roughness = standard ? quantise(material.roughness, .1) : 0, metalness = standard ? quantise(material.metalness, .2) : 0, glow = material.emissive.getHex() === 0 ? 0 : quantise(material.emissiveIntensity, .1);
      const key = [material.type, material.map?.uuid ?? "none", material.normalMap?.uuid ?? "none", material.emissiveMap?.uuid ?? "none", material instanceof MeshToonMaterial ? material.gradientMap?.uuid ?? "none" : "-", roughness, metalness, glow ? material.emissive.getHex() : 0, glow, standard ? material.envMapIntensity : 0, material.opacity, material.transparent, material.side, standard ? material.flatShading : false, "clearcoat" in material ? material.clearcoat : 0, material.transparent && object.castShadow].join(":");
      let group = groups.get(key);
      if (!group) {
        const batchMaterial = material.clone();
        batchMaterial.color.setRGB(1,1,1); batchMaterial.vertexColors = true; batchMaterial.emissiveIntensity = glow;
        if (batchMaterial instanceof MeshStandardMaterial) { batchMaterial.roughness = roughness; batchMaterial.metalness = metalness; }
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
    const created: Mesh[] = [], ink = outline ? createOutlineMaterial(outline.color, outline.pixels) : null;
    for (const { material,geometries,castShadow } of groups.values()) {
      const geometry = mergeGeometries(geometries, false);
      for (const temporary of geometries) temporary.dispose();
      if (!geometry) { material.dispose(); continue; }
      const mesh = new Mesh(geometry, material); mesh.castShadow = castShadow; mesh.receiveShadow = true;
      target.add(mesh); created.push(mesh);
      if (ink && !material.transparent) {
        const line = new Mesh(geometry, ink); line.userData.outlinePass = true; trackResolution(line);
        target.add(line); created.push(line);
      }
    }
    return () => {
      for (const mesh of created) { target.remove(mesh); if (!mesh.userData.outlinePass) { mesh.geometry.dispose(); (mesh.material as Material).dispose(); } }
      ink?.dispose();
    };
  }, [version]);
  return <><group ref={source} visible={false}>{children}</group><group ref={output} name={name} /></>;
}
