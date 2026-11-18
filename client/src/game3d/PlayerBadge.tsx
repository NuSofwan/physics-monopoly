import { useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";
import { OVERLAY_LAYER } from "./Atmosphere";

const slotColors = ["#34d399", "#f8c24a", "#f472b6", "#60a5fa"];

export function PlayerBadge({ name, slot }: { name: string; slot: number }): JSX.Element {
  const texture = useMemo(() => {
    const W = 512, H = 112;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const accent = slotColors[slot % slotColors.length] ?? "#f8c24a";

    // Pill-shaped deep obsidian plaque with golden/player-colored rim
    const r = 46, x = 10, y = 10, w = W - 20, h = H - 20;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    const bg = ctx.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, "rgba(18, 28, 45, 0.95)");
    bg.addColorStop(1, "rgba(8, 14, 24, 0.97)");
    ctx.fillStyle = bg;
    ctx.fill();

    // Crisp rim stroke
    ctx.lineWidth = 5;
    ctx.strokeStyle = accent;
    ctx.stroke();

    // Inner gold sheen hairline
    ctx.beginPath();
    ctx.roundRect(x + 6, y + 6, w - 12, h - 12, r - 6);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 232, 178, 0.32)";
    ctx.stroke();

    // Player badge symbol & name
    ctx.fillStyle = accent;
    ctx.font = '900 40px "Noto Sans Thai", system-ui, sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const sym = ["△", "□", "⬟", "⬡"][slot % 4] ?? "△";
    ctx.fillText(sym, 34, H / 2 + 1);

    ctx.fillStyle = "#ffffff";
    ctx.font = '800 38px "Noto Sans Thai", system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(name, W / 2 + 16, H / 2 + 1, W - 128);

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [name, slot]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite layers={OVERLAY_LAYER} position={[0, 1.54, 0]} scale={[1.58, 0.34, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
