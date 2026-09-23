import Phaser from "phaser";
import { avatarById, avatarPresets, type GameState, type Tile } from "@physics-monopoly/shared";

export const BOARD_WIDTH = 1672;
export const BOARD_HEIGHT = 941;

const tileWidth = 118;
const tileHeight = 78;
const centerX = BOARD_WIDTH / 2;
const centerY = BOARD_HEIGHT / 2;
const nightBg = "#0b1224";
const boardPalette = [0xd99a36, 0x2a9b9b, 0xc75f46, 0xf0dfb9, 0x1f6f94, 0xd99a36, 0x2f7f90];
/** Every valid avatar id (server allowlist parity), used to derive a distinct token color per avatar. */
const AVATAR_IDS = [...avatarPresets.map((preset) => preset.id), "robot"];
const tokenPalette = [0x34d399, 0xf8c24a, 0xff6b5f, 0x60a5fa, 0xa78bfa, 0xfb923c, 0x2dd4bf, 0xe879f9, 0xf472b6, 0x38bdf8];
function tokenColorFor(avatar: string): number {
  const index = AVATAR_IDS.indexOf(avatar);
  return tokenPalette[(index < 0 ? 0 : index) % tokenPalette.length] ?? 0x34d399;
}

const boardPath = [
  { x: 326, y: 686 },
  { x: 440, y: 705 },
  { x: 553, y: 728 },
  { x: 668, y: 752 },
  { x: 787, y: 792 },
  { x: 914, y: 793 },
  { x: 1039, y: 781 },
  { x: 1160, y: 758 },
  { x: 1266, y: 716 },
  { x: 1350, y: 660 },
  { x: 1414, y: 590 },
  { x: 1438, y: 514 },
  { x: 1411, y: 443 },
  { x: 1328, y: 392 },
  { x: 1222, y: 359 },
  { x: 1114, y: 338 },
  { x: 1007, y: 322 },
  { x: 900, y: 308 },
  { x: 792, y: 302 },
  { x: 682, y: 303 },
  { x: 572, y: 316 },
  { x: 466, y: 346 },
  { x: 369, y: 388 },
  { x: 276, y: 433 },
  { x: 188, y: 471 },
  { x: 284, y: 513 },
  { x: 386, y: 557 },
  { x: 475, y: 615 },
] as const;

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
    // Project-owned physics-city backdrop (also used on the lobby).
    this.load.image("citybg", "/assets/art/science_city_hero.webp");
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
      .text(centerX, BOARD_HEIGHT - 34, "", {
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
        this.cameras.main.pan(centerX, centerY, 380, "Sine.easeInOut");
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
    if (this.textures.exists("citybg")) {
      this.add.image(centerX, centerY, "citybg").setDisplaySize(BOARD_WIDTH, BOARD_HEIGHT).setDepth(-30);
      this.add.rectangle(centerX, centerY, BOARD_WIDTH, BOARD_HEIGHT, 0x071328, 0.12).setDepth(-29);
    } else {
      this.add.rectangle(centerX, centerY, BOARD_WIDTH, BOARD_HEIGHT, 0x0b1224, 1).setDepth(-30);
    }

    this.drawRouteGlow();
    this.drawLakeBlueprints();
    tiles.forEach((tile) => this.drawTile(tile));
  }

  private drawTile(tile: Tile): void {
    const pos = tilePosition(tile.index);
    this.tilePositions.set(tile.index, new Phaser.Math.Vector2(pos.x, pos.y));
    const fill = tile.type === "property" ? (boardPalette[tile.index % boardPalette.length] ?? 0xd99a36) : specialColor(tile.type);
    const angle = tileAngle(tile.index);
    const labelAngle = readableAngle(angle);
    const isCorner = tile.type === "start" || tile.type === "jail" || tile.type === "freeParking" || tile.type === "goToJail";
    const width = isCorner ? tileWidth + 14 : tileWidth;
    const height = isCorner ? tileHeight + 10 : tileHeight;

    const shadow = this.add.graphics().setPosition(pos.x, pos.y).setRotation(angle).setDepth(2);
    shadow.fillStyle(0x05070f, 0.4);
    shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 8, width, height, 12);

    const g = this.add.graphics().setPosition(pos.x, pos.y).setRotation(angle).setDepth(3);
    g.fillStyle(fill, 0.9);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, 12);
    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(-width / 2 + 5, -height / 2 + 5, width - 10, height * 0.34, 9);
    g.lineStyle(3, 0xfff5db, 0.86);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, 12);

    this.drawTileIcon(tile, pos.x, pos.y, angle, fill);

    const labelOffset = rotatePoint(0, 16, angle);
    const label = tile.name.length > 12 ? `${tile.name.slice(0, 12)}...` : tile.name;
    this.add
      .text(pos.x + labelOffset.x, pos.y + labelOffset.y, label, {
        fontFamily: "Arial, Noto Sans Thai",
        fontSize: isCorner ? "16px" : "12px",
        color: "#ffffff",
        fontStyle: "bold",
        align: "center",
        wordWrap: { width: width - 24 },
      })
      .setOrigin(0.5)
      .setRotation(labelAngle)
      .setDepth(5)
      .setStroke("#0b1224", 3)
      .setShadow(0, 1, "#0b1224", 3);

    if (tile.type === "property" && tile.price) {
      const priceOffset = rotatePoint(0, height / 2 - 12, angle);
      const pw = 62;
      const ph = 17;
      const pill = this.add.graphics().setDepth(5);
      pill.fillStyle(0x0b1224, 0.62);
      pill.fillRoundedRect(pos.x + priceOffset.x - pw / 2, pos.y + priceOffset.y - ph / 2, pw, ph, 9);
      this.add
        .text(pos.x + priceOffset.x, pos.y + priceOffset.y, `$${tile.price.toLocaleString()}`, {
          fontFamily: "Arial",
          fontSize: "11px",
          color: "#eaf2ff",
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setRotation(labelAngle)
        .setDepth(6);
    }
  }

  private drawRouteGlow(): void {
    const points = boardPath.map((point) => new Phaser.Math.Vector2(point.x, point.y));
    points.push(new Phaser.Math.Vector2(boardPath[0].x, boardPath[0].y));
    const curve = new Phaser.Curves.Spline(points);
    const glow = this.add.graphics().setDepth(0);
    glow.lineStyle(128, 0x071328, 0.34);
    curve.draw(glow, 120);
    glow.lineStyle(122, 0xffedc3, 0.22);
    curve.draw(glow, 120);
    glow.lineStyle(4, 0xffffff, 0.52);
    curve.draw(glow, 120);
  }

  private drawLakeBlueprints(): void {
    const g = this.add.graphics().setDepth(-3);
    g.lineStyle(2, 0x8cc8ff, 0.15);
    g.strokeCircle(centerX - 60, centerY + 8, 52);
    g.strokeCircle(centerX - 60, centerY + 8, 24);
    g.lineBetween(centerX - 112, centerY + 8, centerX - 8, centerY + 8);
    g.lineBetween(centerX - 60, centerY - 44, centerX - 60, centerY + 60);
    g.strokeCircle(centerX + 210, centerY + 118, 30);
    g.lineBetween(centerX + 180, centerY + 118, centerX + 240, centerY + 118);
    g.lineBetween(centerX + 210, centerY + 88, centerX + 210, centerY + 148);

    for (let i = 0; i < 9; i += 1) {
      const x = centerX - 340 + i * 72;
      const y = centerY + 178 + Math.sin(i) * 22;
      g.strokeCircle(x, y, 7);
      if (i > 0) g.lineBetween(x - 72, y - Math.sin(i) * 12, x, y);
    }
  }

  private drawTileIcon(tile: Tile, x: number, y: number, angle: number, fill: number): void {
    const iconOffset = rotatePoint(0, -13, angle);
    const iconX = x + iconOffset.x;
    const iconY = y + iconOffset.y;

    if (tile.type === "property") {
      const atom = this.add.container(iconX, iconY).setRotation(angle).setDepth(5);
      const orbitA = this.add.ellipse(0, 0, 34, 12).setStrokeStyle(2, 0xffffff, 0.82);
      const orbitB = this.add.ellipse(0, 0, 34, 12).setStrokeStyle(2, 0xffffff, 0.82).setRotation(Math.PI / 3);
      const orbitC = this.add.ellipse(0, 0, 34, 12).setStrokeStyle(2, 0xffffff, 0.82).setRotation(-Math.PI / 3);
      const nucleus = this.add.circle(0, 0, 4, 0xffffff, 0.9);
      atom.add([orbitA, orbitB, orbitC, nucleus]);
      return;
    }

    const icon = this.add.graphics().setPosition(iconX, iconY).setRotation(angle).setDepth(5);
    icon.lineStyle(2, 0xffffff, 0.82);
    icon.fillStyle(0xffffff, 0.88);

    if (tile.type === "chance" || tile.type === "challenge") {
      icon.strokeCircle(0, 0, 14);
      icon.lineBetween(-8, 0, 8, 0);
      icon.lineBetween(0, -8, 0, 8);
      return;
    }

    if (tile.type === "tax") {
      icon.strokeRect(-14, -10, 28, 20);
      icon.lineBetween(-8, -2, 8, -2);
      icon.lineBetween(-8, 5, 5, 5);
      return;
    }

    icon.fillCircle(0, 0, 14);
    icon.fillStyle(fill, 1);
    icon.fillCircle(0, 0, 7);
  }

  private addToken(playerId: string, avatar: string, tileIndex: number, offset: number): Phaser.GameObjects.Container {
    const pos = this.positionForToken(tileIndex, offset);
    const color = tokenColorFor(avatar);
    const container = this.add.container(pos.x, pos.y).setDepth(20 + offset);
    const shadow = this.add.ellipse(0, 20, 34, 12, 0x05070f, 0.35);
    const glow = this.add.circle(0, 0, 24, color, 0.28);
    const body = this.add.circle(0, 0, 19, color);
    body.setStrokeStyle(3, 0xffffff, 1);
    const faceLetter = avatar === "robot" ? "R" : (avatarById(avatar).label[0] ?? avatar[0] ?? "?").toUpperCase();
    const face = this.add
      .text(0, -2, faceLetter, {
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
    const base = this.tilePositions.get(tileIndex) ?? new Phaser.Math.Vector2(centerX, centerY);
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
  return boardPath[index % boardPath.length] ?? { x: boardPath[0].x, y: boardPath[0].y };
}

function tileAngle(index: number): number {
  const prev = boardPath[(index - 1 + boardPath.length) % boardPath.length] ?? boardPath[0];
  const next = boardPath[(index + 1) % boardPath.length] ?? boardPath[0];
  return Math.atan2(next.y - prev.y, next.x - prev.x);
}

function readableAngle(angle: number): number {
  let normalized = Phaser.Math.Angle.Wrap(angle);
  if (normalized > Math.PI / 2 || normalized < -Math.PI / 2) normalized += Math.PI;
  return Phaser.Math.Angle.Wrap(normalized);
}

function rotatePoint(x: number, y: number, angle: number): { x: number; y: number } {
  return {
    x: x * Math.cos(angle) - y * Math.sin(angle),
    y: x * Math.sin(angle) + y * Math.cos(angle),
  };
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
