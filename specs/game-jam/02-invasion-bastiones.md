# GAME JAM 02 — INVASIÓN BASTIONES

> **Status:** Draft
> **Depends on:** 05-asteroids-game, 06-leaderboard-catalogo-supabase
> **Date:** 2026-07-29
> **Objective:** Agregar "INVASIÓN BASTIONES" (`id: "invasion-bastiones"`) como nuevo juego SHOOTER del catálogo: la misma formación descendente y acelerada de INVASIÓN, ampliada con escudos destructibles, una nave bonus, power-ups temporales, efectos de sonido sintetizados y dos skins visuales.

## Why this spec exists

Este es uno de los dos specs alternativos generados en la misma ejecución del agente `game-jam` a partir del candidato "INVASIÓN" de `suggested-games.md` (fila `2026-07-29 · Propuesto`). Su hermano es `specs/game-jam/01-invasion-formacion-basica.md`. Los separa el eje **Alcance**: aquel spec es el mínimo viable (motor + HUD + leaderboard, sin escudos ni power-ups); este es la versión ambiciosa, con escudos/bastiones, nave bonus, power-ups, sonido y skins — el mismo mecanismo central de formación descendente y acelerada, con más alrededor. Solo uno de los dos se implementará; el humano elige cuál promover a `specs/`.

Dentro de `SHOOTER`, el catálogo hoy solo tiene ASTEROIDES (movimiento libre con inercia, objetivos que se fragmentan). Esta versión de INVASIÓN, igual que su hermana mínima, aporta el mecanismo opuesto — cañón acotado, formación estructurada, velocidad creciente — y además demuestra el patrón de "alcance ambicioso" ya usado por TETRIS (spec 07, sonido + 4 skins) y ARKANOID (spec 08, sonido), aplicado por primera vez a un shooter de formación.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (SQL manual): `id: 'invasion-bastiones'`, `title: 'INVASIÓN BASTIONES'`, `cat: 'SHOOTER'`, `color: 'magenta'`, `cover: 'cover-invasion-bastiones'`.
- Nueva clase CSS `.cover-invasion-bastiones` en `app/globals.css`: mismo concepto base que `.cover-invasion` (gradiente radial violeta/negro, formación de alienígenas propios en magenta), sumando en `::before` un bloque verde de escudo/bastión parcialmente erosionado, para diferenciar visualmente la tarjeta de la versión mínima.
- Motor diseñado desde cero en `components/games/invasion-bastiones/engine.ts`: todo lo de la formación, cañón, balas y progresión de niveles de la versión mínima, más — 4 bastiones destructibles pixel a pixel que bloquean balas del jugador y del enemigo, una nave bonus que cruza la parte superior de la pantalla en intervalos aleatorios y otorga un puntaje sorpresa al ser destruida, power-ups que caen ocasionalmente de un alienígena destruido (fuego rápido, disparo triple, reparación de escudo) recogibles con el cañón, y varios patrones de formación que rotan según el nivel. Sin JSX, con la API basada en callbacks de `recipe.md`.
- 6 efectos de sonido sintetizados con Web Audio (disparo, explosión de alienígena, impacto al cañón, oleada completada, power-up recogido, bonus de nave), con toggle ON/OFF persistido en `localStorage`.
- 2 skins visuales (`clasica`, `neon`) para alienígenas y cañón, seleccionables en vivo desde el HUD y persistidas en `localStorage`.
- Wrapper cliente `components/games/invasion-bastiones-player.tsx`: HUD de la plataforma con un quinto `hud-stat` condicional "POWER-UP" (visible solo mientras hay uno activo, con cuenta regresiva), selector de skin y botón SONIDO en `hud-actions`, botones PAUSA/FIN/SALIR, `GameOverModal` y guardado vía `insertScore`.
- `app/games/[id]/play/page.tsx`: una rama más — `id === "invasion-bastiones"` renderiza `InvasionBastionesPlayer`.
- CSS `.invasion-bastiones-canvas`, `.invasion-bastiones-touch-controls` y reutilización de `.hud-select` (ya introducido por TETRIS) en `app/globals.css`, con el breakpoint de 840px.
- Controles táctiles bajo 840px: `.td-pad` con ← →, `.td-actions` con DISPARAR.
- Persistencia de las dos preferencias en `localStorage`: `av_invasion_sound` y `av_invasion_skin`.

**Out of scope (para otro spec):**

- La versión mínima sin estas features es exactamente `specs/game-jam/01-invasion-formacion-basica.md` — no se fusionan ni coexisten, es una elección exclusiva del humano.
- Música de fondo; solo se portan los 6 efectos puntuales.
- Multijugador local (dos cañones) o modo cooperativo.
- Jefe de fin de nivel (alienígena único con vida múltiple) — la variedad de esta versión viene de los patrones de formación y los power-ups, no de un boss.
- Cualquier cambio a ASTEROIDES, TETRIS, ARKANOID, SERPIENTE o a los módulos genéricos sobre `getGames()` (`components/game-card.tsx`, `components/games-browser.tsx`, `app/games/[id]/page.tsx`, `app/hall-of-fame/`, `lib/data/*`).
- Gamepad físico y tests automatizados.

## Data model

**SQL (manual, en el SQL Editor de Supabase):**

```sql
insert into games (id, title, short, long, cat, cover, color) values
  ('invasion-bastiones', 'INVASIÓN BASTIONES',
   'Repele una flota que desciende en formación, protégete tras bastiones y caza la nave bonus.',
   'Controla un cañón de defensa que se protege tras cuatro bastiones destructibles mientras repele una formación de alienígenas cada vez más rápida. Recoge power-ups de fuego mejorado que sueltan algunos alienígenas y derriba la nave bonus que cruza la pantalla de vez en cuando para un puntaje sorpresa. Incluye efectos de sonido y dos skins visuales.',
   'SHOOTER', 'cover-invasion-bastiones', 'magenta');
```

`best` y `plays` no se insertan: los calcula la vista `games_with_stats` desde `scores`.

**TypeScript:**

```ts
// components/games/invasion-bastiones/engine.ts — motor diseñado desde cero, sin JSX
export type InvasionSkin = "clasica" | "neon";
export const SKIN_LABELS: Record<InvasionSkin, string>; // "Clásica" | "Neón"

export type InvasionPowerup = "rapid_fire" | "multi_shot" | "shield_repair";

export type InvasionBastionesCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onPowerupChange?: (
    powerup: InvasionPowerup | null,
    secondsLeft: number,
  ) => void; // null = ninguno activo
  onGameOver?: (finalScore: number) => void;
};

export type InvasionBastionesOptions = {
  skin?: InvasionSkin; // por defecto "clasica"
  soundEnabled?: boolean; // por defecto true
};

export type InvasionBastionesGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void; // "ArrowLeft" | "ArrowRight" | "Space"
  forceGameOver: () => void;
  setSkin: (skin: InvasionSkin) => void; // aplica en el siguiente frame, sin reiniciar
  setSoundEnabled: (enabled: boolean) => void;
};

export function createInvasionBastionesGame(
  canvas: HTMLCanvasElement,
  callbacks: InvasionBastionesCallbacks,
  options?: InvasionBastionesOptions,
): InvasionBastionesGame;
```

Preferencias persistidas (leídas y escritas por `invasion-bastiones-player.tsx`, nunca por el motor):

```ts
// localStorage
// "av_invasion_skin"  -> InvasionSkin       (valor inválido o ausente → "clasica")
// "av_invasion_sound" -> "on" | "off"        (valor inválido o ausente → "on")
```

Geometría y constantes base (comparten origen con la versión mínima, sin assets — todo se dibuja con primitivas de canvas):

```ts
const CANVAS_W = 800,
  CANVAS_H = 600; // 4:3, rellena .crt-screen
const ROWS = 5,
  COLS = 8; // 40 alienígenas por oleada
const ALIEN_W = 32,
  ALIEN_H = 24,
  GAP_X = 16,
  GAP_Y = 16;
const FORMATION_TOP = 60;
const ROW_POINTS = [30, 30, 20, 20, 10];
const STEP_PX = 12,
  ROW_DROP_PX = 24;
const BASE_STEP_MS = 700,
  MIN_STEP_MS = 70,
  LEVEL_STEP_MS_REDUCTION = 50;
const CANNON_Y = 480,
  CANNON_W = 36,
  CANNON_H = 18,
  CANNON_SPEED = 260; // px/s, más arriba que en la v.mínima para dejar sitio a los bastiones
const ENEMY_BULLET_SPEED = 200; // px/s
const ENEMY_FIRE_RATE_BASE = 0.6,
  ENEMY_FIRE_RATE_PER_LEVEL = 0.1;
const GAME_OVER_ROW_Y = 440; // la formación llegando aquí (encima de los bastiones) termina la partida
const LIVES_START = 3;

// Diferencia deliberada frente a la versión mínima: el disparo del jugador usa cooldown, no
// "una bala a la vez", para poder soportar disparo múltiple durante un power-up.
const BASE_FIRE_COOLDOWN_MS = 500;
const RAPID_FIRE_COOLDOWN_MS = 150;
const MULTI_SHOT_BULLET_COUNT = 3; // central + dos con ángulo al recoger "multi_shot"
const PLAYER_BULLET_SPEED = 420; // px/s

// Bastiones
const SHIELD_COUNT = 4;
const SHIELD_COLS = 15,
  SHIELD_ROWS = 9,
  SHIELD_CELL = 6; // bloques de 6px, 1 punto de vida cada uno
const SHIELD_Y = 400; // franja horizontal donde se alinean los 4 bastiones, encima del cañón
const SHIELD_REPAIR_BLOCKS = 15; // bloques que restaura el power-up "shield_repair"

// Nave bonus
const UFO_Y = 40,
  UFO_SPEED = 140; // px/s
const UFO_SPAWN_MIN_MS = 15000,
  UFO_SPAWN_MAX_MS = 25000;
const UFO_SCORE_POOL = [50, 100, 150, 300]; // puntaje sorpresa al destruirla

// Power-ups
const POWERUP_DROP_CHANCE = 0.08; // por alienígena destruido
const POWERUP_FALL_SPEED = 120; // px/s
const POWERUP_DURATION_MS = 8000; // rapid_fire / multi_shot; shield_repair es instantáneo
```

Patrones de formación por nivel (misma cuadrícula 5×8 de posiciones, distinta ocupación — rota `level % PATTERNS.length`):

```ts
type FormationPattern = "rectangulo" | "diamante" | "tablero";
const PATTERNS: FormationPattern[] = ["rectangulo", "diamante", "tablero"];
// "rectangulo": las 40 celdas ocupadas (igual a la versión mínima)
// "diamante": ocupación decreciente hacia los bordes de cada fila
// "tablero": ocupación en patrón de ajedrez, la mitad de alienígenas pero cada uno vale el doble
```

Estado del juego (clausura interna del motor, no exportado):

```ts
// aliens: Array<{ row: number; col: number; alive: boolean }>
// formationX, formationDir, level, pattern
// cannonX, fireCooldownMs, activePowerup: { type: InvasionPowerup; msLeft: number } | null
// playerBullets: Array<{ x: number; y: number }>  (1 a 3 según haya "multi_shot" activo)
// enemyBullets: Array<{ x: number; y: number }>
// shields: Array<{ x: number; y: number; blocks: boolean[] }>  // 4 bastiones, bitmap de bloques vivos
// ufo: { x: number; dir: 1 | -1; scoreValue: number } | null, ufoTimerMs
// fallingPowerups: Array<{ x: number; y: number; type: InvasionPowerup }>
// score, lives
```

Convenciones:

- `createInvasionBastionesGame` arranca el loop inmediatamente; no hay `start()` separado.
- `dt` se limita (`Math.min(dt, 0.05)`).
- Pausa: se detiene `update(dt)` pero sigue `draw()` (frame congelado) con "EN PAUSA"; al reanudar se descarta el acumulador y los temporizadores de power-up/UFO no avanzan durante la pausa.
- Un bastión bloquea cualquier bala (del jugador o enemiga) que lo toque: la bala se elimina y el bloque impactado del bastión desaparece; un bastión sin bloques deja de bloquear nada mientras sigue existiendo su franja.
- La nave bonus aparece en `UFO_Y`, cruza de un lado al otro a `UFO_SPEED` y desaparece sola si nadie la destruye; su `scoreValue` se sortea de `UFO_SCORE_POOL` al aparecer, no al ser destruida, para que sea determinable en tests manuales.
- El power-up cae en línea recta desde la posición del alienígena destruido; si el cañón lo atrapa se aplica de inmediato y reemplaza cualquier power-up activo anterior (no se acumulan); si llega al suelo sin ser atrapado, se pierde.
- `rapid_fire` y `multi_shot` son mutuamente excluyentes con "un solo power-up activo a la vez"; `shield_repair` es instantáneo y no ocupa el slot de power-up activo del HUD.
- Sonido: mismo patrón que TETRIS (spec 07) — `AudioContext` creado perezosamente en el primer efecto (siempre después de una pulsación del jugador), cerrado en `destroy()`; con `soundEnabled` en `false`, `playSound()` retorna de inmediato sin crear contexto.
- El motor no lee ni escribe `localStorage`; las preferencias entran por `options` y por `setSkin`/`setSoundEnabled`.
- Lo que se guarda en `scores.score` es el `score` acumulado (alienígenas por fila + bonus de nave), sin contar power-ups recogidos como puntos directos.
- Ni los alienígenas ni la nave bonus son sprites de imagen: se dibujan con formas planas propias, y las dos skins son dos paletas/estilos de esas mismas formas, nunca una réplica del sprite de ningún juego existente.

## Implementation plan

1. **Insertar la fila del catálogo (paso manual del usuario).** Ejecutar el `insert into games` de arriba en el SQL Editor de Supabase.
   _Test:_ `/games` muestra la tarjeta "INVASIÓN BASTIONES"; `/games/invasion-bastiones` muestra el detalle con `best = 0`, `plays = 0` y leaderboard vacío; `/games/invasion-bastiones/play` todavía renderiza el reproductor mock genérico.
2. **Arte de portada.** Agregar `.cover-invasion-bastiones` en `app/globals.css`.
   _Test:_ la tarjeta y el hero muestran el arte nuevo; ninguna otra `.cover-*` cambia, incluida `.cover-invasion` si ya existiera.
3. **Motor, núcleo.** Crear `components/games/invasion-bastiones/engine.ts` con formación (patrón "rectangulo" únicamente por ahora), movimiento lateral con descenso por escalón, recálculo de velocidad, cañón con cooldown de disparo, balas enemigas, colisiones básicas, puntuación por fila, 3 vidas, subida de nivel, fin de partida. No se conecta a ningún componente todavía.
   _Test:_ `npm run build` compila sin errores de tipos.
4. **Motor, bastiones.** Agregar los 4 bastiones con su bitmap de bloques, la colisión bala-bastión (jugador y enemiga) y su erosión progresiva.
   _Test:_ `npm run build` sigue limpio.
5. **Motor, nave bonus y power-ups.** Agregar el temporizador y movimiento de la nave bonus con puntaje sorpresa, la caída ocasional de power-ups al destruir un alienígena, su recogida por el cañón, y los tres efectos (`rapid_fire`, `multi_shot`, `shield_repair`) con `onPowerupChange`.
   _Test:_ `npm run build` sigue limpio.
6. **Motor, patrones de formación y sonido.** Agregar los patrones "diamante" y "tablero" (rotando por nivel), y los 6 efectos de sonido sintetizados con Web Audio más `setSoundEnabled`.
   _Test:_ `npm run build` sigue limpio.
7. **Reproductor, rama de ruta y HUD de skin/sonido.** Crear `components/games/invasion-bastiones-player.tsx` con el HUD estándar más el `hud-stat` condicional "POWER-UP", un `<select className="hud-select">` de skin y un botón SONIDO ON/OFF en `hud-actions`, ambos leyendo/escribiendo `av_invasion_skin`/`av_invasion_sound`. Agregar `.invasion-bastiones-canvas` en `app/globals.css` y la línea `if (game.id === "invasion-bastiones") return <InvasionBastionesPlayer game={game} />;` en `app/games/[id]/play/page.tsx`.
   _Test manual:_ en `/games/invasion-bastiones/play` se juega con teclado; los bastiones se erosionan con los disparos; la nave bonus aparece y otorga puntaje al destruirla; los power-ups caen, se recogen y expiran mostrando/ocultando el `hud-stat` "POWER-UP"; cambiar de skin repinta sin reiniciar; SONIDO ON/OFF silencia/restaura los efectos y ambas preferencias sobreviven a recargar la página; PAUSA/REANUDAR/FIN/guardado se comportan como en el resto del catálogo.
8. **Controles táctiles.** Agregar `.invasion-bastiones-touch-controls` (`.td-pad` con ← →, `.td-actions` con DISPARAR) y su CSS con `@media (max-width: 840px)`.
   _Test manual:_ bajo 840px los botones mueven y disparan igual que el teclado; en escritorio no se renderizan.
9. **Repaso final con Playwright.** Comparar `/games/invasion-bastiones/play` contra el resto del sitio en viewport de escritorio y móvil, capturando las dos skins y los tres patrones de formación para verificar legibilidad sobre el `.crt-screen` negro con líneas de escaneo. Ajustar escalado del canvas, posición del `hud-select`, y visibilidad de los bastiones erosionados.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores en consola en `/games`, `/games/invasion-bastiones` y `/games/invasion-bastiones/play`.
- [ ] `select * from games_with_stats where id = 'invasion-bastiones'` devuelve la fila, y `best`/`plays` se mueven al insertar puntuaciones reales.
- [ ] `/games` muestra la tarjeta "INVASIÓN BASTIONES" con `.cover-invasion-bastiones`, sin cambios en ninguna otra tarjeta.
- [ ] `/games/invasion-bastiones` muestra cover, tags, descripción, stat-strip y el leaderboard lateral.
- [ ] El HUD (Jugador/Puntuación/Vidas/Nivel) refleja el estado real del motor, no valores simulados.
- [ ] El botón PAUSA congela el juego con el frame visible y el overlay "EN PAUSA"; REANUDAR continúa sin salto brusco, incluidos los temporizadores de power-up y de la nave bonus.
- [ ] El botón FIN termina la partida inmediatamente con la puntuación alcanzada hasta ese momento.
- [ ] Guardar en `GameOverModal` inserta una fila en `scores` con `game_id = 'invasion-bastiones'`, visible en `/hall-of-fame`.
- [ ] El nombre precargado en el modal viene de `av_user` en `localStorage`.
- [ ] Bajo 840px aparecen los controles táctiles y controlan el juego igual que el teclado; en escritorio no se renderizan.
- [ ] El canvas se escala dentro del marco `.crt` en ambos anchos sin deformar ni recortar el HUD.
- [ ] Salir de `/games/invasion-bastiones/play` detiene el loop y cierra el `AudioContext`: sin errores en consola y sin listeners huérfanos.
- [ ] `npm run build` termina sin errores.
- [ ] Un disparo (del jugador o enemigo) que atraviesa un bastión elimina exactamente un bloque de su bitmap y la propia bala, sin llegar más allá.
- [ ] Un bastión completamente erosionado (sin bloques) deja pasar las balas libremente.
- [ ] La nave bonus aparece en intervalos aleatorios entre 15 y 25 segundos, cruza la pantalla y desaparece sola si no se la destruye; destruirla suma uno de los valores de `UFO_SCORE_POOL`.
- [ ] Al menos uno de cada tres tipos de power-up (`rapid_fire`, `multi_shot`, `shield_repair`) es observable en una sesión de juego razonablemente larga, y el `hud-stat` "POWER-UP" aparece y desaparece según corresponda.
- [ ] Con `rapid_fire` activo el cooldown de disparo baja de 500 ms a 150 ms; con `multi_shot` activo cada disparo lanza 3 balas en vez de 1; ambos expiran solos tras 8 segundos.
- [ ] `shield_repair` restaura bloques a los bastiones de inmediato y no aparece como `hud-stat` activo con cuenta regresiva.
- [ ] El patrón de formación cambia entre "rectángulo", "diamante" y "tablero" a medida que sube el nivel.
- [ ] El selector de skin ofrece "Clásica" y "Neón"; cambiar de skin en mitad de una partida repinta alienígenas y cañón sin reiniciar ni alterar puntuación, vidas o nivel.
- [ ] La skin elegida sobrevive a recargar la página (`av_invasion_skin`).
- [ ] El botón SONIDO alterna entre ON y OFF, silencia de inmediato y su estado sobrevive a recargar la página (`av_invasion_sound`).
- [ ] Arrancando con el sonido en OFF no se crea ningún `AudioContext`.
- [ ] Se ejecutan los 6 efectos de sonido en sus momentos correspondientes cuando el sonido está activo.

## Decisions

- **Sí:** eje de diferenciación **Alcance** frente a `01-invasion-formacion-basica.md` — esta es la versión ambiciosa. Mismo mecanismo central, más features alrededor (escudos, nave bonus, power-ups, sonido, skins), siguiendo el patrón que ya usaron TETRIS y ARKANOID para su propio "alcance ambicioso".
- **Sí:** `id: "invasion-bastiones"`, distinto del `id: "invasion"` de la versión mínima. Es obligatorio por regla dura del agente: cada versión tiene su propia fila de catálogo, su propia carpeta de motor y su propia clase de portada; nunca podrían coexistir con el mismo `id`.
- **Sí:** `title: "INVASIÓN BASTIONES"` en vez de repetir "INVASIÓN" a secas. Deja clara, con solo mirar el catálogo, cuál de las dos versiones se implementó, sin necesitar abrir el spec.
- **Sí:** `cat: 'SHOOTER'`, `color: 'magenta'` — igual que la versión mínima, vienen literalmente del prompt del usuario vía `suggested-games.md`.
- **Sí (supuesto):** disparo del jugador por cooldown (`BASE_FIRE_COOLDOWN_MS`) en vez de "una bala a la vez". Es una desviación deliberada de la versión mínima, necesaria para que `multi_shot` tenga sentido; se documenta aquí porque no vino del prompt del usuario.
- **No:** mantener la restricción de "una bala a la vez" e implementar `multi_shot` como excepción especial a esa regla. Más simple y más legible tratar el disparo base como un caso particular de cooldown (`BASE_FIRE_COOLDOWN_MS`) que uno de los tres estados posibles de power-up modifica.
- **Sí (supuesto):** 4 bastiones de 15×9 bloques de 6px, alineados en `SHIELD_Y = 400`, con 1 punto de vida por bloque. Los números concretos son un supuesto — ningún valor vino del prompt — elegido para que la erosión sea visible en pantalla sin resultar en bastiones que desaparecen de un solo disparo.
- **Sí (supuesto):** la nave bonus se sortea entre `[50, 100, 150, 300]` al aparecer, no al ser destruida. Hace la mecánica determinable en pruebas manuales (el valor no cambia mientras la nave está en pantalla) sin alterar la sensación de "puntaje sorpresa" del jugador, que no ve el valor hasta destruirla.
- **Sí (supuesto):** `POWERUP_DROP_CHANCE = 0.08` por alienígena destruido, un solo power-up activo a la vez (el nuevo reemplaza al anterior), y `POWERUP_DURATION_MS = 8000` para los dos power-ups temporales. Ninguno de estos números vino del prompt; se fijan aquí para que el power-up aparezca con frecuencia razonable sin dominar la partida.
- **Sí (supuesto):** 3 patrones de formación (`rectangulo`, `diamante`, `tablero`) rotando por nivel, en vez de una única cuadrícula fija. Cumple con el punto "niveles" del eje Alcance del `recipe.md` (mismo criterio que ARKANOID usó con sus 3 layouts de ladrillos) y aporta variedad visual sin rediseñar el mecanismo central.
- **Sí:** 2 skins (`clasica`, `neon`) en vez de las 4 de TETRIS. Menor alcance que TETRIS porque aquí las skins son secundarias frente a bastiones/power-ups/nave bonus, que son las features que de verdad diferencian esta versión de la mínima.
- **No:** 4 o más skins. Añadiría trabajo de diseño de paleta sin aportar a la diferenciación por Alcance frente a la versión mínima, que ya está bien establecida con bastiones + power-ups + nave bonus + sonido.
- **Sí:** 6 efectos de sonido sintetizados con Web Audio, mismo patrón de `AudioContext` perezoso que TETRIS (spec 07). Consistente con el precedente ya sentado en el catálogo para "sonido = Web Audio sin archivos".
- **No:** música de fondo. Ninguna de las dos versiones de INVASIÓN la incluye; TETRIS tampoco la tiene.
- **No:** jefe de fin de nivel (boss). Sería una mecánica nueva, no una ampliación de alcance sobre el mecanismo de formación+escudos+power-ups ya definido; si se quiere, es candidato a otro spec.
- **No:** multijugador local. No fue pedido y complicaría el HUD compartido de la plataforma, pensado para un jugador.
- **No:** usar el nombre "Space Invaders" ni replicar su sprite de alienígena o de escudo. El nombre es marca viva de Taito; título, alienígenas y bastiones son diseños propios (formas planas), nunca una réplica pixel a pixel de ningún juego existente.
- **No:** gamepad físico ni tests automatizados. No fueron pedidos y no hay precedente en el catálogo actual.

## Risks

| Riesgo                                                                                                                                                              | Mitigación                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El bitmap de 15×9 bloques por bastión (× 4 bastiones) puede ser costoso de recorrer por colisión en cada frame si se implementa ingenuamente.                       | Acotar la comprobación de colisión al bloque bajo la posición `(x, y)` de la bala vía aritmética directa (`col = floor((x - shieldX) / SHIELD_CELL)`), no iterando los 135 bloques por bastión. |
| Un power-up que cae puede solaparse visualmente con las balas enemigas y confundir al jugador sobre qué debe esquivar y qué debe atrapar.                           | Dar a la cápsula de power-up una forma y color claramente distintos de las balas enemigas; verificar legibilidad en el paso 9.                                                                  |
| La nave bonus y los power-ups añaden dos temporizadores independientes del loop principal; una pausa mal implementada podría dejarlos avanzando "en segundo plano". | Los temporizadores de UFO y de power-up activo se congelan explícitamente junto con `update(dt)` durante la pausa, no en un `setInterval` aparte.                                               |
| El `AudioContext` puede quedar vivo tras salir del reproductor si `destroy()` no lo cierra, acumulándose entre partidas.                                            | `destroy()` llama a `audioCtx.close()` además de cancelar el rAF, mismo patrón que TETRIS (spec 07).                                                                                            |
| Los patrones "diamante" y "tablero" reducen el número de alienígenas por oleada, lo que podría desalinear la fórmula de puntuación esperada por el jugador.         | El patrón "tablero" duplica el valor por alienígena para compensar la menor cantidad; se documenta en el HUD/detalle y se verifica en el paso 9.                                                |
| Importar `insertScore` desde `lib/data/games.ts` rompe el build con un error engañoso de "Pages Router".                                                            | `invasion-bastiones-player.tsx` importa `insertScore` solo desde `lib/data/scores.ts`, como los demás reproductores.                                                                            |
| Next.js 16.2.10 difiere de las APIs conocidas por entrenamiento para Client Components, `params` o montaje de `<canvas>`.                                           | Antes del paso 7, revisar `node_modules/next/dist/docs/01-app/`, como exige `CLAUDE.md`.                                                                                                        |
| El `<select>` de skin puede capturar el foco y que las flechas manejen la lista de opciones en vez del cañón.                                                       | Igual que en TETRIS: tras un cambio de skin, el reproductor devuelve el foco al contenedor del juego con `blur()` sobre el select.                                                              |

## Lo que **no** está en este spec

- La versión mínima sin escudos/power-ups/sonido/skins — es `specs/game-jam/01-invasion-formacion-basica.md`.
- Música de fondo.
- Multijugador local o modo cooperativo.
- Jefe de fin de nivel.
- Cualquier cambio a ASTEROIDES, TETRIS, ARKANOID, SERPIENTE o a los componentes genéricos sobre `getGames()`.
- Gamepad físico y tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
