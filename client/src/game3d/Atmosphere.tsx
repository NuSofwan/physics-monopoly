import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BackSide, Color, HalfFloatType, Mesh, PMREMGenerator, PerspectiveCamera, Scene, ShaderMaterial, SphereGeometry, Vector2, Vector3, WebGLRenderTarget, type Camera } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { RenderQuality } from "./RenderQuality";
import { waterNormalTexture } from "./SurfaceTextures";

/** Layer for screen-facing overlays (name badges) that must not cast ambient occlusion. */
export const OVERLAY_LAYER = 1;

export const SKY = { top: "#16385a", mid: "#4f86a6", horizon: "#e9c2a0", ground: "#1c4a5c", sun: "#fff0d6", fog: "#e9c2a0" } as const;
export const SUN_DIRECTION = new Vector3(-6, 14, 8).normalize();

const skyVertex = /* glsl */`
varying vec3 vDirection;
void main() {
  vDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = clip.xyww;
}`;
const skyFragment = /* glsl */`
uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 ground; uniform vec3 sunColor; uniform vec3 sunDirection; uniform float sunDisc;
varying vec3 vDirection;
void main() {
  vec3 d = normalize(vDirection);
  float h = d.y;
  vec3 sky = mix(horizon, mid, smoothstep(0.0, 0.28, h));
  sky = mix(sky, top, smoothstep(0.22, 0.95, h));
  vec3 color = h >= 0.0 ? sky : mix(horizon, ground, smoothstep(0.0, 0.18, -h));
  float sun = max(dot(d, sunDirection), 0.0);
  color += sunColor * (pow(sun, 6.0) * 0.28 + pow(sun, 900.0) * sunDisc);
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function skyMaterial(sunDisc: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: skyVertex, fragmentShader: skyFragment, side: BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new Color(SKY.top) }, mid: { value: new Color(SKY.mid) }, horizon: { value: new Color(SKY.horizon) }, ground: { value: new Color(SKY.ground) },
      sunColor: { value: new Color(SKY.sun) }, sunDirection: { value: SUN_DIRECTION.clone() }, sunDisc: { value: sunDisc },
    },
  });
}

/** Gradient sky dome plus a matching image-based-lighting environment so glass, gold and water reflect the same dusk sky. */
export function SkyAndEnvironment({ intensity = .85, showSky = true }: { intensity?: number; showSky?: boolean }): JSX.Element | null {
  const { gl, scene, camera } = useThree();
  const material = useMemo(() => skyMaterial(1.4), []);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const envScene = new Scene();
    envScene.add(new Mesh(new SphereGeometry(10, 48, 24), skyMaterial(40)));
    const target = pmrem.fromScene(envScene, 0.02, .1, 50);
    const previous = scene.environment, previousIntensity = scene.environmentIntensity;
    scene.environment = target.texture; scene.environmentIntensity = intensity;
    camera.layers.enable(OVERLAY_LAYER);
    envScene.traverse(object => { if (object instanceof Mesh) { object.geometry.dispose(); (object.material as ShaderMaterial).dispose(); } });
    pmrem.dispose();
    return () => { scene.environment = previous; scene.environmentIntensity = previousIntensity; target.dispose(); };
  }, [gl, scene, camera, intensity]);
  useEffect(() => () => material.dispose(), [material]);
  if (!showSky) return null;
  return <mesh material={material} renderOrder={-10} frustumCulled={false} scale={90}><sphereGeometry args={[1, 32, 16]}/></mesh>;
}

/** Scrolls the shared procedural water normal map; every batched water surface ripples together. */
export function WaterMotion({ reducedMotion = false }: { reducedMotion?: boolean }): null {
  useFrame((_state, delta) => {
    if (reducedMotion) return;
    const normal = waterNormalTexture();
    normal.offset.x = (normal.offset.x + delta * .018) % 1;
    normal.offset.y = (normal.offset.y + delta * .011) % 1;
  });
  return null;
}

/** Key/fill lights tuned to sit on top of the sky IBL. */
export function SceneLights({ quality, extent = 11.5 }: { quality: RenderQuality; extent?: number }): JSX.Element {
  const map = quality === "low" ? 1024 : 2048;
  const at = SUN_DIRECTION.clone().multiplyScalar(18);
  return <>
    <hemisphereLight args={["#cfe6ff", "#6b6152", .6]}/>
    <directionalLight castShadow={quality !== "low"} color="#ffd9ad" intensity={2.6} position={[at.x, at.y, at.z]} shadow-mapSize={[map, map]} shadow-camera-left={-extent} shadow-camera-right={extent} shadow-camera-top={extent} shadow-camera-bottom={-extent} shadow-camera-near={2} shadow-camera-far={45} shadow-bias={-.00025} shadow-normalBias={.02}/>
  </>;
}

/** GTAO that ignores overlay-layer sprites so name badges never leave dark halos. */
class OverlaySafeGTAOPass extends GTAOPass {
  private readonly view: Camera;
  constructor(scene: Scene, camera: Camera, width: number, height: number) { super(scene, camera, width, height); this.view = camera; }
  override render(...args: Parameters<GTAOPass["render"]>): void {
    this.view.layers.disable(OVERLAY_LAYER);
    try { super.render(...args); } finally { this.view.layers.enable(OVERLAY_LAYER); }
  }
}

/** High tier only: MSAA scene render → ambient occlusion → bloom on lights/windows → tone-mapped output. */
export function PostEffects(): null {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    if (camera instanceof PerspectiveCamera) {
      const ao = new OverlaySafeGTAOPass(scene, camera, 1, 1);
      ao.updateGtaoMaterial({ radius: .55, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 12, distanceFallOff: .9 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
      ao.blendIntensity = .9;
      composer.addPass(ao);
    }
    composer.addPass(new UnrealBloomPass(new Vector2(256, 256), .42, .5, .92));
    composer.addPass(new OutputPass());
    return composer;
  }, [gl, scene, camera]);
  useEffect(() => { composer.setPixelRatio(gl.getPixelRatio()); composer.setSize(size.width, size.height); }, [composer, gl, size.width, size.height]);
  useEffect(() => {
    gl.info.autoReset = false;
    return () => { gl.info.autoReset = true; for (const pass of composer.passes) pass.dispose(); composer.dispose(); };
  }, [composer, gl]);
  useFrame((_state, delta) => { gl.info.reset(); composer.render(delta); }, 1);
  return null;
}

/** Steps a struggling device down from the high tier: after a warm-up, ~4 s averaging under 28 fps triggers onSlow once. */
export function PerformanceGuard({ onSlow }: { onSlow: () => void }): null {
  const state = useMemo(() => ({ elapsed: 0, frames: 0, slowWindows: 0, done: false }), []);
  useFrame((_state, delta) => {
    if (state.done) return;
    state.elapsed += delta; state.frames++;
    if (state.elapsed < 1) return;
    const fps = state.frames / state.elapsed;
    state.elapsed = 0; state.frames = 0;
    // Hidden tabs throttle to ~1 fps; ignore those samples rather than degrading.
    if (document.visibilityState !== "visible" || fps < 5) return;
    state.slowWindows = fps < 28 ? state.slowWindows + 1 : Math.max(0, state.slowWindows - 1);
    if (state.slowWindows >= 4) { state.done = true; onSlow(); }
  });
  return null;
}
