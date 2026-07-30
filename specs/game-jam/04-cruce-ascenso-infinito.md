# GAME JAM 04 — ASCENSO

> **Status:** Draft
> **Depends on:** 05-asteroids-game, 06-leaderboard-catalogo-supabase
> **Date:** 2026-07-29
> **Objective:** Diseñar "ASCENSO" (`id: "ascenso"`) como reinterpretación sin pantalla fija del cruce de carriles propuesto en `suggested-games.md`, con carriles infinitos generados sobre la marcha y una línea de peligro que asciende y obliga a avanzar contra el reloj.

## Why this spec exists

Este spec es una de dos alternativas del mismo concepto — la hermana es `specs/game-jam/03-cruce-clasico.md` ("CRUCE"). El eje que las separa es **Mecánica**: en la hermana el jugador cruza una pantalla fija de carriles (tráfico + río) hacia una fila de metas y la pantalla se reinicia al completarla; aquí no hay pantalla fija ni metas — el jugador asciende sin fin por carriles generados proceduralmente mientras una línea de peligro sube desde abajo cada vez más rápido, obligándolo a avanzar. Solo una de las dos se implementará.

ASCENSO toma la mecánica base de cruce de carriles de `suggested-games.md` (fila CRUCE, 2026-07-29) y le añade el twist de presión temporal continua, en la línea de "Reinterpretación con un twist propio" del menú de ejes.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (SQL manual): `id: 'ascenso'`, `title: 'ASCENSO'`, `cat: 'ARCADE'`, `color: 'cyan'`, `cover: 'cover-ascenso'`.
- Nueva clase CSS `.cover-ascenso` en `app/globals.css`: franjas horizontales de carriles vistas en perspectiva ascendente con una línea de peligro brillante en la parte inferior, mismo patrón de pseudo-elementos que las demás `.cover-*`.
- Motor diseñado desde cero en `components/games/ascenso/engine.ts`: generación procedural de carriles (seguro/río/calzada) sin límite hacia arriba, cámara que sigue al jugador, línea de peligro ascendente independiente, salto discreto por celda con el mismo `HOP_LOCK_MS` que CRUCE, colisión con vehículos y ahogamiento en el río, 3 vidas, checkpoints cada 10 filas con bonus y subida de nivel, sin JSX, con la API basada en callbacks del `recipe.md`.
- Wrapper cliente `components/games/ascenso-player.tsx`: HUD de la plataforma (Jugador / Puntuación / Vidas / Nivel), botones PAUSA/FIN/SALIR, D-pad táctil de 4 direcciones visible bajo 840px, `GameOverModal` y guardado vía `insertScore`.
- `app/games/[id]/play/page.tsx`: una rama más — `id === "ascenso"` renderiza `AscensoPlayer`.
- CSS `.ascenso-canvas` y `.ascenso-touch-controls` en `app/globals.css`, con el breakpoint de 840px ya usado en el resto del sitio.

**Out of scope (para otro spec):**

- La versión clásica de pantalla fija — vive en `specs/game-jam/03-cruce-clasico.md`, un spec independiente.
- Sonido y música — no fue pedido y no hay assets de audio disponibles.
- Sprites de vehículos, troncos o personaje — todo se dibuja con formas planas en canvas; ningún asset bajo `public/`.
- Selector de skin o tema visual alternativo.
- Tabla de posiciones por distancia máxima separada de `scores` — se sigue usando el mismo esquema (`player_name`, `score`).
- Modo cooperativo o versus de dos jugadores.
- Tests automatizados (unit/e2e) y soporte de gamepad físico.
- Cualquier cambio a ASTEROIDES, TETRIS, ARKANOID, SERPIENTE o a los módulos genéricos sobre `getGames()`.

## Data model

**SQL (manual, en el SQL Editor de Supabase):**

```sql
insert into games (id, title, short, long, cat, cover, color) values
  ('ascenso', 'ASCENSO',
   'Sube sin parar por carriles infinitos mientras una línea de peligro te pisa los talones.',
   'Escala una sucesión infinita de carriles de tráfico y río generados sobre la marcha, mientras una línea de peligro asciende desde abajo cada vez más rápido y te obliga a avanzar sin detenerte. Cualquier colisión con un vehículo, ahogarte en el río, o quedar atrapado por la línea de peligro termina la vida al instante; cada diez carriles superados suma un bonus y sube el nivel, acelerando tanto el tráfico como la persecución.',
   'ARCADE', 'cover-ascenso', 'cyan');
```

`best` y `plays` no se insertan: los calcula la vista `games_with_stats` desde `scores`.

**TypeScript:**

```ts
// components/games/ascenso/engine.ts — motor diseñado desde cero, sin JSX
export type AscensoCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type AscensoGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void; // "ArrowUp"|"ArrowDown"|"ArrowLeft"|"ArrowRight"
  forceGameOver: () => void;
};

export function createAscensoGame(
  canvas: HTMLCanvasElement,
  callbacks: AscensoCallbacks,
): AscensoGame;
```

Geometría del canvas (constantes del motor, no configurables):

```ts
const CELL = 40;
const COLS = 9; // ancho fijo; las filas se generan sin límite hacia arriba
const CANVAS_W = 800,
  CANVAS_H = 600; // 4:3, rellena .crt-screen
const BOARD_W = COLS * CELL; // 360
const BOARD_X = (CANVAS_W - BOARD_W) / 2; // 220 de gutter a cada lado: próximo carril / línea de peligro
const VISIBLE_ROWS = 15; // 600 / CELL: filas visibles simultáneamente en el viewport de scroll
```

Progresión y puntuación:

```ts
const START_LIVES = 3;
const POINTS_PER_ROW = 10; // por cada nueva fila máxima alcanzada
const CHECKPOINT_INTERVAL = 10; // cada 10 filas de avance: bonus + nivel
const CHECKPOINT_BONUS = 50;
const KILL_LINE_SPEED_BASE = 0.6; // filas/seg que asciende la línea de peligro en el nivel 1
const KILL_LINE_SPEED_STEP = 0.12; // +filas/seg por nivel
const KILL_LINE_BUFFER_ROWS = 6; // colchón entre jugador y línea al respawnear o al superar un checkpoint
const HOP_LOCK_MS = 120; // igual que CRUCE: salto discreto por evento, no repetición al mantener pulsado
```

Estado del juego (clausura interna del motor, no exportado):

```ts
// player: { row: number; col: number }       // row crece hacia arriba, sin límite superior
// maxRowReached: number
// killLineRow: number                         // avanza de forma continua; game over si alcanza o supera player.row
// lanes: Map<number, { type: "safe" | "river" | "road"; dir: 1 | -1; speed: number; objects: {col:number; width:number}[] }>
//   generadas bajo demanda a medida que la cámara se acerca a la fila más alta ya generada,
//   descartadas cuando quedan muy por debajo de killLineRow
// score, lives, level, hopLockUntilMs
```

Convenciones:

- La cámara sigue al jugador manteniéndolo en el tercio inferior del viewport de `VISIBLE_ROWS` filas; nuevas filas se generan proceduralmente conforme la cámara se acerca al límite superior ya generado, con una distribución ponderada 30% seguro / 35% río / 35% calzada y sin más de dos carriles de riesgo consecutivos.
- La línea de peligro asciende de forma continua e independiente del jugador a `KILL_LINE_SPEED_BASE * (1 + (nivel - 1) * KILL_LINE_SPEED_STEP / KILL_LINE_SPEED_BASE)` filas/seg; si `killLineRow >= player.row`, es game over inmediato de la vida actual. Esta presión constante es la que **no** existe en CRUCE.
- El salto sigue siendo discreto por evento (`pressed=false→true`) con el mismo `HOP_LOCK_MS` que CRUCE — mismo esquema de control (cuatro direcciones, `setKey`), sensación distinta solo por la presión de la línea de peligro, no por el input en sí mismo.
- El jugador puede retroceder una fila, pero si esa fila queda por debajo de `killLineRow` al hacerlo, es game over inmediato — retroceder nunca es gratis.
- Cada `CHECKPOINT_INTERVAL` filas de `maxRowReached` suma `CHECKPOINT_BONUS`, sube el nivel y reubica `killLineRow` a `player.row - KILL_LINE_BUFFER_ROWS` — un respiro puntual, no una pausa de la persecución.
- Perder una vida (no la última) respawnea al jugador en `maxRowReached` (el punto más alto ya alcanzado en la partida) con `killLineRow` reubicada `KILL_LINE_BUFFER_ROWS` filas por debajo — nunca vuelve a la fila 0: en un juego sin fin, eso equivaldría a un game over encubierto.
- En la calzada, pisar la misma celda que un vehículo es game over de la vida actual. En el río, el jugador solo sobrevive si su celda coincide con un objeto flotante; una celda de agua vacía bajo sus pies, o ser arrastrado fuera de `[0, COLS)` por un tronco, también termina la vida.
- `dt` se limita (`Math.min(dt, 0.05)`, igual que CRUCE y ASTEROIDES) para que una pestaña en segundo plano no adelante de golpe ni los carriles ni la línea de peligro.
- El motor no toca `window`/`document` fuera de sus propios `keydown`/`keyup`, que remueve en `destroy()`. No lee ni escribe `localStorage`.
- `preventDefault()` solo sobre los cuatro códigos que consume: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`.
- El HUD dibujado dentro del canvas no existe: puntuación, vidas y nivel viven solo en el `player-hud` de la plataforma; la línea de peligro se dibuja dentro del canvas de juego porque es parte de la mecánica, no del HUD.
- No hay assets bajo `public/`: vehículos, troncos, personaje y línea de peligro se dibujan con rectángulos, polígonos y degradados planos en canvas.

## Implementation plan

1. **Insertar la fila del catálogo (paso manual del usuario).** Ejecutar el `insert into games` de arriba en el SQL Editor de Supabase.
   _Test:_ `/games` muestra la tarjeta "ASCENSO" junto a las demás; `/games/ascenso` muestra el detalle con `best = 0`, `plays = 0` y leaderboard vacío; `/games/ascenso/play` todavía renderiza el reproductor mock genérico.
2. **Arte de portada.** Agregar `.cover-ascenso` en `app/globals.css`: franjas horizontales en perspectiva ascendente con `repeating-linear-gradient`, una franja inferior brillante en `::after` representando la línea de peligro, mismo patrón que las demás `.cover-*`.
   _Test:_ la tarjeta en `/games` y el hero de `/games/ascenso` muestran el arte nuevo; ninguna otra `.cover-*` cambia, incluida `.cover-cruce`.
3. **Motor.** Crear `components/games/ascenso/engine.ts`: generación procedural de carriles bajo demanda, cámara que sigue al jugador, línea de peligro ascendente, salto discreto con `HOP_LOCK_MS`, colisión de calzada, ahogamiento de río, checkpoints, vidas, nivel, y la API `pause`/`resume`/`destroy`/`setKey`/`forceGameOver`. No se conecta a ningún componente todavía.
   _Test:_ `npm run build` compila sin errores de tipos.
4. **Reproductor y rama de ruta.** Crear `components/games/ascenso-player.tsx` siguiendo la estructura de `cruce-player.tsx`/`snake-player.tsx`: HUD con Jugador / Puntuación / Vidas / Nivel, marco `.crt` con el canvas 800×600 y el overlay "EN PAUSA", `.crt-bottom`, botones PAUSA/FIN/SALIR, `GameOverModal` con `insertScore` de `lib/data/scores.ts`, nombre precargado desde `av_user`. Agregar `.ascenso-canvas` en `app/globals.css` y la línea `if (game.id === "ascenso") return <AscensoPlayer game={game} />;` en `app/games/[id]/play/page.tsx`.
   _Test manual:_ en `/games/ascenso/play` se juega con las flechas; la cámara sigue al jugador mientras se generan carriles nuevos arriba; la línea de peligro sube visiblemente; el HUD refleja el estado real del motor; PAUSA congela con el frame visible (incluida la línea de peligro) y REANUDAR continúa sin salto; FIN abre `GameOverModal` con la puntuación alcanzada; guardar inserta una fila en `scores` con `game_id = 'ascenso'`.
5. **Controles táctiles.** Agregar el bloque `.ascenso-touch-controls` (`.td-pad` con las cuatro direcciones, sin `.td-actions`) y su CSS con el `@media (max-width: 840px)`, siguiendo `.cruce-touch-controls`. Cada botón usa `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel` sobre `setKey`.
   _Test manual:_ bajo 840px los cuatro botones saltan igual que el teclado, respetando el mismo `HOP_LOCK_MS`; en escritorio no se renderizan.
6. **Repaso final con Playwright.** Comparar `/games/ascenso/play` contra el resto del sitio (HUD, marco `.crt`, tipografía) en viewport de escritorio y móvil, y jugar varios minutos seguidos para confirmar que la generación procedural no degrada el rendimiento ni acumula memoria. Verificar que la línea de peligro es visualmente inconfundible con los carriles normales, y que la cámara no genera saltos bruscos al seguir al jugador. Ajustar velocidad de línea de peligro, ponderación de carriles y colocación de controles.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores en consola en `/games`, `/games/ascenso` y `/games/ascenso/play`.
- [ ] `select * from games_with_stats where id = 'ascenso'` devuelve la fila, y `best`/`plays` se mueven al insertar puntuaciones reales.
- [ ] `/games` muestra la tarjeta "ASCENSO" con `.cover-ascenso`, sin cambios en las demás tarjetas, incluida "CRUCE".
- [ ] `/games/ascenso` muestra cover, tags, descripción, stat-strip y el leaderboard lateral.
- [ ] El canvas rellena el marco `.crt` (4:3) sin deformación ni recorte, en escritorio y en móvil.
- [ ] El jugador arranca en la fila 0, columna central, con 3 vidas y la línea de peligro `KILL_LINE_BUFFER_ROWS` filas por debajo.
- [ ] Cada pulsación de flecha mueve exactamente una celda; mantener la tecla presionada no atraviesa varios carriles de un tirón (`HOP_LOCK_MS`).
- [ ] La cámara sigue al jugador y se generan carriles nuevos por encima sin interrupción perceptible, indefinidamente.
- [ ] La línea de peligro asciende de forma continua incluso si el jugador no se mueve, y alcanzar o cruzarla termina la vida actual al instante.
- [ ] Pisar la misma celda que un vehículo en un carril de calzada termina la vida actual al instante.
- [ ] Quedar en una celda de río sin un tronco debajo, o ser arrastrado fuera del tablero por uno, termina la vida actual al instante.
- [ ] Avanzar a una fila nunca alcanzada en la partida suma 10 puntos; retroceder o repetir fila no suma puntos de nuevo.
- [ ] Retroceder a una fila que queda por debajo de la línea de peligro termina la vida actual al instante.
- [ ] Cada 10 filas de avance máximo suma 50 puntos, sube el nivel y aleja la línea de peligro `KILL_LINE_BUFFER_ROWS` filas.
- [ ] Cada nivel acelera tanto la velocidad de los carriles como el ascenso de la línea de peligro.
- [ ] Perder una vida (no la última) respawnea al jugador en la fila más alta ya alcanzada, nunca en la fila 0, con la línea de peligro reubicada por debajo.
- [ ] Perder la última vida termina la partida al instante y abre `GameOverModal` con la puntuación alcanzada.
- [ ] El stat "Vidas" del HUD refleja el número real de vidas restantes, no un valor fijo.
- [ ] Jugar varios minutos seguidos no degrada el framerate ni acumula memoria de forma perceptible (filas muy por debajo de la línea de peligro se descartan).
- [ ] Volver a la pestaña tras dejarla en segundo plano no adelanta de golpe ni los carriles ni la línea de peligro.
- [ ] El HUD (Jugador / Puntuación / Vidas / Nivel) refleja el estado real del motor, no valores simulados.
- [ ] El botón PAUSA congela el juego con el frame visible, incluida la posición de la línea de peligro, con el overlay "EN PAUSA"; REANUDAR continúa sin que la línea salte hacia delante por el tiempo pausado.
- [ ] El botón FIN termina la partida inmediatamente con la puntuación alcanzada hasta ese momento.
- [ ] Guardar en `GameOverModal` inserta una fila en `scores` con `game_id = 'ascenso'`, visible en `/hall-of-fame`.
- [ ] El nombre precargado en el modal sigue viniendo de `av_user` en `localStorage`.
- [ ] Este spec no añade ninguna clave nueva a `localStorage`.
- [ ] Bajo 840px aparecen los cuatro botones táctiles y saltan igual que el teclado; en escritorio no se renderizan.
- [ ] Un dedo arrastrado fuera de un botón táctil no deja la tecla trabada.
- [ ] Las flechas no hacen scroll de la página mientras el juego está montado.
- [ ] Salir de `/games/ascenso/play` detiene el loop: sin errores en consola y sin listeners huérfanos.
- [ ] `npm run build` termina sin errores.

## Decisions

- **Sí:** motor diseñado desde cero, sin puerto de código existente. Igual que su hermana, no hay `game.js` de referencia para esta mecánica en `references/started-games/`. Supuesto explícito de esta ejecución.
- **Sí:** `id: "ascenso"` en español. Sigue el mismo criterio que `cruce`: no hay un nombre genérico en inglés establecido para esta variante que no invoque directamente marcas conocidas de "endless runner" verticales. Supuesto explícito.
- **Sí:** `cat: 'ARCADE'`, `color: 'cyan'` — se mantienen iguales a los de CRUCE. El eje que separa ambas versiones es la mecánica, no la categoría ni el color; usar el mismo `cat`/`color` que la hermana evita fabricar una diferencia visual que no representa una decisión real de catálogo. Supuesto explícito, ya que ninguna de las dos filas viene literalmente de un prompt del usuario más allá de "ARCADE / cyan" para el concepto CRUCE.
- **Sí:** generación procedural infinita sin límite superior, con cámara que sigue al jugador y descarta filas muy por debajo de la línea de peligro. Es el rasgo que define esta versión frente a la pantalla fija de CRUCE. Supuesto explícito: la ponderación 30/35/35 y el límite de dos carriles de riesgo consecutivos no vienen del prompt.
- **No:** un límite superior de filas ("ganar" al llegar a una fila final). Contradiría la idea de ascenso sin fin; esta versión termina por muerte, no por victoria.
- **Sí:** línea de peligro ascendente continua e independiente del jugador, con velocidad creciente por nivel. Es el mecanismo concreto que convierte "cruzar carriles" en "cruzar carriles contra el reloj" — el twist declarado en `Why this spec exists`.
- **No:** un temporizador numérico visible en vez de una línea de peligro dibujada en el canvas. La línea comunica la amenaza espacialmente (se ve venir) en vez de exigir leer un número, coherente con que el juego no tiene HUD dibujado en canvas salvo este elemento de juego.
- **Sí:** al perder una vida, el jugador respawnea en la fila más alta alcanzada (no en la fila 0). En un juego sin pantalla fija, volver al inicio absoluto tras cada muerte equivaldría a un game over encubierto y contradiría la sensación de progreso continuo que define a este género.
- **No:** conservar el respawn en la fila de salida absoluta, como hace CRUCE. Tiene sentido en una pantalla fija con metas discretas; aquí no hay pantalla fija ni metas que reiniciar.
- **Sí:** mismo esquema de input que CRUCE — salto discreto por evento con idéntico `HOP_LOCK_MS`. El encargo pide considerar cómo se siente el control en la práctica, no cambiar el esquema de teclas; la diferencia de sensación viene de la presión de la línea de peligro, no de una mecánica de input distinta.
- **No:** controles de movimiento continuo o de carrera automática hacia delante. Cambiaría el esquema de input entero, no solo el ritmo, y dejaría de compartir el D-pad de 4 direcciones con el resto del catálogo.
- **Sí:** retroceder una fila está permitido pero puede terminar la partida si esa fila ya quedó por debajo de la línea de peligro. Mantiene las 4 direcciones útiles (a diferencia de un runner de solo avance) sin volver el retroceso gratuito.
- **Sí:** sin sprites, todo dibujado con formas planas y degradados en canvas, igual que CRUCE. No hay atlas de arte disponible para ninguna de las dos versiones.
- **No:** nombre, sprite de rana o vehículos con forma de marca reconocible. Mismo riesgo de marca de Frogger que en CRUCE, mitigado igual: personaje y vehículos genéricos.

## Risks

| Riesgo                                                                                                                            | Mitigación                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La generación procedural infinita puede acumular filas en memoria indefinidamente durante una partida larga.                      | Descartar filas cuya posición quede muy por debajo de `killLineRow`; verificado en el paso 6 con sesiones de juego largas.                              |
| La línea de peligro puede sentirse injusta si sube demasiado rápido, o intrascendente si sube demasiado lento.                    | `KILL_LINE_SPEED_BASE`/`KILL_LINE_SPEED_STEP` son valores de partida, ajustados con prueba manual en el paso 6, no cifras cerradas.                     |
| Retroceder y quedar atrapado por la línea de peligro puede sentirse como una muerte injusta si la línea no es claramente visible. | La línea se dibuja con un color y brillo (`shadowBlur`) claramente distintos de los carriles; revisado explícitamente en el paso 6.                     |
| Un `dt` grande al volver de una pestaña en segundo plano podría adelantar la línea de peligro varias filas de golpe.              | `dt` se limita a `0.05` s antes de acumularse, igual que CRUCE y ASTEROIDES. Criterio de aceptación explícito.                                          |
| La asociación con "Frogger" (marca de Konami) es fuerte en la memoria colectiva pese a que ambas mecánicas son genéricas.         | Personaje, vehículos y troncos genéricos dibujados a medida, sin nombre ni forma reconocible del original; título y assets propios, igual que en CRUCE. |
| Importar `insertScore` desde `lib/data/games.ts` rompe el build con un error engañoso de "Pages Router".                          | `ascenso-player.tsx` importa `insertScore` **solo** desde `lib/data/scores.ts`, como los demás reproductores.                                           |
| Next.js 16.2.10 no es el Next.js del conocimiento de entrenamiento.                                                               | Antes de los pasos 3 y 4, consultar `node_modules/next/dist/docs/01-app/`, como exige `CLAUDE.md`.                                                      |

## Lo que **no** está en este spec

- La versión clásica de pantalla fija (`specs/game-jam/03-cruce-clasico.md`).
- Sonido y música.
- Sprites de vehículos, troncos o personaje.
- Selector de skin o tema visual alternativo.
- Tabla de posiciones separada por distancia máxima.
- Modo cooperativo o versus de dos jugadores.
- Tests automatizados y soporte de gamepad físico.

Cada uno de estos, si se implementa, va en su propio spec.
