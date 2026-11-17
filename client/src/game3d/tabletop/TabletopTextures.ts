import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import type { Tile } from "@physics-monopoly/shared";

/**
 * Procedural print/material textures for the tabletop board style. Everything is drawn on canvases
 * at runtime: the board face, money, deeds and card backs are this project's own designs.
 */
export const BOARD_HALF = 8.1;
/** Inner edge of the ring of spaces (world units from the centre). */
export const RING_INNER = 5.25;
/** Outer edge of the ring of spaces. */
export const RING_OUTER = 7.85;
export const THAI_FONT = '"Noto Sans Thai", "Leelawadee UI", "Leelawadee", Tahoma, sans-serif';

const INK = "#1d2a3a", PAPER = "#f1e8d2", GOLD = "#b8892f", NAVY = "#14243a";

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement("canvas");
  element.width = width; element.height = height;
  return [element, element.getContext("2d")!];
}
function finish(element: HTMLCanvasElement, anisotropy = 8): CanvasTexture {
  const texture = new CanvasTexture(element);
  texture.colorSpace = SRGBColorSpace; texture.anisotropy = anisotropy; texture.minFilter = LinearMipmapLinearFilter;
  return texture;
}
/** Deterministic PRNG so textures look identical on every client. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}
function paperGrain(context: CanvasRenderingContext2D, width: number, height: number, amount: number, seed: number): void {
  const next = random(seed);
  for (let i = 0; i < width * height / 90; i++) {
    const shade = next() < .5 ? 0 : 255;
    context.fillStyle = `rgba(${shade},${shade},${shade},${next() * amount})`;
    context.fillRect(next() * width, next() * height, 1 + next() * 2, 1 + next() * 2);
  }
}
function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight = 700): number {
  let font = size;
  do { context.font = `${weight} ${font}px ${THAI_FONT}`; font -= 2; } while (context.measureText(text).width > maxWidth && font > 10);
  return font + 2;
}
/** Splits a Thai label into at most two balanced lines when it is too wide. */
function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (context.measureText(text).width <= maxWidth) return [text];
  const chars = Array.from(text);
  let best = Math.ceil(chars.length / 2);
  const space = text.indexOf(" ");
  if (space > 0) best = Array.from(text.slice(0, space)).length;
  return [chars.slice(0, best).join("").trim(), chars.slice(best).join("").trim()];
}

// ───────────────────────────── Table ─────────────────────────────

let woodCache: Texture | null = null;
/** Polished dark walnut planks with flowing grain, knots and lacquer variation. Repeats seamlessly along planks. */
export function walnutTexture(): Texture {
  if (woodCache) return woodCache;
  const W = 1024, H = 1024, [element, context] = canvas(W, H), next = random(77);
  const planks = 4, plankH = H / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * plankH, hue = 22 + next() * 6, light = 17 + next() * 7;
    const base = context.createLinearGradient(0, y0, 0, y0 + plankH);
    base.addColorStop(0, `hsl(${hue},48%,${light + 2}%)`); base.addColorStop(.5, `hsl(${hue},52%,${light + 5}%)`); base.addColorStop(1, `hsl(${hue},46%,${light}%)`);
    context.fillStyle = base; context.fillRect(0, y0, W, plankH);
    // Long grain lines: sums of sines give a natural meander; periodic in x so the texture tiles.
    const lines = 70;
    for (let l = 0; l < lines; l++) {
      const yBase = y0 + next() * plankH, amp = 3 + next() * 12, phase = next() * Math.PI * 2, f1 = 1 + Math.floor(next() * 3), f2 = 3 + Math.floor(next() * 4);
      const dark = next() < .6;
      context.strokeStyle = dark ? `rgba(18,8,3,${.12 + next() * .28})` : `rgba(160,98,52,${.06 + next() * .12})`;
      context.lineWidth = .6 + next() * 2.2;
      context.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const t = x / W * Math.PI * 2;
        const y = yBase + Math.sin(t * f1 + phase) * amp + Math.sin(t * f2 + phase * 2) * amp * .25;
        if (x === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
    }
    // Cathedral grain arches and a couple of knots.
    for (let k = 0; k < 2; k++) {
      const kx = next() * W, ky = y0 + plankH * (.3 + next() * .4);
      for (let r = 0; r < 9; r++) {
        context.strokeStyle = `rgba(20,9,4,${.32 - r * .03})`; context.lineWidth = 1.2;
        context.beginPath(); context.ellipse(kx, ky, 10 + r * 9, 3 + r * 2.4, 0, 0, Math.PI * 2); context.stroke();
      }
      context.fillStyle = "rgba(15,6,2,.55)"; context.beginPath(); context.ellipse(kx, ky, 8, 3, 0, 0, Math.PI * 2); context.fill();
    }
    // Plank seam.
    context.fillStyle = "rgba(6,3,1,.85)"; context.fillRect(0, y0, W, 3);
    context.fillStyle = "rgba(140,90,50,.18)"; context.fillRect(0, y0 + 3, W, 1);
  }
  paperGrain(context, W, H, .05, 5);
  const texture = finish(element, 16);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  woodCache = texture;
  return texture;
}

// ───────────────────────────── Board face ─────────────────────────────

type Draw = (context: CanvasRenderingContext2D, unit: number) => void;

function icon(context: CanvasRenderingContext2D, kind: Tile["type"], unit: number, color: string): void {
  context.save(); context.strokeStyle = color; context.fillStyle = color; context.lineWidth = unit * .035; context.lineCap = "round"; context.lineJoin = "round";
  const r = unit * .26;
  if (kind === "challenge") {
    // Atom with a question mark nucleus.
    for (let i = 0; i < 3; i++) { context.beginPath(); context.ellipse(0, 0, r, r * .36, i * Math.PI / 3, 0, Math.PI * 2); context.stroke(); }
    context.beginPath(); context.arc(0, 0, r * .3, 0, Math.PI * 2); context.fill();
    context.fillStyle = PAPER; context.font = `900 ${r * .48}px ${THAI_FONT}`; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText("?", 0, r * .03);
  } else if (kind === "chance") {
    // Light bulb.
    context.beginPath(); context.arc(0, -r * .25, r * .55, Math.PI * .8, Math.PI * 2.2); context.lineTo(r * .25, r * .45); context.lineTo(-r * .25, r * .45); context.closePath(); context.stroke();
    for (let i = 0; i < 3; i++) { context.beginPath(); context.moveTo(-r * .25, r * (.58 + i * .14)); context.lineTo(r * .25, r * (.58 + i * .14)); context.stroke(); }
    context.beginPath(); context.moveTo(-r * .15, r * .3); context.lineTo(-r * .08, -r * .25); context.lineTo(0, -r * .05); context.lineTo(r * .08, -r * .25); context.lineTo(r * .15, r * .3); context.stroke();
    for (let i = 0; i < 5; i++) { const a = -Math.PI * .9 + i * Math.PI * .2; context.beginPath(); context.moveTo(Math.cos(a) * r * .75, -r * .25 + Math.sin(a) * r * .75); context.lineTo(Math.cos(a) * r * .95, -r * .25 + Math.sin(a) * r * .95); context.stroke(); }
  } else if (kind === "tax") {
    // Stacked coins with a baht sign.
    for (let i = 2; i >= 0; i--) { context.beginPath(); context.ellipse(0, r * .3 - i * r * .22, r * .6, r * .22, 0, 0, Math.PI * 2); context.fillStyle = PAPER; context.fill(); context.stroke(); }
    context.fillStyle = color; context.font = `900 ${r * .5}px ${THAI_FONT}`; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText("฿", 0, -r * .15);
  }
  context.restore();
}

function drawSpace(context: CanvasRenderingContext2D, tile: Tile, unit: number): void {
  // Local frame: x along the edge (−0.875…0.875), y = outward (−0.875 inner … 1.725 outer).
  const w = 1.75 * unit, x0 = -.875 * unit, yIn = -.875 * unit, yOut = 1.725 * unit;
  context.fillStyle = PAPER; context.fillRect(x0, yIn, w, yOut - yIn);
  context.textAlign = "center"; context.textBaseline = "middle";
  if (tile.type === "property") {
    const band = tile.groupColor ?? "#888";
    context.fillStyle = band; context.fillRect(x0, yIn, w, .52 * unit);
    // Printed sheen line and inner shadow on the colour band.
    context.fillStyle = "rgba(255,255,255,.18)"; context.fillRect(x0, yIn + .03 * unit, w, .05 * unit);
    context.fillStyle = "rgba(0,0,0,.25)"; context.fillRect(x0, yIn + .5 * unit, w, .02 * unit);
    context.fillStyle = INK;
    const size = fitText(context, tile.name, w * .9, unit * .2);
    const lines = size < unit * .15 ? (context.font = `700 ${unit * .17}px ${THAI_FONT}`, wrap(context, tile.name, w * .9)) : [tile.name];
    lines.forEach((line, i) => context.fillText(line, 0, -.17 * unit + (i - (lines.length - 1) / 2) * unit * .2, w * .92));
    const kind = { land: "ที่ดิน", house: "บ้าน", condo: "คอนโด", hotel: "โรงแรม" }[tile.kind ?? "land"];
    context.font = `500 ${unit * .1}px ${THAI_FONT}`; context.fillStyle = "rgba(29,42,58,.62)"; context.fillText(kind, 0, .09 * unit);
    context.font = `700 ${unit * .17}px ${THAI_FONT}`; context.fillStyle = INK; context.fillText(`฿${(tile.price ?? 0).toLocaleString("en-US")}`, 0, 1.52 * unit);
  } else {
    const accent = tile.type === "challenge" ? "#6b3fb5" : tile.type === "chance" ? "#0f7f74" : "#8a6a1e";
    context.save(); context.translate(0, .55 * unit); icon(context, tile.type, unit * 1.45, accent); context.restore();
    context.fillStyle = accent; fitText(context, tile.name, w * .9, unit * .19);
    context.fillText(tile.name, 0, -.5 * unit);
    if (tile.type === "tax" && tile.price) { context.font = `700 ${unit * .16}px ${THAI_FONT}`; context.fillStyle = INK; context.fillText(`จ่าย ฿${tile.price.toLocaleString("en-US")}`, 0, 1.52 * unit); }
    if (tile.type === "challenge") { context.font = `500 ${unit * .1}px ${THAI_FONT}`; context.fillStyle = "rgba(29,42,58,.7)"; context.fillText(tile.failPenalty === "jail" ? "ตอบผิด → ติดคุก" : "ตอบผิด → หยุด 1 ตา", 0, 1.52 * unit); }
    if (tile.type === "chance") { context.font = `500 ${unit * .1}px ${THAI_FONT}`; context.fillStyle = "rgba(29,42,58,.7)"; context.fillText("หยิบการ์ดโอกาส", 0, 1.52 * unit); }
  }
  context.strokeStyle = INK; context.lineWidth = unit * .018; context.strokeRect(x0, yIn, w, yOut - yIn);
}

function drawCorner(context: CanvasRenderingContext2D, tile: Tile, unit: number): void {
  // Square of side 2.6 with the outer corner at (+1.3,+1.3) after the caller rotates.
  const s = 2.6 * unit, h = s / 2;
  context.fillStyle = PAPER; context.fillRect(-h, -h, s, s);
  context.save(); context.rotate(-Math.PI / 4);
  context.textAlign = "center"; context.textBaseline = "middle";
  const label = (text: string, y: number, size: number, color = INK, weight = 800) => { context.fillStyle = color; context.font = `${weight} ${size * unit}px ${THAI_FONT}`; context.fillText(text, 0, y * unit, s * .95); };
  if (tile.type === "start") {
    // Orbit arrow around a glowing nucleus — the board's own start mark.
    context.strokeStyle = "#b3261e"; context.lineWidth = unit * .1; context.lineCap = "round";
    context.beginPath(); context.ellipse(0, .1 * unit, .95 * unit, .42 * unit, 0, Math.PI * .15, Math.PI * 1.85); context.stroke();
    const ax = Math.cos(Math.PI * .15) * .95 * unit, ay = .1 * unit + Math.sin(Math.PI * .15) * .42 * unit;
    context.fillStyle = "#b3261e"; context.beginPath(); context.moveTo(ax + .22 * unit, ay - .05 * unit); context.lineTo(ax - .12 * unit, ay - .22 * unit); context.lineTo(ax - .05 * unit, ay + .18 * unit); context.closePath(); context.fill();
    label("START", .12, .42, "#b3261e", 900);
    label("ผ่านรับ ฿2,000", .78, .16);
  } else if (tile.type === "jail") {
    context.fillStyle = "#e6833a"; context.fillRect(-.62 * unit, -.75 * unit, 1.24 * unit, 1.05 * unit);
    context.fillStyle = INK; for (let i = 0; i < 6; i++) context.fillRect((-.55 + i * .22) * unit, -.75 * unit, .06 * unit, 1.05 * unit);
    context.fillRect(-.62 * unit, -.75 * unit, 1.24 * unit, .07 * unit); context.fillRect(-.62 * unit, .23 * unit, 1.24 * unit, .07 * unit);
    label("คุก", .58, .32, INK, 900);
    label("แวะเยี่ยมชมได้", .9, .14, "rgba(29,42,58,.75)", 600);
  } else if (tile.type === "freeParking") {
    for (let i = 0; i < 5; i++) { context.fillStyle = i % 2 ? "#d4a631" : "#e9c25a"; context.beginPath(); context.ellipse((i - 2) * .05 * unit, (.15 - i * .12) * unit, .5 * unit, .17 * unit, 0, 0, Math.PI * 2); context.fill(); context.strokeStyle = "#8a6a1e"; context.lineWidth = unit * .02; context.stroke(); }
    label("฿", -.48, .26, "#8a6a1e", 900);
    label("กองกลาง", .55, .32, INK, 900);
    label("เก็บเงินกองกลาง", .88, .14, "rgba(29,42,58,.75)", 600);
  } else {
    context.strokeStyle = "#1f5e9a"; context.lineWidth = unit * .07;
    context.beginPath(); context.arc(-.3 * unit, -.2 * unit, .28 * unit, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.arc(.3 * unit, -.2 * unit, .28 * unit, 0, Math.PI * 2); context.stroke();
    context.fillStyle = "#1f5e9a"; context.fillRect(-.06 * unit, -.24 * unit, .12 * unit, .08 * unit);
    label("ไปคุก", .5, .34, "#1f5e9a", 900);
    label("เดินตรงไปที่คุกทันที", .86, .14, "rgba(29,42,58,.75)", 600);
  }
  context.restore();
  context.strokeStyle = INK; context.lineWidth = unit * .02; context.strokeRect(-h, -h, s, s);
}

function atomEmblem(context: CanvasRenderingContext2D, radius: number): void {
  context.save();
  const glow = context.createRadialGradient(0, 0, 0, 0, 0, radius * 1.25);
  glow.addColorStop(0, "rgba(232,190,92,.35)"); glow.addColorStop(1, "rgba(232,190,92,0)");
  context.fillStyle = glow; context.beginPath(); context.arc(0, 0, radius * 1.25, 0, Math.PI * 2); context.fill();
  context.strokeStyle = GOLD; context.lineWidth = radius * .045;
  for (let i = 0; i < 3; i++) { context.beginPath(); context.ellipse(0, 0, radius, radius * .34, i * Math.PI / 3, 0, Math.PI * 2); context.stroke(); }
  for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + .9; context.fillStyle = "#e9c46a"; context.beginPath(); context.arc(Math.cos(a) * radius * Math.cos(i * Math.PI / 3) - Math.sin(a) * radius * .34 * Math.sin(i * Math.PI / 3), Math.cos(a) * radius * Math.sin(i * Math.PI / 3) + Math.sin(a) * radius * .34 * Math.cos(i * Math.PI / 3), radius * .07, 0, Math.PI * 2); context.fill(); }
  const core = context.createRadialGradient(-radius * .05, -radius * .05, 0, 0, 0, radius * .2);
  core.addColorStop(0, "#fff1c4"); core.addColorStop(1, "#c4902f");
  context.fillStyle = core; context.beginPath(); context.arc(0, 0, radius * .18, 0, Math.PI * 2); context.fill();
  context.restore();
}

/** Card-deck slots printed on the board (world centre, rotation), shared with the 3D deck meshes. */
export const DECK_SLOTS: ReadonlyArray<{ x: number; z: number; rotation: number; kind: "question" | "chance" }> = [
  { x: -3.3, z: -3.3, rotation: Math.PI / 4, kind: "question" },
  { x: 3.3, z: 3.3, rotation: Math.PI / 4 + Math.PI, kind: "chance" },
];
export const DECK_SIZE: [number, number] = [2.1, 1.4];

function drawCentre(context: CanvasRenderingContext2D, unit: number, title: string, subtitle: string): void {
  const r = RING_INNER * unit;
  // Deep navy field with a gold pinstripe frame and a faint blueprint grid.
  context.fillStyle = NAVY; context.fillRect(-r, -r, r * 2, r * 2);
  context.strokeStyle = "rgba(120,160,210,.08)"; context.lineWidth = unit * .01;
  for (let g = -r; g <= r; g += unit * .5) { context.beginPath(); context.moveTo(g, -r); context.lineTo(g, r); context.stroke(); context.beginPath(); context.moveTo(-r, g); context.lineTo(r, g); context.stroke(); }
  const vignette = context.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.45);
  vignette.addColorStop(0, "rgba(40,70,110,.35)"); vignette.addColorStop(1, "rgba(0,0,0,.45)");
  context.fillStyle = vignette; context.fillRect(-r, -r, r * 2, r * 2);
  context.strokeStyle = GOLD; context.lineWidth = unit * .05; context.strokeRect(-r + unit * .18, -r + unit * .18, r * 2 - unit * .36, r * 2 - unit * .36);
  context.lineWidth = unit * .015; context.strokeRect(-r + unit * .3, -r + unit * .3, r * 2 - unit * .6, r * 2 - unit * .6);
  // Faint formulas in the background give the physics identity.
  context.save(); context.fillStyle = "rgba(233,196,106,.1)"; context.font = `italic 600 ${unit * .3}px Georgia, serif`; context.textAlign = "center";
  const formulas = ["F = ma", "E = mc²", "v = u + at", "V = IR", "λ = h/p", "PV = nRT", "Q = mcΔT", "n₁sinθ₁ = n₂sinθ₂"];
  formulas.forEach((formula, i) => { const a = i / formulas.length * Math.PI * 2 + .3; context.save(); context.translate(Math.cos(a) * r * .72, Math.sin(a) * r * .72); context.rotate(a + Math.PI / 2); context.fillText(formula, 0, 0); context.restore(); });
  context.restore();
  // Printed deck slots.
  for (const slot of DECK_SLOTS) {
    context.save(); context.translate(slot.x * unit, slot.z * unit); context.rotate(-slot.rotation);
    const [dw, dh] = DECK_SIZE;
    context.setLineDash([unit * .1, unit * .07]); context.strokeStyle = "rgba(233,196,106,.75)"; context.lineWidth = unit * .03;
    context.strokeRect(-dw / 2 * unit - unit * .12, -dh / 2 * unit - unit * .12, dw * unit + unit * .24, dh * unit + unit * .24);
    context.setLineDash([]);
    context.fillStyle = "rgba(233,196,106,.85)"; context.font = `700 ${unit * .18}px ${THAI_FONT}`; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(slot.kind === "question" ? "การ์ดโจทย์ฟิสิกส์" : "การ์ดโอกาส", 0, dh / 2 * unit + unit * .38);
    context.restore();
  }
  // Diagonal title lock-up.
  context.save(); context.rotate(-Math.PI / 4);
  atomEmblem(context, unit * 1.05);
  context.textAlign = "center"; context.textBaseline = "middle";
  const size = fitText(context, title, r * 1.6, unit * .95, 900);
  context.font = `900 ${size}px ${THAI_FONT}`;
  context.lineJoin = "round"; context.lineWidth = unit * .1; context.strokeStyle = "#0a1220"; context.strokeText(title, 0, unit * 1.75);
  const goldFill = context.createLinearGradient(0, unit * 1.3, 0, unit * 2.2);
  goldFill.addColorStop(0, "#fbe7a1"); goldFill.addColorStop(.5, "#e3b44f"); goldFill.addColorStop(1, "#9c6b1f");
  context.fillStyle = goldFill; context.fillText(title, 0, unit * 1.75);
  context.font = `700 ${unit * .26}px ${THAI_FONT}`; context.fillStyle = "rgba(241,232,210,.88)";
  context.fillText(subtitle, 0, unit * 2.55, r * 1.5);
  context.font = `600 ${unit * .2}px Georgia, serif`; context.fillStyle = "rgba(233,196,106,.7)";
  context.fillText("P H Y S I C S   T Y C O O N", 0, -unit * 1.55);
  context.restore();
}

/** Corner tiles sit at the board corners; their square spans RING_INNER…RING_OUTER on both axes. */
const CORNERS: Record<number, [number, number]> = { 0: [1, 1], 7: [-1, 1], 14: [-1, -1], 21: [1, -1] };

/**
 * Prints the whole board onto one canvas: paper stock, ring of spaces (colour bands, Thai names,
 * prices, icons), corner squares, navy centre with title and printed deck slots, a fold line and wear.
 * Canvas pixel (px,py) maps to world (x,z) = (px/S·2B − B, py/S·2B − B).
 */
export function boardFaceTexture(tiles: Tile[], title: string, subtitle: string, size: number, positionOf: (index: number) => [number, number, number]): CanvasTexture {
  const [element, context] = canvas(size, size), unit = size / (BOARD_HALF * 2);
  context.fillStyle = "#e9dfc6"; context.fillRect(0, 0, size, size);
  paperGrain(context, size, size, .05, 11);
  context.save(); context.translate(size / 2, size / 2);
  // Outer navy border with gold inlay.
  const edge = BOARD_HALF * unit;
  context.fillStyle = NAVY; context.fillRect(-edge, -edge, edge * 2, edge * 2);
  context.fillStyle = PAPER; context.fillRect(-RING_OUTER * unit, -RING_OUTER * unit, RING_OUTER * 2 * unit, RING_OUTER * 2 * unit);
  context.strokeStyle = GOLD; context.lineWidth = unit * .03; context.strokeRect(-(BOARD_HALF - .12) * unit, -(BOARD_HALF - .12) * unit, (BOARD_HALF - .12) * 2 * unit, (BOARD_HALF - .12) * 2 * unit);
  drawCentre(context, unit, title, subtitle);
  for (const tile of tiles) {
    const corner = CORNERS[tile.index];
    context.save();
    if (corner) {
      const c = (RING_INNER + RING_OUTER) / 2;
      context.translate(corner[0] * c * unit, corner[1] * c * unit);
      // Rotate so the corner's diagonal text reads from the outside corner.
      context.rotate(Math.atan2(corner[1], corner[0]) - Math.PI / 4);
      drawCorner(context, tile, unit);
    } else {
      const [x, z, rotation] = positionOf(tile.index);
      context.translate(x * unit, z * unit); context.rotate(-rotation);
      drawSpace(context, tile, unit);
    }
    context.restore();
  }
  context.strokeStyle = INK; context.lineWidth = unit * .03;
  context.strokeRect(-RING_OUTER * unit, -RING_OUTER * unit, RING_OUTER * 2 * unit, RING_OUTER * 2 * unit);
  context.strokeRect(-RING_INNER * unit, -RING_INNER * unit, RING_INNER * 2 * unit, RING_INNER * 2 * unit);
  context.restore();
  // Board fold line + gentle edge wear: the details that make printed cardboard read as real.
  const fold = context.createLinearGradient(size / 2 - 6, 0, size / 2 + 6, 0);
  fold.addColorStop(0, "rgba(0,0,0,0)"); fold.addColorStop(.5, "rgba(0,0,0,.18)"); fold.addColorStop(1, "rgba(255,255,255,.05)");
  context.fillStyle = fold; context.fillRect(size / 2 - 6, 0, 12, size);
  const wear = context.createRadialGradient(size / 2, size / 2, size * .35, size / 2, size / 2, size * .75);
  wear.addColorStop(0, "rgba(90,60,20,0)"); wear.addColorStop(1, "rgba(90,60,20,.16)");
  context.fillStyle = wear; context.fillRect(0, 0, size, size);
  return finish(element, 16);
}

// ───────────────────────────── Money, deeds, decks ─────────────────────────────

export const BILLS: ReadonlyArray<{ value: number; color: string; ink: string }> = [
  { value: 100, color: "#dcd4ee", ink: "#4f3f86" },
  { value: 500, color: "#c4e4e6", ink: "#1f6470" },
  { value: 1000, color: "#ecd7bf", ink: "#7a4a22" },
  { value: 5000, color: "#d3dcb8", ink: "#4d5d22" },
  { value: 10000, color: "#efc9d6", ink: "#8a2f52" },
  { value: 20000, color: "#e6dcae", ink: "#6e5a14" },
];
/** Atlas: one banknote per row (6 rows), each 2.3:1. */
export function billAtlas(): CanvasTexture {
  const W = 512, rowH = 222, [element, context] = canvas(W, rowH * BILLS.length);
  BILLS.forEach((bill, i) => {
    const y = i * rowH;
    context.fillStyle = bill.color; context.fillRect(0, y, W, rowH);
    paperGrain(context, W, rowH, .06, 30 + i);
    context.strokeStyle = bill.ink; context.lineWidth = 6; context.strokeRect(14, y + 14, W - 28, rowH - 28);
    context.lineWidth = 1.5; context.strokeRect(24, y + 24, W - 48, rowH - 48);
    // Guilloche rosette.
    context.save(); context.translate(W / 2, y + rowH / 2); context.strokeStyle = `${bill.ink}55`; context.lineWidth = 1.2;
    for (let k = 0; k < 18; k++) { context.beginPath(); context.ellipse(0, 0, 70, 24, k * Math.PI / 18, 0, Math.PI * 2); context.stroke(); }
    context.restore();
    context.fillStyle = bill.ink; context.textAlign = "center"; context.textBaseline = "middle";
    context.font = `900 64px ${THAI_FONT}`; context.fillText(`฿${bill.value.toLocaleString("en-US")}`, W / 2, y + rowH / 2 + 4);
    context.font = `700 26px ${THAI_FONT}`; context.fillText(String(bill.value), 64, y + 52); context.fillText(String(bill.value), W - 64, y + rowH - 50);
    context.font = `600 18px ${THAI_FONT}`; context.fillText("ธนาคารเศรษฐีฟิสิกส์", W / 2, y + 42);
  });
  return finish(element);
}

/** Atlas of title-deed cards (5 columns), each 0.62:1. */
export function deedAtlas(deeds: Tile[]): CanvasTexture {
  const cw = 248, ch = 400, [element, context] = canvas(cw * deeds.length, ch);
  deeds.forEach((tile, i) => {
    const x = i * cw;
    context.fillStyle = "#f8f4ea"; context.fillRect(x, 0, cw, ch);
    paperGrain(context, cw, ch, .04, 50 + i);
    context.strokeStyle = INK; context.lineWidth = 3; context.strokeRect(x + 10, 10, cw - 20, ch - 20);
    context.fillStyle = tile.groupColor ?? "#888"; context.fillRect(x + 18, 18, cw - 36, 92);
    context.strokeRect(x + 18, 18, cw - 36, 92);
    context.fillStyle = "#fff"; context.textAlign = "center"; context.textBaseline = "middle";
    context.font = `600 15px ${THAI_FONT}`; context.fillText("โฉนดที่ดิน", x + cw / 2, 40);
    fitText(context, tile.name, cw - 50, 30, 800); context.fillText(tile.name, x + cw / 2, 78);
    context.fillStyle = INK; context.font = `500 17px ${THAI_FONT}`;
    const rows = ["ค่าเช่า ที่ดิน", "บ้าน", "คอนโด", "โรงแรม"];
    (tile.rentByLevel ?? []).forEach((rent, r) => {
      context.textAlign = "left"; context.fillText(rows[r] ?? "", x + 28, 142 + r * 40);
      context.textAlign = "right"; context.fillText(`฿${rent.toLocaleString("en-US")}`, x + cw - 28, 142 + r * 40);
    });
    context.fillStyle = "rgba(29,42,58,.25)"; context.fillRect(x + 28, 312, cw - 56, 2);
    context.textAlign = "center"; context.fillStyle = INK; context.font = `700 20px ${THAI_FONT}`;
    context.fillText(`ราคา ฿${(tile.price ?? 0).toLocaleString("en-US")}`, x + cw / 2, 345);
  });
  return finish(element);
}

const deckDraw: Record<"question" | "chance", Draw> = {
  question: (context, unit) => {
    const g = context.createLinearGradient(-unit, -unit, unit, unit); g.addColorStop(0, "#5a2ea6"); g.addColorStop(1, "#2c1460");
    context.fillStyle = g; context.fillRect(-unit, -unit * .667, unit * 2, unit * 1.333);
    context.strokeStyle = "#e9c46a"; context.lineWidth = unit * .03; context.strokeRect(-unit * .9, -unit * .58, unit * 1.8, unit * 1.16);
    context.save(); context.translate(-unit * .45, 0); atomEmblem(context, unit * .32); context.restore();
    context.fillStyle = "#f6e7c1"; context.textAlign = "center"; context.textBaseline = "middle";
    context.font = `900 ${unit * .2}px ${THAI_FONT}`; context.fillText("โจทย์", unit * .35, -unit * .1);
    context.font = `900 ${unit * .2}px ${THAI_FONT}`; context.fillText("ฟิสิกส์", unit * .35, unit * .17);
  },
  chance: (context, unit) => {
    const g = context.createLinearGradient(-unit, -unit, unit, unit); g.addColorStop(0, "#1fa093"); g.addColorStop(1, "#0b5a52");
    context.fillStyle = g; context.fillRect(-unit, -unit * .667, unit * 2, unit * 1.333);
    context.strokeStyle = "#fff4dc"; context.lineWidth = unit * .03; context.strokeRect(-unit * .9, -unit * .58, unit * 1.8, unit * 1.16);
    context.save(); context.translate(-unit * .45, unit * .02); icon(context, "chance", unit * 1.3, "#fff4dc"); context.restore();
    context.fillStyle = "#fff4dc"; context.textAlign = "center"; context.textBaseline = "middle";
    context.font = `900 ${unit * .26}px ${THAI_FONT}`; context.fillText("โอกาส", unit * .35, 0);
  },
};
/** Two card backs side by side (u 0–0.5 question, 0.5–1 chance). */
export function deckAtlas(): CanvasTexture {
  const unit = 256, [element, context] = canvas(unit * 4, Math.round(unit * 1.333));
  (["question", "chance"] as const).forEach((kind, i) => { context.save(); context.translate(unit + i * unit * 2, unit * .667); deckDraw[kind](context, unit); context.restore(); });
  return finish(element);
}
