import Phaser from "phaser";
import type { GameState, Tile } from "@physics-monopoly/shared";

const boardSize = 760;
const tileSize = 96;
const center = boardSize / 2;
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

  create(): void {
    this.cameras.main.setBackgroundColor("#edf5ff");
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
      .text(center, boardSize - 34, "", {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#101827",
        backgroundColor: "#ffffffcc",
        padding: { x: 14, y: 8 },
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
    const bg = this.add.rectangle(center, center, boardSize - 64, boardSize - 64, 0xf8fbff, 1);
    bg.setStrokeStyle(3, 0x101827, 0.14);
    this.add.text(center, center - 42, "Physics", { fontFamily: "Arial", fontSize: "46px", color: "#101827", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(center, center + 10, "Monopoly", { fontFamily: "Arial", fontSize: "42px", color: "#ff6b5f", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(center, center + 62, "ตอบโจทย์ให้ถูกเพื่อซื้อ อัปเกรด และเอาชนะ", { fontFamily: "Arial", fontSize: "20px", color: "#475569" }).setOrigin(0.5);
    tiles.forEach((tile) => this.drawTile(tile));
  }

  private drawTile(tile: Tile): void {
    const pos = tilePosition(tile.index);
    this.tilePositions.set(tile.index, new Phaser.Math.Vector2(pos.x, pos.y));
    const fill = tile.type === "property" ? colorToNumber(tile.groupColor ?? "#94a3b8") : specialColor(tile.type);
    const rect = this.add.rectangle(pos.x, pos.y, tileSize, tileSize, 0xffffff, 1);
    rect.setStrokeStyle(2, 0x101827, 0.18);
    this.add.rectangle(pos.x, pos.y - tileSize / 2 + 10, tileSize, 20, fill, 1);
    const label = tile.name.length > 12 ? `${tile.name.slice(0, 12)}…` : tile.name;
    this.add.text(pos.x, pos.y + 4, label, { fontFamily: "Arial", fontSize: "13px", color: "#101827", align: "center", wordWrap: { width: 82 } }).setOrigin(0.5);
    if (tile.type === "property") {
      this.add.text(pos.x, pos.y + 32, `฿${tile.price}`, { fontFamily: "Arial", fontSize: "12px", color: "#475569" }).setOrigin(0.5);
    }
  }

  private addToken(playerId: string, avatar: string, tileIndex: number, offset: number): Phaser.GameObjects.Container {
    const pos = this.positionForToken(tileIndex, offset);
    const container = this.add.container(pos.x, pos.y).setDepth(20 + offset);
    const shadow = this.add.ellipse(0, 20, 34, 12, 0x101827, 0.2);
    const body = this.add.circle(0, 0, 19, tokenColors[avatar] ?? 0x34d399);
    body.setStrokeStyle(3, 0xffffff, 1);
    const face = this.add.text(0, -2, avatar === "robot" ? "R" : avatar === "astro" ? "A" : avatar === "girl" ? "G" : "B", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#101827",
      fontStyle: "bold",
    }).setOrigin(0.5);
    container.add([shadow, body, face]);
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
    start: 0x34d399,
    property: 0x94a3b8,
    challenge: 0xff6b5f,
    chance: 0xf8c24a,
    tax: 0x64748b,
    jail: 0x111827,
    goToJail: 0xef4444,
    freeParking: 0x60a5fa,
  };
  return map[type];
}

function colorToNumber(hex: string): number {
  return Number.parseInt(hex.replace("#", ""), 16);
}
