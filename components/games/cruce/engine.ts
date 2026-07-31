import type { SkinId } from "@/lib/skins";

export type CruceCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type CruceOptions = {
  skin?: SkinId;
};

export type CruceGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void;
  forceGameOver: () => void;
  setSkin: (skin: SkinId) => void;
};

const CELL = 40;
const COLS = 11;
const ROWS = 13; // fila 0 = meta, 1-5 río, 6 mediana, 7-11 calzada, 12 salida
const CANVAS_W = 800;
const CANVAS_H = 600;
const BOARD_W = COLS * CELL;
const BOARD_H = ROWS * CELL;
const BOARD_X = (CANVAS_W - BOARD_W) / 2;
const BOARD_Y = (CANVAS_H - BOARD_H) / 2;
const GOAL_COLS = [0, 2, 5, 8, 10];

const START_LIVES = 3;
const POINTS_PER_ADVANCE = 10;
const GOAL_BONUS = 50;
const HOP_LOCK_MS = 120;
const LANE_SPEED_STEP = 0.15;

const GOAL_ROW = 0;
const RIVER_ROWS = [1, 2, 3, 4, 5];
const MEDIAN_ROW = 6;
const ROAD_ROWS = [7, 8, 9, 10, 11];
const EXIT_ROW = 12;
const START_COL = Math.floor(COLS / 2);

type Direction = "up" | "down" | "left" | "right";

const DIRECTION_BY_CODE: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// Velocidad base (celdas/seg a nivel 1) de cada carril, con variación por fila
// para que no todos se sientan iguales; el nivel las multiplica via LANE_SPEED_STEP.
const ROAD_SPEEDS: Record<number, number> = {
  7: 2.2,
  8: 2.8,
  9: 1.8,
  10: 3.0,
  11: 2.4,
};
const RIVER_SPEEDS: Record<number, number> = {
  1: 1.4,
  2: 1.0,
  3: 1.6,
  4: 1.2,
  5: 1.8,
};

type Lane = {
  row: number;
  type: "river" | "road";
  dir: 1 | -1;
  baseSpeed: number;
  distance: number; // distancia firmada acumulada (celdas), avanza dir*speed*dt
  objectWidth: number;
  objectCount: number;
  offset: number;
};

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function buildLanes(): Lane[] {
  const lanes: Lane[] = [];
  for (const row of RIVER_ROWS) {
    lanes.push({
      row,
      type: "river",
      dir: row % 2 === 0 ? 1 : -1,
      baseSpeed: RIVER_SPEEDS[row],
      distance: 0,
      objectWidth: 2,
      objectCount: 3,
      offset: (row * 7) % (COLS + 4),
    });
  }
  for (const row of ROAD_ROWS) {
    lanes.push({
      row,
      type: "road",
      dir: row % 2 === 0 ? 1 : -1,
      baseSpeed: ROAD_SPEEDS[row],
      distance: 0,
      objectWidth: 1,
      objectCount: 3,
      offset: (row * 7) % (COLS + 2),
    });
  }
  return lanes;
}

// Posiciones actuales (en celdas, con decimales) de los objetos de un carril.
function laneObjectCols(lane: Lane): number[] {
  const cycle = COLS + lane.objectWidth * 2;
  const spacing = cycle / lane.objectCount;
  const cols: number[] = [];
  for (let i = 0; i < lane.objectCount; i++) {
    const base = lane.offset + i * spacing;
    cols.push(mod(base + lane.distance, cycle) - lane.objectWidth);
  }
  return cols;
}

function laneEffectiveSpeed(lane: Lane, level: number): number {
  return lane.baseSpeed * (1 + (level - 1) * LANE_SPEED_STEP);
}

function cellOverlap(col: number, objCol: number, objWidth: number): boolean {
  return objCol < col + 1 && objCol + objWidth > col;
}

function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D context not available");
  return context;
}

type CrucePalette = {
  bg: string;
  goalRow: string;
  goalUnfilled: string;
  goalFilled: string;
  river: string;
  riverLine: string;
  median: string;
  road: string;
  roadLine: string;
  exit: string;
  log: string;
  logHighlight: string;
  vehicles: string[];
  player: string;
  playerOutline: string;
  boardBorder: string;
};

// Identidades visuales de cada skin. `clasico` reproduce 1:1 la paleta
// original del juego (fondos planos, sin efectos) para que la vista por
// defecto no cambie para quien ya jugaba. `neon` sube la saturación sobre
// negros con tinte violeta/azul y usa shadowBlur en meta, vehículos, troncos
// y jugador (molde: drawBlockNeon en components/games/tetris/engine.ts).
// `retro` usa un rango corto ámbar/verde/naranja tipo fósforo CRT con bisel
// (highlight/shadow planos) y sin resplandor (molde: drawBlockPixel/
// drawBlockRetro en el mismo archivo).
const SKIN_COLORS: Record<SkinId, CrucePalette> = {
  clasico: {
    bg: "#000000",
    goalRow: "#04202a",
    goalUnfilled: "#0a3a48",
    goalFilled: "#00ff88",
    river: "#052b33",
    riverLine: "rgba(0, 245, 255, 0.12)",
    median: "#141a12",
    road: "#17171c",
    roadLine: "rgba(255, 255, 255, 0.25)",
    exit: "#141a12",
    log: "#8a5a2c",
    logHighlight: "rgba(255, 255, 255, 0.18)",
    vehicles: ["#ff006e", "#f5ff00", "#00ff88"],
    player: "#00f5ff",
    playerOutline: "#e6e9ff",
    boardBorder: "rgba(0, 245, 255, 0.5)",
  },
  neon: {
    bg: "#000000",
    goalRow: "#12002a",
    goalUnfilled: "#b400ff",
    goalFilled: "#39ff14",
    river: "#00131a",
    riverLine: "rgba(255, 0, 230, 0.22)",
    median: "#0a0316",
    road: "#0d0417",
    roadLine: "rgba(255, 0, 230, 0.35)",
    exit: "#0a0316",
    log: "#ff8a00",
    logHighlight: "rgba(255, 210, 130, 0.3)",
    vehicles: ["#ff003c", "#00e5ff", "#faff00"],
    player: "#00e5ff",
    playerOutline: "#eafcff",
    boardBorder: "rgba(255, 0, 230, 0.6)",
  },
  retro: {
    bg: "#0a0500",
    goalRow: "#1a1000",
    goalUnfilled: "#5c3d00",
    goalFilled: "#ffb000",
    river: "#142400",
    riverLine: "rgba(80, 200, 90, 0.2)",
    median: "#101800",
    road: "#1a1002",
    roadLine: "rgba(255, 176, 0, 0.35)",
    exit: "#101800",
    log: "#cc7a00",
    logHighlight: "rgba(255, 210, 130, 0.35)",
    vehicles: ["#ff7300", "#ffcf3a", "#4dff6a"],
    player: "#ffb000",
    playerOutline: "#3a2200",
    boardBorder: "rgba(255, 176, 0, 0.55)",
  },
};

type CruceDrawers = {
  goal: (
    context: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    filled: boolean,
    palette: CrucePalette,
  ) => void;
  log: (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    palette: CrucePalette,
  ) => void;
  vehicle: (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ) => void;
  player: (
    context: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    palette: CrucePalette,
  ) => void;
};

function drawGoalClasico(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  filled: boolean,
  palette: CrucePalette,
) {
  context.save();
  if (filled) {
    context.shadowColor = palette.goalFilled;
    context.shadowBlur = 10;
    context.fillStyle = palette.goalFilled;
  } else {
    context.fillStyle = palette.goalUnfilled;
  }
  context.beginPath();
  context.arc(cx, cy, r, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawGoalNeon(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  filled: boolean,
  palette: CrucePalette,
) {
  const color = filled ? palette.goalFilled : palette.goalUnfilled;
  context.save();
  context.fillStyle = "#000000";
  context.beginPath();
  context.arc(cx, cy, r, 0, Math.PI * 2);
  context.fill();
  context.shadowColor = color;
  context.shadowBlur = filled ? 18 : 10;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(cx, cy, r - 1, 0, Math.PI * 2);
  context.stroke();
  if (filled) {
    context.globalAlpha = 0.55;
    context.fillStyle = color;
    context.beginPath();
    context.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawGoalRetro(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  filled: boolean,
  palette: CrucePalette,
) {
  const color = filled ? palette.goalFilled : palette.goalUnfilled;
  context.save();
  context.fillStyle = color;
  context.beginPath();
  context.arc(cx, cy, r, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(255, 255, 255, 0.2)";
  context.beginPath();
  context.arc(cx, cy - r * 0.3, r * 0.55, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawLogClasico(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: CrucePalette,
) {
  context.fillStyle = palette.log;
  context.fillRect(x + 1, y + 6, w - 2, h - 12);
  context.fillStyle = palette.logHighlight;
  context.fillRect(x + 1, y + 6, w - 2, 3);
}

function drawLogNeon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: CrucePalette,
) {
  context.save();
  context.fillStyle = "#000000";
  context.fillRect(x + 1, y + 6, w - 2, h - 12);
  context.shadowColor = palette.log;
  context.shadowBlur = 12;
  context.strokeStyle = palette.log;
  context.lineWidth = 2;
  context.strokeRect(x + 2, y + 7, w - 4, h - 14);
  context.globalAlpha = 0.4;
  context.fillStyle = palette.log;
  context.fillRect(x + 4, y + 9, w - 8, h - 18);
  context.restore();
}

function drawLogRetro(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: CrucePalette,
) {
  context.fillStyle = palette.log;
  context.fillRect(x + 1, y + 6, w - 2, h - 12);
  context.fillStyle = palette.logHighlight;
  context.fillRect(x + 1, y + 6, w - 2, 3);
  context.fillStyle = "rgba(0, 0, 0, 0.3)";
  context.fillRect(x + 1, y + h - 15, w - 2, 3);
}

function drawVehicleClasico(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 6;
  context.fillStyle = color;
  context.fillRect(x + 3, y + 6, w - 6, h - 12);
  context.restore();
}

function drawVehicleNeon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  context.save();
  context.fillStyle = "#000000";
  context.fillRect(x + 3, y + 6, w - 6, h - 12);
  context.shadowColor = color;
  context.shadowBlur = 16;
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(x + 4, y + 7, w - 8, h - 14);
  context.globalAlpha = 0.4;
  context.fillStyle = color;
  context.fillRect(x + 6, y + 9, w - 12, h - 18);
  context.restore();
}

function drawVehicleRetro(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  context.fillStyle = color;
  context.fillRect(x + 3, y + 6, w - 6, h - 12);
  context.fillStyle = "rgba(255, 255, 255, 0.22)";
  context.fillRect(x + 3, y + 6, w - 6, 3);
  context.fillStyle = "rgba(0, 0, 0, 0.28)";
  context.fillRect(x + 3, y + h - 15, w - 6, 3);
}

function drawPlayerClasico(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  palette: CrucePalette,
) {
  context.save();
  context.shadowColor = palette.player;
  context.shadowBlur = 10;
  context.fillStyle = palette.player;
  context.beginPath();
  context.moveTo(cx, cy - size * 0.32);
  context.lineTo(cx + size * 0.28, cy + size * 0.24);
  context.lineTo(cx - size * 0.28, cy + size * 0.24);
  context.closePath();
  context.fill();
  context.strokeStyle = palette.playerOutline;
  context.lineWidth = 1.5;
  context.stroke();
  context.restore();
}

function drawPlayerNeon(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  palette: CrucePalette,
) {
  context.save();
  context.beginPath();
  context.moveTo(cx, cy - size * 0.34);
  context.lineTo(cx + size * 0.3, cy + size * 0.26);
  context.lineTo(cx - size * 0.3, cy + size * 0.26);
  context.closePath();
  context.fillStyle = "#000000";
  context.fill();
  context.shadowColor = palette.player;
  context.shadowBlur = 18;
  context.strokeStyle = palette.player;
  context.lineWidth = 2;
  context.stroke();
  context.beginPath();
  context.moveTo(cx, cy - size * 0.22);
  context.lineTo(cx + size * 0.18, cy + size * 0.16);
  context.lineTo(cx - size * 0.18, cy + size * 0.16);
  context.closePath();
  context.fillStyle = palette.playerOutline;
  context.fill();
  context.restore();
}

function drawPlayerRetro(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  palette: CrucePalette,
) {
  context.save();
  context.beginPath();
  context.moveTo(cx, cy - size * 0.32);
  context.lineTo(cx + size * 0.28, cy + size * 0.24);
  context.lineTo(cx - size * 0.28, cy + size * 0.24);
  context.closePath();
  context.fillStyle = palette.player;
  context.fill();
  context.strokeStyle = palette.playerOutline;
  context.lineWidth = 1.5;
  context.stroke();
  context.beginPath();
  context.moveTo(cx, cy - size * 0.32);
  context.lineTo(cx + size * 0.12, cy - size * 0.02);
  context.lineTo(cx - size * 0.12, cy - size * 0.02);
  context.closePath();
  context.fillStyle = "rgba(255, 255, 255, 0.3)";
  context.fill();
  context.restore();
}

const SKIN_DRAWERS: Record<SkinId, CruceDrawers> = {
  clasico: {
    goal: drawGoalClasico,
    log: drawLogClasico,
    vehicle: drawVehicleClasico,
    player: drawPlayerClasico,
  },
  neon: {
    goal: drawGoalNeon,
    log: drawLogNeon,
    vehicle: drawVehicleNeon,
    player: drawPlayerNeon,
  },
  retro: {
    goal: drawGoalRetro,
    log: drawLogRetro,
    vehicle: drawVehicleRetro,
    player: drawPlayerRetro,
  },
};

export function createCruceGame(
  canvas: HTMLCanvasElement,
  callbacks: CruceCallbacks,
  options: CruceOptions = {},
): CruceGame {
  const ctx = getContext2D(canvas);
  let skin: SkinId = options.skin ?? "clasico";

  // ---- teclado ----
  const CAPTURED_CODES = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ]);
  const heldCodes = new Set<string>();

  function onKeyDown(e: KeyboardEvent) {
    if (CAPTURED_CODES.has(e.code)) e.preventDefault();
    setKey(e.code, true);
  }
  function onKeyUp(e: KeyboardEvent) {
    setKey(e.code, false);
  }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ---- estado ----
  let lanes: Lane[] = buildLanes();
  let player = { row: EXIT_ROW, col: START_COL };
  let minRowReached = EXIT_ROW; // fila más avanzada (menor número) alcanzada en la vida actual
  let filledGoals: boolean[] = GOAL_COLS.map(() => false);
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let totalElapsedMs = 0;
  let hopLockUntilMs = 0;
  let gameOver = false;
  let paused = false;
  let destroyed = false;
  let rafId = 0;
  let lastTime: number | null = null;

  function laneForRow(row: number): Lane | undefined {
    return lanes.find((l) => l.row === row);
  }

  function respawnPlayer() {
    player = { row: EXIT_ROW, col: START_COL };
  }

  function endGame() {
    if (gameOver) return;
    gameOver = true;
    callbacks.onGameOver?.(score);
  }

  function forceGameOver() {
    endGame();
  }

  function loseLife() {
    if (gameOver) return;
    lives -= 1;
    callbacks.onLivesChange?.(Math.max(lives, 0));
    if (lives <= 0) {
      endGame();
      return;
    }
    respawnPlayer();
    minRowReached = EXIT_ROW;
  }

  function fillGoal(index: number) {
    filledGoals[index] = true;
    score += GOAL_BONUS;
    callbacks.onScoreChange?.(score);
    respawnPlayer();
    if (filledGoals.every(Boolean)) {
      level += 1;
      filledGoals = GOAL_COLS.map(() => false);
      callbacks.onLevelChange?.(level);
    }
  }

  function requestHop(dir: Direction) {
    if (paused || gameOver) return;
    if (totalElapsedMs < hopLockUntilMs) return;
    hopLockUntilMs = totalElapsedMs + HOP_LOCK_MS;
    applyHop(dir);
  }

  function applyHop(dir: Direction) {
    const fromCol = Math.round(player.col);
    let newRow = player.row;
    let newCol = fromCol;
    if (dir === "up") newRow -= 1;
    else if (dir === "down") newRow += 1;
    else if (dir === "left") newCol -= 1;
    else newCol += 1;

    if (newCol < 0 || newCol >= COLS) return; // fuera del tablero: salto inválido
    if (newRow < GOAL_ROW || newRow > EXIT_ROW) return; // fuera del tablero: salto inválido

    if (newRow === GOAL_ROW) {
      const goalIndex = GOAL_COLS.indexOf(newCol);
      if (goalIndex === -1 || filledGoals[goalIndex]) return; // seto o meta ya ocupada
      fillGoal(goalIndex);
      return;
    }

    player = { row: newRow, col: newCol };
    if (newRow < minRowReached) {
      minRowReached = newRow;
      score += POINTS_PER_ADVANCE;
      callbacks.onScoreChange?.(score);
    }
  }

  function setKey(code: string, pressed: boolean) {
    const dir = DIRECTION_BY_CODE[code];
    if (!dir) return;
    const wasHeld = heldCodes.has(code);
    if (pressed) {
      heldCodes.add(code);
      if (!wasHeld) requestHop(dir);
    } else {
      heldCodes.delete(code);
    }
  }

  function advanceLanes(dt: number) {
    for (const lane of lanes) {
      const speed = laneEffectiveSpeed(lane, level);
      lane.distance += lane.dir * speed * dt;
    }
  }

  function checkPlayerSafety(dt: number) {
    if (gameOver) return;
    if (ROAD_ROWS.includes(player.row)) {
      const lane = laneForRow(player.row);
      if (!lane) return;
      const cols = laneObjectCols(lane);
      const hit = cols.some((c) =>
        cellOverlap(player.col, c, lane.objectWidth),
      );
      if (hit) loseLife();
      return;
    }
    if (RIVER_ROWS.includes(player.row)) {
      const lane = laneForRow(player.row);
      if (!lane) return;
      const cols = laneObjectCols(lane);
      const carrying = cols.some((c) =>
        cellOverlap(player.col, c, lane.objectWidth),
      );
      if (!carrying) {
        loseLife();
        return;
      }
      const speed = laneEffectiveSpeed(lane, level);
      player.col += lane.dir * speed * dt;
      if (player.col < -0.999 || player.col > COLS - 0.001) {
        loseLife();
      }
    }
  }

  function update(dt: number) {
    if (gameOver) return;
    totalElapsedMs += dt * 1000;
    advanceLanes(dt);
    checkPlayerSafety(dt);
  }

  // ---- dibujado ----
  function drawRowBands() {
    const palette = SKIN_COLORS[skin];

    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = palette.goalRow;
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_W, CELL);

    ctx.fillStyle = palette.river;
    ctx.fillRect(BOARD_X, BOARD_Y + CELL, BOARD_W, CELL * RIVER_ROWS.length);

    ctx.fillStyle = palette.median;
    ctx.fillRect(BOARD_X, BOARD_Y + MEDIAN_ROW * CELL, BOARD_W, CELL);

    ctx.fillStyle = palette.road;
    ctx.fillRect(
      BOARD_X,
      BOARD_Y + ROAD_ROWS[0] * CELL,
      BOARD_W,
      CELL * ROAD_ROWS.length,
    );

    ctx.fillStyle = palette.exit;
    ctx.fillRect(BOARD_X, BOARD_Y + EXIT_ROW * CELL, BOARD_W, CELL);

    // líneas de carril del río
    ctx.strokeStyle = palette.riverLine;
    ctx.lineWidth = 1;
    for (const row of RIVER_ROWS) {
      const y = BOARD_Y + row * CELL + 0.5;
      ctx.beginPath();
      ctx.moveTo(BOARD_X, y);
      ctx.lineTo(BOARD_X + BOARD_W, y);
      ctx.stroke();
    }

    // líneas discontinuas de la calzada
    ctx.strokeStyle = palette.roadLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    for (const row of ROAD_ROWS) {
      const y = BOARD_Y + row * CELL + CELL / 2;
      ctx.beginPath();
      ctx.moveTo(BOARD_X, y);
      ctx.lineTo(BOARD_X + BOARD_W, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.strokeStyle = palette.boardBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
  }

  function drawGoals() {
    const palette = SKIN_COLORS[skin];
    const drawer = SKIN_DRAWERS[skin].goal;
    for (let i = 0; i < GOAL_COLS.length; i++) {
      const col = GOAL_COLS[i];
      const cx = BOARD_X + col * CELL + CELL / 2;
      const cy = BOARD_Y + CELL / 2;
      drawer(ctx, cx, cy, CELL * 0.3, filledGoals[i], palette);
    }
  }

  function drawLanes() {
    // los objetos de carril viajan un poco más allá de [0, COLS) para entrar/
    // salir de forma continua; se recortan al rectángulo del tablero para que
    // nunca se dibujen sobre el fondo negro fuera del marco cian.
    const palette = SKIN_COLORS[skin];
    const drawers = SKIN_DRAWERS[skin];
    ctx.save();
    ctx.beginPath();
    ctx.rect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
    ctx.clip();

    lanes.forEach((lane, laneIndex) => {
      const cols = laneObjectCols(lane);
      const y = BOARD_Y + lane.row * CELL;
      if (lane.type === "river") {
        for (const c of cols) {
          const x = BOARD_X + c * CELL;
          const w = lane.objectWidth * CELL;
          drawers.log(ctx, x, y, w, CELL, palette);
        }
      } else {
        const color = palette.vehicles[laneIndex % palette.vehicles.length];
        for (const c of cols) {
          const x = BOARD_X + c * CELL;
          const w = lane.objectWidth * CELL;
          drawers.vehicle(ctx, x, y, w, CELL, color);
        }
      }
    });

    ctx.restore();
  }

  function drawPlayer() {
    const cx = BOARD_X + (player.col + 0.5) * CELL;
    const cy = BOARD_Y + (player.row + 0.5) * CELL;
    SKIN_DRAWERS[skin].player(ctx, cx, cy, CELL, SKIN_COLORS[skin]);
  }

  function draw() {
    drawRowBands();
    drawGoals();
    drawLanes();
    drawPlayer();
  }

  // ---- loop ----
  function loop(ts: number) {
    if (destroyed) return;
    const frameDt =
      lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    if (!paused && !gameOver) update(frameDt);

    draw();
    rafId = requestAnimationFrame(loop);
  }

  function initGame() {
    score = 0;
    lives = START_LIVES;
    level = 1;
    gameOver = false;
    lanes = buildLanes();
    filledGoals = GOAL_COLS.map(() => false);
    minRowReached = EXIT_ROW;
    totalElapsedMs = 0;
    hopLockUntilMs = 0;
    respawnPlayer();

    callbacks.onScoreChange?.(score);
    callbacks.onLivesChange?.(lives);
    callbacks.onLevelChange?.(level);
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
