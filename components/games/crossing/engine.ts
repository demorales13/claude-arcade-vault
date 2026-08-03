import type { SkinId } from "@/lib/skins";

export type CrossingCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type CrossingOptions = {
  skin?: SkinId;
};

export type CrossingGame = {
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
// La animación de salto dura exactamente lo mismo que el bloqueo de salto
// (HOP_LOCK_MS): así nunca se solapan dos saltos animados y no hace falta
// gestionar una cola de animaciones.
const HOP_ANIM_MS = HOP_LOCK_MS;
const HOP_ARC_HEIGHT = 0.35; // altura del arco de salto, en celdas
// Al perder una vida el jugador queda "muerto" en el sitio (mundo sigue
// moviéndose) el tiempo suficiente para leer el golpe antes de reaparecer o
// de disparar el game over, en vez del respawn instantáneo anterior.
const DEATH_ANIM_MS = 450;

// Márgenes de colisión (fracción de celda excluida en cada extremo) para que
// el hit-test coincida con lo que realmente se dibuja: sin esto el jugador
// "choca" o "flota" con un vehículo/tronco que visualmente ni siquiera se
// tocan, porque antes se comparaban celdas completas contra sprites con inset.
const PLAYER_HIT_MARGIN = 0.22; // ≈ mitad del ancho del cuerpo de la rana
const VEHICLE_HIT_MARGIN = 0.075; // coincide con el inset de drawVehicle*
const LOG_HIT_MARGIN = 0.05; // coincide con el inset de drawLog*

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

function cellOverlap(
  col: number,
  objCol: number,
  objWidth: number,
  playerMargin = 0,
  objMargin = 0,
): boolean {
  const pStart = col + playerMargin;
  const pEnd = col + 1 - playerMargin;
  const oStart = objCol + objMargin;
  const oEnd = objCol + objWidth - objMargin;
  return oStart < pEnd && oEnd > pStart;
}

// A diferencia de cellOverlap (cualquier intersección cuenta, correcto para
// "¿toca un vehículo?"), montar un tronco exige que el CENTRO del jugador
// quede dentro del tronco: exigir el cuerpo completo hacía que un salto que
// visualmente aterriza sobre el tronco (con el borde de la rana apenas más
// allá del canto) se contara como caída aunque el jugador esté claramente
// parado encima.
function cellCenterContained(
  col: number,
  objCol: number,
  objWidth: number,
  objMargin = 0,
): boolean {
  const center = col + 0.5;
  return (
    center >= objCol + objMargin && center <= objCol + objWidth - objMargin
  );
}

function getContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D context not available");
  return context;
}

type CrossingPalette = {
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
const SKIN_COLORS: Record<SkinId, CrossingPalette> = {
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

type CrossingDrawers = {
  goal: (
    context: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    filled: boolean,
    palette: CrossingPalette,
  ) => void;
  log: (
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    palette: CrossingPalette,
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
    palette: CrossingPalette,
  ) => void;
};

function drawGoalClasico(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  filled: boolean,
  palette: CrossingPalette,
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
  palette: CrossingPalette,
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
  palette: CrossingPalette,
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

// Traza el cuerpo del tronco como una cápsula (rectángulo con extremos
// redondeados) en vez de un rectángulo plano, para que se lea como un tronco
// de madera y no como un vehículo más.
function traceLogBody(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const top = y + 6;
  const bodyH = h - 12;
  const r = bodyH / 2;
  const left = x + 1;
  const right = x + w - 1;
  context.beginPath();
  context.moveTo(left + r, top);
  context.lineTo(right - r, top);
  context.arc(right - r, top + r, r, -Math.PI / 2, Math.PI / 2);
  context.lineTo(left + r, top + bodyH);
  context.arc(left + r, top + r, r, Math.PI / 2, (3 * Math.PI) / 2);
  context.closePath();
}

// Vetas y anillos de corte en los extremos, para reforzar la lectura de
// "tronco flotante" a simple vista.
function drawLogGrain(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  const top = y + 6;
  const bodyH = h - 12;
  const r = bodyH / 2;
  const left = x + 1 + r;
  const right = x + w - 1 - r;
  context.strokeStyle = color;
  context.lineWidth = 1;
  if (right > left) {
    context.beginPath();
    context.moveTo(left, top + bodyH * 0.32);
    context.lineTo(right, top + bodyH * 0.32);
    context.moveTo(left, top + bodyH * 0.68);
    context.lineTo(right, top + bodyH * 0.68);
    context.stroke();
  }
  const capR = r * 0.55;
  context.beginPath();
  context.arc(x + 1 + r, top + r, capR, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(x + w - 1 - r, top + r, capR, 0, Math.PI * 2);
  context.stroke();
}

function drawLogClasico(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: CrossingPalette,
) {
  context.save();
  context.fillStyle = palette.log;
  traceLogBody(context, x, y, w, h);
  context.fill();
  drawLogGrain(context, x, y, w, h, "rgba(0, 0, 0, 0.28)");
  context.restore();
}

function drawLogNeon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: CrossingPalette,
) {
  context.save();
  context.fillStyle = "#000000";
  traceLogBody(context, x, y, w, h);
  context.fill();
  context.shadowColor = palette.log;
  context.shadowBlur = 12;
  context.strokeStyle = palette.log;
  context.lineWidth = 2;
  traceLogBody(context, x, y, w, h);
  context.stroke();
  context.shadowBlur = 0;
  drawLogGrain(context, x, y, w, h, "rgba(255, 255, 255, 0.28)");
  context.restore();
}

function drawLogRetro(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: CrossingPalette,
) {
  context.save();
  context.fillStyle = palette.log;
  traceLogBody(context, x, y, w, h);
  context.fill();
  drawLogGrain(context, x, y, w, h, "rgba(0, 0, 0, 0.3)");
  const top = y + 6;
  const bodyH = h - 12;
  const r = bodyH / 2;
  context.fillStyle = palette.logHighlight;
  context.fillRect(x + 1 + r, top, w - 2 - 2 * r, 3);
  context.fillStyle = "rgba(0, 0, 0, 0.3)";
  context.fillRect(x + 1 + r, top + bodyH - 3, w - 2 - 2 * r, 3);
  context.restore();
}

// Geometría de un auto visto de perfil: chasis (rect. redondeado, ancho
// completo) + cabina (rect. redondeado, más angosta y corta, montada encima)
// + dos ruedas. El chasis conserva exactamente el inset horizontal (x+3,
// w-6) que ya usaba el rectángulo plano anterior, así el hit-test de
// VEHICLE_HIT_MARGIN sigue coincidiendo con lo dibujado.
type VehicleRect = { x: number; y: number; w: number; h: number; r: number };
type VehicleGeometry = {
  chassis: VehicleRect;
  cabin: VehicleRect;
  wheelR: number;
  wheelY: number;
  wheelXs: [number, number];
};

function vehicleGeometry(
  x: number,
  y: number,
  w: number,
  h: number,
): VehicleGeometry {
  const left = x + 3;
  const width = w - 6;
  const insetTop = y + 6;
  const insetH = h - 12;
  const chassisH = insetH * 0.6;
  const chassisY = insetTop + insetH - chassisH;
  const chassisR = Math.min(4, chassisH / 2);
  const cabinW = width * 0.56;
  const cabinLeft = left + (width - cabinW) / 2;
  const cabinH = insetH * 0.48;
  const cabinY = chassisY - cabinH + 3;
  const cabinR = Math.min(3, cabinH / 2);
  const wheelR = Math.max(2, chassisH * 0.22);
  const wheelY = chassisY + chassisH - wheelR * 0.6;
  return {
    chassis: { x: left, y: chassisY, w: width, h: chassisH, r: chassisR },
    cabin: { x: cabinLeft, y: cabinY, w: cabinW, h: cabinH, r: cabinR },
    wheelR,
    wheelY,
    wheelXs: [left + width * 0.24, left + width * 0.76],
  };
}

function traceVehiclePart(
  context: CanvasRenderingContext2D,
  part: VehicleRect,
) {
  roundedRectPath(context, part.x, part.y, part.w, part.h, part.r);
}

function drawVehicleWheels(
  context: CanvasRenderingContext2D,
  g: VehicleGeometry,
  color: string,
) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(g.wheelXs[0], g.wheelY, g.wheelR, 0, Math.PI * 2);
  context.arc(g.wheelXs[1], g.wheelY, g.wheelR, 0, Math.PI * 2);
  context.fill();
}

function drawVehicleClasico(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  const g = vehicleGeometry(x, y, w, h);
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 6;
  context.fillStyle = color;
  traceVehiclePart(context, g.chassis);
  context.fill();
  traceVehiclePart(context, g.cabin);
  context.fill();
  context.shadowBlur = 0;
  drawVehicleWheels(context, g, "rgba(0, 0, 0, 0.5)");
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
  const g = vehicleGeometry(x, y, w, h);
  context.save();
  context.fillStyle = "#000000";
  traceVehiclePart(context, g.chassis);
  context.fill();
  traceVehiclePart(context, g.cabin);
  context.fill();
  context.shadowColor = color;
  context.shadowBlur = 14;
  context.strokeStyle = color;
  context.lineWidth = 2;
  traceVehiclePart(context, g.chassis);
  context.stroke();
  traceVehiclePart(context, g.cabin);
  context.stroke();
  context.shadowBlur = 0;
  drawVehicleWheels(context, g, color);
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
  const g = vehicleGeometry(x, y, w, h);
  context.fillStyle = color;
  traceVehiclePart(context, g.chassis);
  context.fill();
  traceVehiclePart(context, g.cabin);
  context.fill();
  context.fillStyle = "rgba(255, 255, 255, 0.25)";
  context.fillRect(g.chassis.x + 2, g.chassis.y + 1, g.chassis.w - 4, 2);
  context.fillStyle = "rgba(0, 0, 0, 0.28)";
  context.fillRect(
    g.chassis.x + 2,
    g.chassis.y + g.chassis.h - 3,
    g.chassis.w - 4,
    2,
  );
  drawVehicleWheels(context, g, "#1a1a1a");
}

// Geometría de la rana: cuerpo (rect. redondeado, mismo ancho que ocupaba el
// triángulo anterior para no desalinear PLAYER_HIT_MARGIN), dos ojos arriba y
// dos pares de patas cortas a los lados. Todas las skins parten de la misma
// geometría y solo cambian relleno/trazo/glow, igual que con troncos y autos.
type FrogRect = { x: number; y: number; w: number; h: number; r: number };
type FrogEye = { x: number; y: number; r: number };
type FrogGeometry = {
  body: FrogRect;
  eyes: [FrogEye, FrogEye];
  legs: [FrogRect, FrogRect, FrogRect, FrogRect];
};

function frogGeometry(cx: number, cy: number, size: number): FrogGeometry {
  const bodyW = size * 0.56; // = 1 - 2*PLAYER_HIT_MARGIN, mismo footprint que el triángulo
  const bodyH = size * 0.32;
  const bodyX = cx - bodyW / 2;
  const bodyY = cy - bodyH * 0.35;
  const bodyR = bodyH * 0.45;
  const eyeR = size * 0.09;
  const eyeY = bodyY - eyeR * 0.4;
  const legW = size * 0.14;
  const legH = size * 0.11;
  const frontLegY = bodyY + bodyH * 0.15;
  const backLegY = bodyY + bodyH - legH * 0.3;
  return {
    body: { x: bodyX, y: bodyY, w: bodyW, h: bodyH, r: bodyR },
    eyes: [
      { x: cx - bodyW * 0.24, y: eyeY, r: eyeR },
      { x: cx + bodyW * 0.24, y: eyeY, r: eyeR },
    ],
    legs: [
      { x: bodyX - legW * 0.35, y: frontLegY, w: legW, h: legH, r: legH * 0.4 },
      {
        x: bodyX + bodyW - legW * 0.65,
        y: frontLegY,
        w: legW,
        h: legH,
        r: legH * 0.4,
      },
      { x: bodyX - legW * 0.2, y: backLegY, w: legW, h: legH, r: legH * 0.4 },
      {
        x: bodyX + bodyW - legW * 0.8,
        y: backLegY,
        w: legW,
        h: legH,
        r: legH * 0.4,
      },
    ],
  };
}

function traceFrogBody(context: CanvasRenderingContext2D, g: FrogGeometry) {
  roundedRectPath(context, g.body.x, g.body.y, g.body.w, g.body.h, g.body.r);
}

function strokeFrogLegs(context: CanvasRenderingContext2D, g: FrogGeometry) {
  for (const leg of g.legs) {
    roundedRectPath(context, leg.x, leg.y, leg.w, leg.h, leg.r);
    context.stroke();
  }
}

function drawFrogLegs(
  context: CanvasRenderingContext2D,
  g: FrogGeometry,
  color: string,
) {
  context.fillStyle = color;
  for (const leg of g.legs) {
    roundedRectPath(context, leg.x, leg.y, leg.w, leg.h, leg.r);
    context.fill();
  }
}

function drawFrogEyes(
  context: CanvasRenderingContext2D,
  g: FrogGeometry,
  scleraColor: string,
  pupilColor: string,
) {
  for (const eye of g.eyes) {
    context.fillStyle = scleraColor;
    context.beginPath();
    context.arc(eye.x, eye.y, eye.r, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = pupilColor;
    context.beginPath();
    context.arc(eye.x, eye.y, eye.r * 0.45, 0, Math.PI * 2);
    context.fill();
  }
}

function drawPlayerClasico(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  palette: CrossingPalette,
) {
  const g = frogGeometry(cx, cy, size);
  context.save();
  context.shadowColor = palette.player;
  context.shadowBlur = 10;
  drawFrogLegs(context, g, palette.player);
  context.fillStyle = palette.player;
  traceFrogBody(context, g);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = palette.playerOutline;
  context.lineWidth = 1.5;
  traceFrogBody(context, g);
  context.stroke();
  drawFrogEyes(context, g, palette.playerOutline, "#0a0a0a");
  context.restore();
}

function drawPlayerNeon(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  palette: CrossingPalette,
) {
  const g = frogGeometry(cx, cy, size);
  context.save();
  context.fillStyle = "#000000";
  drawFrogLegs(context, g, "#000000");
  traceFrogBody(context, g);
  context.fill();
  context.shadowColor = palette.player;
  context.shadowBlur = 18;
  context.strokeStyle = palette.player;
  context.lineWidth = 2;
  traceFrogBody(context, g);
  context.stroke();
  strokeFrogLegs(context, g);
  context.shadowBlur = 0;
  drawFrogEyes(context, g, palette.playerOutline, palette.player);
  context.restore();
}

function drawPlayerRetro(
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  palette: CrossingPalette,
) {
  const g = frogGeometry(cx, cy, size);
  context.save();
  context.fillStyle = palette.player;
  drawFrogLegs(context, g, palette.player);
  traceFrogBody(context, g);
  context.fill();
  context.strokeStyle = palette.playerOutline;
  context.lineWidth = 1.5;
  traceFrogBody(context, g);
  context.stroke();
  context.fillStyle = "rgba(255, 255, 255, 0.28)";
  roundedRectPath(
    context,
    g.body.x + g.body.w * 0.18,
    g.body.y + g.body.h * 0.12,
    g.body.w * 0.64,
    g.body.h * 0.3,
    g.body.h * 0.15,
  );
  context.fill();
  drawFrogEyes(context, g, palette.playerOutline, palette.player);
  context.restore();
}

const SKIN_DRAWERS: Record<SkinId, CrossingDrawers> = {
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

export function createCrossingGame(
  canvas: HTMLCanvasElement,
  callbacks: CrossingCallbacks,
  options: CrossingOptions = {},
): CrossingGame {
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

  // Animación puramente visual del salto: la posición lógica (`player`) se
  // actualiza al instante en `applyHop` para que colisiones y arrastre de
  // troncos sigan siendo exactos; `hopAnim` solo interpola dónde se dibuja
  // la rana entre la celda de origen y la de destino durante HOP_ANIM_MS.
  type HopAnim = {
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
    elapsedMs: number;
  };
  let hopAnim: HopAnim | null = null;

  // Estado de "muerte": al perder una vida el jugador se congela en el punto
  // del golpe (deathAt) durante DEATH_ANIM_MS -mundo y carriles siguen
  // moviéndose- antes de reaparecer o, si era la última vida, de disparar
  // game over. Antes esto ocurría sin ninguna transición.
  let dying = false;
  let dyingElapsedMs = 0;
  let deathAt = { row: EXIT_ROW, col: START_COL };

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
    if (gameOver || dying) return;
    lives -= 1;
    callbacks.onLivesChange?.(Math.max(lives, 0));
    hopAnim = null;
    dying = true;
    dyingElapsedMs = 0;
    deathAt = { row: player.row, col: player.col };
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
    if (paused || gameOver || dying) return;
    if (totalElapsedMs < hopLockUntilMs) return;
    hopLockUntilMs = totalElapsedMs + HOP_LOCK_MS;
    applyHop(dir);
  }

  // No redondea la columna de origen a la celda de rejilla: si el jugador va
  // montado en un tronco, player.col es fraccionario (arrastrado cada frame
  // por la corriente). Redondear antes de saltar podía desplazar el
  // aterrizaje hasta media celda de donde el jugador realmente estaba, así
  // que un salto vertical entre dos troncos alineados fallaba "a la suerte"
  // según en qué punto exacto del arrastre se pulsara la tecla. Saltar
  // conservando la columna exacta (±1 solo en horizontal) hace que un salto
  // recto hacia un tronco alineado aterrice donde se ve, siempre.
  function applyHop(dir: Direction) {
    let newRow = player.row;
    let newCol = player.col;
    if (dir === "up") newRow -= 1;
    else if (dir === "down") newRow += 1;
    else if (dir === "left") newCol -= 1;
    else newCol += 1;

    if (newCol < 0 || newCol >= COLS) return; // fuera del tablero: salto inválido
    if (newRow < GOAL_ROW || newRow > EXIT_ROW) return; // fuera del tablero: salto inválido

    if (newRow === GOAL_ROW) {
      // La meta sí exige una celda exacta: aquí (y solo aquí) se redondea.
      const goalCol = Math.round(newCol);
      const goalIndex = GOAL_COLS.indexOf(goalCol);
      if (goalIndex === -1 || filledGoals[goalIndex]) return; // seto o meta ya ocupada
      hopAnim = {
        fromRow: player.row,
        fromCol: player.col,
        toRow: GOAL_ROW,
        toCol: goalCol,
        elapsedMs: 0,
      };
      fillGoal(goalIndex);
      return;
    }

    hopAnim = {
      fromRow: player.row,
      fromCol: player.col,
      toRow: newRow,
      toCol: newCol,
      elapsedMs: 0,
    };
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
    if (gameOver || dying) return;
    if (ROAD_ROWS.includes(player.row)) {
      const lane = laneForRow(player.row);
      if (!lane) return;
      const cols = laneObjectCols(lane);
      const hit = cols.some((c) =>
        cellOverlap(
          player.col,
          c,
          lane.objectWidth,
          PLAYER_HIT_MARGIN,
          VEHICLE_HIT_MARGIN,
        ),
      );
      if (hit) loseLife();
      return;
    }
    if (RIVER_ROWS.includes(player.row)) {
      const lane = laneForRow(player.row);
      if (!lane) return;
      const cols = laneObjectCols(lane);
      const carrying = cols.some((c) =>
        cellCenterContained(player.col, c, lane.objectWidth, LOG_HIT_MARGIN),
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

    if (hopAnim) {
      hopAnim.elapsedMs += dt * 1000;
      if (hopAnim.elapsedMs >= HOP_ANIM_MS) hopAnim = null;
    }

    if (dying) {
      dyingElapsedMs += dt * 1000;
      if (dyingElapsedMs >= DEATH_ANIM_MS) {
        dying = false;
        // Recién aquí -tras la animación, no en el instante del golpe- se
        // decide si toca reaparecer o disparar el game over.
        if (lives <= 0) {
          endGame();
        } else {
          respawnPlayer();
          minRowReached = EXIT_ROW;
        }
      }
      return;
    }

    checkPlayerSafety(dt);
  }

  // ---- dibujado ----
  function drawRiverWaveLine(
    y: number,
    dir: 1 | -1,
    color: string,
    phaseOffset: number,
  ) {
    const amplitude = 2.5;
    const wavelength = 46;
    const phase = totalElapsedMs * dir * 0.03 + phaseOffset;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= BOARD_W; x += 4) {
      const yy =
        y + Math.sin(((x + phase) / wavelength) * Math.PI * 2) * amplitude;
      if (x === 0) ctx.moveTo(BOARD_X + x, yy);
      else ctx.lineTo(BOARD_X + x, yy);
    }
    ctx.stroke();
  }

  // Parte del tablero que no cambia frame a frame (todo salvo las ondas del
  // río, que se animan con `totalElapsedMs`). Recibe un contexto explícito
  // porque también se usa para rellenar `bgCache` (ver más abajo), no solo
  // el canvas real.
  function drawStaticBands(target: CanvasRenderingContext2D) {
    const palette = SKIN_COLORS[skin];

    target.fillStyle = palette.bg;
    target.fillRect(0, 0, CANVAS_W, CANVAS_H);

    target.fillStyle = palette.goalRow;
    target.fillRect(BOARD_X, BOARD_Y, BOARD_W, CELL);

    target.fillStyle = palette.river;
    target.fillRect(BOARD_X, BOARD_Y + CELL, BOARD_W, CELL * RIVER_ROWS.length);

    target.fillStyle = palette.median;
    target.fillRect(BOARD_X, BOARD_Y + MEDIAN_ROW * CELL, BOARD_W, CELL);

    target.fillStyle = palette.road;
    target.fillRect(
      BOARD_X,
      BOARD_Y + ROAD_ROWS[0] * CELL,
      BOARD_W,
      CELL * ROAD_ROWS.length,
    );

    target.fillStyle = palette.exit;
    target.fillRect(BOARD_X, BOARD_Y + EXIT_ROW * CELL, BOARD_W, CELL);

    // líneas discontinuas de la calzada
    target.strokeStyle = palette.roadLine;
    target.lineWidth = 2;
    target.setLineDash([10, 8]);
    for (const row of ROAD_ROWS) {
      const y = BOARD_Y + row * CELL + CELL / 2;
      target.beginPath();
      target.moveTo(BOARD_X, y);
      target.lineTo(BOARD_X + BOARD_W, y);
      target.stroke();
    }
    target.setLineDash([]);

    target.strokeStyle = palette.boardBorder;
    target.lineWidth = 2;
    target.strokeRect(BOARD_X, BOARD_Y, BOARD_W, BOARD_H);
  }

  // Cachea `drawStaticBands` en un canvas auxiliar a la resolución física
  // real (`canvas.width`/`height`, que ya incluye el devicePixelRatio que
  // aplicó `setupHiDpiCanvas`) para no recalcular 6 `fillRect` + las líneas
  // discontinuas de la calzada en cada frame — solo cambia si cambia la skin.
  // Hallazgo del profiling (spec 14): `drawRowBands` era, con diferencia, el
  // bloque de dibujado más repetitivo por frame aunque su coste medible en
  // esta máquina fuera bajo; cachearlo reduce el trabajo por frame sin
  // margen que perder en gama baja.
  let bgCache: HTMLCanvasElement | null = null;
  let bgCacheCtx: CanvasRenderingContext2D | null = null;
  let bgCacheSkin: SkinId | null = null;

  function ensureBgCache() {
    if (bgCache && bgCacheSkin === skin) return;
    if (!bgCache) {
      bgCache = document.createElement("canvas");
      bgCache.width = canvas.width;
      bgCache.height = canvas.height;
      bgCacheCtx = getContext2D(bgCache);
      const scaleX = canvas.width / CANVAS_W;
      const scaleY = canvas.height / CANVAS_H;
      bgCacheCtx.scale(scaleX, scaleY);
    }
    bgCacheSkin = skin;
    drawStaticBands(bgCacheCtx!);
  }

  // Ondas del río: dos líneas senoidales por carril que se desplazan en la
  // dirección del carril, para que se lea como agua en movimiento y no como
  // una calzada más. Es la única parte de `drawStaticBands` que sí cambia
  // cada frame (depende de `totalElapsedMs`), así que se dibuja aparte,
  // directamente sobre el canvas real, encima del fondo cacheado.
  function drawRiverWaves() {
    const palette = SKIN_COLORS[skin];
    for (const row of RIVER_ROWS) {
      const lane = laneForRow(row);
      const dir = lane?.dir ?? 1;
      drawRiverWaveLine(
        BOARD_Y + row * CELL + CELL * 0.32,
        dir,
        palette.riverLine,
        row * 17,
      );
      drawRiverWaveLine(
        BOARD_Y + row * CELL + CELL * 0.68,
        dir,
        palette.riverLine,
        row * 11 + 30,
      );
    }
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

  // Salpicadura al perder una vida: la rana se congela en `deathAt`,
  // desvaneciéndose y expandiéndose mientras un anillo de choque se abre a
  // su alrededor. Reutiliza el sprite normal en vez de un dibujante propio
  // por skin -queda coherente con las tres paletas sin triplicar código-.
  function drawDeathEffect(progress: number) {
    const palette = SKIN_COLORS[skin];
    const cx = BOARD_X + (deathAt.col + 0.5) * CELL;
    const cy = BOARD_Y + (deathAt.row + 0.5) * CELL;
    const fade = Math.max(0, 1 - progress);

    ctx.save();
    ctx.globalAlpha = fade;
    const scale = 1 + progress * 0.7;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
    SKIN_DRAWERS[skin].player(ctx, cx, cy, CELL, palette);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = fade * 0.8;
    ctx.strokeStyle = palette.player;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.25 + progress * CELL * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    if (dying) {
      drawDeathEffect(Math.min(dyingElapsedMs / DEATH_ANIM_MS, 1));
      return;
    }

    if (hopAnim) {
      const t = Math.min(hopAnim.elapsedMs / HOP_ANIM_MS, 1);
      const col = hopAnim.fromCol + (hopAnim.toCol - hopAnim.fromCol) * t;
      const row = hopAnim.fromRow + (hopAnim.toRow - hopAnim.fromRow) * t;
      const arc = Math.sin(t * Math.PI) * HOP_ARC_HEIGHT;
      const cx = BOARD_X + (col + 0.5) * CELL;
      const cy = BOARD_Y + (row + 0.5) * CELL - arc * CELL;
      const stretch = 1 + Math.sin(t * Math.PI) * 0.12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1 / stretch, stretch);
      ctx.translate(-cx, -cy);
      SKIN_DRAWERS[skin].player(ctx, cx, cy, CELL, SKIN_COLORS[skin]);
      ctx.restore();
      return;
    }

    const cx = BOARD_X + (player.col + 0.5) * CELL;
    const cy = BOARD_Y + (player.row + 0.5) * CELL;
    SKIN_DRAWERS[skin].player(ctx, cx, cy, CELL, SKIN_COLORS[skin]);
  }

  function draw() {
    ensureBgCache();
    if (bgCache) ctx.drawImage(bgCache, 0, 0, CANVAS_W, CANVAS_H);
    drawRiverWaves();
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
    hopAnim = null;
    dying = false;
    dyingElapsedMs = 0;
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
