import Phaser from "phaser";
import type { GameState, Tile } from "@physics-monopoly/shared";

const boardSize = 760;
const tileSize = 96;
const center = boardSize / 2;
const nightBg = "#0b1224";
const tokenColors: Record<string, number> = {
  astro: 0x34d399,
  robot: 0xf8c24a,
  girl: 0xff6b5f,
  boy: 0x60a5fa,
};

export class BoardScene extends Phaser.Scene {
  private tokenGroup!: Phaser.GameObjects.Group;
  private tilePositions = new Map<number, Phaser.Math.Vector2>();
  private tokens = new Map<string, Phaser.GameObjects.Container>();
  private stepLabel?: Phaser.GameObjects.Text;
  // Phaser boots the scene asynchronously; React can push state in before
  // create() runs. Guard with a ready flag and replay the latest state once the
  // scene is live so syncState/animateMove never touch uninitialised systems.
  private ready = false;
  private latestState: GameState | null = null;

  constructor() {
    super("BoardScene");
  }

  preload(): void {
    // Physics-city night backdrop (also used on the lobby). Served from /public.
    this.load.image("citybg", "/assets/art/physics_city_backdrop.png");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(nightBg);
    this.tokenGroup = this.add.group();
    this.ready = true;
    if (this.latestState) {
      this.renderBoard(this.latestState);
    }
  }

  syncState(state: GameState): void {
    this.latestState = state;
    if (!this.ready) return;
    if (this.tilePositions.size === 0 || this.tokens.size !== state.players.length) {
      this.renderBoard(state);
      return;
    }
    state.players.forEach((player, index) => {
      let token = this.tokens.get(player.id);
      if (!token) token = this.addToken(player.id, player.avatar, player.tileIndex, index);
      const pos = this.positionForToken(player.tileIndex, index);
      token.setPosition(pos.x, pos.y);
      token.setAlpha(player.bankrupt ? 0.3 : player.connected ? 1 : 0.55);
    });
  }

  renderBoard(state: GameState): void {
    this.children.removeAll();
    this.tokens.clear();
    this.tilePositions.clear();
    this.drawBoard(state.tiles);
    this.stepLabel = this.add
      .text(center, boardSize - 30, "", {
        fontFamily: "Arial",
        fontSize: "20px",
        color: "#eaf2ff",
        backgroundColor: "#101a33dd",
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5)
      .setDepth(50);
    state.players.forEach((player, index) => this.addToken(player.id, player.avatar, player.tileIndex, index));
  }

  animateMove(playerId: string, path: number[], playerOffset: number): void {
    if (!this.ready) return;
    const token = this.tokens.get(playerId);
    if (!token || path.length === 0) return;
    let step = 0;
    const runStep = (): void => {
      const tileIndex = path[step];
      if (tileIndex === undefined) {
        this.stepLabel?.setText("");
        this.cameras.main.pan(center, center, 380, "Sine.easeInOut");
        this.cameras.main.zoomTo(1, 380);
        return;
      }
      const pos = this.positionForToken(tileIndex, playerOffset);
      this.stepLabel?.setText(`${step + 1}/${path.length}`);
      this.cameras.main.pan(pos.x, pos.y, 260, "Sine.easeInOut");
      this.cameras.main.zoomTo(1.16, 260);
      this.tweens.add({
        targets: token,
        x: pos.x,
        y: pos.y,
        scaleX: 1.08,
        scaleY: 0.94,
        duration: 320,
        ease: "Sine.easeInOut",
        onComplete: () => {
          token.setScale(1);
          step += 1;
          runStep();
        },
      });
    };
    runStep();
  }

  private drawBoard(tiles: Tile[]): void {
    // 1) Physics-city backdrop (cover-fit the square board) + dark overlay for contrast.
    if (this.textures.exists("citybg")) {
      const src = this.textures.get("citybg").getSourceImage() as HTMLImageElement;
      const scale = Math.max(boardSize / src.width, boardSize / src.height);
      this.add.image(center, center, "citybg").setScale(scale).setDepth(-20);
      this.add.rectangle(center, center, boardSize, boardSize, 0x0b1224, 0.5).setDepth(-19);
    } else {
      this.add.rectangle(center, center, boardSize, boardSize, 0x0b1224, 1).setDepth(-20);
    }

    // 2) Central glowing emblem panel (translucent so the city lake shows through).
    const panelSize = boardSize - tileSize * 2 - 40;
    const panel = this.add.graphics().setDepth(-10);
    panel.fillStyle(0x0e1730, 0.6);
    panel.fillRoundedRect(center - panelSize / 2, center - panelSize / 2, panelSize, panelSize, 28);
    panel.lineStyle(2, 0x6ea8ff, 0.35);
    panel.strokeRoundedRect(center - panelSize / 2, center - panelSize / 2, panelSize, panelSize, 28);

    this.add
      .text(center, center - 34, "PHYSICS", { fontFamily: "Arial", fontSize: "46px", color: "#eaf2ff", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(-9)
      .setShadow(0, 0, "#3b6fd4", 18);
    this.add
      .text(center, center + 16, "MONOPOLY", { fontFamily: "Arial", fontSize: "40px", color: "#ff6b5f", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(-9)
      .setShadow(0, 0, "#ff6b5f", 16);
    this.add
      .text(center, center + 62, "ตอบโจทย์ฟิสิกส์ให้ถูก เพื่อซื้อ อัปเกรด และเอาชนะ", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#9fb4d8",
      })
      .setOrigin(0.5)
      .setDepth(-9);

    tiles.forEach((tile) => this.drawTile(tile));
  }

  private drawTile(tile: Tile): void {
    const pos = tilePosition(tile.index);
    this.tilePositions.set(tile.index, new Phaser.Math.Vector2(pos.x, pos.y));
    const fill = tile.type === "property" ? colorToNumber(tile.groupColor ?? "#94a3b8") : specialColor(tile.type);
    const half = tileSize / 2;
    const x = pos.x - half;
    const y = pos.y - half;

    // Vibrant rounded tile: drop shadow, color fill, glossy top highlight, light border.
    const g = this.add.graphics();
    g.fillStyle(0x05070f, 0.5);
    g.fillRoundedRect(x + 2, y + 5, tileSize - 4, tileSize - 4, 15);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x, y, tileSize, tileSize, 15);
    g.fillStyle(0xffffff, 0.16);
    g.fillRoundedRect(x, y, tileSize, tileSize * 0.4, 15);
    g.lineStyle(2, 0xffffff, 0.55);
    g.strokeRoundedRect(x, y, tileSize, tileSize, 15);

    // Tile name — white, bold, dark-stroked so it reads on any tile colour.
    const label = tile.name.length > 13 ? `${tile.name.slice(0, 13)}…` : tile.name;
    this.add
      .text(pos.x, pos.y - 2, label, {
        fontFamily: "Arial",
        fontSize: "12.5px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: 82 },
      })
      .setOrigin(0.5)
      .setStroke("#0b1224", 3)
      .setShadow(0, 1, "#0b1224", 3);

    // Price pill for properties.
    if (tile.type === "property" && tile.price) {
      const pw = 60;
      const ph = 18;
      const pill = this.add.graphics();
      pill.fillStyle(0x0b1224, 0.62);
      pill.fillRoundedRect(pos.x - pw / 2, pos.y + half - 26, pw, ph, 9);
      this.add
        .text(pos.x, pos.y + half - 17, `฿${tile.price.toLocaleString()}`, {
          fontFamily: "Arial",
          fontSize: "11px",
          color: "#eaf2ff",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }
  }

  private addToken(playerId: string, avatar: string, tileIndex: number, offset: number): Phaser.GameObjects.Container {
    const pos = this.positionForToken(tileIndex, offset);
    const color = tokenColors[avatar] ?? 0x34d399;
    const container = this.add.container(pos.x, pos.y).setDepth(20 + offset);
    const shadow = this.add.ellipse(0, 20, 34, 12, 0x05070f, 0.35);
    const glow = this.add.circle(0, 0, 24, color, 0.28);
    const body = this.add.circle(0, 0, 19, color);
    body.setStrokeStyle(3, 0xffffff, 1);
    const face = this.add
      .text(0, -2, avatar === "robot" ? "R" : avatar === "astro" ? "A" : avatar === "girl" ? "G" : "B", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#0b1224",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    container.add([shadow, glow, body, face]);
    this.tokens.set(playerId, container);
    return container;
  }

  private positionForToken(tileIndex: number, offset: number): Phaser.Math.Vector2 {
    const base = this.tilePositions.get(tileIndex) ?? new Phaser.Math.Vector2(center, center);
    const offsets = [
      [-18, -18],
      [18, -18],
      [-18, 18],
      [18, 18],
    ] as const;
    const [x, y] = offsets[offset % offsets.length] ?? [0, 0];
    return new Phaser.Math.Vector2(base.x + x, base.y + y);
  }
}

function tilePosition(index: number): { x: number; y: number } {
  const min = tileSize / 2 + 16;
  const max = boardSize - tileSize / 2 - 16;
  const span = max - min;
  if (index <= 7) return { x: max - (span / 7) * index, y: max };
  if (index <= 14) return { x: min, y: max - (span / 7) * (index - 7) };
  if (index <= 21) return { x: min + (span / 7) * (index - 14), y: min };
  return { x: max, y: min + (span / 7) * (index - 21) };
}

function specialColor(type: Tile["type"]): number {
  const map: Record<Tile["type"], number> = {
    start: 0x22c55e,
    property: 0x94a3b8,
    challenge: 0xff6b5f,
    chance: 0xf8c24a,
    tax: 0x64748b,
    jail: 0x1f2a44,
    goToJail: 0xef4444,
    freeParking: 0x3b82f6,
  };
  return map[type];
}

function colorToNumber(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}
