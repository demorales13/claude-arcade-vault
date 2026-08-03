import type { SkinId } from "@/lib/skins";

export type SnakeCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type SnakeOptions = {
  skin?: SkinId;
};

export type SnakeGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void;
  forceGameOver: () => void;
  setSkin: (skin: SkinId) => void;
};

const CELL = 24;
const COLS = 20;
const ROWS = 20;
const CANVAS_W = 800;
const CANVAS_H = 600;
const BOARD_X = (CANVAS_W - COLS * CELL) / 2;
const BOARD_Y = (CANVAS_H - ROWS * CELL) / 2;

const POINTS_PER_FRUIT = 10;
const FRUITS_PER_LEVEL = 5;
const TICK_START_MS = 160;
const TICK_STEP_MS = 12;
const TICK_MIN_MS = 60;
const START_LENGTH = 3;

const FRUIT_SOURCE = "/games/snake/fruits.png";

type FruitSprite = { x: number; y: number; w: number; h: number };

// Portado 1:1 de references/snake-assets/sprites.js — mismos recortes.
const FRUIT_ATLAS: Record<string, FruitSprite> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};
const FRUIT_KEYS = Object.keys(FRUIT_ATLAS);

type Direction = "up" | "down" | "left" | "right";

const DIRECTION_BY_CODE: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

function opposite(dir: Direction): Direction {
  if (dir === "up") return "down";
  if (dir === "down") return "up";
  if (dir === "left") return "right";
  return "left";
}

type Cell = { col: number; row: number };
type Fruit = Cell & { sprite: string };

function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D context not available");
  return context;
}

type SnakePalette = {
  body: string;
  head: string;
  fruitFallback: string;
};

// Skin visual identities. `clasico` reproduces the game's original palette
// (flat green body, glowing head) exactly as it looked before skins existed,
// so the default view never changes for existing players. `neon` swaps in a
// cyan/magenta duo drawn with a black-cored glow border (mold: drawBlockNeon
// in components/games/tetris/engine.ts). `retro` uses a short amber range
// with a beveled highlight strip and no shadowBlur, evoking CRT phosphor.
const SKIN_COLORS: Record<SkinId, SnakePalette> = {
  clasico: {
    body: "#00cc6e",
    head: "#00ff88",
    fruitFallback: "#ff3b3b",
  },
  neon: {
    body: "#00e5ff",
    head: "#ff00e6",
    fruitFallback: "#faff00",
  },
  retro: {
    body: "#ffb000",
    head: "#ffcf6b",
    fruitFallback: "#ff5a1f",
  },
};

const EYE_COLOR = "#04150c";

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + w - r, y);
  context.arcTo(x + w, y, x + w, y + r, r);
  context.lineTo(x + w, y + h - r);
  context.arcTo(x + w, y + h, x + w - r, y + h, r);
  context.lineTo(x + r, y + h);
  context.arcTo(x, y + h, x, y + h - r, r);
  context.lineTo(x, y + r);
  context.arcTo(x, y, x + r, y, r);
  context.closePath();
}

function drawBodyClasico(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  context.fillStyle = color;
  context.fillRect(x + 1, y + 1, size - 2, size - 2);
}

function drawBodyNeon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  context.fillStyle = "#000000";
  context.fillRect(x + 1, y + 1, size - 2, size - 2);
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(x + 3, y + 3, size - 6, size - 6);
  context.restore();
  context.save();
  context.globalAlpha = 0.35;
  context.fillStyle = color;
  context.fillRect(x + 5, y + 5, size - 10, size - 10);
  context.restore();
}

function drawBodyRetro(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  context.fillStyle = color;
  context.fillRect(x + 1, y + 1, size - 2, size - 2);
  context.fillStyle = "rgba(255, 255, 255, 0.18)";
  context.fillRect(x + 1, y + 1, size - 2, 4);
  context.fillStyle = "rgba(0, 0, 0, 0.25)";
  context.fillRect(x + 1, y + size - 5, size - 2, 4);
}

function drawHeadClasico(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 8;
  context.fillStyle = color;
  roundedRectPath(context, x + 1, y + 1, size - 2, size - 2, 6);
  context.fill();
  context.restore();
}

function drawHeadNeon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  roundedRectPath(context, x + 1, y + 1, size - 2, size - 2, 6);
  context.fillStyle = "#000000";
  context.fill();
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 16;
  roundedRectPath(context, x + 3, y + 3, size - 6, size - 6, 5);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.stroke();
  context.restore();
  roundedRectPath(context, x + 5, y + 5, size - 10, size - 10, 4);
  context.fillStyle = color;
  context.fill();
}

function drawHeadRetro(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  roundedRectPath(context, x + 1, y + 1, size - 2, size - 2, 4);
  context.fillStyle = color;
  context.fill();
  roundedRectPath(context, x + 1, y + 1, size - 2, 4, 4);
  context.fillStyle = "rgba(255, 255, 255, 0.22)";
  context.fill();
}

const SKIN_DRAWERS: Record<
  SkinId,
  {
    body: (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number,
      color: string,
    ) => void;
    head: (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      size: number,
      color: string,
    ) => void;
  }
> = {
  clasico: { body: drawBodyClasico, head: drawHeadClasico },
  neon: { body: drawBodyNeon, head: drawHeadNeon },
  retro: { body: drawBodyRetro, head: drawHeadRetro },
};

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
  options: SnakeOptions = {},
): SnakeGame {
  const ctx = getContext2D(canvas);
  let skin: SkinId = options.skin ?? "clasico";

  // ---- atlas de frutas: precargado antes de arrancar el loop ----
  let fruitImg: HTMLImageElement | null = null;
  let fruitImgLoaded = false;

  function loadFruitImage() {
    const img = new Image();
    img.onload = () => {
      fruitImg = img;
      fruitImgLoaded = true;
      if (!destroyed) rafId = requestAnimationFrame(loop);
    };
    img.onerror = () => {
      console.error("No se pudo cargar el atlas de frutas de SERPIENTE");
      if (!destroyed) rafId = requestAnimationFrame(loop);
    };
    img.src = FRUIT_SOURCE;
  }

  // ---- teclado ----
  const CAPTURED_CODES = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ]);

  function setKey(code: string, pressed: boolean) {
    if (!pressed) return;
    const dir = DIRECTION_BY_CODE[code];
    if (dir) requestDirection(dir);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (CAPTURED_CODES.has(e.code)) e.preventDefault();
    setKey(e.code, true);
  }

  window.addEventListener("keydown", onKeyDown);

  // ---- estado del juego ----
  let snake: Cell[] = [];
  let direction: Direction = "right";
  let nextDirection: Direction = "right";
  let fruit: Fruit | null = null;
  let score = 0;
  let level = 1;
  let fruitsEaten = 0;
  let tickAccumulatorMs = 0;
  let gameOver = false;

  function requestDirection(dir: Direction) {
    // Se compara contra `direction` (la última aplicada en un tick), no
    // contra `nextDirection` (la pendiente): así dos giros rápidos dentro
    // de la misma ventana de tick no pueden encadenarse en una reversa de
    // 180° antes de que el primer giro llegue a aplicarse.
    if (dir === opposite(direction)) return;
    nextDirection = dir;
  }

  function tickIntervalForLevel(lvl: number) {
    return Math.max(TICK_MIN_MS, TICK_START_MS - (lvl - 1) * TICK_STEP_MS);
  }

  function spawnFruit() {
    const occupied = new Set(snake.map((s) => `${s.col},${s.row}`));
    const free: Cell[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!occupied.has(`${col},${row}`)) free.push({ col, row });
      }
    }
    if (free.length === 0) {
      fruit = null;
      return;
    }
    const cell = free[Math.floor(Math.random() * free.length)];
    const sprite = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
    fruit = { ...cell, sprite };
  }

  function endGame() {
    if (gameOver) return;
    gameOver = true;
    callbacks.onGameOver?.(score);
  }

  function forceGameOver() {
    endGame();
  }

  function stepTick() {
    direction = nextDirection;
    const head = snake[0];
    const newHead: Cell = { col: head.col, row: head.row };
    if (direction === "up") newHead.row -= 1;
    else if (direction === "down") newHead.row += 1;
    else if (direction === "left") newHead.col -= 1;
    else newHead.col += 1;

    if (
      newHead.col < 0 ||
      newHead.col >= COLS ||
      newHead.row < 0 ||
      newHead.row >= ROWS
    ) {
      endGame();
      return;
    }

    const ateFruit =
      fruit !== null && newHead.col === fruit.col && newHead.row === fruit.row;
    const bodyToCheck = ateFruit ? snake : snake.slice(0, snake.length - 1);
    if (
      bodyToCheck.some(
        (seg) => seg.col === newHead.col && seg.row === newHead.row,
      )
    ) {
      endGame();
      return;
    }

    snake.unshift(newHead);
    if (ateFruit) {
      score += POINTS_PER_FRUIT;
      callbacks.onScoreChange?.(score);
      fruitsEaten += 1;
      if (fruitsEaten % FRUITS_PER_LEVEL === 0) {
        level += 1;
        callbacks.onLevelChange?.(level);
      }
      spawnFruit();
    } else {
      snake.pop();
    }
  }

  function update(dt: number) {
    if (gameOver) return;
    tickAccumulatorMs += dt * 1000;
    while (!gameOver && tickAccumulatorMs >= tickIntervalForLevel(level)) {
      tickAccumulatorMs -= tickIntervalForLevel(level);
      stepTick();
    }
  }

  // ---- dibujado ----
  // Tablero (fondo negro + rejilla + borde): no depende de la skin (colores
  // fijos) ni cambia nunca durante la partida, así que es 100% estático
  // frame a frame. Recibe un contexto explícito porque también se usa para
  // rellenar `bgCache` (ver más abajo), no solo el canvas real.
  function drawBoard(target: CanvasRenderingContext2D) {
    target.fillStyle = "#000";
    target.fillRect(0, 0, CANVAS_W, CANVAS_H);

    target.fillStyle = "#001a0d";
    target.fillRect(BOARD_X, BOARD_Y, COLS * CELL, ROWS * CELL);

    target.strokeStyle = "rgba(0, 255, 136, 0.08)";
    target.lineWidth = 1;
    for (let col = 0; col <= COLS; col++) {
      const x = BOARD_X + col * CELL + 0.5;
      target.beginPath();
      target.moveTo(x, BOARD_Y);
      target.lineTo(x, BOARD_Y + ROWS * CELL);
      target.stroke();
    }
    for (let row = 0; row <= ROWS; row++) {
      const y = BOARD_Y + row * CELL + 0.5;
      target.beginPath();
      target.moveTo(BOARD_X, y);
      target.lineTo(BOARD_X + COLS * CELL, y);
      target.stroke();
    }

    target.strokeStyle = "rgba(0, 255, 136, 0.5)";
    target.lineWidth = 2;
    target.strokeRect(BOARD_X, BOARD_Y, COLS * CELL, ROWS * CELL);
  }

  // Cachea `drawBoard` en un canvas auxiliar a la resolución física real
  // (`canvas.width`/`height`, que ya incluye el devicePixelRatio que aplicó
  // `setupHiDpiCanvas`) para no recalcular el fondo + 40 líneas de rejilla +
  // borde en cada frame; se dibuja una sola vez y se vuelca con `drawImage`
  // (molde: `ensureBgCache` en components/games/crossing/engine.ts). A
  // diferencia de Crossing, el tablero de Serpiente no tiene ninguna parte
  // animada (sin ondas de río) ni depende de la skin, así que no hace falta
  // invalidar el cache nunca tras la primera vez.
  let bgCache: HTMLCanvasElement | null = null;
  let bgCacheCtx: CanvasRenderingContext2D | null = null;

  function ensureBgCache() {
    if (bgCache) return;
    bgCache = document.createElement("canvas");
    bgCache.width = canvas.width;
    bgCache.height = canvas.height;
    bgCacheCtx = getContext2D(bgCache);
    const scaleX = canvas.width / CANVAS_W;
    const scaleY = canvas.height / CANVAS_H;
    bgCacheCtx.scale(scaleX, scaleY);
    drawBoard(bgCacheCtx);
  }

  function drawFruit() {
    if (!fruit) return;
    const cx = BOARD_X + fruit.col * CELL + CELL / 2;
    const cy = BOARD_Y + fruit.row * CELL + CELL / 2;

    if (fruitImgLoaded && fruitImg) {
      const sprite = FRUIT_ATLAS[fruit.sprite];
      const scale = Math.min(CELL / sprite.w, CELL / sprite.h) * 0.92;
      const dw = sprite.w * scale;
      const dh = sprite.h * scale;
      ctx.drawImage(
        fruitImg,
        sprite.x,
        sprite.y,
        sprite.w,
        sprite.h,
        cx - dw / 2,
        cy - dh / 2,
        dw,
        dh,
      );
    } else {
      ctx.fillStyle = SKIN_COLORS[skin].fruitFallback;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHeadEyes() {
    const head = snake[0];
    const cx = BOARD_X + head.col * CELL + CELL / 2;
    const cy = BOARD_Y + head.row * CELL + CELL / 2;
    const along = CELL * 0.22;
    const side = CELL * 0.18;

    let ax = 0,
      ay = 0,
      sx = 0,
      sy = 0;
    if (direction === "up") {
      ay = -along;
      sx = side;
    } else if (direction === "down") {
      ay = along;
      sx = side;
    } else if (direction === "left") {
      ax = -along;
      sy = side;
    } else {
      ax = along;
      sy = side;
    }

    const eyeRadius = CELL * 0.09;
    ctx.fillStyle = EYE_COLOR;
    ctx.beginPath();
    ctx.arc(cx + ax - sx, cy + ay - sy, eyeRadius, 0, Math.PI * 2);
    ctx.arc(cx + ax + sx, cy + ay + sy, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnake() {
    const palette = SKIN_COLORS[skin];
    const drawers = SKIN_DRAWERS[skin];

    for (let i = snake.length - 1; i >= 1; i--) {
      const seg = snake[i];
      const x = BOARD_X + seg.col * CELL;
      const y = BOARD_Y + seg.row * CELL;
      drawers.body(ctx, x, y, CELL, palette.body);
    }

    const head = snake[0];
    const hx = BOARD_X + head.col * CELL;
    const hy = BOARD_Y + head.row * CELL;
    drawers.head(ctx, hx, hy, CELL, palette.head);

    drawHeadEyes();
  }

  function draw() {
    ensureBgCache();
    if (bgCache) ctx.drawImage(bgCache, 0, 0, CANVAS_W, CANVAS_H);
    drawFruit();
    drawSnake();
  }

  // ---- loop ----
  let lastTime: number | null = null;
  let paused = false;
  let destroyed = false;
  let rafId = 0;

  function loop(ts: number) {
    if (destroyed) return;

    const frameDt =
      lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    if (!paused && !gameOver) {
      update(frameDt);
    }

    draw();
    rafId = requestAnimationFrame(loop);
  }

  function initGame() {
    score = 0;
    level = 1;
    fruitsEaten = 0;
    gameOver = false;
    tickAccumulatorMs = 0;
    direction = "right";
    nextDirection = "right";

    const startRow = Math.floor(ROWS / 2);
    const startCol = Math.floor(COLS / 2) - 1;
    snake = [];
    for (let i = 0; i < START_LENGTH; i++) {
      snake.push({ col: startCol - i, row: startRow });
    }
    spawnFruit();

    callbacks.onScoreChange?.(score);
    callbacks.onLivesChange?.(1);
    callbacks.onLevelChange?.(level);
  }

  initGame();
  loadFruitImage();

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      lastTime = null;
      tickAccumulatorMs = 0;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
    setKey,
    forceGameOver,
    setSkin(newSkin: SkinId) {
      skin = newSkin;
    },
  };
}
