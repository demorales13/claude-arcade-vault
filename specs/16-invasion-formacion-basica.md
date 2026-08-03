# GAME JAM 01 — INVASIÓN (formación básica)

> **Status:** Implemented
> **Depends on:** 05-asteroids-game, 06-leaderboard-catalogo-supabase
> **Date:** 2026-07-29
> **Objective:** Agregar "INVASIÓN" (`id: "invasion"`) como nuevo juego SHOOTER del catálogo: un cañón fijo en la base dispara contra una formación de 40 alienígenas que desciende oleada tras oleada y acelera a medida que quedan menos enemigos, sin escudos ni power-ups.

## Why this spec exists

Este es uno de los dos specs alternativos generados en la misma ejecución del agente `game-jam` a partir del candidato "INVASIÓN" de `suggested-games.md` (fila `2026-07-29 · Propuesto`). Su hermano es `specs/game-jam/02-invasion-bastiones.md`. Los separa el eje **Alcance**: este spec es el mínimo viable (motor + HUD + leaderboard, sin escudos, sin power-ups, sin sonido), el otro es la versión ambiciosa (bastiones destructibles, nave bonus, power-ups, sonido y dos skins). Solo uno de los dos se implementará; el humano elige cuál promover a `specs/`.

Dentro de `SHOOTER`, el catálogo hoy solo tiene ASTEROIDES: movimiento libre con inercia en campo abierto contra objetivos que se fragmentan. INVASIÓN aporta el mecanismo opuesto — cañón acotado a un eje horizontal, formación estructurada que ataca en oleadas con velocidad creciente — sin duplicar ni el esquema de control ni la sensación de amenaza de ASTEROIDES.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (SQL manual): `id: 'invasion'`, `title: 'INVASIÓN'`, `cat: 'SHOOTER'`, `color: 'magenta'`, `cover: 'cover-invasion'`.
- Nueva clase CSS `.cover-invasion` en `app/globals.css`: gradiente radial oscuro violeta/negro, patrón de siluetas de alienígenas pixel-art propias (no el sprite de ninguna marca) en magenta dispuestas en cuadrícula vía `::after`, y un cañón triangular magenta en la base vía `::before` — mismo patrón de pseudo-elementos que `.cover-asteroids`.
- Motor diseñado desde cero en `components/games/invasion/engine.ts`: formación de 40 alienígenas (5 filas × 8 columnas) que se mueve lateralmente y desciende un escalón al chocar con cualquier borde, con la velocidad de avance recalculada en cada paso en función de cuántos alienígenas quedan vivos; cañón del jugador acotado al ancho del canvas (sin movimiento libre); una sola bala del jugador en pantalla a la vez; balas enemigas que caen desde alienígenas vivos elegidos al azar; colisión bala-alienígena, bala enemiga-cañón y formación-cañón; puntuación por fila (las filas superiores valen más); 3 vidas; subida de nivel al completar una oleada, con la siguiente oleada arrancando más rápida; fin de partida inmediato si la formación alcanza la fila del cañón o si las vidas llegan a 0. Sin JSX, con la API basada en callbacks de `recipe.md`.
- Wrapper cliente `components/games/invasion-player.tsx`: HUD estándar de la plataforma (Jugador / Puntuación / Vidas / Nivel, sin `hud-stat` adicional), botones PAUSA/FIN/SALIR wireados al motor, `GameOverModal` y guardado vía `insertScore`.
- `app/games/[id]/play/page.tsx`: una rama más — `id === "invasion"` renderiza `InvasionPlayer`.
- CSS `.invasion-canvas` e `.invasion-touch-controls` en `app/globals.css`, con el breakpoint de 840px ya usado en el resto del sitio.
- Controles táctiles bajo 840px: `.td-pad` con ← →, `.td-actions` con DISPARAR.

**Out of scope (para otro spec):**

- Escudos/bastiones destructibles, nave bonus (UFO), power-ups, sonido y skins — es exactamente lo que diferencia a `specs/game-jam/02-invasion-bastiones.md`; si se decide que el catálogo quiere esa versión, se promueve ese spec en vez de este.
- Múltiples patrones de formación por nivel — esta versión repite siempre la misma cuadrícula 5×8, solo más rápida.
- Cualquier cambio a ASTEROIDES, TETRIS, ARKANOID, SERPIENTE o a los módulos genéricos sobre `getGames()` (`components/game-card.tsx`, `components/games-browser.tsx`, `app/games/[id]/page.tsx`, `app/hall-of-fame/`, `lib/data/*`).
- Gamepad físico y tests automatizados.

## Data model

**SQL (manual, en el SQL Editor de Supabase):**

```sql
insert into games (id, title, short, long, cat, cover, color) values
  ('invasion', 'INVASIÓN',
   'Repele una flota que desciende en formación y acelera con cada oleada.',
   'Controla un cañón de defensa fijo en la base de la pantalla y dispara contra una formación de 40 alienígenas que desciende oleada tras oleada, acelerando a medida que quedan menos enemigos. Tres vidas, sin escudos ni power-ups: la formación y su velocidad creciente son el único desafío.',
   'SHOOTER', 'cover-invasion', 'magenta');
```

`best` y `plays` no se insertan: los calcula la vista `games_with_stats` desde `scores`.

**TypeScript:**

```ts
// components/games/invasion/engine.ts — motor diseñado desde cero, sin JSX
export type InvasionCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type InvasionGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void; // "ArrowLeft" | "ArrowRight" | "Space"
  forceGameOver: () => void;
};

export function createInvasionGame(
  canvas: HTMLCanvasElement,
  callbacks: InvasionCallbacks,
): InvasionGame;
```

Geometría y constantes del motor (no configurables, sin assets — el juego se dibuja entero con primitivas de canvas):

```ts
const CANVAS_W = 800,
  CANVAS_H = 600; // 4:3, rellena .crt-screen sin conflicto de proporción
const ROWS = 5,
  COLS = 8; // 40 alienígenas
const ALIEN_W = 32,
  ALIEN_H = 24,
  GAP_X = 16,
  GAP_Y = 16;
const FORMATION_LEFT = 216,
  FORMATION_TOP = 60; // (800 - (8*32 + 7*16)) / 2
const ROW_POINTS = [30, 30, 20, 20, 10]; // fila superior (índice 0) vale más
const STEP_PX = 12,
  ROW_DROP_PX = 24; // desplazamiento lateral y descenso por escalón
const BASE_STEP_MS = 700,
  MIN_STEP_MS = 70; // intervalo entre pasos, nivel 1, formación completa
const LEVEL_STEP_MS_REDUCTION = 50; // el intervalo base baja este monto por cada nivel
const CANNON_Y = 560,
  CANNON_W = 36,
  CANNON_H = 18,
  CANNON_SPEED = 260; // px/s
const PLAYER_BULLET_SPEED = 420; // px/s; una sola bala del jugador en pantalla a la vez
const ENEMY_BULLET_SPEED = 200; // px/s
const ENEMY_FIRE_RATE_BASE = 0.6,
  ENEMY_FIRE_RATE_PER_LEVEL = 0.1; // disparos enemigos esperados por segundo, suma sobre toda la formación viva
const GAME_OVER_ROW_Y = CANNON_Y - 40; // la formación llegando aquí termina la partida de inmediato
const LIVES_START = 3;
```

Fórmula de velocidad (recalculada cada vez que muere un alienígena, replica el mecanismo clásico de "menos enemigos, más rápido"):

```
stepMs = max(MIN_STEP_MS, round((BASE_STEP_MS - (level - 1) * LEVEL_STEP_MS_REDUCTION) * (aliveCount / totalCount)))
```

Estado del juego (clausura interna del motor, no exportado):

```ts
// aliens: Array<{ row: number; col: number; alive: boolean }>, posición derivada de (row, col) + offset de formación
// formationX: desplazamiento horizontal acumulado; formationDir: 1 | -1
// cannonX: posición del cañón, acotada a [0, CANVAS_W - CANNON_W]
// playerBullet: { x, y } | null  (null = puede disparar)
// enemyBullets: Array<{ x, y }>
// score, lives, level, aliveCount
```

Convenciones:

- `createInvasionGame` arranca el loop inmediatamente al llamarse; no hay `start()` separado.
- `dt` se limita (`Math.min(dt, 0.05)`) para que una pestaña en segundo plano no dispare varios pasos de formación de golpe.
- Pausa: se detiene `update(dt)` pero sigue `draw()` (frame congelado) con el overlay "EN PAUSA"; al reanudar se descarta el acumulador de `dt` y el temporizador de pasos.
- El motor no lee ni escribe `localStorage`; no toca `window`/`document` fuera de sus propios `keydown`/`keyup`, removidos en `destroy()`.
- `preventDefault()` solo sobre `ArrowLeft`, `ArrowRight` y `Space`, y solo mientras el juego está montado.
- Lo que se guarda en `scores.score` al terminar es el `score` acumulado de todas las oleadas jugadas en esa partida, sin bonus de fin de partida.
- No hay sprites ni imágenes: el alienígena, el cañón y las balas se dibujan con formas planas propias (rectángulos/triángulos), nunca una réplica del sprite de ningún juego existente.

## Implementation plan

1. **Insertar la fila del catálogo (paso manual del usuario).** Ejecutar el `insert into games` de arriba en el SQL Editor de Supabase.
   _Test:_ `/games` muestra la tarjeta "INVASIÓN" junto a las demás; `/games/invasion` muestra el detalle con `best = 0`, `plays = 0` y leaderboard vacío; `/games/invasion/play` todavía renderiza el reproductor mock genérico.
2. **Arte de portada.** Agregar `.cover-invasion` en `app/globals.css`, junto a las demás `.cover-*`.
   _Test:_ la tarjeta en `/games` y el hero de `/games/invasion` muestran el arte nuevo; ninguna otra `.cover-*` cambia.
3. **Motor.** Crear `components/games/invasion/engine.ts` con: formación 5×8, movimiento lateral con descenso por escalón, recálculo de velocidad por alienígenas vivos, cañón acotado, una bala del jugador a la vez, balas enemigas aleatorias, colisiones, puntuación por fila, 3 vidas, subida de nivel al vaciar la oleada, fin de partida por formación en la fila del cañón o por 0 vidas, y la API `pause`/`resume`/`destroy`/`setKey`/`forceGameOver`. No se conecta a ningún componente todavía.
   _Test:_ `npm run build` compila sin errores de tipos.
4. **Reproductor y rama de ruta.** Crear `components/games/invasion-player.tsx` siguiendo la estructura de `asteroids-player.tsx`: HUD Jugador/Puntuación/Vidas/Nivel, marco `.crt` con el canvas 800×600 y el overlay "EN PAUSA", botones PAUSA/FIN/SALIR, `GameOverModal` con `insertScore` importado de `lib/data/scores.ts`, nombre precargado desde `av_user`. Agregar `.invasion-canvas` en `app/globals.css` y la línea `if (game.id === "invasion") return <InvasionPlayer game={game} />;` en `app/games/[id]/play/page.tsx`.
   _Test manual:_ en `/games/invasion/play`, las flechas mueven el cañón y espacio dispara; el HUD refleja el estado real del motor; vaciar la oleada sube el nivel y acelera la siguiente; PAUSA congela con el frame visible y REANUDAR continúa sin salto; FIN abre `GameOverModal` con la puntuación alcanzada; guardar inserta una fila en `scores` con `game_id = 'invasion'`.
5. **Controles táctiles.** Agregar `.invasion-touch-controls` (`.td-pad` con ← →, `.td-actions` con DISPARAR) y su CSS con el `@media (max-width: 840px)`. Cada botón usa `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel` sobre `setKey`.
   _Test manual:_ bajo 840px los botones mueven y disparan igual que el teclado; en escritorio no se renderizan.
6. **Repaso final con Playwright.** Comparar `/games/invasion/play` contra el resto del sitio (HUD, marco `.crt`, tipografía) en viewport de escritorio y móvil. Verificar que la formación completa de 40 alienígenas cabe legible dentro del canvas y que la aceleración por alienígenas restantes se percibe con claridad.

## Acceptance criteria

- [x] `npm run dev` levanta sin errores en consola en `/games`, `/games/invasion` y `/games/invasion/play`. Verificado: consola sin errores en las tres rutas, y 0 errores de consola durante la sesión de 40 s de `game-performance` (cambios de skin + partida completa hasta Game Over).
- [x] `select * from games_with_stats where id = 'invasion'` devuelve la fila, y `best`/`plays` se mueven al insertar puntuaciones reales. Verificado: `plays` pasó de 0→1→2 y `best` a 2560 tras la partida real jugada por `game-performance`.
- [x] `/games` muestra la tarjeta "INVASIÓN" con `.cover-invasion`, sin cambios en ninguna otra tarjeta. Verificado por lectura de página.
- [x] `/games/invasion` muestra cover, tags, descripción, stat-strip y el leaderboard lateral. Verificado por lectura de página.
- [x] El HUD (Jugador/Puntuación/Vidas/Nivel) refleja el estado real del motor, no valores simulados. Verificado: FIN dejó "Vidas" en `—` y abrió el modal con la puntuación real; la sesión de `game-performance` confirmó renders del HUD ligados a los callbacks del motor.
- [x] El botón PAUSA congela el juego con el frame visible y el overlay "EN PAUSA"; REANUDAR continúa sin salto brusco. Verificado el cambio de etiqueta PAUSA↔REANUDAR y la aparición del overlay "EN PAUSA"; el "sin salto brusco" se apoya en que `resume()` descarta `lastTime` (revisión de código), no en inspección visual directa.
- [x] El botón FIN termina la partida inmediatamente con la puntuación alcanzada hasta ese momento. Verificado: abrió `GameOverModal` de inmediato con la puntuación real.
- [x] Guardar en `GameOverModal` inserta una fila en `scores` con `game_id = 'invasion'`, visible en `/hall-of-fame`. Verificado dos veces: una fila de prueba (INVITADO, 0) y la partida real de `game-performance` (DEMORALES, 2560), ambas visibles en la pestaña INVASIÓN de `/hall-of-fame`.
- [ ] El nombre precargado en el modal viene de `av_user` en `localStorage`. Implementado con el mismo `readUserName()` que usan el resto de reproductores; no se verificó explícitamente cambiando `av_user` en esta sesión.
- [ ] Bajo 840px aparecen los controles táctiles y controlan el juego igual que el teclado; en escritorio no se renderizan. El patrón compartido vigente (spec 12/13) usa `(pointer: coarse)` en vez del breakpoint literal de 840px que describe este spec — texto desactualizado respecto a `recipe.md`, ya señalado en las notas de implementación. El wiring de `<TouchPad>` está presente y fue auditado contra la checklist de `mobile-porter` sin hallazgos, pero no se emuló un viewport táctil real en esta sesión.
- [ ] El canvas se escala dentro del marco `.crt` en ambos anchos sin deformar ni recortar el HUD. No se pudo verificar visualmente: el panel del navegador de esta sesión no compositó fotogramas (`document.hidden === true`), lo que también impidió tomar capturas de pantalla.
- [x] Salir de `/games/invasion/play` detiene el loop: sin errores en consola y sin listeners huérfanos. `destroy()` cancela el rAF y remueve los listeners (revisión de código); se navegó repetidamente dentro y fuera de `/games/invasion/play` en esta sesión sin errores de consola acumulados.
- [x] `npm run build` termina sin errores. Verificado repetidamente (implementación base, tras skins, y sin cambios tras la auditoría de rendimiento).
- [ ] La formación de 40 alienígenas (5×8) se mueve lateralmente y desciende un escalón cada vez que toca cualquiera de los dos bordes del canvas. Implementado en `stepFormation()`; la sesión automatizada de `game-performance` jugó 40 s hasta Game Over sin errores y con puntuación real, pero el descenso escalonado no se observó visualmente en esta sesión.
- [ ] La velocidad de la formación aumenta de forma medible a medida que quedan menos alienígenas vivos dentro de la misma oleada. Implementado en `recomputeStepMs()`; no verificado visualmente.
- [ ] Solo puede haber una bala del jugador en pantalla a la vez: disparar de nuevo antes de que la anterior salga o impacte no tiene efecto. Implementado (`playerBullet` como candado); no aislado en una prueba específica.
- [ ] Una bala enemiga que impacta el cañón resta exactamente 1 vida; con 0 vidas se abre `GameOverModal` de inmediato. Implementado; la sesión de `game-performance` llegó a Game Over de forma natural (no vía FIN), lo que es evidencia indirecta del ciclo de vidas, pero el caso puntual no se aisló.
- [ ] Los alienígenas de la fila superior otorgan más puntos que los de la fila inferior al ser destruidos. Implementado (`ROW_POINTS = [30, 30, 20, 20, 10]`); no aislado en una prueba específica.
- [ ] Vaciar por completo la oleada (40/40 alienígenas destruidos) sube el nivel en 1 y arranca una nueva oleada con un `stepMs` base menor (más rápida) que la anterior. Implementado en `nextLevel()`; la puntuación de 2560 obtenida en la sesión de `game-performance` es consistente con varias oleadas completas (una oleada completa vale hasta 880 puntos), pero no se confirmó visualmente el cambio de nivel.
- [ ] Si la formación desciende hasta alcanzar `GAME_OVER_ROW_Y`, la partida termina de inmediato sin importar las vidas restantes. Implementado en `checkFormationReachedCannon()`; no aislado en una prueba específica.
- [ ] El cañón nunca sale de los límites horizontales del canvas. Implementado (`Math.max(0, Math.min(...))` en `updateCannon`); no aislado en una prueba específica.
- [ ] No aparece ningún escudo, bastión, nave bonus, power-up, efecto de sonido ni selector de skin en esta versión. **Incumplido a propósito por el flujo `/spec-impl-game`:** este comando encadena `skin-designer` sobre todo juego que implementa, sin excepción para specs que declaran explícitamente "sin selector de skin" como parte de su alcance mínimo. Como resultado, `invasion-player.tsx` sí muestra un `<SkinSelector>` (clasico/neon/retro). Se documenta como una discrepancia real entre este spec y el comportamiento del flujo de trabajo, no como un error silenciado — ver Risks/incidencias.

## Decisions

- **Sí:** eje de diferenciación **Alcance** frente a `02-invasion-bastiones.md` — este spec es el mínimo viable. Es uno de los cuatro ejes del menú de `game-jam.md`; se eligió porque el mecanismo central (formación que desciende y acelera) es el mismo en ambas versiones y lo que varía es cuánto se construye alrededor de él, no la mecánica en sí.
- **No:** eje "Mecánica". Ambas versiones comparten exactamente el mismo esquema de control y de amenaza; forzar una mecánica genuinamente distinta habría producido un juego diferente, no dos versiones del mismo concepto.
- **Sí:** `id: "invasion"` en inglés con `title: "INVASIÓN"` en español, siguiendo el precedente de `asteroids`/"ASTEROIDES".
- **Sí:** `cat: 'SHOOTER'`, `color: 'magenta'` — vienen literalmente del prompt del usuario, que cita la fila de `suggested-games.md` con esos valores exactos. No es un supuesto.
- **Sí (supuesto):** canvas lógico 800×600 (4:3), idéntico al usado por ASTEROIDES. La formación 5×8 y el cañón caben con margen dentro de esa proporción sin ningún conflicto geométrico como el que tuvo TETRIS con su tablero 1:2 — se decide explícitamente aquí para dejar constancia de que no hace falta resolver nada especial.
- **Sí (supuesto):** una sola bala del jugador en pantalla a la vez, replicando la restricción del Space Invaders original. Simplifica el motor y es coherente con "mínimo viable"; la versión ambiciosa (spec 02) reemplaza esta regla por un cooldown para poder soportar power-ups de disparo múltiple.
- **No:** varias balas simultáneas del jugador en esta versión. Rompería el criterio de "mínimo viable" y adelantaría trabajo que pertenece a la versión ambiciosa.
- **Sí (supuesto):** puntuación por fila (`ROW_POINTS`), con las filas superiores valiendo más. Es el modelo de puntuación descrito en `suggested-games.md` ("puntos por enemigo") resuelto de forma concreta; los valores exactos (30/30/20/20/10) son un supuesto razonable, no vinieron del prompt.
- **Sí (supuesto):** fin de partida inmediato si la formación alcanza `GAME_OVER_ROW_Y`, además de por 0 vidas. Es el comportamiento esperado de cualquier variante de este mecanismo — dejar que la formación llegue al cañón sin consecuencia sería irreconocible como el género.
- **No:** escudos, nave bonus, power-ups, sonido y skins en este spec. Es exactamente el contenido de la versión ambiciosa (spec 02); incluirlos aquí anularía la diferenciación por Alcance.
- **No:** usar el nombre "Space Invaders" ni replicar su sprite de alienígena. El nombre es marca viva de Taito; el `title` ("INVASIÓN") y el diseño del alienígena (formas planas propias) son deliberadamente genéricos.
- **No:** gamepad físico ni tests automatizados. No fueron pedidos y no hay precedente en el catálogo actual.

## Risks

| Riesgo                                                                                                                                      | Mitigación                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| La fórmula de velocidad (`stepMs` recalculado por alienígenas vivos) puede volverse imperceptible o injugablemente rápida en los extremos.  | Aplicar el piso `MIN_STEP_MS` y verificar en el paso 6 que el último alienígena de una oleada se sigue pudiendo esquivar/disparar con margen.         |
| Un `dt` grande tras volver de una pestaña en segundo plano podría avanzar varios pasos de formación de golpe y bajar la formación de golpe. | `dt` se limita a `0.05` s antes de acumularse, igual que en ASTEROIDES y SERPIENTE; el acumulador se descarta al reanudar desde pausa.                |
| El `requestAnimationFrame` del motor podría seguir vivo tras navegar fuera del reproductor.                                                 | `destroy()` cancela el rAF y remueve los listeners de teclado; se llama siempre desde el cleanup del `useEffect`.                                     |
| Importar `insertScore` desde `lib/data/games.ts` rompe el build con un error engañoso de "Pages Router".                                    | `invasion-player.tsx` importa `insertScore` solo desde `lib/data/scores.ts`, como los demás reproductores.                                            |
| Next.js 16.2.10 difiere de las APIs conocidas por entrenamiento para Client Components, `params` o montaje de `<canvas>`.                   | Antes del paso 4, revisar `node_modules/next/dist/docs/01-app/`, como exige `CLAUDE.md`.                                                              |
| Sin escudos ni pausa entre oleadas, el jugador podría no tener un momento de respiro visual entre una oleada y la siguiente.                | La nueva oleada aparece con la formación completa en `FORMATION_TOP` (arriba del todo), dando el mismo margen que la primera; se valida en el paso 6. |

## Incidencias de la implementación (2026-08-01, ejecución automática de `/spec-impl-game`)

- **El subagente `mobile-porter` no estaba registrado como tipo de agente invocable en esta sesión** (el archivo `.claude/agents/mobile-porter.md` existe, pero la herramienta de agentes lo rechazó como "not found"). En su lugar, se auditó manualmente el reproductor contra la checklist documentada en ese archivo (Fase 2): todos los puntos ya estaban correctamente resueltos porque la implementación base ya seguía el patrón `<TouchPad>`/`<HudMenu>`/`setupHiDpiCanvas` de `snake-player.tsx` desde el principio. No se requirió ningún cambio, pero la Fase 4 de verificación manual con emulación de viewport táctil real (que sí requiere el navegador) no se ejecutó — ver el criterio de aceptación de controles táctiles arriba.
- **Conflicto real entre este spec y el flujo `/spec-impl-game`:** este spec declara explícitamente "sin selector de skin" como parte de su alcance mínimo (ver Decisions y el último criterio de aceptación), pero `/spec-impl-game` encadena `skin-designer` sobre todo juego que implementa, sin excepción para este caso. El resultado es que `invasion-player.tsx` sí incluye un `<SkinSelector>` (clasico/neon/retro), contradiciendo la decisión de alcance de este spec. Se documenta aquí en vez de revertirse unilateralmente; si se decide que `invasion` no debe tener selector de skin, es una decisión humana a tomar aparte.

## Lo que **no** está en este spec

- Escudos/bastiones destructibles, nave bonus (UFO), power-ups, sonido y skins — contenido de `specs/game-jam/02-invasion-bastiones.md`.
- Múltiples patrones de formación por nivel.
- Cualquier cambio a ASTEROIDES, TETRIS, ARKANOID, SERPIENTE o a los componentes genéricos sobre `getGames()`.
- Gamepad físico y tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
