export type InvasionCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type InvasionGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void;
  forceGameOver: () => void;
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

type GameState = "playing" | "gameover";

export function createInvasionGame(
  canvas: HTMLCanvasElement,
  callbacks: InvasionCallbacks,
): InvasionGame {
  const ctx = getContext2D(canvas);

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
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 4, y, ALIEN_W - 8, 6);
    ctx.fillRect(x, y + 6, ALIEN_W, ALIEN_H - 12);
    ctx.fillRect(x + 2, y + ALIEN_H - 6, 6, 6);
    ctx.fillRect(x + ALIEN_W - 8, y + ALIEN_H - 6, 6, 6);
  }

  function drawCannon() {
    ctx.fillStyle = "#00ffff";
    ctx.beginPath();
    ctx.moveTo(cannonX + CANNON_W / 2, CANNON_Y - CANNON_H);
    ctx.lineTo(cannonX, CANNON_Y + CANNON_H);
    ctx.lineTo(cannonX + CANNON_W, CANNON_Y + CANNON_H);
    ctx.closePath();
    ctx.fill();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const alien of aliens) {
      if (alien.alive) drawAlien(alien);
    }

    if (playerBullet) {
      ctx.fillStyle = "#ffff00";
      ctx.fillRect(playerBullet.x - 1.5, playerBullet.y - 6, 3, 10);
    }

    ctx.fillStyle = "#ff3b6f";
    for (const bullet of enemyBullets) {
      ctx.fillRect(bullet.x - 1.5, bullet.y - 6, 3, 10);
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
  };
}
