import { BackSide, Color, DataTexture, MeshBasicMaterial, NearestFilter, RedFormat, Vector2, type Mesh, type WebGLRenderer } from "three";

let gradient: DataTexture | null = null;
/** Three-step cel ramp (shadow / mid / lit) shared by every anime-shaded part. */
export function toonGradient(): DataTexture {
  if (gradient) return gradient;
  gradient = new DataTexture(new Uint8Array([150, 212, 255]), 3, 1, RedFormat);
  gradient.minFilter = gradient.magFilter = NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const drawingBuffer = new Vector2();
/**
 * Inverted-hull outline drawn at a constant on-screen width: back faces are pushed out along the
 * projected normal in clip space, so lines stay visible when characters are small on the board.
 */
export function createOutlineMaterial(color: string, pixels: number): MeshBasicMaterial {
  const resolution = { value: new Vector2(1280, 720) };
  const material = new MeshBasicMaterial({ color: new Color(color), side: BackSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.outlineResolution = resolution;
    shader.uniforms.outlinePixels = { value: pixels };
    shader.vertexShader = `uniform vec2 outlineResolution;\nuniform float outlinePixels;\n${shader.vertexShader}`.replace("#include <project_vertex>", `#include <project_vertex>
      vec4 clipNormal = projectionMatrix * modelViewMatrix * vec4(normal, 0.0);
      vec2 screenNormal = length(clipNormal.xy) > 1e-5 ? normalize(clipNormal.xy) : vec2(0.0);
      gl_Position.xy += screenNormal * outlinePixels * 2.0 / outlineResolution * gl_Position.w;`);
  };
  material.customProgramCacheKey = () => "anime-outline";
  material.userData.resolution = resolution;
  return material;
}
/** Keeps an outline mesh's resolution uniform in step with the canvas (including device pixel ratio). */
export function trackResolution(mesh: Mesh): void {
  mesh.onBeforeRender = (renderer: WebGLRenderer) => {
    renderer.getDrawingBufferSize(drawingBuffer);
    const uniform = (mesh.material as MeshBasicMaterial).userData.resolution as { value: Vector2 } | undefined;
    // CSS-pixel resolution so the line width is the same on 1x and 2x displays.
    const ratio = renderer.getPixelRatio();
    uniform?.value.set(drawingBuffer.x / ratio, drawingBuffer.y / ratio);
  };
}
