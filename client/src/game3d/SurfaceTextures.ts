import { CanvasTexture, ImageLoader, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

export type Surface = "plaster" | "stone" | "roof" | "thaiRoof" | "wood" | "terrain" | "water";
const cache = new Map<Surface, Texture>();

function random(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value = (1664525 * value + 1013904223) >>> 0; return value / 4294967296; };
}

/** Photo plaster is warm beige; keep only its light/dark detail so white Santorini walls stay white and every wall colour stays true. */
function neutralise(image: HTMLImageElement): HTMLCanvasElement {
  const size = 1024, canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size), data = pixels.data;
  let mean = 0;
  for (let i = 0; i < data.length; i += 4) mean += data[i]! * .299 + data[i + 1]! * .587 + data[i + 2]! * .114;
  mean /= data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i]! * .299 + data[i + 1]! * .587 + data[i + 2]! * .114, value = Math.max(0, Math.min(255, 236 + (luminance - mean) * .75));
    data[i] = data[i + 1] = data[i + 2] = value;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

/** Small, repeatable material maps add detail without network requests or model downloads. */
export function surfaceTexture(surface: Surface): Texture {
  const cached = cache.get(surface);
  if (cached) return cached;
  if (surface === "plaster" || surface === "thaiRoof") {
    // Start from a neutral swatch so surfaces never flash black while the photo texture downloads;
    // dispose on load because WebGL2 texture storage is immutable and the size changes.
    const swatch = document.createElement("canvas");
    swatch.width = swatch.height = 4;
    const swatchContext = swatch.getContext("2d")!;
    swatchContext.fillStyle = surface === "plaster" ? "#ececec" : "#a9503a"; swatchContext.fillRect(0, 0, 4, 4);
    const texture = new CanvasTexture(swatch);
    new ImageLoader().load(surface === "plaster" ? "/assets/textures/limestone-plaster.png" : "/assets/textures/terracotta-roof.png", image => { texture.image = surface === "plaster" ? neutralise(image) : image; texture.dispose(); texture.needsUpdate = true; });
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = 4;
    cache.set(surface, texture);
    return texture;
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = surface === "terrain" || surface === "water" ? 512 : 256;
  const context = canvas.getContext("2d")!;
  const size = canvas.width;
  const rng = random(9457 + surface.length * 7919);
  const base = surface === "water" ? 218 : surface === "wood" ? 226 : 234;
  context.fillStyle = `rgb(${base},${base},${base})`;
  context.fillRect(0, 0, size, size);
  if (surface === "terrain") for (let i = 0; i < 70; i++) {
    // Soft light/dark patches break up large lawns like uneven sun-bleached grass.
    const x = rng() * size, y = rng() * size, radius = 30 + rng() * 90, light = rng() > .5;
    for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]] as const) {
      const patch = context.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
      patch.addColorStop(0, light ? "rgba(255,255,235,.16)" : "rgba(30,45,20,.13)"); patch.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = patch; context.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2);
    }
  }
  const flecks = surface === "terrain" ? 5200 : surface === "water" ? 1900 : 2200;
  for (let i = 0; i < flecks; i++) {
    const light = rng() > .53;
    context.fillStyle = light ? `rgba(255,255,255,${.025 + rng() * .12})` : `rgba(25,28,29,${.02 + rng() * .1})`;
    const x = rng() * size, y = rng() * size;
    const width = surface === "water" ? 3 + rng() * 22 : 1 + rng() * (surface === "terrain" ? 9 : 4);
    context.fillRect(x, y, width, surface === "water" ? .5 + rng() * 1.6 : 1 + rng() * 3);
  }
  if (surface === "roof" || surface === "wood" || surface === "stone") {
    const rows = surface === "roof" ? 15 : surface === "wood" ? 26 : 10;
    for (let row = 0; row < rows; row++) {
      const y = (row + .5) * size / rows;
      context.strokeStyle = surface === "wood" ? "rgba(59,39,27,.12)" : "rgba(50,44,40,.15)";
      context.lineWidth = surface === "wood" ? 1 : 2;
      context.beginPath(); context.moveTo(0, y); context.lineTo(size, y); context.stroke();
      if (surface !== "wood") for (let col = 0; col < 4; col++) {
        const x = (col + (row % 2) * .5) * size / 4;
        context.beginPath(); context.moveTo(x, y); context.lineTo(x, y + size / rows); context.stroke();
      }
    }
  }
  if (surface === "water") for (let i = 0; i < 75; i++) {
    const x = rng() * size, y = rng() * size;
    context.strokeStyle = `rgba(255,255,255,${.08 + rng() * .2})`;
    context.lineWidth = .8 + rng();
    context.beginPath(); context.ellipse(x, y, 5 + rng() * 24, .6 + rng() * 2, 0, 0, Math.PI); context.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  cache.set(surface, texture);
  return texture;
}

let waterNormal: Texture | null = null;
/** Tileable ripple normal map built from integer-frequency waves, so scrolling it never shows a seam. */
export function waterNormalTexture(): Texture {
  if (waterNormal) return waterNormal;
  const size = 256, canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!, image = context.createImageData(size, size), rng = random(40213);
  // Many wave trains at scattered angles/frequencies so the repeat is hard to spot at grazing angles.
  const waves = Array.from({ length: 30 }, (_, i) => { const angle = rng() * Math.PI * 2, frequency = 2 + i * .9 + rng() * 2; return { fx: Math.round(Math.cos(angle) * frequency), fy: Math.round(Math.sin(angle) * frequency) || 1, phase: rng() * Math.PI * 2, amplitude: 1 / (1 + i * .35) }; });
  const height = (x: number, y: number) => waves.reduce((sum, w) => sum + Math.sin((w.fx * x + w.fy * y) * Math.PI * 2 / size + w.phase) * w.amplitude, 0);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = height(x + 1, y) - height(x - 1, y), dy = height(x, y + 1) - height(x, y - 1);
    const nx = -dx * .45, ny = -dy * .45, length = Math.hypot(nx, ny, 1), offset = (y * size + x) * 4;
    image.data[offset] = (nx / length * .5 + .5) * 255; image.data[offset + 1] = (ny / length * .5 + .5) * 255; image.data[offset + 2] = (1 / length * .5 + .5) * 255; image.data[offset + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.anisotropy = 4;
  waterNormal = texture;
  return texture;
}

export type Facade = "glass" | "glassTeal" | "office";
const facades = new Map<Facade, { map: Texture; emissiveMap: Texture }>();
/** Ribbon-window curtain walls: light spandrel bands over reflective glass, with a scattered subset of rooms lit (emissive map). */
export function facadeTextures(kind: Facade): { map: Texture; emissiveMap: Texture } {
  const cached = facades.get(kind);
  if (cached) return cached;
  const width = 256, height = 512, columns = kind === "office" ? 4 : 6, floors = kind === "office" ? 7 : 10;
  const color = document.createElement("canvas"), glow = document.createElement("canvas");
  color.width = glow.width = width; color.height = glow.height = height;
  const c = color.getContext("2d")!, g = glow.getContext("2d")!, rng = random(kind.length * 3571 + 17);
  const [glassTop, glassBottom, spandrel] = kind === "glassTeal" ? ["#4f9aa3", "#1d4b57", "#e6ebe7"] : kind === "glass" ? ["#5b86ad", "#1f3853", "#e1e5ea"] : ["#6c8796", "#33485a", "#efe7d8"];
  g.fillStyle = "#000"; g.fillRect(0, 0, width, height);
  const floorH = height / floors, cellW = width / columns, band = floorH * .3;
  for (let floor = 0; floor < floors; floor++) {
    const y = floor * floorH, glassY = y + band, glassH = floorH - band;
    c.fillStyle = spandrel; c.fillRect(0, y, width, band);
    c.fillStyle = "rgba(0,0,0,.12)"; c.fillRect(0, y + band - 2, width, 2);
    const gradient = c.createLinearGradient(0, glassY, 0, glassY + glassH);
    gradient.addColorStop(0, glassTop); gradient.addColorStop(1, glassBottom);
    c.fillStyle = gradient; c.fillRect(0, glassY, width, glassH);
    for (let column = 0; column < columns; column++) {
      const x = column * cellW, lit = rng();
      if (lit > .7) {
        const warm = lit > .92 ? "#fff0c9" : lit > .8 ? "#ffd48e" : "#f6b865";
        c.fillStyle = "rgba(255,210,140,.5)"; c.fillRect(x + 2, glassY + 2, cellW - 4, glassH - 4);
        g.fillStyle = warm; g.globalAlpha = .55 + rng() * .45; g.fillRect(x + 2, glassY + 2, cellW - 4, glassH - 4); g.globalAlpha = 1;
      }
      c.fillStyle = "#1b262e"; c.fillRect(x, glassY, 2, glassH);
    }
  }
  // Diagonal sky sheen so the glass reads as reflective even under flat light.
  const sheen = c.createLinearGradient(0, 0, width, height);
  sheen.addColorStop(0, "rgba(255,255,255,0)"); sheen.addColorStop(.45, "rgba(255,255,255,.14)"); sheen.addColorStop(.55, "rgba(255,255,255,0)");
  c.fillStyle = sheen; c.fillRect(0, 0, width, height);
  const make = (canvas: HTMLCanvasElement) => { const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 8; return texture; };
  const result = { map: make(color), emissiveMap: make(glow) };
  facades.set(kind, result);
  return result;
}
