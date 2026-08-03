# GAME JAM 03 — CRUCE

> **Status:** Implemented
> **Depends on:** 05-asteroids-game, 06-leaderboard-catalogo-supabase
> **Date:** 2026-07-29
> **Objective:** Diseñar "CRUCE" (`id: "cruce"`) como versión clásica de pantalla fija del cruce de carriles propuesto en `suggested-games.md`, con motor de saltos discretos, tráfico, río y tres vidas antes de game over.
> **Nota posterior:** durante la implementación el `id` final quedó como `"crossing"` (no `"cruce"`), y así aparece en el código (`components/games/crossing/`, `crossing-player.tsx`) e `implemented-games.md`. Este spec no se reescribió para reflejarlo; es el registro histórico de la decisión original.

## Why this spec exists

Este spec es una de dos alternativas del mismo concepto — la hermana es `specs/game-jam/04-cruce-ascenso-infinito.md` ("ASCENSO"). El eje que las separa es **Mecánica**: aquí el jugador cruza una pantalla fija de carriles (tráfico + río) hacia una fila de metas, y al llenarla la pantalla se reinicia más rápido y reordenada; en la hermana no hay pantalla fija ni metas — el jugador asciende sin fin mientras una línea de peligro sube desde abajo y lo obliga a avanzar contra el reloj. Solo una de las dos se implementará.

CRUCE es la lectura fiel de la propuesta original registrada en `suggested-games.md` (fila CRUCE, 2026-07-29): estructura de carriles fija, sin límite de tiempo salvo el propio tráfico, tal como el género clásico de cruce de carriles la plantea genéricamente.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (SQL manual): `id: 'cruce'`, `title: 'CRUCE'`, `cat: 'ARCADE'`, `color: 'cyan'`, `cover: 'cover-cruce'`.
- Nueva clase CSS `.cover-cruce` en `app/globals.css`: franjas horizontales alternando asfalto oscuro y agua cian, mismo patrón de pseudo-elementos que las demás `.cover-*`.
- Motor diseñado desde cero en `components/games/cruce/engine.ts`: tablero de 11×13 celdas (fila 0 metas, filas 1–5 río, fila 6 mediana, filas 7–11 calzada, fila 12 salida), salto discreto por celda con bloqueo de repetición (`HOP_LOCK_MS`), colisión con vehículos y ahogamiento en el río, 3 vidas, subida de nivel al llenar las 5 metas, sin JSX, con la API basada en callbacks del `recipe.md`.
- Wrapper cliente `components/games/cruce-player.tsx`: HUD de la plataforma (Jugador / Puntuación / Vidas / Nivel), botones PAUSA/FIN/SALIR, D-pad táctil de 4 direcciones visible bajo 840px, `GameOverModal` y guardado vía `insertScore`.
- `app/games/[id]/play/page.tsx`: una rama más — `id === "cruce"` renderiza `CrucePlayer`.
- CSS `.cruce-canvas` y `.cruce-touch-controls` en `app/globals.css`, con el breakpoint de 840px ya usado en el resto del sitio.

**Out of scope (para otro spec):**

- La versión de ascenso infinito — vive en `specs/game-jam/04-cruce-ascenso-infinito.md`, un spec independiente.
- Sonido y música — no fue pedido y no hay assets de audio disponibles.
- Sprites de vehículos, troncos o personaje — todo se dibuja con formas planas en canvas; ningún asset bajo `public/`.
- Modo cooperativo o versus de dos jugadores.
- Tests automatizados (unit/e2e) y soporte de gamepad físico.
- Cualquier cambio a ASTEROIDES, TETRIS, ARKANOID, SERPIENTE o a los módulos genéricos sobre `getGames()`.

## Data model

**SQL (manual, en el SQL Editor de Supabase):**

```sql
insert into games (id, title, short, long, cat, cover, color, title_en, short_en, long_en) values
  ('cruce', 'CRUCE',
   'Cruza carriles de tráfico y un río sin perder un solo salto: un golpe y se acabó.',
   'Guía a tu explorador a través de una franja de carriles con vehículos en movimiento y una franja de río con troncos flotantes, saltando de una celda a otra hasta alcanzar una de las cinco metas de la orilla opuesta. Cualquier colisión con un vehículo, o quedarte sin tronco bajo los pies en el río, termina la vida al instante. Llenar las cinco metas sube de nivel y reordena los carriles, más rápidos que antes.',
   'ARCADE', 'cover-cruce', 'cyan',
   'CROSSING',
   'Cross traffic lanes and a river without missing a single hop: one hit and it''s over.',
   'Guide your explorer across a strip of lanes with moving vehicles and a river strip with floating logs, hopping from cell to cell to reach one of the five goals on the far shore. Any collision with a vehicle, or being left without a log underfoot in the river, ends the life instantly. Filling all five goals levels up and reshuffles the lanes, faster than before.');
```

`best` y `plays` no se insertan: los calcula la vista `games_with_stats` desde `scores`.

**TypeScript:**

```ts
// components/games/cruce/engine.ts — motor diseñado desde cero, sin JSX
export type CruceCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type CruceGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void; // "ArrowUp"|"ArrowDown"|"ArrowLeft"|"ArrowRight"
  forceGameOver: () => void;
};

export function createCruceGame(
  canvas: HTMLCanvasElement,
  callbacks: CruceCallbacks,
): CruceGame;
```

Geometría del canvas (constantes del motor, no configurables):

```ts
const CELL = 40;
const COLS = 11,
  ROWS = 13; // fila 0 = meta, 1-5 río, 6 mediana, 7-11 calzada, 12 salida
const CANVAS_W = 800,
  CANVAS_H = 600; // 4:3, rellena .crt-screen
const BOARD_W = COLS * CELL; // 440
const BOARD_H = ROWS * CELL; // 520
const BOARD_X = (CANVAS_W - BOARD_W) / 2; // 180
const BOARD_Y = (CANVAS_H - BOARD_H) / 2; // 40, gutters superior/inferior de 40px
const GOAL_COLS = [0, 2, 5, 8, 10]; // columnas de las 5 metas en la fila 0
```

Progresión y puntuación:

```ts
const START_LIVES = 3;
const POINTS_PER_ADVANCE = 10; // por cada nueva fila máxima alcanzada en la vida actual
const GOAL_BONUS = 50; // por cada meta ocupada
const HOP_LOCK_MS = 120; // ventana mínima entre saltos: una tecla mantenida no atraviesa varios carriles de un tirón
const LANE_SPEED_STEP = 0.15; // +15% de velocidad por nivel sobre la base de cada carril
```

Estado del juego (clausura interna del motor, no exportado):

```ts
// player: { row: number; col: number }, fila 12 al iniciar cada vida
// maxRowReached: number   // para no puntuar avances hacia atrás
// lanes: Array<{ row: number; type: "river" | "road"; dir: 1 | -1; speed: number; objects: {col:number; width:number}[] }>
// filledGoals: boolean[5]  // una por GOAL_COLS
// score, lives, level, hopLockUntilMs
```

Convenciones:

- El salto es discreto y por evento: una transición `pressed=false→true` en `setKey` encola un salto de una celda si `HOP_LOCK_MS` ya expiró; mantener la tecla presionada no repite el salto por sí solo. Es la diferencia de sensación deliberada frente a SERPIENTE, que avanza sola por tick lógico continuo — aquí no pasa nada si no se pulsa.
- Las filas 1–5 (río) y 7–11 (calzada) llevan objetos que se mueven horizontalmente a velocidad y dirección propias de carril, alternando sentido entre carriles adyacentes.
- En la calzada, pisar la misma celda que un vehículo es game over de la vida actual. En el río, el jugador solo sobrevive si su celda coincide con un objeto flotante; una celda de agua vacía bajo sus pies, o ser arrastrado fuera de `[0, COLS)` por un tronco, también termina la vida.
- La fila 6 (mediana) y la fila 12 (salida) son siempre seguras, sin objetos.
- Llegar a la fila 0 en una columna sin meta (`GOAL_COLS`) bloquea el movimiento hacia esa celda (como el seto del original) — no es game over, solo un salto inválido.
- Llegar a una celda de meta libre la marca como ocupada, suma `GOAL_BONUS`, y devuelve al jugador a la fila de salida. Cuando las 5 metas están ocupadas, sube el nivel, se limpian las 5 metas y las velocidades de carril se multiplican `1 + (nivel-1) * LANE_SPEED_STEP`.
- Perder una vida respawnea al jugador en la fila de salida, en la columna central, sin resetear metas ya ocupadas ni el nivel. Perder la última vida dispara `onGameOver`.
- `dt` se limita (`Math.min(dt, 0.05)`, igual que ASTEROIDES) para que una pestaña en segundo plano no adelante de golpe los carriles.
- El motor no toca `window`/`document` fuera de sus propios `keydown`/`keyup`, que remueve en `destroy()`. No lee ni escribe `localStorage`.
- `preventDefault()` solo sobre los cuatro códigos que consume: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`.
- El HUD dibujado dentro del canvas no existe: puntuación, vidas y nivel viven solo en el `player-hud` de la plataforma.
- No hay assets bajo `public/`: vehículos, troncos, meta y personaje se dibujan con rectángulos y polígonos planos en canvas.

## Implementation plan

1. **Insertar la fila del catálogo (paso manual del usuario).** Ejecutar el `insert into games` de arriba en el SQL Editor de Supabase.
   _Test:_ `/games` muestra la tarjeta "CRUCE" junto a las demás; `/games/cruce` muestra el detalle con `best = 0`, `plays = 0` y leaderboard vacío; `/games/cruce/play` todavía renderiza el reproductor mock genérico.
2. **Arte de portada.** Agregar `.cover-cruce` en `app/globals.css`: franjas horizontales oscuras (asfalto) y cian (agua) con `repeating-linear-gradient`, siluetas planas de vehículo/tronco en `::after`, mismo patrón que las demás `.cover-*`.
   _Test:_ la tarjeta en `/games` y el hero de `/games/cruce` muestran el arte nuevo; ninguna otra `.cover-*` cambia.
3. **Motor.** Crear `components/games/cruce/engine.ts`: tablero 11×13, generación de carriles con velocidad/dirección por fila, salto discreto con `HOP_LOCK_MS`, colisión de calzada, ahogamiento de río, metas, vidas, nivel, y la API `pause`/`resume`/`destroy`/`setKey`/`forceGameOver`. No se conecta a ningún componente todavía.
   _Test:_ `npm run build` compila sin errores de tipos.
4. **Reproductor y rama de ruta.** Crear `components/games/cruce-player.tsx` siguiendo la estructura de `snake-player.tsx`: HUD con Jugador / Puntuación / Vidas / Nivel, marco `.crt` con el canvas 800×600 y el overlay "EN PAUSA", `.crt-bottom`, botones PAUSA/FIN/SALIR, `GameOverModal` con `insertScore` de `lib/data/scores.ts`, nombre precargado desde `av_user`. Agregar `.cruce-canvas` en `app/globals.css` y la línea `if (game.id === "cruce") return <CrucePlayer game={game} />;` en `app/games/[id]/play/page.tsx`.
   _Test manual:_ en `/games/cruce/play` se juega con las flechas, cada pulsación mueve una celda; el HUD refleja el estado real del motor; PAUSA congela con el frame visible y REANUDAR continúa sin salto de tráfico; FIN abre `GameOverModal` con la puntuación alcanzada; guardar inserta una fila en `scores` con `game_id = 'cruce'`.
5. **Controles táctiles.** Agregar el bloque `.cruce-touch-controls` (`.td-pad` con las cuatro direcciones, sin `.td-actions`) y su CSS con el `@media (max-width: 840px)`, siguiendo `.snake-touch-controls`. Cada botón usa `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel` sobre `setKey`.
   _Test manual:_ bajo 840px los cuatro botones saltan igual que el teclado, respetando el mismo `HOP_LOCK_MS`; en escritorio no se renderizan.
6. **Repaso final con Playwright.** Comparar `/games/cruce/play` contra el resto del sitio (HUD, marco `.crt`, tipografía) en viewport de escritorio y móvil. Verificar que el tablero 440×520 queda centrado dentro del marco 4:3, que los vehículos y troncos se distinguen claramente sobre el `.crt-screen` negro, y que las 5 metas son visualmente identificables. Ajustar escalado del canvas y colocación de los controles.

## Acceptance criteria

- [x] `npm run dev` levanta sin errores en consola en `/games`, `/games/cruce` y `/games/cruce/play`.
- [x] `select * from games_with_stats where id = 'cruce'` devuelve la fila, y `best`/`plays` se mueven al insertar puntuaciones reales. Verificado vía UI (no SQL directo): `plays` pasó de 1 a 2 en `/games/cruce` tras guardar una puntuación nueva desde `GameOverModal`.
- [x] `/games` muestra la tarjeta "CRUCE" con `.cover-cruce`, sin cambios en las demás tarjetas.
- [x] `/games/cruce` muestra cover, tags, descripción, stat-strip y el leaderboard lateral.
- [x] El canvas rellena el marco `.crt` (4:3) sin deformación ni recorte, en escritorio y en móvil, con el tablero 440×520 centrado.
- [x] El jugador arranca en la fila de salida, columna central, con 3 vidas.
- [x] Cada pulsación de flecha mueve exactamente una celda; mantener la tecla presionada no atraviesa varios carriles de un tirón (`HOP_LOCK_MS`).
- [x] Pisar la misma celda que un vehículo en la calzada termina la vida actual al instante.
- [ ] Quedar en una celda de río sin un tronco debajo, o ser arrastrado fuera del tablero por uno, termina la vida actual al instante. No se ejerció en vivo en esta sesión (solo se llegó a la calzada); verificado por revisión de código (`checkPlayerSafety` en `engine.ts`), no por juego real.
- [ ] Llegar a la fila de meta en una columna sin `GOAL_COLS` bloquea el movimiento a esa celda sin terminar la vida. No se alcanzó la fila de meta en esta sesión; verificado por revisión de código.
- [ ] Ocupar una meta libre suma 50 puntos y devuelve al jugador a la fila de salida sin perder una vida. No se alcanzó una meta en esta sesión; verificado por revisión de código (`fillGoal` en `engine.ts`).
- [x] Avanzar a una fila nunca alcanzada en la vida actual suma 10 puntos; retroceder o repetir fila no suma puntos de nuevo.
- [ ] Llenar las 5 metas sube el nivel, limpia las metas y acelera todos los carriles. No ejercido en vivo (requiere llenar 5 metas); verificado por revisión de código.
- [ ] Perder una vida (no la última) respawnea en la fila de salida sin resetear metas ocupadas ni nivel. Se verificó el respawn sin perder metas/nivel al perder vidas intermedias, pero no había metas ocupadas en la corrida para confirmar que no se resetean.
- [x] Perder la última vida termina la partida al instante y abre `GameOverModal` con la puntuación alcanzada.
- [x] El stat "Vidas" del HUD refleja el número real de vidas restantes, no un valor fijo.
- [ ] Volver a la pestaña tras dejarla en segundo plano no adelanta los carriles de golpe (colisión injusta al volver). No ejercido en vivo; garantizado por el mismo `Math.min(dt, 0.05)` que usan ASTEROIDES/SERPIENTE.
- [x] El HUD (Jugador / Puntuación / Vidas / Nivel) refleja el estado real del motor, no valores simulados, y no aparece ningún HUD dibujado dentro del canvas.
- [x] El botón PAUSA congela el juego con el frame visible y el overlay "EN PAUSA"; REANUDAR continúa sin que el tráfico salte hacia delante por el tiempo pausado.
- [x] El botón FIN termina la partida inmediatamente con la puntuación alcanzada hasta ese momento.
- [x] Guardar en `GameOverModal` inserta una fila en `scores` con `game_id = 'cruce'`, visible en `/hall-of-fame`.
- [x] El nombre precargado en el modal sigue viniendo de `av_user` en `localStorage`.
- [x] Este spec no añade ninguna clave nueva a `localStorage`.
- [x] Bajo 840px aparecen los cuatro botones táctiles y saltan igual que el teclado; en escritorio no se renderizan.
- [ ] Un dedo arrastrado fuera de un botón táctil no deja la tecla trabada. Garantizado por el componente compartido `<TouchPad>` (`onPointerLeave`/`onPointerCancel`), no reverificado por juego individual.
- [x] Las flechas no hacen scroll de la página mientras el juego está montado. Garantizado por `preventDefault()` sobre los cuatro códigos capturados en `onKeyDown` (mismo patrón que ASTEROIDES/SERPIENTE); no se intentó un scroll real en esta sesión.
- [x] Salir de `/games/cruce/play` detiene el loop: sin errores en consola y sin listeners huérfanos. Verificado navegando fuera de `/play` varias veces durante la sesión sin errores de consola.
- [x] `npm run build` termina sin errores.

## Decisions

- **Sí:** motor diseñado desde cero, sin puerto de código existente. `suggested-games.md` describe la mecánica en prosa, no hay `game.js` de referencia en `references/started-games/`. Supuesto explícito de esta ejecución.
- **Sí:** `id: "cruce"` en español, sin traducción a inglés. A diferencia de `asteroids`/`tetris`/`snake`, la mecánica no tiene un nombre genérico consolidado en inglés que no sea la marca registrada del original; se usa directamente el sustantivo español. Supuesto explícito.
- **Sí:** `cat: 'ARCADE'`, `color: 'cyan'`. Tomados literalmente de la fila CRUCE en `suggested-games.md`, no son un supuesto de esta ejecución.
- **Sí:** tablero fijo de 11×13 celdas con 5 metas discretas, fiel a la estructura clásica de 5 carriles de tráfico + río + metas. Es el eje de esta versión frente al scroll infinito de la hermana. Supuesto explícito: número de columnas, filas y posiciones de meta no vienen del prompt del usuario.
- **No:** wrapping o teletransporte al salir del tablero por los costados. El jugador solo sale del tablero si un tronco lo arrastra fuera del río, y eso es game over — nunca aparece por el otro lado.
- **Sí:** 3 vidas iniciales, con muerte instantánea por colisión y sin daño progresivo, tal como especifica `suggested-games.md`. El sistema de vidas clásico (varios intentos, cada uno terminado de un solo golpe) no contradice "sin vidas/daño progresivo": lo que se descarta es una barra de vida o golpes que restan energía poco a poco. Supuesto explícito: el número exacto (3) no viene del prompt.
- **No:** un único intento (1 vida) como en SERPIENTE. Frogger clásico siempre ofreció varios intentos configurables; reducirlo a 1 sería un rediseño no pedido.
- **Sí:** salto discreto por evento (`pressed=false→true`) con `HOP_LOCK_MS` de bloqueo, en vez de tick lógico continuo como SERPIENTE. Es la diferencia de sensación de control señalada en el encargo: aquí el jugador decide cada salto; en SERPIENTE la serpiente avanza sola.
- **No:** repetición automática del salto al mantener la tecla presionada. Rompería el ritmo de "un salto, una decisión" que define el género.
- **Sí:** puntuación por avance de fila máxima (no por vaivén) más bonus fijo por meta, igual que el Frogger original. Evita que el jugador farmee puntos moviéndose adelante y atrás sin arriesgar nada.
- **No:** puntuación por tiempo restante o por velocidad de cruce. No hay límite de tiempo en esta versión — ese es exactamente el rasgo que la distingue de ASCENSO.
- **Sí:** sin sprites, todo dibujado con formas planas en canvas. No hay atlas de arte disponible para este concepto (a diferencia de SERPIENTE); mantiene el motor sin dependencias de `public/`.
- **No:** nombre, sprite de rana o vehículos con forma de marca reconocible. Riesgo de marca de Frogger (Konami); el personaje es un explorador genérico y los vehículos son rectángulos con detalles mínimos.
- **Sí:** D-pad táctil de 4 direcciones sin botón de acción, igual que SERPIENTE. El salto es la única acción del juego.

## Risks

| Riesgo                                                                                                                                   | Mitigación                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| La asociación con "Frogger" (marca de Konami) es fuerte en la memoria colectiva pese a que la mecánica de cruce de carriles es genérica. | Personaje, vehículos y troncos genéricos dibujados a medida, sin nombre ni forma reconocible del original; título y assets propios.    |
| Un `dt` grande al volver de una pestaña en segundo plano podría mover los carriles varias celdas de golpe y matar al jugador sin aviso.  | `dt` se limita a `0.05` s antes de acumularse, igual que ASTEROIDES. Criterio de aceptación explícito.                                 |
| El `HOP_LOCK_MS` puede sentirse demasiado restrictivo o demasiado laxo comparado con lo que el jugador espera de un juego de saltos.     | Se ajusta en el paso 6 con Playwright y prueba manual; 120 ms es un punto de partida, no un valor final cerrado.                       |
| Los objetos de río y calzada dibujados como rectángulos planos pueden confundirse visualmente entre sí sin arte de referencia.           | Paletas de color claramente distintas por tipo de carril (río cian oscuro, calzada gris) y por tipo de objeto, revisadas en el paso 6. |
| Importar `insertScore` desde `lib/data/games.ts` rompe el build con un error engañoso de "Pages Router".                                 | `cruce-player.tsx` importa `insertScore` **solo** desde `lib/data/scores.ts`, como los demás reproductores.                            |
| Next.js 16.2.10 no es el Next.js del conocimiento de entrenamiento.                                                                      | Antes de los pasos 3 y 4, consultar `node_modules/next/dist/docs/01-app/`, como exige `CLAUDE.md`.                                     |

## Lo que **no** está en este spec

- La versión de ascenso infinito (`specs/game-jam/04-cruce-ascenso-infinito.md`).
- Sonido y música.
- Sprites de vehículos, troncos o personaje.
- Modo cooperativo o versus de dos jugadores.
- Tests automatizados y soporte de gamepad físico.

Cada uno de estos, si se implementa, va en su propio spec.

## Implementation notes

- **Desviación del Data model:** este spec se redactó antes de que `title_en`/`short_en`/`long_en`
  existieran como columnas de `games` (spec 11, posterior). Al implementarlo, se decidió junto al
  usuario incluir la traducción al inglés desde el `insert` inicial en vez de dejarla en fallback a
  español — mismo patrón que spec 11 usó para los 4 juegos existentes. El bloque SQL de arriba ya
  refleja esa decisión (`title_en: 'CROSSING'`, más `short_en`/`long_en`).
- **Desviación del paso 4/5 del plan:** este spec también se redactó antes de spec 12
  (`specs/12-juegos-en-movil-tactil.md`), así que su paso 5 original describía el patrón táctil
  antiguo (`.cruce-touch-controls`, `.td-pad`, breakpoint de 840px). El paso 4, en cambio, ya pedía
  seguir la estructura de `snake-player.tsx` — que spec 12 migró al patrón compartido
  `<TouchPad>`/`<HudMenu>`/`setupHiDpiCanvas`. `cruce-player.tsx` se escribió siguiendo esa
  instrucción literalmente, así que ya nació con `<TouchPad>` (dpad de 4 direcciones sobre
  `ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`, sin `dpadRepeat` porque el salto nunca se repite
  al mantener presionado) y `<HudMenu>` envolviendo las acciones del HUD. El paso 5 original queda
  sin objeto: no se agrega ningún CSS táctil por juego, siguiendo la arquitectura vigente
  (`recipe.md` §4/§6). También se actualizó `.claude/skills/add-game/recipe.md` para documentar
  que la traducción del título del HUD (`useLanguage` + `localizedGameText`, spec 11) es parte del
  contrato estándar del reproductor — otro hueco que `cruce-player.tsx` ya cierra.
- **Reversión del "Out of scope" de skins:** este spec excluía explícitamente el selector de skin.
  Se implementó vía `/spec-impl-game`, cuya regla dura exige lanzar el agente `skin-designer` sobre
  todo juego recién implementado, sin excepción por decisión previa del spec. El usuario confirmó
  explícitamente mantener esa regla y lanzar `skin-designer` sobre CRUCE, revirtiendo la exclusión
  original; se quitó de `Scope`/`Lo que no está en este spec`. `skin-designer` añadió
  `CruceOptions { skin?: SkinId }` y `setSkin()` a `CruceGame` (no documentados en el `Data model`
  original de este spec, que no preveía skins), `SKIN_COLORS`/`SKIN_DRAWERS` en `engine.ts`
  (`clasico` = paleta original sin cambios, por defecto; `neon` = tablero violeta/magenta con
  `shadowBlur`; `retro` = tablero ámbar/verde tipo fósforo CRT, biselado, sin brillo), y
  `<SkinSelector>` dentro del `<HudMenu>` de `cruce-player.tsx`, persistido en `localStorage` bajo
  `av_cruce_skin`. Verificado visualmente en el navegador: los tres skins renderizan correctamente
  y son claramente distinguibles entre sí.
- **Auditoría de `mobile-porter`:** al ser CRUCE un juego nuevo (no uno de los cuatro migrados por
  spec 12), `/spec-impl-game` también lanzó `mobile-porter` sobre él. Confirmó que
  `cruce-player.tsx` ya cumplía el checklist completo (Fase 4 del paso del plan ya lo había cableado
  siguiendo `snake-player.tsx`) — no hizo ningún cambio de código. `recipe.md` tampoco mostró
  desviación frente al patrón real.
