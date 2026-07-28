export type SnakeCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type SnakeGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void;
  forceGameOver: () => void;
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
const FRUIT_FALLBACK_COLOR = "#ff3b3b";

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

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
): SnakeGame {
  const ctx = getContext2D(canvas);

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
  function drawBoard() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = "#001a0d";
    ctx.fillRect(BOARD_X, BOARD_Y, COLS * CELL, ROWS * CELL);

    ctx.strokeStyle = "rgba(0, 255, 136, 0.08)";
    ctx.lineWidth = 1;
    for (let col = 0; col <= COLS; col++) {
      const x = BOARD_X + col * CELL + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, BOARD_Y);
      ctx.lineTo(x, BOARD_Y + ROWS * CELL);
      ctx.stroke();
    }
    for (let row = 0; row <= ROWS; row++) {
      const y = BOARD_Y + row * CELL + 0.5;
      ctx.beginPath();
      ctx.moveTo(BOARD_X, y);
      ctx.lineTo(BOARD_X + COLS * CELL, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(0, 255, 136, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X, BOARD_Y, COLS * CELL, ROWS * CELL);
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
      ctx.fillStyle = FRUIT_FALLBACK_COLOR;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function roundedRectPath(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
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
    ctx.fillStyle = "#04150c";
    ctx.beginPath();
    ctx.arc(cx + ax - sx, cy + ay - sy, eyeRadius, 0, Math.PI * 2);
    ctx.arc(cx + ax + sx, cy + ay + sy, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnake() {
    for (let i = snake.length - 1; i >= 1; i--) {
      const seg = snake[i];
      const x = BOARD_X + seg.col * CELL;
      const y = BOARD_Y + seg.row * CELL;
      ctx.fillStyle = "#00cc6e";
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    }

    const head = snake[0];
    const hx = BOARD_X + head.col * CELL;
    const hy = BOARD_Y + head.row * CELL;

    ctx.save();
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#00ff88";
    roundedRectPath(hx + 1, hy + 1, CELL - 2, CELL - 2, 6);
    ctx.fill();
    ctx.restore();

    drawHeadEyes();
  }

  function draw() {
    drawBoard();
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
  };
}
