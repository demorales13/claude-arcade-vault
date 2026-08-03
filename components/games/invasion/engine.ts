import type { SkinId } from "@/lib/skins";

export type InvasionCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type InvasionOptions = {
  skin?: SkinId;
};

export type InvasionGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void;
  forceGameOver: () => void;
  setSkin: (skin: SkinId) => void;
};

const CANVAS_W = 800;
const CANVAS_H = 600;

const ROWS = 5;
const COLS = 8;
const ALIEN_W = 32;
const ALIEN_H = 24;
const GAP_X = 16;
const GAP_Y = 16;
const FORMATION_LEFT = 216;
const FORMATION_TOP = 60;
const ROW_POINTS = [30, 30, 20, 20, 10];
const STEP_PX = 12;
const ROW_DROP_PX = 24;
const BASE_STEP_MS = 700;
const MIN_STEP_MS = 70;
const LEVEL_STEP_MS_REDUCTION = 50;
const CANNON_Y = 560;
const CANNON_W = 36;
const CANNON_H = 18;
const CANNON_SPEED = 260;
const PLAYER_BULLET_SPEED = 420;
const ENEMY_BULLET_SPEED = 200;
const ENEMY_FIRE_RATE_BASE = 0.6;
const ENEMY_FIRE_RATE_PER_LEVEL = 0.1;
const GAME_OVER_ROW_Y = CANNON_Y - 40;
const LIVES_START = 3;

const TOTAL_ALIENS = ROWS * COLS;
const FORMATION_WIDTH = COLS * ALIEN_W + (COLS - 1) * GAP_X;

type Alien = { row: number; col: number; alive: boolean };
type Bullet = { x: number; y: number };

function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D context not available");
  return context;
}

type InvasionPalette = {
  alien: string;
  cannon: string;
  playerBullet: string;
  enemyBullet: string;
};

// Skin visual identities. `clasico` reproduces the game's original palette
// (white aliens, cyan cannon, yellow player bullet, pink enemy bullets)
// exactly as it looked before skins existed, so the default view never
// changes for existing players. `neon` swaps in a saturated magenta/cyan duo
// drawn with a black-cored glow border (mold: drawBlockNeon in
// components/games/tetris/engine.ts). `retro` uses a short amber/green
// range with a beveled highlight/shadow strip and no shadowBlur, evoking CRT
// phosphor (mold: drawBlockRetro in the same file).
const SKIN_COLORS: Record<SkinId, InvasionPalette> = {
  clasico: {
    alien: "#ffffff",
    cannon: "#00ffff",
    playerBullet: "#ffff00",
    enemyBullet: "#ff3b6f",
  },
  neon: {
    alien: "#ff00e6",
    cannon: "#00fff9",
    playerBullet: "#faff00",
    enemyBullet: "#ff2d55",
  },
  retro: {
    alien: "#33ff66",
    cannon: "#ffb000",
    playerBullet: "#ffcf6b",
    enemyBullet: "#ff5a1f",
  },
};

function alienShapePath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  context.fillRect(x + 4, y, ALIEN_W - 8, 6);
  context.fillRect(x, y + 6, ALIEN_W, ALIEN_H - 12);
  context.fillRect(x + 2, y + ALIEN_H - 6, 6, 6);
  context.fillRect(x + ALIEN_W - 8, y + ALIEN_H - 6, 6, 6);
}

function drawAlienClasico(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  context.fillStyle = color;
  alienShapePath(context, x, y);
}

function drawAlienNeon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 10;
  context.fillStyle = color;
  alienShapePath(context, x, y);
  context.restore();
  context.save();
  context.globalAlpha = 0.55;
  context.fillStyle = "#ffffff";
  context.fillRect(x + ALIEN_W / 2 - 4, y + 7, 8, ALIEN_H - 14);
  context.restore();
}

function drawAlienRetro(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  context.fillStyle = color;
  alienShapePath(context, x, y);
  context.fillStyle = "rgba(255, 255, 255, 0.25)";
  context.fillRect(x + 4, y, ALIEN_W - 8, 2);
  context.fillStyle = "rgba(0, 0, 0, 0.3)";
  context.fillRect(x, y + ALIEN_H - 8, ALIEN_W, 2);
}

const ALIEN_DRAWERS: Record<
  SkinId,
  (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
  ) => void
> = {
  clasico: drawAlienClasico,
  neon: drawAlienNeon,
  retro: drawAlienRetro,
};

function cannonPath(context: CanvasRenderingContext2D, cannonX: number) {
  context.beginPath();
  context.moveTo(cannonX + CANNON_W / 2, CANNON_Y - CANNON_H);
  context.lineTo(cannonX, CANNON_Y + CANNON_H);
  context.lineTo(cannonX + CANNON_W, CANNON_Y + CANNON_H);
  context.closePath();
}

function drawCannonClasico(
  context: CanvasRenderingContext2D,
  cannonX: number,
  color: string,
) {
  context.fillStyle = color;
  cannonPath(context, cannonX);
  context.fill();
}

function drawCannonNeon(
  context: CanvasRenderingContext2D,
  cannonX: number,
  color: string,
) {
  context.save();
  context.fillStyle = "#000000";
  cannonPath(context, cannonX);
  context.fill();
  context.shadowColor = color;
  context.shadowBlur = 14;
  context.strokeStyle = color;
  context.lineWidth = 2;
  cannonPath(context, cannonX);
  context.stroke();
  context.restore();
  context.save();
  context.globalAlpha = 0.6;
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(cannonX + CANNON_W / 2, CANNON_Y - CANNON_H + 5);
  context.lineTo(cannonX + 6, CANNON_Y + CANNON_H - 3);
  context.lineTo(cannonX + CANNON_W - 6, CANNON_Y + CANNON_H - 3);
  context.closePath();
  context.fill();
  context.restore();
}

function drawCannonRetro(
  context: CanvasRenderingContext2D,
  cannonX: number,
  color: string,
) {
  context.fillStyle = color;
  cannonPath(context, cannonX);
  context.fill();
  context.fillStyle = "rgba(255, 255, 255, 0.25)";
  context.fillRect(cannonX, CANNON_Y + CANNON_H - 4, CANNON_W, 3);
}

const CANNON_DRAWERS: Record<
  SkinId,
  (context: CanvasRenderingContext2D, cannonX: number, color: string) => void
> = {
  clasico: drawCannonClasico,
  neon: drawCannonNeon,
  retro: drawCannonRetro,
};

function drawBulletClasico(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  context.fillStyle = color;
  context.fillRect(x - 1.5, y - 6, 3, 10);
}

function drawBulletNeon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 10;
  context.fillStyle = color;
  context.fillRect(x - 1.5, y - 6, 3, 10);
  context.restore();
}

function drawBulletRetro(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  context.fillStyle = color;
  context.fillRect(x - 1.5, y - 6, 3, 10);
  context.fillStyle = "rgba(255, 255, 255, 0.35)";
  context.fillRect(x - 1.5, y - 6, 3, 2);
}

const BULLET_DRAWERS: Record<
  SkinId,
  (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
  ) => void
> = {
  clasico: drawBulletClasico,
  neon: drawBulletNeon,
  retro: drawBulletRetro,
};

type GameState = "playing" | "gameover";

export function createInvasionGame(
  canvas: HTMLCanvasElement,
  callbacks: InvasionCallbacks,
  options: InvasionOptions = {},
): InvasionGame {
  const ctx = getContext2D(canvas);

  let skin: SkinId = options.skin ?? "clasico";

  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};
  const CAPTURED_CODES = new Set(["ArrowLeft", "ArrowRight", "Space"]);

  function setKey(code: string, isPressed: boolean) {
    if (isPressed) {
      if (!keys[code]) justPressed[code] = true;
      keys[code] = true;
    } else {
      keys[code] = false;
    }
  }

  function pressed(code: string) {
    const val = !!justPressed[code];
    justPressed[code] = false;
    return val;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (paused || state === "gameover") return;
    if (CAPTURED_CODES.has(e.code)) e.preventDefault();
    setKey(e.code, true);
  }
  function onKeyUp(e: KeyboardEvent) {
    setKey(e.code, false);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  let aliens: Alien[] = [];
  let formationX = 0;
  let formationY = 0;
  let formationDir: 1 | -1 = 1;
  let stepTimerMs = BASE_STEP_MS;
  let stepMs = BASE_STEP_MS;
  let cannonX = (CANVAS_W - CANNON_W) / 2;
  let playerBullet: Bullet | null = null;
  let enemyBullets: Bullet[] = [];
  let score = 0;
  let lives = LIVES_START;
  let level = 1;
  let aliveCount = TOTAL_ALIENS;
  let state: GameState = "playing";

  function alienX(alien: Alien) {
    return FORMATION_LEFT + formationX + alien.col * (ALIEN_W + GAP_X);
  }
  function alienY(alien: Alien) {
    return FORMATION_TOP + formationY + alien.row * (ALIEN_H + GAP_Y);
  }

  function recomputeStepMs() {
    const base = BASE_STEP_MS - (level - 1) * LEVEL_STEP_MS_REDUCTION;
    stepMs = Math.max(
      MIN_STEP_MS,
      Math.round(base * (aliveCount / TOTAL_ALIENS)),
    );
  }

  function spawnFormation() {
    aliens = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        aliens.push({ row, col, alive: true });
      }
    }
    aliveCount = TOTAL_ALIENS;
    formationX = 0;
    formationY = 0;
    formationDir = 1;
    recomputeStepMs();
    stepTimerMs = stepMs;
  }

  function initGame() {
    spawnFormation();
    cannonX = (CANVAS_W - CANNON_W) / 2;
    playerBullet = null;
    enemyBullets = [];
    score = 0;
    lives = LIVES_START;
    level = 1;
    state = "playing";
    recomputeStepMs();
    callbacks.onScoreChange?.(score);
    callbacks.onLivesChange?.(lives);
    callbacks.onLevelChange?.(level);
  }

  function nextLevel() {
    level++;
    spawnFormation();
    playerBullet = null;
    enemyBullets = [];
    callbacks.onLevelChange?.(level);
  }

  function forceGameOver() {
    if (state === "gameover") return;
    lives = 0;
    callbacks.onLivesChange?.(lives);
    state = "gameover";
    callbacks.onGameOver?.(score);
  }

  function checkFormationReachedCannon() {
    for (const alien of aliens) {
      if (!alien.alive) continue;
      if (alienY(alien) + ALIEN_H >= GAME_OVER_ROW_Y) {
        state = "gameover";
        callbacks.onGameOver?.(score);
        return;
      }
    }
  }

  function stepFormation() {
    const nextX = formationX + STEP_PX * formationDir;
    const nextLeft = FORMATION_LEFT + nextX;
    const nextRight = nextLeft + FORMATION_WIDTH;
    if (nextLeft < 0 || nextRight > CANVAS_W) {
      formationY += ROW_DROP_PX;
      formationDir = formationDir === 1 ? -1 : 1;
    } else {
      formationX = nextX;
    }
    checkFormationReachedCannon();
  }

  function updateCannon(dt: number) {
    if (keys["ArrowLeft"]) cannonX -= CANNON_SPEED * dt;
    if (keys["ArrowRight"]) cannonX += CANNON_SPEED * dt;
    cannonX = Math.max(0, Math.min(CANVAS_W - CANNON_W, cannonX));
  }

  function tryPlayerShoot() {
    if (playerBullet || !pressed("Space")) return;
    playerBullet = { x: cannonX + CANNON_W / 2, y: CANNON_Y - CANNON_H };
  }

  function updatePlayerBullet(dt: number) {
    if (!playerBullet) return;
    playerBullet.y -= PLAYER_BULLET_SPEED * dt;
    if (playerBullet.y < 0) {
      playerBullet = null;
      return;
    }
    for (const alien of aliens) {
      if (!alien.alive) continue;
      const ax = alienX(alien);
      const ay = alienY(alien);
      if (
        playerBullet.x >= ax &&
        playerBullet.x <= ax + ALIEN_W &&
        playerBullet.y >= ay &&
        playerBullet.y <= ay + ALIEN_H
      ) {
        alien.alive = false;
        aliveCount--;
        score += ROW_POINTS[alien.row];
        callbacks.onScoreChange?.(score);
        playerBullet = null;
        recomputeStepMs();
        if (aliveCount <= 0) nextLevel();
        break;
      }
    }
  }

  function maybeSpawnEnemyBullet(dt: number) {
    const rate = ENEMY_FIRE_RATE_BASE + ENEMY_FIRE_RATE_PER_LEVEL * (level - 1);
    if (Math.random() >= rate * dt) return;
    const shooters = aliens.filter((a) => a.alive);
    if (shooters.length === 0) return;
    const shooter = shooters[Math.floor(Math.random() * shooters.length)];
    enemyBullets.push({
      x: alienX(shooter) + ALIEN_W / 2,
      y: alienY(shooter) + ALIEN_H,
    });
  }

  function updateEnemyBullets(dt: number) {
    for (const bullet of enemyBullets) {
      bullet.y += ENEMY_BULLET_SPEED * dt;
    }
    enemyBullets = enemyBullets.filter((b) => b.y < CANVAS_H);

    for (const bullet of enemyBullets) {
      if (
        bullet.x >= cannonX &&
        bullet.x <= cannonX + CANNON_W &&
        bullet.y >= CANNON_Y &&
        bullet.y <= CANNON_Y + CANNON_H
      ) {
        bullet.y = CANVAS_H;
        lives--;
        callbacks.onLivesChange?.(lives);
        if (lives <= 0) {
          state = "gameover";
          callbacks.onGameOver?.(score);
        }
      }
    }
    enemyBullets = enemyBullets.filter((b) => b.y < CANVAS_H);
  }

  function isGameOver() {
    return state === "gameover";
  }

  function update(dt: number) {
    if (isGameOver()) return;

    updateCannon(dt);
    tryPlayerShoot();
    updatePlayerBullet(dt);
    maybeSpawnEnemyBullet(dt);
    updateEnemyBullets(dt);

    if (isGameOver()) return;

    stepTimerMs -= dt * 1000;
    if (stepTimerMs <= 0) {
      stepFormation();
      stepTimerMs = stepMs;
    }
  }

  function drawAlien(alien: Alien) {
    const x = alienX(alien);
    const y = alienY(alien);
    ALIEN_DRAWERS[skin](ctx, x, y, SKIN_COLORS[skin].alien);
  }

  function drawCannon() {
    CANNON_DRAWERS[skin](ctx, cannonX, SKIN_COLORS[skin].cannon);
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const alien of aliens) {
      if (alien.alive) drawAlien(alien);
    }

    if (playerBullet) {
      BULLET_DRAWERS[skin](
        ctx,
        playerBullet.x,
        playerBullet.y,
        SKIN_COLORS[skin].playerBullet,
      );
    }

    for (const bullet of enemyBullets) {
      BULLET_DRAWERS[skin](
        ctx,
        bullet.x,
        bullet.y,
        SKIN_COLORS[skin].enemyBullet,
      );
    }

    drawCannon();
  }

  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId = 0;

  function loop(ts: number) {
    if (destroyed) return;
    const dt =
      paused || lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused) update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  initGame();
  rafId = requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      lastTime = null;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
    setKey,
    forceGameOver,
    setSkin(newSkin: SkinId) {
      skin = newSkin;
    },
  };
}
