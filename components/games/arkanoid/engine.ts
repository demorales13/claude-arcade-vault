import type { SkinId } from "@/lib/skins";

export type ArkanoidOutcome = "defeat" | "victory";

export type ArkanoidCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onLevelCleared?: (level: number) => void;
  onSoundToggled?: (enabled: boolean) => void;
  onGameOver?: (finalScore: number, outcome: ArkanoidOutcome) => void;
};

export type ArkanoidOptions = {
  soundEnabled?: boolean;
  skin?: SkinId;
};

export type ArkanoidGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void;
  forceGameOver: () => void;
  continueLevel: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setSkin: (skin: SkinId) => void;
  setPointerX: (logicalX: number | null) => void;
};

const CANVAS_W = 800;
const CANVAS_H = 600;
const PADDLE = { w: 120, h: 16, y: 560, speed: 7 };
const BALL = { radius: 8, base: 5.6, maxBounceAngle: Math.PI / 3 };
const SPEED_INCREASE_PER_LEVEL = 0.05;
const BLOCK = {
  rows: 6,
  cols: 10,
  w: 76,
  h: 26,
  gap: 4,
  topOffset: 60,
  points: 10,
};
const ROW_COLORS = [
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
] as const;
const EXPLOSION_DURATION = 150;
const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 3;
const LIVES = 3;

const ASSET_BASE = "/games/arkanoid";
const SPRITESHEET_SRC = `${ASSET_BASE}/spritesheet-breakout.png`;
const BOUNCE_SOUND_SRC = `${ASSET_BASE}/sounds/ball-bounce.mp3`;
const BREAK_SOUND_SRC = `${ASSET_BASE}/sounds/break-sound.mp3`;
const SOUND_VOLUME = 0.5;

type BlockColor = (typeof ROW_COLORS)[number] | "gray";

// Route chosen for skins: the spritesheet's pixel art (paddle, ball, blocks,
// explosion animation) stays exactly as authored for every skin — `clasico`
// draws it untouched. `neon`/`retro` are built by tinting one cached copy of
// the intermediate atlas canvas per skin, once, with non-spatial canvas
// filters (saturate/brightness/contrast/hue-rotate — no blur, since sprite
// frames sit flush against each other in the atlas with no padding and a
// blur filter would bleed color across adjacent rows). The extra glow
// (`neon`) and bevel (`retro`) on top are cheap per-draw canvas state
// (shadowBlur / stroke+fill), not a re-tint, so nothing is recomputed per
// frame beyond ordinary drawImage calls.
const NEON_FILTER = "saturate(1.8) contrast(1.25) brightness(1.12)";
const RETRO_FILTER =
  "sepia(0.6) saturate(2.2) hue-rotate(-8deg) brightness(1.05) contrast(1.15)";

const NEON_ACCENT = "#00f5ff";
const NEON_SHADOW_BLUR = 12;
const NEON_GLOW: Record<BlockColor, string> = {
  red: "#ff3b5c",
  yellow: "#faff00",
  cyan: "#00fff9",
  magenta: "#ff00e6",
  hotpink: "#ff2ec4",
  green: "#00ff85",
  gray: "#8fa6c9",
};

const RETRO_BEVEL_DARK = "rgba(0, 0, 0, 0.45)";
const RETRO_BEVEL_LIGHT = "rgba(255, 255, 255, 0.16)";

type SpriteFrame = { sx: number; sy: number; sw: number; sh: number };

const SPRITES: {
  paddle: SpriteFrame;
  ball: SpriteFrame;
  blocks: Record<BlockColor, SpriteFrame>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};

const EXPLOSION_FRAMES: Record<BlockColor, SpriteFrame[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

// Cada nivel es un array de BLOCK.rows strings de longitud BLOCK.cols.
// 'X' = bloque presente en esa celda, '.' = hueco (sin bloque).
const LEVELS: string[][] = [
  // Nivel 1 — cuadrícula completa
  [
    "XXXXXXXXXX",
    "XXXXXXXXXX",
    "XXXXXXXXXX",
    "XXXXXXXXXX",
    "XXXXXXXXXX",
    "XXXXXXXXXX",
  ],
  // Nivel 2 — hueco en forma de diamante en el centro
  [
    "XXXXXXXXXX",
    "XXXX..XXXX",
    "XXX....XXX",
    "XXX....XXX",
    "XXXX..XXXX",
    "XXXXXXXXXX",
  ],
  // Nivel 3 — tablero de ajedrez
  [
    "X.X.X.X.X.",
    ".X.X.X.X.X",
    "X.X.X.X.X.",
    ".X.X.X.X.X",
    "X.X.X.X.X.",
    ".X.X.X.X.X",
  ],
];
const TOTAL_LEVELS = LEVELS.length;

function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D context not available");
  return context;
}

type Block = {
  row: number;
  col: number;
  color: BlockColor;
  x: number;
  y: number;
  alive: boolean;
};

type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  startTime: number;
};

type Screen = "playing" | "levelCleared";

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
  options: ArkanoidOptions = {},
): ArkanoidGame {
  const ctx = getContext2D(canvas);

  let soundEnabled = options.soundEnabled ?? true;
  let skin: SkinId = options.skin ?? "clasico";

  // ---- spritesheet: dibujado a un canvas intermedio antes de usarlo ----
  // `ssBase` es el atlas tal cual (skin `clasico`). `skinVariants` cachea una
  // copia teñida por skin, construida una sola vez al cargar la imagen — ver
  // `buildSkinVariant`. Nunca se recalcula por frame.
  let ssBase: HTMLCanvasElement | null = null;
  let ssLoaded = false;
  const skinVariants: Partial<Record<SkinId, HTMLCanvasElement>> = {};

  function buildSkinVariant(
    base: HTMLCanvasElement,
    filter: string,
  ): HTMLCanvasElement {
    const oc = document.createElement("canvas");
    oc.width = base.width;
    oc.height = base.height;
    const octx = oc.getContext("2d");
    if (!octx) return base;
    octx.filter = filter;
    octx.drawImage(base, 0, 0);
    return oc;
  }

  function buildSkinVariants(base: HTMLCanvasElement) {
    skinVariants.clasico = base;
    skinVariants.neon = buildSkinVariant(base, NEON_FILTER);
    skinVariants.retro = buildSkinVariant(base, RETRO_FILTER);
  }

  function activeSpritesheet(): HTMLCanvasElement | null {
    return skinVariants[skin] ?? ssBase;
  }

  function loadSpritesheet() {
    const rawImg = new Image();
    rawImg.onload = () => {
      const oc = document.createElement("canvas");
      oc.width = rawImg.width;
      oc.height = rawImg.height;
      const octx = oc.getContext("2d");
      if (!octx) return;
      octx.drawImage(rawImg, 0, 0);
      ssBase = oc;
      buildSkinVariants(oc);
      ssLoaded = true;
      if (!destroyed) {
        rafId = requestAnimationFrame(loop);
      }
    };
    rawImg.onerror = () => {
      console.error("No se pudo cargar el spritesheet de ARKANOID");
    };
    rawImg.src = SPRITESHEET_SRC;
  }

  function drawFrame(
    frame: SpriteFrame,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const sheet = activeSpritesheet();
    if (!ssLoaded || !sheet) return;
    ctx.drawImage(sheet, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
  }

  function drawRetroBevel(x: number, y: number, w: number, h: number) {
    ctx.save();
    ctx.strokeStyle = RETRO_BEVEL_DARK;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = RETRO_BEVEL_LIGHT;
    ctx.fillRect(x + 1, y + 1, w - 2, Math.max(2, Math.round(h * 0.18)));
    ctx.restore();
  }

  // ---- sonido ----
  function playSound(src: string) {
    if (!soundEnabled) return;
    const audio = new Audio(src);
    audio.volume = SOUND_VOLUME;
    audio.play().catch(() => {});
  }
  function playBounceSound() {
    playSound(BOUNCE_SOUND_SRC);
  }
  function playBreakSound() {
    playSound(BREAK_SOUND_SRC);
  }

  // ---- teclado ----
  const keys: Record<string, boolean> = {};
  const CAPTURED_CODES = new Set([
    "ArrowLeft",
    "ArrowRight",
    "KeyA",
    "KeyD",
    "KeyS",
  ]);
  const PADDLE_KEYS = new Set(["ArrowLeft", "ArrowRight", "KeyA", "KeyD"]);

  // ---- puntero (arrastre de paleta) ----
  // Tiene prioridad sobre las flechas hasta que se pulse una, que lo limpia.
  let pointerTargetX: number | null = null;

  function setPointerX(logicalX: number | null) {
    pointerTargetX = logicalX;
  }

  function setKey(code: string, isPressed: boolean) {
    keys[code] = isPressed;
    if (isPressed && PADDLE_KEYS.has(code)) pointerTargetX = null;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (CAPTURED_CODES.has(e.code)) e.preventDefault();

    if (e.code === "KeyS") {
      if (!e.repeat) {
        // No decide por su cuenta: el reproductor es el único dueño del
        // valor y confirma el nuevo estado llamando a setSoundEnabled().
        callbacks.onSoundToggled?.(!soundEnabled);
      }
      return;
    }

    setKey(e.code, true);
  }
  function onKeyUp(e: KeyboardEvent) {
    if (e.code === "KeyS") return;
    setKey(e.code, false);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ---- estado del juego ----
  let screen: Screen = "playing";
  let score = 0;
  let lives = LIVES;
  let level = 1;
  const paddle = { x: (CANVAS_W - PADDLE.w) / 2 };
  const ball = { x: 0, y: 0, dx: 0, dy: 0, speed: BALL.base };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let clock = 0; // reloj interno acumulado del motor, en ms
  let gameOver = false;

  function resetPaddle() {
    paddle.x = (CANVAS_W - PADDLE.w) / 2;
  }

  function speedForLevel(lvl: number) {
    return BALL.base * Math.pow(1 + SPEED_INCREASE_PER_LEVEL, lvl - 1);
  }

  function resetBall() {
    ball.speed = speedForLevel(level);
    ball.x = paddle.x + PADDLE.w / 2;
    ball.y = PADDLE.y - BALL.radius;
    ball.dx = ball.speed * Math.SQRT1_2;
    ball.dy = -ball.speed * Math.SQRT1_2;
  }

  function createBlocks(lvl: number) {
    const gridWidth = BLOCK.cols * BLOCK.w + (BLOCK.cols - 1) * BLOCK.gap;
    const leftOffset = (CANVAS_W - gridWidth) / 2;
    const layout = LEVELS[lvl - 1];

    blocks = [];
    for (let row = 0; row < BLOCK.rows; row++) {
      for (let col = 0; col < BLOCK.cols; col++) {
        if (layout[row][col] !== "X") continue;
        blocks.push({
          row,
          col,
          color: ROW_COLORS[row],
          x: leftOffset + col * (BLOCK.w + BLOCK.gap),
          y: BLOCK.topOffset + row * (BLOCK.h + BLOCK.gap),
          alive: true,
        });
      }
    }
    explosions = [];
  }

  function allBlocksDestroyed() {
    return blocks.every((b) => !b.alive);
  }

  function spawnExplosion(block: Block) {
    explosions.push({
      x: block.x,
      y: block.y,
      w: BLOCK.w,
      h: BLOCK.h,
      color: block.color,
      startTime: clock,
    });
  }

  function checkBlockCollision() {
    for (const block of blocks) {
      if (!block.alive) continue;

      const closestX = Math.max(block.x, Math.min(ball.x, block.x + BLOCK.w));
      const closestY = Math.max(block.y, Math.min(ball.y, block.y + BLOCK.h));
      const dx = ball.x - closestX;
      const dy = ball.y - closestY;

      if (dx * dx + dy * dy > BALL.radius * BALL.radius) continue;

      block.alive = false;
      score += BLOCK.points;
      callbacks.onScoreChange?.(score);
      spawnExplosion(block);
      playBreakSound();

      const overlapLeft = ball.x + BALL.radius - block.x;
      const overlapRight = block.x + BLOCK.w - (ball.x - BALL.radius);
      const overlapTop = ball.y + BALL.radius - block.y;
      const overlapBottom = block.y + BLOCK.h - (ball.y - BALL.radius);

      const minOverlapX = Math.min(overlapLeft, overlapRight);
      const minOverlapY = Math.min(overlapTop, overlapBottom);

      if (minOverlapX < minOverlapY) {
        ball.dx = -ball.dx;
      } else {
        ball.dy = -ball.dy;
      }

      break;
    }
  }

  function checkPaddleCollision() {
    const hitsPaddle =
      ball.dy > 0 &&
      ball.y + BALL.radius >= PADDLE.y &&
      ball.y + BALL.radius <= PADDLE.y + PADDLE.h &&
      ball.x + BALL.radius >= paddle.x &&
      ball.x - BALL.radius <= paddle.x + PADDLE.w;

    if (!hitsPaddle) return;

    const paddleCenter = paddle.x + PADDLE.w / 2;
    const relativeIntersect = (ball.x - paddleCenter) / (PADDLE.w / 2);
    const clampedIntersect = Math.max(-1, Math.min(1, relativeIntersect));
    const bounceAngle = clampedIntersect * BALL.maxBounceAngle;

    ball.dx = ball.speed * Math.sin(bounceAngle);
    ball.dy = -ball.speed * Math.cos(bounceAngle);
    ball.y = PADDLE.y - BALL.radius;

    playBounceSound();
  }

  function loseLife() {
    lives -= 1;
    callbacks.onLivesChange?.(lives);
    if (lives <= 0) {
      endGame("defeat");
      return;
    }
    resetBall();
  }

  function updateBall() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    if (ball.x - BALL.radius <= 0) {
      ball.x = BALL.radius;
      ball.dx = -ball.dx;
      playBounceSound();
    } else if (ball.x + BALL.radius >= CANVAS_W) {
      ball.x = CANVAS_W - BALL.radius;
      ball.dx = -ball.dx;
      playBounceSound();
    }

    if (ball.y - BALL.radius <= 0) {
      ball.y = BALL.radius;
      ball.dy = -ball.dy;
      playBounceSound();
    }

    checkBlockCollision();
    checkPaddleCollision();

    if (ball.y - BALL.radius > CANVAS_H) {
      loseLife();
    }
  }

  function updatePaddle() {
    if (pointerTargetX !== null) {
      paddle.x = pointerTargetX - PADDLE.w / 2;
    } else {
      if (keys["ArrowLeft"] || keys["KeyA"]) paddle.x -= PADDLE.speed;
      if (keys["ArrowRight"] || keys["KeyD"]) paddle.x += PADDLE.speed;
    }

    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + PADDLE.w > CANVAS_W) paddle.x = CANVAS_W - PADDLE.w;
  }

  function updateExplosions() {
    explosions = explosions.filter(
      (explosion) => clock - explosion.startTime < EXPLOSION_DURATION,
    );
  }

  function goToNextLevel() {
    level += 1;
    callbacks.onLevelChange?.(level);
    resetPaddle();
    resetBall();
    createBlocks(level);
    screen = "playing";
    accumulator = 0;
  }

  function continueLevel() {
    if (screen !== "levelCleared") return;
    goToNextLevel();
  }

  function endGame(outcome: ArkanoidOutcome) {
    if (gameOver) return;
    gameOver = true;
    accumulator = 0;
    callbacks.onGameOver?.(score, outcome);
  }

  function forceGameOver() {
    endGame("defeat");
  }

  function stepSimulation() {
    if (screen !== "playing") return;

    updatePaddle();
    updateBall();
    updateExplosions();

    if (gameOver) return;

    if (allBlocksDestroyed() && explosions.length === 0) {
      if (level >= TOTAL_LEVELS) {
        endGame("victory");
      } else {
        screen = "levelCleared";
        accumulator = 0;
        callbacks.onLevelCleared?.(level);
      }
    }
  }

  // ---- dibujado ----
  function withNeonGlow(color: string, draw: () => void) {
    if (skin !== "neon") {
      draw();
      return;
    }
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = NEON_SHADOW_BLUR;
    draw();
    ctx.restore();
  }

  function drawPaddle() {
    withNeonGlow(NEON_ACCENT, () =>
      drawFrame(SPRITES.paddle, paddle.x, PADDLE.y, PADDLE.w, PADDLE.h),
    );
    if (skin === "retro")
      drawRetroBevel(paddle.x, PADDLE.y, PADDLE.w, PADDLE.h);
  }

  function drawBall() {
    withNeonGlow(NEON_ACCENT, () =>
      drawFrame(
        SPRITES.ball,
        ball.x - BALL.radius,
        ball.y - BALL.radius,
        BALL.radius * 2,
        BALL.radius * 2,
      ),
    );
  }

  function drawBlocks() {
    for (const block of blocks) {
      if (!block.alive) continue;
      withNeonGlow(NEON_GLOW[block.color], () =>
        drawFrame(
          SPRITES.blocks[block.color],
          block.x,
          block.y,
          BLOCK.w,
          BLOCK.h,
        ),
      );
      if (skin === "retro") drawRetroBevel(block.x, block.y, BLOCK.w, BLOCK.h);
    }
  }

  function drawExplosions() {
    for (const explosion of explosions) {
      const elapsed = clock - explosion.startTime;
      const frameIndex = Math.min(
        3,
        Math.max(0, Math.floor(elapsed / (EXPLOSION_DURATION / 4))),
      );
      const frame = EXPLOSION_FRAMES[explosion.color][frameIndex];
      withNeonGlow(NEON_GLOW[explosion.color], () =>
        drawFrame(frame, explosion.x, explosion.y, explosion.w, explosion.h),
      );
    }
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (!ssLoaded) return;

    drawBlocks();
    drawExplosions();
    drawPaddle();
    drawBall();
  }

  // ---- loop de paso fijo ----
  let accumulator = 0;
  let lastTime: number | null = null;
  let paused = false;
  let destroyed = false;
  let rafId = 0;

  function loop(ts: number) {
    if (destroyed) return;

    const frameDt = lastTime === null ? 0 : (ts - lastTime) / 1000;
    lastTime = ts;

    if (!paused && !gameOver && screen === "playing") {
      accumulator += frameDt;
      const maxAccum = STEP * MAX_STEPS_PER_FRAME;
      if (accumulator > maxAccum) accumulator = maxAccum;

      while (accumulator >= STEP) {
        clock += STEP * 1000;
        stepSimulation();
        accumulator -= STEP;
        if (gameOver || screen !== "playing") break;
      }
    }

    draw();
    rafId = requestAnimationFrame(loop);
  }

  function initGame() {
    score = 0;
    lives = LIVES;
    level = 1;
    screen = "playing";
    gameOver = false;
    accumulator = 0;
    resetPaddle();
    resetBall();
    createBlocks(level);

    callbacks.onScoreChange?.(score);
    callbacks.onLivesChange?.(lives);
    callbacks.onLevelChange?.(level);
  }

  initGame();
  loadSpritesheet();

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      lastTime = null;
      accumulator = 0;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
    setKey,
    forceGameOver,
    continueLevel,
    setSoundEnabled(enabled: boolean) {
      soundEnabled = enabled;
    },
    setSkin(newSkin: SkinId) {
      skin = newSkin;
    },
    setPointerX,
  };
}
