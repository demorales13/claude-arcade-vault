export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel";

export const SKIN_LABELS: Record<TetrisSkin, string> = {
  retro: "Retro",
  neon: "Neon",
  pastel: "Pastel",
  pixel: "Pixel Art",
};

export type TetrisCallbacks = {
  onScoreChange?: (score: number) => void;
  onLinesChange?: (lines: number) => void;
  onLevelChange?: (level: number) => void;
  onComboChange?: (combo: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type TetrisOptions = {
  skin?: TetrisSkin;
  soundEnabled?: boolean;
};

export type TetrisGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void;
  forceGameOver: () => void;
  setSkin: (skin: TetrisSkin) => void;
  setSoundEnabled: (enabled: boolean) => void;
};

const CANVAS_W = 800;
const CANVAS_H = 600;
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const BOARD_X = 250;
const BOARD_Y = 0;

const NEXT_BOX_X = 615;
const NEXT_BOX_Y = 80;
const NEXT_BLOCK = 30;
const NEXT_LABEL_X = 675;
const NEXT_LABEL_Y = 60;

const GRID_LINE_COLOR = "rgba(0, 245, 255, 0.12)";
const BOARD_BORDER_COLOR = "rgba(0, 245, 255, 0.6)";

const PIECES: number[][][] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const LINE_NAMES = ["", "SINGLE", "DOUBLE", "TRIPLE", "TETRIS"];
const TSPIN_SCORES = [100, 200, 400, 600];
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000];

type EffectType = "combo" | "tetris" | "tspin" | "b2b" | "perfect";

const EFFECT_COLORS: Record<EffectType, string> = {
  combo: "#ffd54f",
  tetris: "#4dd0e1",
  tspin: "#ba68c8",
  b2b: "#ff8a65",
  perfect: "#81c784",
};

const EFFECTS_CENTER_X = 125;
const EFFECTS_CENTER_Y = 300;

type FloatingText = {
  text: string;
  color: string;
  created: number;
  duration: number;
  row: number;
};

const SKIN_COLORS: Record<TetrisSkin, string[]> = {
  retro: [
    "",
    "#4dd0e1",
    "#ffd54f",
    "#ba68c8",
    "#81c784",
    "#e57373",
    "#90caf9",
    "#ffb74d",
  ],
  neon: [
    "",
    "#00fff9",
    "#faff00",
    "#ff00e6",
    "#00ff85",
    "#ff2d55",
    "#00aaff",
    "#ff9500",
  ],
  pastel: [
    "",
    "#a7d8de",
    "#fff2b2",
    "#d9b8e0",
    "#bfe3c0",
    "#f4b6b6",
    "#b8d3f4",
    "#f8d3a8",
  ],
  pixel: [
    "",
    "#4dd0e1",
    "#ffd54f",
    "#ba68c8",
    "#81c784",
    "#e57373",
    "#90caf9",
    "#ffb74d",
  ],
};

function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D context not available");
  return context;
}

type SoundKind = "clear" | "combo" | "tetris" | "tspin" | "b2b" | "perfect";

function getAudioContextClass(): typeof AudioContext | undefined {
  type WindowWithWebkitAudio = typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return (
    window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext
  );
}

function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00ff) + percent;
  let b = (num & 0x0000ff) + percent;
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function drawRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawBlockRetro(
  context: CanvasRenderingContext2D,
  px: number,
  py: number,
  color: string,
  size: number,
) {
  context.fillStyle = color;
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.fillStyle = "rgba(255,255,255,0.12)";
  context.fillRect(px + 1, py + 1, size - 2, 4);
}

function drawBlockNeon(
  context: CanvasRenderingContext2D,
  px: number,
  py: number,
  color: string,
  size: number,
) {
  context.fillStyle = "#000000";
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  context.shadowColor = color;
  context.shadowBlur = 14;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(px + 3, py + 3, size - 6, size - 6);
  context.shadowBlur = 8;
  context.fillStyle = color;
  context.fillRect(px + 5, py + 5, size - 10, size - 10);
}

function drawBlockPastel(
  context: CanvasRenderingContext2D,
  px: number,
  py: number,
  color: string,
  size: number,
) {
  const x = px + 2;
  const y = py + 2;
  const s = size - 4;
  drawRoundedRectPath(context, x, y, s, s, 6);
  context.fillStyle = color;
  context.fill();
  drawRoundedRectPath(context, x, y, s, Math.max(s * 0.35, 4), 6);
  context.fillStyle = "rgba(255,255,255,0.4)";
  context.fill();
}

function drawBlockPixel(
  context: CanvasRenderingContext2D,
  px: number,
  py: number,
  color: string,
  size: number,
) {
  context.fillStyle = shadeColor(color, -60);
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  const inset = 4;
  const inner = size - inset * 2;
  context.fillStyle = color;
  context.fillRect(px + inset, py + inset, inner, inner);
  const half = Math.ceil(inner / 2);
  context.fillStyle = shadeColor(color, 35);
  context.fillRect(px + inset, py + inset, half, half);
  context.fillStyle = shadeColor(color, -35);
  context.fillRect(
    px + inset + inner - half,
    py + inset + inner - half,
    half,
    half,
  );
}

const SKIN_DRAWERS: Record<
  TetrisSkin,
  (
    context: CanvasRenderingContext2D,
    px: number,
    py: number,
    color: string,
    size: number,
  ) => void
> = {
  retro: drawBlockRetro,
  neon: drawBlockNeon,
  pastel: drawBlockPastel,
  pixel: drawBlockPixel,
};

type Piece = {
  type: number;
  shape: number[][];
  x: number;
  y: number;
};

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
  options: TetrisOptions = {},
): TetrisGame {
  const ctx = getContext2D(canvas);

  let skin: TetrisSkin = options.skin ?? "neon";
  let soundEnabled = options.soundEnabled ?? true;
  let audioCtx: AudioContext | null = null;

  function ensureAudioCtx(): AudioContext | null {
    if (!soundEnabled) return null;
    if (!audioCtx) {
      const AudioContextClass = getAudioContextClass();
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function beep(
    freq: number,
    duration = 0.12,
    type: OscillatorType = "sine",
    delay = 0,
    volume = 0.15,
  ) {
    const ctxA = ensureAudioCtx();
    if (!ctxA) return;
    const osc = ctxA.createOscillator();
    const gain = ctxA.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctxA.destination);
    const startTime = ctxA.currentTime + delay;
    osc.start(startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.stop(startTime + duration + 0.02);
  }

  function playSound(kind: SoundKind) {
    if (!soundEnabled) return;
    try {
      switch (kind) {
        case "clear":
          beep(440, 0.12, "sine");
          break;
        case "combo":
          beep(440 + Math.min(combo, 10) * 55, 0.12, "square");
          break;
        case "tetris":
          [523, 659, 784, 988].forEach((f, i) =>
            beep(f, 0.14, "square", i * 0.06),
          );
          break;
        case "tspin":
          beep(660, 0.1, "triangle");
          beep(880, 0.14, "triangle", 0.09);
          break;
        case "b2b":
          beep(784, 0.1, "sawtooth");
          beep(988, 0.14, "sawtooth", 0.08);
          break;
        case "perfect":
          [523, 659, 784, 988, 1175].forEach((f, i) =>
            beep(f, 0.16, "sine", i * 0.09),
          );
          break;
      }
    } catch {
      // Web Audio no disponible; se ignora silenciosamente.
    }
  }

  const CAPTURED_CODES = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowDown",
    "ArrowUp",
    "KeyX",
    "Space",
  ]);

  let board: number[][];
  let current: Piece;
  let next: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = 1000;
  let dropAccum = 0;
  let combo = 0;
  let b2bActive = false;
  let lastMoveWasRotation = false;
  let floatingTexts: FloatingText[] = [];
  let gameOver = false;
  let paused = false;
  let destroyed = false;
  let lastTime: number | null = null;
  let rafId = 0;

  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 7) + 1;
    const shape = PIECES[type].map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result: number[][] = Array.from({ length: cols }, () =>
      new Array(rows).fill(0),
    );
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        lastMoveWasRotation = true;
        return;
      }
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function detectTSpin(): boolean {
    if (current.type !== 3 || !lastMoveWasRotation) return false;
    const corners: [number, number][] = [
      [current.y, current.x],
      [current.y, current.x + 2],
      [current.y + 2, current.x],
      [current.y + 2, current.x + 2],
    ];
    let filled = 0;
    for (const [ry, rx] of corners) {
      if (rx < 0 || rx >= COLS || ry >= ROWS) filled++;
      else if (ry >= 0 && board[ry][rx]) filled++;
    }
    return filled >= 3;
  }

  function queueEffect(text: string, type: EffectType, row = 0) {
    floatingTexts.push({
      text,
      color: EFFECT_COLORS[type],
      created: performance.now(),
      duration: 1100,
      row,
    });
  }

  function flashBoard() {
    canvas.classList.remove("flash");
    void canvas.offsetWidth;
    canvas.classList.add("flash");
  }

  function clearLines(tspin: boolean): number {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }

    combo = cleared > 0 ? combo + 1 : 0;
    callbacks.onComboChange?.(combo);

    if (cleared === 0) {
      if (tspin) {
        score += TSPIN_SCORES[0] * level;
        callbacks.onScoreChange?.(score);
        queueEffect("T-SPIN", "tspin");
        playSound("tspin");
        flashBoard();
      }
      return cleared;
    }

    const isTetris = cleared === 4;
    const qualifiesForB2B = isTetris || tspin;
    let base = (LINE_SCORES[cleared] || 0) * level;
    if (tspin) base += TSPIN_SCORES[cleared] * level;

    const comboMultiplier = Math.max(1, combo);
    let total = base * comboMultiplier;

    const isB2B = qualifiesForB2B && b2bActive;
    if (isB2B) total += Math.floor(base * 0.5);
    b2bActive = qualifiesForB2B;

    score += total;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);

    const effects: { text: string; type: EffectType }[] = [];
    if (tspin)
      effects.push({ text: `T-SPIN ${LINE_NAMES[cleared]}`, type: "tspin" });
    else if (isTetris) effects.push({ text: "TETRIS", type: "tetris" });
    if (isB2B) effects.push({ text: "BACK-TO-BACK", type: "b2b" });
    if (combo > 1) effects.push({ text: `COMBO x${combo}`, type: "combo" });

    const isPerfectClear = board.every((row) => row.every((v) => v === 0));
    if (isPerfectClear) {
      score += PERFECT_CLEAR_SCORES[cleared] * level;
      effects.push({ text: "PERFECT CLEAR!", type: "perfect" });
    }

    effects.forEach((e, i) => queueEffect(e.text, e.type, i));

    const soundKind: SoundKind = isPerfectClear
      ? "perfect"
      : isB2B
        ? "b2b"
        : tspin
          ? "tspin"
          : isTetris
            ? "tetris"
            : combo > 1
              ? "combo"
              : "clear";
    playSound(soundKind);
    if (isTetris || tspin || isB2B || isPerfectClear) flashBoard();

    callbacks.onScoreChange?.(score);
    callbacks.onLinesChange?.(lines);
    callbacks.onLevelChange?.(level);
    return cleared;
  }

  function spawn() {
    current = next;
    next = randomPiece();
    lastMoveWasRotation = false;
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
  }

  function lockPiece() {
    const tspin = detectTSpin();
    merge();
    clearLines(tspin);
    spawn();
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    callbacks.onScoreChange?.(score);
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      callbacks.onScoreChange?.(score);
    } else {
      lockPiece();
    }
  }

  function endGame() {
    if (gameOver) return;
    gameOver = true;
    callbacks.onGameOver?.(score);
  }

  function forceGameOver() {
    endGame();
  }

  function processInput(code: string) {
    switch (code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) {
          current.x--;
          lastMoveWasRotation = false;
        }
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) {
          current.x++;
          lastMoveWasRotation = false;
        }
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  }

  function setKey(code: string, isPressed: boolean) {
    if (!isPressed || paused || gameOver) return;
    processInput(code);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (CAPTURED_CODES.has(e.code)) e.preventDefault();
    if (paused || gameOver) return;
    processInput(e.code);
  }

  window.addEventListener("keydown", onKeyDown);

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    dropAccum = 0;
    combo = 0;
    b2bActive = false;
    lastMoveWasRotation = false;
    floatingTexts = [];
    gameOver = false;
    next = randomPiece();
    spawn();
    callbacks.onScoreChange?.(score);
    callbacks.onLinesChange?.(lines);
    callbacks.onLevelChange?.(level);
    callbacks.onComboChange?.(combo);
  }

  function update(dt: number) {
    if (gameOver) return;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }

  // Parte del lienzo que nunca cambia frame a frame: el fondo negro y la
  // cuadrícula del tablero (ni depende del estado del juego ni de la skin,
  // a diferencia de Crossing). Recibe un contexto explícito porque también se
  // usa para rellenar `bgCache` (ver más abajo), no solo el canvas real.
  function drawStaticBoard(target: CanvasRenderingContext2D) {
    target.fillStyle = "#000000";
    target.fillRect(0, 0, CANVAS_W, CANVAS_H);

    target.strokeStyle = GRID_LINE_COLOR;
    target.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      target.beginPath();
      target.moveTo(BOARD_X + c * BLOCK, BOARD_Y);
      target.lineTo(BOARD_X + c * BLOCK, BOARD_Y + ROWS * BLOCK);
      target.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      target.beginPath();
      target.moveTo(BOARD_X, BOARD_Y + r * BLOCK);
      target.lineTo(BOARD_X + COLS * BLOCK, BOARD_Y + r * BLOCK);
      target.stroke();
    }

    target.strokeStyle = BOARD_BORDER_COLOR;
    target.lineWidth = 2;
    target.strokeRect(BOARD_X, BOARD_Y, COLS * BLOCK, ROWS * BLOCK);
  }

  // Cachea `drawStaticBoard` en un canvas auxiliar a la resolución física
  // real (`canvas.width`/`height`, que ya incluye el devicePixelRatio que
  // aplicó `setupHiDpiCanvas`) para no recalcular el relleno de fondo + 9
  // líneas verticales + 19 horizontales + el borde en cada frame. A
  // diferencia de Crossing, ni el fondo ni la cuadrícula dependen de la skin
  // (`GRID_LINE_COLOR`/`BOARD_BORDER_COLOR` son constantes), así que se
  // dibuja una única vez y no necesita invalidarse. Molde:
  // `ensureBgCache`/`drawStaticBands` en components/games/crossing/engine.ts.
  let bgCache: HTMLCanvasElement | null = null;

  function ensureBgCache() {
    if (bgCache) return;
    bgCache = document.createElement("canvas");
    bgCache.width = canvas.width;
    bgCache.height = canvas.height;
    const bgCacheCtx = getContext2D(bgCache);
    const scaleX = canvas.width / CANVAS_W;
    const scaleY = canvas.height / CANVAS_H;
    bgCacheCtx.scale(scaleX, scaleY);
    drawStaticBoard(bgCacheCtx);
  }

  function drawBlock(
    px: number,
    py: number,
    colorIndex: number,
    size: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    SKIN_DRAWERS[skin](ctx, px, py, SKIN_COLORS[skin][colorIndex], size);
    ctx.restore();
  }

  function drawBoard() {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(BOARD_X + c * BLOCK, BOARD_Y + r * BLOCK, board[r][c], BLOCK);

    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(
            BOARD_X + (current.x + c) * BLOCK,
            BOARD_Y + (gy + r) * BLOCK,
            current.shape[r][c],
            BLOCK,
            0.2,
          );

    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(
          BOARD_X + (current.x + c) * BLOCK,
          BOARD_Y + (current.y + r) * BLOCK,
          current.shape[r][c],
          BLOCK,
        );
  }

  function drawNextPanel() {
    ctx.save();
    ctx.fillStyle = "#8a8fb5";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("SIGUIENTE", NEXT_LABEL_X, NEXT_LABEL_Y);
    ctx.restore();

    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(
          NEXT_BOX_X + (offX + c) * NEXT_BLOCK,
          NEXT_BOX_Y + (offY + r) * NEXT_BLOCK,
          shape[r][c],
          NEXT_BLOCK,
        );
  }

  function drawEffects() {
    if (!floatingTexts.length) return;
    const now = performance.now();
    floatingTexts = floatingTexts.filter((f) => now - f.created < f.duration);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "bold 18px system-ui, sans-serif";
    floatingTexts.forEach((f) => {
      const t = (now - f.created) / f.duration;
      ctx.globalAlpha = Math.max(1 - t, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(
        f.text,
        EFFECTS_CENTER_X,
        EFFECTS_CENTER_Y - 10 - f.row * 26 - t * 30,
      );
    });
    ctx.restore();
  }

  function draw() {
    ensureBgCache();
    if (bgCache) ctx.drawImage(bgCache, 0, 0, CANVAS_W, CANVAS_H);
    drawBoard();
    drawNextPanel();
    drawEffects();
  }

  function loop(ts: number) {
    if (destroyed) return;
    const dt = paused || lastTime === null ? 0 : Math.min(ts - lastTime, 50);
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
      if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
      }
    },
    setKey,
    forceGameOver,
    setSkin(newSkin: TetrisSkin) {
      skin = newSkin;
    },
    setSoundEnabled(enabled: boolean) {
      soundEnabled = enabled;
    },
  };
}
