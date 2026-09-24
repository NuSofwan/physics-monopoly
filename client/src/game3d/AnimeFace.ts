import { CanvasTexture, Color, SRGBColorSpace, type Texture } from "three";

/** Angular window of the head sphere covered by the face decal (see AvatarFigure). */
export const FACE_PHI = 1.9, FACE_THETA_START = .95, FACE_THETA = 1.4;
export type Expression = "normal" | "blink" | "happy" | "think";
export interface FaceStyle { eyes: string; brows: string; lashes: "soft" | "long"; senior: boolean }

const SIZE = 512, X = SIZE / FACE_PHI, Y = SIZE / FACE_THETA;
/** Canvas point for a face-local angle: phi offset from centre (positive = viewer's right) and polar angle theta. */
const at = (phi: number, theta: number): [number, number] => [SIZE / 2 + phi * X, (theta - FACE_THETA_START) * Y];
const shade = (hex: string, amount: number) => `#${new Color(hex).lerp(new Color(amount < 0 ? "#0b0d16" : "#ffffff"), Math.abs(amount)).getHexString()}`;
const cache = new Map<string, Texture>();

function eye(c: CanvasRenderingContext2D, side: -1 | 1, style: FaceStyle, expression: Expression): void {
  const [cx, cy] = at(side * .37, 1.64), rx = .225 * X, ry = .3 * Y, ink = "#231b28";
  c.lineCap = "round"; c.lineJoin = "round";
  if (expression === "blink" || expression === "happy") {
    // Closed eyes: a soft lash curve (blink) or an upturned ^ arc (happy).
    c.strokeStyle = ink; c.lineWidth = 13;
    c.beginPath();
    if (expression === "happy") { c.moveTo(cx - rx * .85, cy + ry * .15); c.quadraticCurveTo(cx, cy - ry * .75, cx + rx * .85, cy + ry * .15); }
    else { c.moveTo(cx - rx * .9, cy); c.quadraticCurveTo(cx, cy + ry * .38, cx + rx * .9, cy); }
    c.stroke();
    if (style.lashes === "long") { c.lineWidth = 8; c.beginPath(); c.moveTo(cx + side * rx * .85, cy + (expression === "happy" ? ry * .15 : 0)); c.lineTo(cx + side * rx * 1.12, cy - ry * .18); c.stroke(); }
    return;
  }
  const look = expression === "think" ? [side * 0 + rx * .22, -ry * .16] : [0, 0];
  c.save();
  c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.closePath();
  c.fillStyle = "#fbf8f3"; c.fill(); c.clip();
  const ix = cx + look[0]!, iy = cy + ry * .1 + look[1]!, irx = rx * .82, iry = ry * .86;
  const iris = c.createLinearGradient(0, iy - iry, 0, iy + iry);
  iris.addColorStop(0, shade(style.eyes, -.55)); iris.addColorStop(.45, style.eyes); iris.addColorStop(1, shade(style.eyes, .45));
  c.fillStyle = iris; c.beginPath(); c.ellipse(ix, iy, irx, iry, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = shade(style.eyes, -.6); c.lineWidth = 5; c.stroke();
  c.fillStyle = shade(style.eyes, -.72); c.beginPath(); c.ellipse(ix, iy + iry * .05, irx * .42, iry * .46, 0, 0, Math.PI * 2); c.fill();
  // Lower-iris glow and two catch-lights give the glossy figure look.
  c.fillStyle = "rgba(255,255,255,.28)"; c.beginPath(); c.ellipse(ix, iy + iry * .55, irx * .6, iry * .22, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(ix - irx * .34, iy - iry * .42, irx * .32, iry * .24, -.3, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(ix + irx * .38, iy + iry * .36, irx * .13, iry * .1, 0, 0, Math.PI * 2); c.fill();
  // Upper-lid shadow on the white.
  c.fillStyle = "rgba(60,40,60,.18)"; c.fillRect(cx - rx, cy - ry, rx * 2, ry * .32);
  c.restore();
  c.strokeStyle = ink; c.lineWidth = 15;
  c.beginPath(); c.ellipse(cx, cy, rx * 1.02, ry * 1.01, 0, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
  c.lineWidth = 4; c.beginPath(); c.ellipse(cx, cy, rx * .98, ry * .98, 0, Math.PI * .28, Math.PI * .72); c.stroke();
  if (style.lashes === "long") { c.lineWidth = 9; c.beginPath(); c.moveTo(cx + side * rx * .92, cy - ry * .5); c.lineTo(cx + side * rx * 1.22, cy - ry * .78); c.stroke(); }
}

/** Anime face decal (eyes, brows, blush, mouth) drawn on a transparent canvas; cached per style + expression. */
export function faceTexture(style: FaceStyle, expression: Expression): Texture {
  const key = `${style.eyes}:${style.brows}:${style.lashes}:${style.senior}:${expression}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const c = canvas.getContext("2d")!;
  for (const side of [-1, 1] as const) {
    // Blush: soft glow plus three short hatch strokes.
    const [bx, by] = at(side * .6, 1.86);
    const blush = c.createRadialGradient(bx, by, 0, bx, by, 58);
    blush.addColorStop(0, "rgba(255,120,130,.42)"); blush.addColorStop(1, "rgba(255,120,130,0)");
    c.fillStyle = blush; c.fillRect(bx - 60, by - 60, 120, 120);
    c.strokeStyle = "rgba(230,90,110,.35)"; c.lineWidth = 4;
    for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(bx + i * 14 - 5, by + 7); c.lineTo(bx + i * 14 + 5, by - 7); c.stroke(); }
    eye(c, side, style, expression);
    // Brows follow the hair colour; thinking raises one.
    const [ex, ey] = at(side * .36, 1.23 - (expression === "think" && side > 0 ? .06 : 0));
    c.strokeStyle = style.brows; c.lineWidth = 9; c.lineCap = "round";
    c.beginPath(); c.moveTo(ex - side * 38, ey + 6); c.quadraticCurveTo(ex, ey - 10, ex + side * 42, ey + (expression === "think" ? -4 : 4)); c.stroke();
    if (style.senior) { c.strokeStyle = "rgba(120,80,70,.28)"; c.lineWidth = 3; c.beginPath(); c.moveTo(ex + side * 60, at(0, 1.72)[1]); c.lineTo(ex + side * 72, at(0, 1.66)[1]); c.stroke(); }
  }
  // Anime noses are a single soft shadow tick rather than a bump.
  const [nx, ny] = at(.02, 1.84);
  c.strokeStyle = "rgba(150,80,70,.55)"; c.lineWidth = 5; c.lineCap = "round";
  c.beginPath(); c.moveTo(nx, ny - 8); c.lineTo(nx - 5, ny + 6); c.stroke();
  const [mx, my] = at(0, 2.0);
  c.lineCap = "round";
  if (expression === "happy") {
    c.fillStyle = "#8d2f3b"; c.beginPath(); c.moveTo(mx - 30, my - 6); c.quadraticCurveTo(mx, my + 44, mx + 30, my - 6); c.closePath(); c.fill();
    c.fillStyle = "#f27f8e"; c.beginPath(); c.ellipse(mx, my + 16, 15, 9, 0, 0, Math.PI * 2); c.fill();
  } else if (expression === "think") {
    c.strokeStyle = "#7c3a42"; c.lineWidth = 7; c.beginPath(); c.moveTo(mx - 16, my + 4); c.quadraticCurveTo(mx - 4, my - 4, mx + 6, my + 3); c.quadraticCurveTo(mx + 13, my + 8, mx + 18, my); c.stroke();
  } else {
    c.strokeStyle = "#7c3a42"; c.lineWidth = 7; c.beginPath(); c.moveTo(mx - 18, my); c.quadraticCurveTo(mx, my + 14, mx + 18, my); c.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace; texture.anisotropy = 4;
  cache.set(key, texture);
  return texture;
}
