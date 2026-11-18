import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture } from "three";
import type { Tile } from "@physics-monopoly/shared";

/**
 * Procedural print/material textures for the tabletop board style. Everything is drawn on canvases
 * at runtime: the board face, money, deeds, mortgaged sign and card backs are this project's own designs.
 */
export const BOARD_HALF = 8.1;
/** Inner edge of the ring of spaces (world units from the centre). */
export const RING_INNER = 5.25;
/** Outer edge of the ring of spaces. */
export const RING_OUTER = 7.85;
export const THAI_FONT = '"Noto Sans Thai", "Leelawadee UI", "Leelawadee", Tahoma, sans-serif';

const INK = "#192330", PAPER = "#efe6d0", GOLD = "#c89632", NAVY = "#101e33", CRIMSON = "#b9221d";

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
    const y0 = p * plankH, hue = 20 + next() * 6, light = 15 + next() * 7;
    const base = context.createLinearGradient(0, y0, 0, y0 + plankH);
    base.addColorStop(0, `hsl(${hue},50%,${light + 2}%)`); base.addColorStop(.5, `hsl(${hue},54%,${light + 5}%)`); base.addColorStop(1, `hsl(${hue},48%,${light}%)`);
    context.fillStyle = base; context.fillRect(0, y0, W, plankH);
    // Long grain lines: sums of sines give a natural meander; periodic in x so the texture tiles.
    const lines = 85;
    for (let l = 0; l < lines; l++) {
      const yBase = y0 + next() * plankH, amp = 3 + next() * 13, phase = next() * Math.PI * 2, f1 = 1 + Math.floor(next() * 3), f2 = 3 + Math.floor(next() * 4);
      const dark = next() < .62;
      context.strokeStyle = dark ? `rgba(14,6,2,${.14 + next() * .32})` : `rgba(175,110,60,${.07 + next() * .13})`;
      context.lineWidth = .6 + next() * 2.3;
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
      for (let r = 0; r < 10; r++) {
        context.strokeStyle = `rgba(18,8,3,${.34 - r * .03})`; context.lineWidth = 1.25;
        context.beginPath(); context.ellipse(kx, ky, 10 + r * 9, 3 + r * 2.4, 0, 0, Math.PI * 2); context.stroke();
      }
      context.fillStyle = "rgba(12,5,2,.6)"; context.beginPath(); context.ellipse(kx, ky, 8, 3, 0, 0, Math.PI * 2); context.fill();
    }
    // Plank seam.
    context.fillStyle = "rgba(5,2,1,.88)"; context.fillRect(0, y0, W, 3);
    context.fillStyle = "rgba(160,105,58,.22)"; context.fillRect(0, y0 + 3, W, 1);
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
  context.save(); context.strokeStyle = color; context.fillStyle = color; context.lineWidth = unit * .038; context.lineCap = "round"; context.lineJoin = "round";
  const r = unit * .27;
  if (kind === "challenge") {
    // Atom with a question mark nucleus.
    for (let i = 0; i < 3; i++) { context.beginPath(); context.ellipse(0, 0, r, r * .36, i * Math.PI / 3, 0, Math.PI * 2); context.stroke(); }
    context.beginPath(); context.arc(0, 0, r * .32, 0, Math.PI * 2); context.fill();
    context.fillStyle = PAPER; context.font = `900 ${r * .5}px ${THAI_FONT}`; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText("?", 0, r * .03);
  } else if (kind === "chance") {
    // Bold question mark / light bulb crest.
    context.beginPath(); context.arc(0, -r * .25, r * .55, Math.PI * .8, Math.PI * 2.2); context.lineTo(r * .25, r * .45); context.lineTo(-r * .25, r * .45); context.closePath(); context.stroke();
    for (let i = 0; i < 3; i++) { context.beginPath(); context.moveTo(-r * .25, r * (.58 + i * .14)); context.lineTo(r * .25, r * (.58 + i * .14)); context.stroke(); }
    context.beginPath(); context.moveTo(-r * .15, r * .3); context.lineTo(-r * .08, -r * .25); context.lineTo(0, -r * .05); context.lineTo(r * .08, -r * .25); context.lineTo(r * .15, r * .3); context.stroke();
    for (let i = 0; i < 5; i++) { const a = -Math.PI * .9 + i * Math.PI * .2; context.beginPath(); context.moveTo(Math.cos(a) * r * .75, -r * .25 + Math.sin(a) * r * .75); context.lineTo(Math.cos(a) * r * .95, -r * .25 + Math.sin(a) * r * .95); context.stroke(); }
  } else if (kind === "tax") {
    // Diamond & stacked coins with a baht sign.
    for (let i = 2; i >= 0; i--) { context.beginPath(); context.ellipse(0, r * .3 - i * r * .22, r * .6, r * .22, 0, 0, Math.PI * 2); context.fillStyle = PAPER; context.fill(); context.stroke(); }
    context.fillStyle = color; context.font = `900 ${r * .5}px ${THAI_FONT}`; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText("฿", 0, -r * .15);
  }
  context.restore();
}

function drawSpace(context: CanvasRenderingContext2D, tile: Tile, unit: number): void {
  // Local frame: x along the edge (−0.875…0.875), y = outward (−0.875 inner … 1.725 outer).
  const w = 1.75 * unit, x0 = -.875 * unit, yIn = -.875 * unit, yOut = 1.725 * unit;
  const g = context.createLinearGradient(0, yIn, 0, yOut);
  g.addColorStop(0, "#f5eee0"); g.addColorStop(1, "#e8dec6");
  context.fillStyle = g; context.fillRect(x0, yIn, w, yOut - yIn);
  context.textAlign = "center"; context.textBaseline = "middle";
  if (tile.type === "property") {
    const band = tile.groupColor ?? "#888";
    context.fillStyle = band; context.fillRect(x0, yIn, w, .54 * unit);
    // Embossed gold/black header border and printed sheen on the colour band.
    context.fillStyle = "rgba(255,255,255,.24)"; context.fillRect(x0, yIn + .02 * unit, w, .06 * unit);
    context.fillStyle = "rgba(0,0,0,.32)"; context.fillRect(x0, yIn + .51 * unit, w, .03 * unit);
    context.strokeStyle = INK; context.lineWidth = unit * .018;
    context.beginPath(); context.moveTo(x0, yIn + .54 * unit); context.lineTo(x0 + w, yIn + .54 * unit); context.stroke();
    context.fillStyle = INK;
    const size = fitText(context, tile.name, w * .9, unit * .21, 800);
    const lines = size < unit * .15 ? (context.font = `800 ${unit * .17}px ${THAI_FONT}`, wrap(context, tile.name, w * .9)) : [tile.name];
    lines.forEach((line, i) => context.fillText(line, 0, -.15 * unit + (i - (lines.length - 1) / 2) * unit * .2, w * .92));
    const kind = { land: "ที่ดิน · LAND", house: "บ้าน · AVENUE", condo: "คอนโด · PLAZA", hotel: "โรงแรม · GRAND" }[tile.kind ?? "land"];
    context.font = `700 ${unit * .095}px ${THAI_FONT}`; context.fillStyle = "rgba(25,35,48,.65)"; context.fillText(kind, 0, .13 * unit);
    // Classic price footer rule
    context.strokeStyle = "rgba(25,35,48,.22)"; context.lineWidth = unit * .01;
    context.beginPath(); context.moveTo(x0 + .16 * unit, 1.3 * unit); context.lineTo(x0 + w - .16 * unit, 1.3 * unit); context.stroke();
    context.font = `900 ${unit * .185}px ${THAI_FONT}`; context.fillStyle = INK; context.fillText(`฿${(tile.price ?? 0).toLocaleString("en-US")}`, 0, 1.52 * unit);
  } else {
    const accent = tile.type === "challenge" ? "#5a2ea6" : tile.type === "chance" ? "#d96b1f" : "#7c5a14";
    context.save(); context.translate(0, .52 * unit); icon(context, tile.type, unit * 1.48, accent); context.restore();
    context.fillStyle = accent; fitText(context, tile.name, w * .9, unit * .2, 800);
    context.fillText(tile.name, 0, -.52 * unit);
    if (tile.type === "tax" && tile.price) { context.font = `800 ${unit * .165}px ${THAI_FONT}`; context.fillStyle = INK; context.fillText(`จ่าย ฿${tile.price.toLocaleString("en-US")}`, 0, 1.52 * unit); }
    if (tile.type === "challenge") { context.font = `600 ${unit * .1}px ${THAI_FONT}`; context.fillStyle = "rgba(25,35,48,.75)"; context.fillText(tile.failPenalty === "jail" ? "ตอบผิด → ติดคุก" : "ตอบผิด → หยุด 1 ตา", 0, 1.52 * unit); }
    if (tile.type === "chance") { context.font = `600 ${unit * .1}px ${THAI_FONT}`; context.fillStyle = "rgba(25,35,48,.75)"; context.fillText("หยิบการ์ดโอกาส", 0, 1.52 * unit); }
  }
  context.strokeStyle = INK; context.lineWidth = unit * .022; context.strokeRect(x0, yIn, w, yOut - yIn);
}

function drawCorner(context: CanvasRenderingContext2D, tile: Tile, unit: number): void {
  // Square of side 2.6 with the outer corner at (+1.3,+1.3) after the caller rotates.
  const s = 2.6 * unit, h = s / 2;
  const g = context.createRadialGradient(0, 0, s * .08, 0, 0, s * .75);
  g.addColorStop(0, "#f7f0e2"); g.addColorStop(1, "#e5dac0");
  context.fillStyle = g; context.fillRect(-h, -h, s, s);
  context.save(); context.rotate(-Math.PI / 4);
  context.textAlign = "center"; context.textBaseline = "middle";
  const label = (text: string, y: number, size: number, color = INK, weight = 800) => { context.fillStyle = color; context.font = `${weight} ${size * unit}px ${THAI_FONT}`; context.fillText(text, 0, y * unit, s * .95); };
  if (tile.type === "start") {
    // Classic bold crimson GO / START arrow and salary instructions like the video at 00:02.
    label("COLLECT ฿2,000 SALARY", -.72, .12, INK, 800);
    label("AS YOU PASS · ผ่านรับ ฿2,000", -.52, .12, "rgba(25,35,48,.8)", 700);
    // Bold red shaded GO / START typography
    context.save();
    context.fillStyle = "#18202c"; context.font = `900 ${.52 * unit}px ${THAI_FONT}`;
    context.fillText("START", .03 * unit, .06 * unit);
    context.fillStyle = CRIMSON; context.fillText("START", 0, .03 * unit);
    context.restore();
    // Large red arrow beneath START pointing along the board flow
    context.fillStyle = CRIMSON; context.strokeStyle = "#18202c"; context.lineWidth = unit * .025;
    context.beginPath();
    context.moveTo(.85 * unit, .58 * unit);
    context.lineTo(-.38 * unit, .58 * unit);
    context.lineTo(-.38 * unit, .42 * unit);
    context.lineTo(-.88 * unit, .66 * unit);
    context.lineTo(-.38 * unit, .90 * unit);
    context.lineTo(-.38 * unit, .74 * unit);
    context.lineTo(.85 * unit, .74 * unit);
    context.closePath();
    context.fill(); context.stroke();
  } else if (tile.type === "jail") {
    // Classic orange IN JAIL inner square + JUST VISITING L-corridor (like 00:09 in the video).
    context.restore();
    context.save();
    // Orange jail cell in the inner corner (-h .. +0.35h)
    const cell = s * .66;
    context.fillStyle = "#e87a2e";
    context.fillRect(-h, -h, cell, cell);
    context.strokeStyle = INK; context.lineWidth = unit * .025;
    context.strokeRect(-h, -h, cell, cell);
    // Diagonal prison bars inside the orange cell
    context.save();
    context.translate(-h + cell / 2, -h + cell / 2);
    context.rotate(-Math.PI / 4);
    context.fillStyle = "rgba(255,245,225,.2)";
    context.fillRect(-.48 * unit, -.45 * unit, .96 * unit, .72 * unit);
    context.fillStyle = INK;
    for (let i = 0; i < 6; i++) context.fillRect((-.42 + i * .168) * unit, -.45 * unit, .045 * unit, .72 * unit);
    context.fillRect(-.48 * unit, -.45 * unit, .96 * unit, .055 * unit);
    context.fillRect(-.48 * unit, .22 * unit, .96 * unit, .055 * unit);
    context.fillStyle = INK; context.font = `900 ${.22 * unit}px ${THAI_FONT}`;
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("IN JAIL · คุก", 0, .46 * unit);
    context.restore();
    // JUST VISITING labels along the two outer corridors
    context.fillStyle = INK; context.font = `900 ${.2 * unit}px ${THAI_FONT}`;
    context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText("JUST", 0, h - .28 * unit);
    context.save();
    context.translate(h - .28 * unit, 0);
    context.rotate(-Math.PI / 2);
    context.fillText("VISITING · เยี่ยมชม", 0, 0);
    context.restore();
  } else if (tile.type === "freeParking") {
    for (let i = 0; i < 5; i++) { context.fillStyle = i % 2 ? "#d4a631" : "#f0cb62"; context.beginPath(); context.ellipse((i - 2) * .05 * unit, (.12 - i * .12) * unit, .52 * unit, .18 * unit, 0, 0, Math.PI * 2); context.fill(); context.strokeStyle = "#7a5b14"; context.lineWidth = unit * .022; context.stroke(); }
    label("฿", -.46, .27, "#7a5b14", 900);
    label("FREE PARKING", .44, .18, CRIMSON, 900);
    label("กองกลาง", .74, .28, INK, 900);
  } else {
    context.strokeStyle = "#174e82"; context.lineWidth = unit * .07;
    context.beginPath(); context.arc(-.3 * unit, -.22 * unit, .28 * unit, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.arc(.3 * unit, -.22 * unit, .28 * unit, 0, Math.PI * 2); context.stroke();
    context.fillStyle = "#174e82"; context.fillRect(-.06 * unit, -.26 * unit, .12 * unit, .08 * unit);
    label("GO TO JAIL", .36, .19, CRIMSON, 900);
    label("ไปคุกทันที", .7, .28, "#174e82", 900);
  }
  context.restore();
  context.strokeStyle = INK; context.lineWidth = unit * .024; context.strokeRect(-h, -h, s, s);
}

function atomEmblem(context: CanvasRenderingContext2D, radius: number): void {
  context.save();
  const glow = context.createRadialGradient(0, 0, 0, 0, 0, radius * 1.25);
  glow.addColorStop(0, "rgba(232,190,92,.38)"); glow.addColorStop(1, "rgba(232,190,92,0)");
  context.fillStyle = glow; context.beginPath(); context.arc(0, 0, radius * 1.25, 0, Math.PI * 2); context.fill();
  context.strokeStyle = GOLD; context.lineWidth = radius * .048;
  for (let i = 0; i < 3; i++) { context.beginPath(); context.ellipse(0, 0, radius, radius * .34, i * Math.PI / 3, 0, Math.PI * 2); context.stroke(); }
  for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + .9; context.fillStyle = "#f2cd6d"; context.beginPath(); context.arc(Math.cos(a) * radius * Math.cos(i * Math.PI / 3) - Math.sin(a) * radius * .34 * Math.sin(i * Math.PI / 3), Math.cos(a) * radius * Math.sin(i * Math.PI / 3) + Math.sin(a) * radius * .34 * Math.cos(i * Math.PI / 3), radius * .075, 0, Math.PI * 2); context.fill(); }
  const core = context.createRadialGradient(-radius * .05, -radius * .05, 0, 0, 0, radius * .2);
  core.addColorStop(0, "#fff4cc"); core.addColorStop(1, "#c4902f");
  context.fillStyle = core; context.beginPath(); context.arc(0, 0, radius * .18, 0, Math.PI * 2); context.fill();
  context.restore();
}

/** Card-deck slots printed on the board (world centre, rotation), shared with the 3D deck meshes. */
export const DECK_SLOTS: ReadonlyArray<{ x: number; z: number; rotation: number; kind: "question" | "chance" }> = [
  { x: -3.25, z: -3.25, rotation: Math.PI / 4, kind: "question" },
  { x: 3.25, z: 3.25, rotation: Math.PI / 4 + Math.PI, kind: "chance" },
];
export const DECK_SIZE: [number, number] = [2.15, 1.42];

function drawCentre(context: CanvasRenderingContext2D, unit: number, title: string, subtitle: string): void {
  const r = RING_INNER * unit;
  // Classic warm cream/ivory inner board field with a royal navy & gold frame so the red centre banner pops like the video.
  const field = context.createRadialGradient(0, 0, r * .1, 0, 0, r * 1.35);
  field.addColorStop(0, "#f5eedc"); field.addColorStop(.7, "#e8dec3"); field.addColorStop(1, "#d8cba8");
  context.fillStyle = field; context.fillRect(-r, -r, r * 2, r * 2);

  // Subtle architectural physics grid and concentric compass rings in the cream field.
  context.strokeStyle = "rgba(25,40,65,.065)"; context.lineWidth = unit * .01;
  for (let g = -r; g <= r; g += unit * .52) { context.beginPath(); context.moveTo(g, -r); context.lineTo(g, r); context.stroke(); context.beginPath(); context.moveTo(-r, g); context.lineTo(r, g); context.stroke(); }
  context.strokeStyle = "rgba(184,137,47,.22)"; context.lineWidth = unit * .018;
  context.beginPath(); context.arc(0, 0, r * .76, 0, Math.PI * 2); context.stroke();
  context.beginPath(); context.arc(0, 0, r * .52, 0, Math.PI * 2); context.stroke();

  // Inner double border frame
  context.strokeStyle = NAVY; context.lineWidth = unit * .055; context.strokeRect(-r + unit * .16, -r + unit * .16, r * 2 - unit * .32, r * 2 - unit * .32);
  context.strokeStyle = GOLD; context.lineWidth = unit * .022; context.strokeRect(-r + unit * .27, -r + unit * .27, r * 2 - unit * .54, r * 2 - unit * .54);

  // Faint physics formulas arranged radially around the centre crest.
  context.save(); context.fillStyle = "rgba(25,38,58,.14)"; context.font = `italic 700 ${unit * .28}px Georgia, serif`; context.textAlign = "center";
  const formulas = ["F = ma", "E = mc²", "v = u + at", "V = IR", "λ = h/p", "PV = nRT", "Q = mcΔT", "n₁sinθ₁ = n₂sinθ₂"];
  formulas.forEach((formula, i) => { const a = i / formulas.length * Math.PI * 2 + .35; context.save(); context.translate(Math.cos(a) * r * .64, Math.sin(a) * r * .64); context.rotate(a + Math.PI / 2); context.fillText(formula, 0, 0); context.restore(); });
  context.restore();

  // Printed deck slots (orange Chance & sky/gold Physics Chest).
  for (const slot of DECK_SLOTS) {
    context.save(); context.translate(slot.x * unit, slot.z * unit); context.rotate(-slot.rotation);
    const [dw, dh] = DECK_SIZE;
    const accent = slot.kind === "chance" ? "#d95f18" : "#1c5d99";
    context.setLineDash([unit * .1, unit * .07]); context.strokeStyle = accent; context.lineWidth = unit * .035;
    context.strokeRect(-dw / 2 * unit - unit * .12, -dh / 2 * unit - unit * .12, dw * unit + unit * .24, dh * unit + unit * .24);
    context.setLineDash([]);
    context.fillStyle = accent; context.font = `800 ${unit * .18}px ${THAI_FONT}`; context.textAlign = "center"; context.textBaseline = "middle";
    context.fillText(slot.kind === "question" ? "การ์ดโจทย์ฟิสิกส์ · COMMUNITY" : "การ์ดโอกาส · CHANCE", 0, dh / 2 * unit + unit * .36);
    context.restore();
  }

  // Diagonal centrepiece: iconic Crimson Banner with White & Gold Embossed Trim + Professor Mascot Emblem (like 00:01 & 00:13 in the video).
  context.save(); context.rotate(-Math.PI / 4);
  // Top emblem crest peeking over the crimson banner
  context.save(); context.translate(0, -unit * 1.48);
  atomEmblem(context, unit * .95);
  context.restore();

  // Drop shadow under the crimson banner
  const bw = unit * 7.6, bh = unit * 1.95;
  context.fillStyle = "rgba(15,12,8,.32)";
  context.fillRect(-bw / 2 + unit * .08, -bh / 2 + unit * .1, bw, bh);

  // Crimson banner body
  const crimsonGrad = context.createLinearGradient(0, -bh / 2, 0, bh / 2);
  crimsonGrad.addColorStop(0, "#d82922"); crimsonGrad.addColorStop(.5, "#b91c18"); crimsonGrad.addColorStop(1, "#89110e");
  context.fillStyle = crimsonGrad;
  context.fillRect(-bw / 2, -bh / 2, bw, bh);

  // Crisp white + gold double border around the crimson banner
  context.strokeStyle = "#fbf7ec"; context.lineWidth = unit * .07;
  context.strokeRect(-bw / 2, -bh / 2, bw, bh);
  context.strokeStyle = GOLD; context.lineWidth = unit * .025;
  context.strokeRect(-bw / 2 + unit * .11, -bh / 2 + unit * .11, bw - unit * .22, bh - unit * .22);

  // Main title inside the crimson banner
  context.textAlign = "center"; context.textBaseline = "middle";
  const size = fitText(context, title, bw * .88, unit * 1.05, 900);
  context.font = `900 ${size}px ${THAI_FONT}`;
  context.lineJoin = "round"; context.lineWidth = unit * .11; context.strokeStyle = "#1a0806";
  context.strokeText(title, 0, -unit * .04);
  context.fillStyle = "#ffffff";
  context.fillText(title, 0, -unit * .04);

  // English & city subtitle ribbon below the banner
  context.fillStyle = NAVY;
  context.fillRect(-bw * .36, bh / 2 + unit * .16, bw * .72, unit * .46);
  context.strokeStyle = GOLD; context.lineWidth = unit * .02;
  context.strokeRect(-bw * .36, bh / 2 + unit * .16, bw * .72, unit * .46);
  context.font = `800 ${unit * .23}px ${THAI_FONT}`; context.fillStyle = "#fbe8b2";
  context.fillText(`PHYSICS MONOPOLY · ${subtitle}`, 0, bh / 2 + unit * .4);
  context.restore();
}

/** Corner tiles sit at the board corners; their square spans RING_INNER…RING_OUTER on both axes. */
const CORNERS: Record<number, [number, number]> = { 0: [1, 1], 7: [-1, 1], 14: [-1, -1], 21: [1, -1] };

/**
 * Prints the whole board onto one canvas: paper stock, ring of spaces (colour bands, Thai names,
 * prices, icons), corner squares, classic cream/crimson centre with title and printed deck slots, a fold line and wear.
 */
export function boardFaceTexture(tiles: Tile[], title: string, subtitle: string, size: number, positionOf: (index: number) => [number, number, number]): CanvasTexture {
  const [element, context] = canvas(size, size), unit = size / (BOARD_HALF * 2);
  context.fillStyle = "#e9dfc6"; context.fillRect(0, 0, size, size);
  paperGrain(context, size, size, .05, 11);
  context.save(); context.translate(size / 2, size / 2);
  // Outer deep frame with gold inlay.
  const edge = BOARD_HALF * unit;
  context.fillStyle = "#121d2f"; context.fillRect(-edge, -edge, edge * 2, edge * 2);
  context.fillStyle = PAPER; context.fillRect(-RING_OUTER * unit, -RING_OUTER * unit, RING_OUTER * 2 * unit, RING_OUTER * 2 * unit);
  context.strokeStyle = GOLD; context.lineWidth = unit * .035; context.strokeRect(-(BOARD_HALF - .11) * unit, -(BOARD_HALF - .11) * unit, (BOARD_HALF - .11) * 2 * unit, (BOARD_HALF - .11) * 2 * unit);
  drawCentre(context, unit, title, subtitle);
  for (const tile of tiles) {
    const corner = CORNERS[tile.index];
    context.save();
    if (corner) {
      const c = (RING_INNER + RING_OUTER) / 2;
      context.translate(corner[0] * c * unit, corner[1] * c * unit);
      context.rotate(Math.atan2(corner[1], corner[0]) - Math.PI / 4);
      drawCorner(context, tile, unit);
    } else {
      const [x, z, rotation] = positionOf(tile.index);
      context.translate(x * unit, z * unit); context.rotate(-rotation);
      drawSpace(context, tile, unit);
    }
    context.restore();
  }
  context.strokeStyle = INK; context.lineWidth = unit * .032;
  context.strokeRect(-RING_OUTER * unit, -RING_OUTER * unit, RING_OUTER * 2 * unit, RING_OUTER * 2 * unit);
  context.strokeRect(-RING_INNER * unit, -RING_INNER * unit, RING_INNER * 2 * unit, RING_INNER * 2 * unit);
  context.restore();
  // Board fold crease + gentle edge vignette wear: makes printed cardboard look tactile.
  const fold = context.createLinearGradient(size / 2 - 7, 0, size / 2 + 7, 0);
  fold.addColorStop(0, "rgba(0,0,0,0)"); fold.addColorStop(.5, "rgba(0,0,0,.2)"); fold.addColorStop(1, "rgba(255,255,255,.06)");
  context.fillStyle = fold; context.fillRect(size / 2 - 7, 0, 14, size);
  const wear = context.createRadialGradient(size / 2, size / 2, size * .35, size / 2, size / 2, size * .75);
  wear.addColorStop(0, "rgba(90,60,20,0)"); wear.addColorStop(1, "rgba(90,60,20,.16)");
  context.fillStyle = wear; context.fillRect(0, 0, size, size);
  return finish(element, 16);
}

// ───────────────────────────── Mortgaged Sign & Stamp ─────────────────────────────

let mortgagedSignCache: CanvasTexture | null = null;
/**
 * The hanging red "🔒 MORTGAGED" sign plate shown on buildings in the video (00:04–00:05).
 */
export function mortgagedSignTexture(): CanvasTexture {
  if (mortgagedSignCache) return mortgagedSignCache;
  const W = 512, H = 240, [element, context] = canvas(W, H);
  const g = context.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#d92721"); g.addColorStop(1, "#991512");
  context.fillStyle = g; context.fillRect(0, 0, W, H);
  paperGrain(context, W, H, .04, 91);
  // Crisp white inner border
  context.strokeStyle = "#fff8ee"; context.lineWidth = 10;
  context.strokeRect(16, 16, W - 32, H - 32);
  // Padlock icon centered at top
  context.save();
  context.translate(W / 2, 74);
  context.strokeStyle = "#fff8ee"; context.fillStyle = "#fff8ee"; context.lineWidth = 9;
  context.beginPath(); context.arc(0, -14, 18, Math.PI, 0); context.stroke();
  context.fillRect(-24, -14, 48, 36);
  context.fillStyle = "#b31b17";
  context.beginPath(); context.arc(0, 2, 5, 0, Math.PI * 2); context.fill();
  context.fillRect(-3, 2, 6, 11);
  context.restore();
  // Bold MORTGAGED text
  context.fillStyle = "#fff8ee"; context.textAlign = "center"; context.textBaseline = "middle";
  context.font = `900 58px ${THAI_FONT}`;
  context.fillText("MORTGAGED", W / 2, 148);
  context.font = `700 26px ${THAI_FONT}`;
  context.fillText("ติดจำนอง / ขายคืน", W / 2, 192);
  mortgagedSignCache = finish(element);
  return mortgagedSignCache;
}

// ───────────────────────────── Money, deeds, decks ─────────────────────────────

export const BILLS: ReadonlyArray<{ value: number; color: string; ink: string }> = [
  { value: 10, color: "#efe4b0", ink: "#685313" },
  { value: 20, color: "#cbe6cf", ink: "#1f5a2d" },
  { value: 50, color: "#dcd0ec", ink: "#4a3074" },
  { value: 100, color: "#eed6be", ink: "#75441c" },
  { value: 500, color: "#f1c7d3", ink: "#822645" },
  { value: 1000, color: "#c5e4e8", ink: "#1b5d69" },
];
/** Atlas: one banknote per row (6 rows), each 2.3:1. Styled like the crisp 10 / 20 / 50 / 100 bills in the foreground of the video. */
export function billAtlas(): CanvasTexture {
  const W = 512, rowH = 222, [element, context] = canvas(W, rowH * BILLS.length);
  BILLS.forEach((bill, i) => {
    const y = i * rowH;
    context.fillStyle = bill.color; context.fillRect(0, y, W, rowH);
    paperGrain(context, W, rowH, .06, 30 + i);
    context.strokeStyle = bill.ink; context.lineWidth = 7; context.strokeRect(14, y + 14, W - 28, rowH - 28);
    context.lineWidth = 2; context.strokeRect(24, y + 24, W - 48, rowH - 48);
    // Guilloche rosette & central oval medallion.
    context.save(); context.translate(W / 2, y + rowH / 2 + 4);
    context.fillStyle = "rgba(255,255,255,.38)";
    context.beginPath(); context.ellipse(0, 0, 118, 56, 0, 0, Math.PI * 2); context.fill();
    context.strokeStyle = `${bill.ink}66`; context.lineWidth = 1.4;
    for (let k = 0; k < 18; k++) { context.beginPath(); context.ellipse(0, 0, 74, 26, k * Math.PI / 18, 0, Math.PI * 2); context.stroke(); }
    context.restore();
    context.fillStyle = bill.ink; context.textAlign = "center"; context.textBaseline = "middle";
    context.font = `900 72px ${THAI_FONT}`; context.fillText(`${bill.value}`, W / 2, y + rowH / 2 + 6);
    context.font = `800 26px ${THAI_FONT}`;
    context.fillText(`฿${bill.value}`, 68, y + 52); context.fillText(`฿${bill.value}`, W - 68, y + 52);
    context.fillText(`฿${bill.value}`, 68, y + rowH - 48); context.fillText(`฿${bill.value}`, W - 68, y + rowH - 48);
    context.font = `700 17px ${THAI_FONT}`; context.fillText("PHYSICS MONOPOLY · ธนาคารเศรษฐีฟิสิกส์", W / 2, y + 40);
  });
  return finish(element);
}

/** Atlas of title-deed cards (5 columns), each 0.62:1. */
export function deedAtlas(deeds: Tile[]): CanvasTexture {
  const cw = 248, ch = 400, [element, context] = canvas(cw * deeds.length, ch);
  deeds.forEach((tile, i) => {
    const x = i * cw;
    context.fillStyle = "#faf6ec"; context.fillRect(x, 0, cw, ch);
    paperGrain(context, cw, ch, .04, 50 + i);
    context.strokeStyle = INK; context.lineWidth = 4; context.strokeRect(x + 10, 10, cw - 20, ch - 20);
    context.fillStyle = tile.groupColor ?? "#888"; context.fillRect(x + 18, 18, cw - 36, 94);
    context.strokeRect(x + 18, 18, cw - 36, 94);
    context.fillStyle = "#fff"; context.textAlign = "center"; context.textBaseline = "middle";
    context.font = `700 14px ${THAI_FONT}`; context.fillText("TITLE DEED · โฉนดที่ดิน", x + cw / 2, 38);
    fitText(context, tile.name, cw - 50, 30, 900); context.fillText(tile.name, x + cw / 2, 78);
    context.fillStyle = INK; context.font = `600 17px ${THAI_FONT}`;
    const rows = ["ค่าเช่า ที่ดิน", "บ้าน 1 หลัง", "คอนโด", "โรงแรม"];
    (tile.rentByLevel ?? []).forEach((rent, r) => {
      context.textAlign = "left"; context.fillText(rows[r] ?? "", x + 26, 144 + r * 40);
      context.textAlign = "right"; context.fillText(`฿${rent.toLocaleString("en-US")}`, x + cw - 26, 144 + r * 40);
    });
    context.fillStyle = "rgba(25,35,48,.25)"; context.fillRect(x + 26, 310, cw - 52, 2);
    context.textAlign = "center"; context.fillStyle = INK; context.font = `800 20px ${THAI_FONT}`;
    context.fillText(`ราคา ฿${(tile.price ?? 0).toLocaleString("en-US")}`, x + cw / 2, 345);
  });
  return finish(element);
}

const deckDraw: Record<"question" | "chance", Draw> = {
  question: (context, unit) => {
    // Classic sky/gold Community Physics card back
    const g = context.createLinearGradient(-unit, -unit, unit, unit); g.addColorStop(0, "#2b74b8"); g.addColorStop(1, "#164270");
    context.fillStyle = g; context.fillRect(-unit, -unit * .667, unit * 2, unit * 1.333);
    context.strokeStyle = "#fbe29d"; context.lineWidth = unit * .04; context.strokeRect(-unit * .9, -unit * .58, unit * 1.8, unit * 1.16);
    context.save(); context.translate(-unit * .42, 0); atomEmblem(context, unit * .34); context.restore();
    context.fillStyle = "#fff6dc"; context.textAlign = "center"; context.textBaseline = "middle";
    context.font = `900 ${unit * .22}px ${THAI_FONT}`; context.fillText("โจทย์ฟิสิกส์", unit * .32, -unit * .12);
    context.font = `800 ${unit * .16}px ${THAI_FONT}`; context.fillText("PHYSICS CHEST", unit * .32, unit * .18);
  },
  chance: (context, unit) => {
    // Iconic vibrant orange Chance card deck with large '?' just like 00:01–00:02 in the video!
    const g = context.createLinearGradient(-unit, -unit, unit, unit); g.addColorStop(0, "#f58529"); g.addColorStop(1, "#c95210");
    context.fillStyle = g; context.fillRect(-unit, -unit * .667, unit * 2, unit * 1.333);
    context.strokeStyle = "#fff5e4"; context.lineWidth = unit * .045; context.strokeRect(-unit * .9, -unit * .58, unit * 1.8, unit * 1.16);
    context.fillStyle = "#fff5e4"; context.textAlign = "center"; context.textBaseline = "middle";
    context.font = `900 ${unit * .74}px Georgia, serif`; context.fillText("?", -unit * .35, unit * .04);
    context.font = `900 ${unit * .28}px ${THAI_FONT}`; context.fillText("โอกาส", unit * .32, -unit * .1);
    context.font = `800 ${unit * .18}px ${THAI_FONT}`; context.fillText("CHANCE", unit * .32, unit * .2);
  },
};
/** Two card backs side by side (u 0–0.5 question, 0.5–1 chance). */
export function deckAtlas(): CanvasTexture {
  const unit = 256, [element, context] = canvas(unit * 4, Math.round(unit * 1.333));
  (["question", "chance"] as const).forEach((kind, i) => { context.save(); context.translate(unit + i * unit * 2, unit * .667); deckDraw[kind](context, unit); context.restore(); });
  return finish(element);
}
