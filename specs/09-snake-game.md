# SPEC 09 — Snake diseñado desde cero como nuevo juego "SERPIENTE"

> **Status:** Implemented
> **Depends on:** 06-leaderboard-catalogo-supabase
> **Date:** 2026-07-27
> **Objective:** Agregar "SERPIENTE" (`id: "snake"`) como cuarto juego jugable del catálogo de Arcade Vault, con un motor de Snake clásico diseñado desde cero en `components/games/snake/engine.ts` (grid 20×20, sin wrapping, niveles por velocidad) que usa el atlas de frutas de `references/snake-assets/` como arte, integrado con el HUD, el marco `.crt` y el guardado de puntuaciones en Supabase ya existentes.

## Why this spec exists

A diferencia de ASTEROIDES, TETRIS y ARKANOID (specs 05, 07, 08), no existe un `game.js` de Snake para portar en `references/started-games/` — solo un atlas de sprites de frutas (`references/snake-assets/fruits.png` + `sprites.js`, 21 frutas recortadas de una hoja de 3790×442px, sin cuerpo/cabeza de serpiente). Este spec diseña la mecánica desde cero (movimiento por grid, colisión, crecimiento, niveles por velocidad) y solo reutiliza el arte de fruta del atlas — el resto (cuerpo, cabeza, fondo) se dibuja con formas planas en canvas, no sprites.

Es también el primer motor del catálogo que **no** avanza por física continua sino por **tick lógico discreto**, y el primero que necesita **precargar un asset** antes de dibujar su primer frame. Ambas cosas son variaciones explícitas sobre el patrón de `recipe.md` y se documentan como tales.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (SQL manual): `id: 'snake'`, `title: 'SERPIENTE'`, `cat: 'ARCADE'`, `color: 'green'`, `cover: 'cover-snake'`.
- Nueva clase CSS `.cover-snake` en `app/globals.css`: fondo verde oscuro, patrón de grid sutil, una línea quebrada de bloques verde neón simulando el cuerpo de la serpiente y un punto destacado (fruta), mismo patrón de pseudo-elementos que las demás `.cover-*`.
- Motor diseñado desde cero en `components/games/snake/engine.ts`: grid lógico 20×20 celdas, movimiento por "tick" (no por frame), cola de dirección para no permitir un giro de 180° instantáneo sobre el propio cuerpo, colisión con bordes y con el propio cuerpo (game over inmediato, sin wrapping), crecimiento de un segmento por fruta comida, niveles que suben cada N frutas con el tick de movimiento cada vez más corto, sin JSX, con la API basada en callbacks del `recipe.md`.
- Constante TS `FRUIT_ATLAS` (en `engine.ts` o en un `fruit-atlas.ts` hermano), traducida 1:1 de `references/snake-assets/sprites.js` (21 entradas `{x,y,w,h}`), usada para elegir un sprite de fruta al azar en cada spawn y recortarlo de `fruits.png` vía `drawImage`.
- `public/games/snake/fruits.png`: copia del asset desde `references/snake-assets/fruits.png`.
- Precarga de `fruits.png` (`Image.onload`) antes de arrancar el loop del motor — variación explícita sobre el patrón general de `recipe.md` (que arranca el loop de inmediato), documentada en Decisions.
- Wrapper cliente `components/games/snake-player.tsx`: HUD de la plataforma con "Vidas" fijo en 1 (sin regenerar), "Nivel" reflejando la progresión real de velocidad, botones PAUSA/FIN/SALIR wireados al motor, controles táctiles (D-pad de 4 direcciones, sin botón de acción) visibles bajo 840px, `GameOverModal` y guardado vía `insertScore`.
- `app/games/[id]/play/page.tsx`: una rama más — `id === "snake"` renderiza `SnakePlayer`.
- CSS `.snake-canvas` y `.snake-touch-controls` en `app/globals.css`, con el breakpoint de 840px ya usado en el resto del sitio.

**Out of scope (para otro spec):**

- Sonido/música — el atlas no incluye audio y no fue pedido.
- Wrapping toroidal en los bordes — se decidió explícitamente game over inmediato al salir del grid.
- Sistema de vidas múltiples o reinicio de posición tras chocar — se decidió explícitamente 1 vida fija.
- Puntaje variable por tipo de fruta — todas las frutas valen lo mismo; el sprite variable es solo estético.
- Gestos de swipe sobre el canvas como alternativa al D-pad táctil.
- Obstáculos, power-ups, múltiples serpientes o cualquier mecánica ausente del Snake clásico.
- Sprites para el cuerpo/cabeza de la serpiente — el atlas disponible solo trae frutas; la serpiente se dibuja con formas planas.
- Tests automatizados (unit/e2e).
- Soporte de gamepad físico.
- Cualquier cambio a ASTEROIDES, TETRIS, ARKANOID o a los módulos genéricos sobre `getGames()` (`components/game-card.tsx`, `components/games-browser.tsx`, `app/games/[id]/page.tsx`, `app/hall-of-fame/`, `lib/data/*`).

## Data model

**SQL (manual, en el SQL Editor de Supabase):**

```sql
insert into games (id, title, short, long, cat, cover, color) values
  ('snake', 'SERPIENTE',
   'Guía a la serpiente, come frutas y no choques contigo mismo.',
   'Controla una serpiente que crece con cada fruta que come sobre una cuadrícula de 20 por 20 celdas. Cada tramo de frutas comidas sube de nivel y acelera el movimiento; chocar contra tu propio cuerpo o contra el borde del tablero termina la partida al instante.',
   'ARCADE', 'cover-snake', 'green');
```

`best` y `plays` no se insertan: los calcula la vista `games_with_stats` desde `scores`.

Nota (de `recipe.md`): `color: 'green'` no tiene clase de botón propia en `components/game-card.tsx` — hoy cae al estilo `cyan` por defecto. Deuda visual menor, aceptada explícitamente (ver Decisions); no se toca `game-card.tsx` en este spec.

**TypeScript:**

```ts
// components/games/snake/engine.ts — motor diseñado desde cero, sin JSX
export type SnakeCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void; // siempre reporta 1 mientras el juego corre
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type SnakeGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void; // "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
  forceGameOver: () => void;
};

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
): SnakeGame;
```

Atlas de frutas, portado 1:1 de `references/snake-assets/sprites.js` (21 entradas, mismos recortes):

```ts
type FruitSprite = { x: number; y: number; w: number; h: number };

const FRUIT_SOURCE = "/games/snake/fruits.png";

const FRUIT_ATLAS: Record<string, FruitSprite> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  // … las 21 entradas de sprites.js, sin cambios de coordenadas
};

const FRUIT_KEYS = Object.keys(FRUIT_ATLAS);
```

Geometría del canvas (constantes del motor, no configurables):

```ts
const CELL = 24;
const COLS = 20,
  ROWS = 20;
const CANVAS_W = 800,
  CANVAS_H = 600; // 4:3, rellena .crt-screen
const BOARD_X = 160,
  BOARD_Y = 60; // (800 - COLS*CELL)/2, (600 - ROWS*CELL)/2 → tablero 480×480 centrado
// gutters laterales (160px) y superior/inferior (60px): fondo sólido, sin dibujar nada encima
```

Progresión de velocidad y puntaje:

```ts
const POINTS_PER_FRUIT = 10;
const FRUITS_PER_LEVEL = 5; // cada 5 frutas comidas → +1 nivel
const TICK_START_MS = 160; // velocidad del nivel 1
const TICK_STEP_MS = 12; // se resta por nivel
const TICK_MIN_MS = 60; // piso: el juego nunca es más rápido que esto
const START_LENGTH = 3; // segmentos iniciales, centrados, dirección "right"
```

Estado del juego (clausura interna del motor, no exportado):

```ts
// snake: Array<{ col: number; row: number }>, snake[0] es la cabeza
// direction / nextDirection: "up" | "down" | "left" | "right"
//   nextDirection se aplica en el próximo tick y se rechaza si es opuesta a direction
// fruit: { col: number; row: number; sprite: string }   sprite ∈ FRUIT_KEYS
// score, level, fruitsEaten, tickAccumulatorMs
```

Convenciones:

- El motor avanza por **tick lógico**, no por frame: `update(dt)` acumula `dt` y solo mueve la serpiente una celda cuando el acumulador supera el intervalo del nivel actual. `draw()` sí corre en cada frame.
- El intervalo del nivel es `Math.max(TICK_MIN_MS, TICK_START_MS - (level - 1) * TICK_STEP_MS)`.
- `dt` se limita (`Math.min(dt, 0.05)`, igual que ASTEROIDES) para que una pestaña en segundo plano no dispare una ráfaga de ticks al volver.
- No hay wrapping: salir de `[0, COLS) × [0, ROWS)` es game over inmediato, igual que morder cualquier segmento del propio cuerpo.
- La cola solo se recorta cuando **no** se comió fruta en ese tick; comer fruta = mover la cabeza sin quitar la cola (crecimiento de un segmento).
- La fruta reaparece en una celda aleatoria **libre** (no ocupada por ningún segmento), con un sprite elegido al azar de `FRUIT_KEYS`.
- `onLivesChange` siempre se llama con `1` (nunca `0`) mientras el juego está en curso; el choque dispara directamente `onGameOver`, no una transición de vidas.
- `createSnakeGame` precarga `fruits.png` (`Image.onload`) y arranca el loop cuando la imagen está lista — única variación documentada sobre el patrón general de `recipe.md`. Si la imagen falla al cargar, el motor arranca igual y dibuja la fruta como un círculo de color de respaldo, para que un 404 no deje el juego muerto.
- El motor no toca `window`/`document` fuera de sus propios `keydown`/`keyup`, que remueve en `destroy()`. No lee ni escribe `localStorage`.
- `preventDefault()` solo sobre los cuatro códigos que consume: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`.
- El HUD dibujado dentro del canvas no existe: puntuación, nivel y vidas viven solo en el `player-hud` de la plataforma.

## Implementation plan

1. **Insertar la fila del catálogo (paso manual del usuario).** Ejecutar el `insert into games` de arriba en el SQL Editor de Supabase.
   _Test:_ `/games` muestra la tarjeta "SERPIENTE" junto a ASTEROIDES, TETRIS y ARKANOID; `/games/snake` muestra el detalle con `best = 0`, `plays = 0` y leaderboard vacío; `/games/snake/play` todavía renderiza el reproductor mock genérico.

2. **Arte de portada.** Agregar `.cover-snake` en `app/globals.css`, junto a las demás `.cover-*`: fondo verde oscuro con `radial-gradient`, un patrón de cuadrícula sutil con `repeating-linear-gradient` en `::after`, y en `::before` una línea quebrada de cuadros verde neón (cuerpo) más un punto de fruta destacado.
   _Test:_ la tarjeta en `/games` y el hero de `/games/snake` muestran el arte nuevo; `.cover-asteroids`, `.cover-tetris` y `.cover-arkanoid` no cambian.

3. **Asset.** Copiar `references/snake-assets/fruits.png` a `public/games/snake/fruits.png`.
   _Test:_ abrir `/games/snake/fruits.png` directamente en el navegador devuelve la imagen, sin 404.

4. **Motor.** Crear `components/games/snake/engine.ts` con: `FRUIT_ATLAS` portado de `sprites.js`, precarga de la imagen, constantes de geometría y progresión, estado inicial (3 segmentos centrados mirando a la derecha), lectura de flechas sobre `e.code` con la regla de no-inversión, tick lógico con acumulador de `dt`, colisión con bordes y cuerpo, spawn de fruta en celda libre con sprite aleatorio, subida de nivel cada 5 frutas, `draw()` del tablero + serpiente + fruta, y la API `pause`/`resume`/`destroy`/`setKey`/`forceGameOver`. No se conecta a ningún componente todavía.
   _Test:_ `npm run build` compila sin errores de tipos.

5. **Reproductor y rama de ruta.** Crear `components/games/snake-player.tsx` siguiendo la estructura de `asteroids-player.tsx`: HUD con Jugador / Puntuación / Vidas / Nivel, marco `.crt` con el canvas 800×600 y el overlay "EN PAUSA", `.crt-bottom`, botones PAUSA/FIN/SALIR, `GameOverModal` con `insertScore` importado de `lib/data/scores.ts`, nombre precargado desde `av_user`. Agregar `.snake-canvas` en `app/globals.css` y la línea `if (game.id === "snake") return <SnakePlayer game={game} />;` en `app/games/[id]/play/page.tsx`.
   _Test manual:_ en `/games/snake/play` se juega con las flechas; la serpiente crece al comer, el HUD refleja el estado real del motor; PAUSA congela con el frame visible y REANUDAR continúa sin salto de tick; FIN abre `GameOverModal` con la puntuación alcanzada; guardar inserta una fila en `scores` con `game_id = 'snake'`, visible en `/games/snake` y en `/hall-of-fame`.

6. **Controles táctiles.** Agregar el bloque `.snake-touch-controls` en el reproductor (`.td-pad` con los cuatro botones ↑ ↓ ← →, sin `.td-actions`) y su CSS con el `@media (max-width: 840px)`, siguiendo el bloque de `.arkanoid-touch-controls`. Cada botón usa `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel` sobre `setKey` con los mismos códigos de flecha.
   _Test manual:_ bajo 840px los cuatro botones cambian la dirección igual que el teclado; en escritorio no se renderizan.

7. **Repaso final con Playwright.** Comparar `/games/snake/play` contra el resto del sitio (HUD, marco `.crt`, tipografía) en viewport de escritorio y móvil. Verificar en particular que los sprites de fruta no quedan apagados sobre el `.crt-screen` negro con líneas de escaneo, que el tablero 480×480 queda visualmente centrado dentro del marco 4:3, y que el D-pad de cuatro botones es cómodo en móvil. Ajustar escalado del canvas y colocación de los controles.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores en consola en `/games`, `/games/snake` y `/games/snake/play`.
- [ ] `select * from games_with_stats where id = 'snake'` devuelve la fila, y `best`/`plays` se mueven al insertar puntuaciones reales.
- [ ] `/games` muestra la tarjeta "SERPIENTE" con `.cover-snake`, sin cambios en las tarjetas de ASTEROIDES, TETRIS ni ARKANOID.
- [ ] `/games/snake` muestra cover, tags, descripción, stat-strip y el leaderboard lateral.
- [ ] `fruits.png` se sirve desde `public/games/snake/` sin ningún 404 en la pestaña de red.
- [ ] El canvas rellena el marco `.crt` (4:3) sin deformación ni recorte, en escritorio y en móvil, con el tablero 480×480 centrado.
- [ ] Las cuatro flechas cambian la dirección de la serpiente, y una flecha opuesta a la dirección actual se ignora (no se puede morder el propio cuello invirtiendo el sentido).
- [ ] La serpiente arranca con 3 segmentos y avanza sola sin pulsar ninguna tecla.
- [ ] Comer una fruta suma exactamente 10 puntos, alarga la serpiente en un segmento y hace reaparecer otra fruta en una celda libre.
- [ ] La fruta que aparece nunca se solapa con un segmento de la serpiente.
- [ ] El sprite de la fruta varía entre partidas y entre spawns (se ven distintas frutas de las 21 del atlas), sin que eso cambie los puntos.
- [ ] Chocar contra cualquier borde del tablero termina la partida al instante y abre `GameOverModal`.
- [ ] Chocar contra un segmento del propio cuerpo termina la partida al instante y abre `GameOverModal`.
- [ ] El stat "Vidas" del HUD muestra siempre 1 mientras la partida está en curso.
- [ ] Cada 5 frutas comidas el stat "Nivel" sube en 1 y la serpiente se mueve visiblemente más rápido.
- [ ] La velocidad deja de aumentar al llegar al piso de 60 ms por tick; el juego sigue siendo jugable.
- [ ] El juego corre a la misma velocidad percibida en un monitor de 60 Hz y en uno de 120 Hz.
- [ ] Volver a la pestaña tras dejarla en segundo plano no dispara una ráfaga de ticks (la serpiente no salta varias celdas de golpe).
- [ ] El HUD (Jugador / Puntuación / Vidas / Nivel) refleja el estado real del motor, no valores simulados, y no aparece ningún HUD dibujado dentro del canvas.
- [ ] El botón PAUSA congela el juego con el frame visible y el overlay "EN PAUSA"; REANUDAR continúa sin que la serpiente salte celdas por el tiempo pausado.
- [ ] El botón FIN termina la partida inmediatamente con la puntuación alcanzada hasta ese momento.
- [ ] Guardar en `GameOverModal` inserta una fila en `scores` con `game_id = 'snake'`, visible en `/hall-of-fame`.
- [ ] El nombre precargado en el modal sigue viniendo de `av_user` en `localStorage`.
- [ ] Este spec no añade ninguna clave nueva a `localStorage`.
- [ ] Bajo 840px aparecen los cuatro botones táctiles y cambian la dirección igual que el teclado; en escritorio no se renderizan.
- [ ] Un dedo arrastrado fuera de un botón táctil no deja la tecla trabada.
- [ ] Las flechas no hacen scroll de la página mientras el juego está montado.
- [ ] Salir de `/games/snake/play` detiene el loop: sin errores en consola y sin listeners huérfanos.
- [ ] `npm run build` termina sin errores.

## Decisions

- **Yes:** diseñar el motor desde cero en vez de portar uno. No existe código de Snake en `references/started-games/`; la carpeta que dio el usuario solo contiene arte de frutas. Verificado antes de empezar el spec.
- **Yes:** un solo spec para mecánica + integración. Snake es una mecánica acotada (grid, dirección, colisión, crecimiento); partirla en dos specs añadiría ceremonia sin reducir riesgo. Confirmado con el usuario.
- **Yes:** `id: "snake"` en inglés con `title: "SERPIENTE"` en español. Sigue el precedente de `asteroids`/"ASTEROIDES" del spec 05: slugs técnicos en inglés, títulos visibles en español.
- **Yes:** `cat: 'ARCADE'`. Snake es un clásico arcade de reflejos y crecimiento continuo; no es un puzzle de planificación por turnos.
- **Yes:** `color: 'green'`, pese a que `components/game-card.tsx` no tiene clase de botón para `green` y hoy lo renderiza como `cyan`. El color temático correcto pesa más que la diferencia visual del botón; añadir la clase `green` es un cambio transversal al catálogo que merece su propio spec.
- **No:** cambiar `game-card.tsx` para dar a `green` su propia clase de botón dentro de este spec. Es un archivo genérico sobre `getGames()` que `recipe.md` marca explícitamente como intocable al agregar un juego.
- **Yes:** grid 20×20 con celdas de 24px sobre canvas lógico 800×600. El tablero cuadrado de 480×480 cabe centrado en el 4:3 de `.crt-screen` sin deformarse, y evita el conflicto geométrico que el spec 07 tuvo que resolver para el tablero 1:2 de Tetris.
- **No:** un canvas cuadrado 600×600 escalado. Deformaría o dejaría barras dentro del `.crt-screen`, que tiene `aspect-ratio: 4 / 3` fijo en `app/globals.css`.
- **Yes:** game over inmediato al chocar contra un borde, sin wrapping toroidal. Es el Snake clásico y el que la mayoría espera; el wrapping haría el juego notablemente más fácil y difuminaría la tensión del tablero cerrado.
- **No:** wrapping en los bordes al estilo ASTEROIDES. Elegido explícitamente por el usuario.
- **Yes:** una sola vida, con el stat "Vidas" del HUD fijo en 1. Snake clásico no tiene vidas; el slot del HUD existe en el markup compartido y mostrar siempre 1 es más honesto que inventar un sistema de vidas.
- **No:** 3 vidas con reposición de la serpiente tras cada choque. Sería un rediseño de la mecánica, no una decisión de HUD.
- **Yes:** niveles que suben cada 5 frutas y acortan el tick, con un piso de 60 ms. Da contenido real al stat "Nivel" que ya existe en el HUD y crea una curva de dificultad; el piso evita que el juego se vuelva injugable en partidas largas.
- **No:** velocidad fija sin niveles. `recipe.md` lo permite, pero dejaría el stat "Nivel" congelado en 01 y el juego sin progresión.
- **Yes:** puntaje fijo de 10 puntos por fruta, con el sprite elegido al azar entre las 21 del atlas solo por variedad visual. Mantiene el marcador legible y aprovecha todo el arte disponible sin inventar una tabla de 21 valores que el jugador no podría memorizar.
- **No:** puntos distintos por tipo de fruta. Obligaría a mostrar en el HUD qué vale cada fruta para ser justo, y ninguna de las 21 tiene un valor "natural" evidente.
- **Yes:** movimiento por tick lógico discreto con acumulador de `dt`, en vez de física continua por frame. Es lo que hace que Snake se sienta como Snake, y desacopla la velocidad del juego de la tasa de refresco del monitor.
- **Yes:** `nextDirection` aplicada en el próximo tick, rechazando la dirección opuesta a la actual. Sin esa regla, dos pulsaciones rápidas dentro de un mismo tick permitirían invertir el sentido y morir contra el propio cuello sin culpa del jugador.
- **Yes:** solo flechas como controles de teclado. Consistente con ASTEROIDES y TETRIS; el motor consume `e.code`, que es lo mismo que inyectan los botones táctiles vía `setKey`.
- **No:** WASD como alias. No aporta a un juego de cuatro direcciones y duplica los casos de prueba de teclado.
- **Yes:** D-pad táctil de cuatro botones, sin botón de acción. Snake no dispara ni salta; los cuatro botones cubren toda la entrada del juego.
- **No:** gestos de swipe sobre el canvas. No hay precedente en el resto del catálogo y añade una capa de detección de gestos que el D-pad ya resuelve.
- **Yes:** `fruits.png` copiado a `public/games/snake/` y el atlas de `sprites.js` portado a una constante TS tipada. Sigue el patrón de assets del spec 08 (ARKANOID) y mantiene el motor como módulo TS puro.
- **No:** cargar `sprites.js` tal cual como script global y leer `window.SPRITE_ATLAS`. Rompería el patrón TS-puro de todos los motores del catálogo y metería una dependencia de orden de carga en un Client Component.
- **Yes:** precargar `fruits.png` con `Image.onload` antes de arrancar el loop, con un círculo de color de respaldo si la carga falla. Evita el primer frame sin fruta; el respaldo evita que un 404 deje el juego sin objetivo visible.
- **No:** arrancar el loop de inmediato y tolerar frames sin fruta. En un juego donde la fruta es el único objetivo, no dibujarla los primeros frames se lee como un bug.
- **Yes:** pausa con el patrón estándar del sitio — se congela el avance de ticks pero se sigue llamando a `draw()`, con el overlay "EN PAUSA" encima, y al reanudar se descarta el acumulador. Es el mismo comportamiento que ASTEROIDES, TETRIS y ARKANOID.
- **No:** sonido en este spec. El material entregado no incluye audio y no fue pedido; TETRIS y ARKANOID ya establecieron cómo se añade cuando toque.

## Risks

| Riesgo                                                                                                                                                       | Mitigación                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El recorte de la fruta (hasta 170×160px en el atlas) dibujado en una celda de 24px puede verse borroso o aplastado, ya que las 21 frutas no comparten ancho. | Dibujar cada fruta preservando su relación de aspecto dentro de la celda (encajar por el lado mayor y centrar), no estirando `w`/`h` al cuadrado de la celda. Verificar en el paso 7 con varias frutas distintas. |
| Los sprites de fruta, pensados para fondo claro, pueden quedar apagados sobre el `.crt-screen` negro con líneas de escaneo.                                  | Riesgo ya visto en el spec 08 con el spritesheet de ARKANOID. Se revisa en el paso 7 y, si hace falta, se compensa con un halo/`shadowBlur` detrás de la fruta, sin tocar el asset.                               |
| Un `dt` grande tras volver de una pestaña en segundo plano podría ejecutar muchos ticks de golpe y matar la serpiente sin que el jugador vea nada.           | `dt` se limita a `0.05` s antes de acumularse, igual que en ASTEROIDES; y el acumulador se descarta al reanudar desde pausa. Criterio de aceptación explícito.                                                    |
| La carga de `fruits.png` es asíncrona; si el componente se desmonta antes del `onload`, el callback podría arrancar un loop sobre un canvas ya desmontado.   | El `onload` comprueba una bandera `destroyed` de la clausura antes de arrancar el loop; `destroy()` la activa. Es el mismo contrato que ya exige `recipe.md` para el `requestAnimationFrame`.                     |
| Buscar una celda libre para la fruta por rechazo aleatorio se degrada cuando la serpiente ocupa casi todo el tablero (400 celdas).                           | Construir la lista de celdas libres y elegir de ella, en vez de reintentar al azar. Es O(400) por spawn, irrelevante a esta escala y sin caso peor.                                                               |
| `color: 'green'` renderiza el botón de la tarjeta como `cyan`, lo que puede leerse como un bug durante la revisión.                                          | Documentado como decisión consciente y como deuda visual conocida de `game-card.tsx`; no se corrige aquí.                                                                                                         |
| Next.js 16.2.10 no es el Next.js del conocimiento de entrenamiento (assets estáticos, Client Components, `params`).                                          | Antes de los pasos 3 y 5, consultar `node_modules/next/dist/docs/01-app/`, como exige `CLAUDE.md`.                                                                                                                |
| Importar `insertScore` desde `lib/data/games.ts` rompe el build con un error engañoso de "Pages Router".                                                     | `snake-player.tsx` importa `insertScore` **solo** desde `lib/data/scores.ts`, como ya hacen los otros tres reproductores.                                                                                         |

## Lo que **no** está en este spec

- Sonido y música.
- Wrapping toroidal en los bordes.
- Vidas múltiples o reposición de la serpiente tras chocar.
- Puntaje variable según el tipo de fruta.
- Sprites para el cuerpo y la cabeza de la serpiente.
- Gestos de swipe en los controles táctiles.
- Obstáculos, power-ups o modos de juego adicionales.
- Dar a `color: 'green'` su propia clase de botón en `components/game-card.tsx`.
- Tests automatizados.
- Soporte de gamepad físico.

Cada uno de estos, si se implementa, va en su propio spec.
