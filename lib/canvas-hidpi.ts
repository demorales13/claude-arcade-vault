/**
 * Escala el buffer de un canvas 2D al devicePixelRatio del dispositivo sin
 * que el motor que dibuja en él tenga que enterarse: sigue dibujando en las
 * mismas coordenadas lógicas (800×600) de siempre.
 */
export function setupHiDpiCanvas(
  canvas: HTMLCanvasElement,
  logicalW: number,
  logicalH: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
}
