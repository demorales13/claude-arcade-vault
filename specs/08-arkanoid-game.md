# SPEC 08 — Arkanoid real como nuevo juego "ARKANOID"

> **Status:** Implemented
> **Depends on:** 05-asteroids-game, 06-leaderboard-catalogo-supabase
> **Date:** 2026-07-27
> **Objective:** Agregar "ARKANOID" (`id: "arkanoid"`) como tercer juego jugable del catálogo de Arcade Vault, portando el motor real de `C:\Courses\ClaudeCode.FernandoHerrera.2026\04-arkanoid` a `components/games/arkanoid/engine.ts` e integrándolo con el HUD, el marco `.crt` y el guardado de puntuaciones en Supabase ya existentes.

## Why this spec exists

El spec 06 dejó escrito que el catálogo real en Supabase crece **de uno en uno, a medida que los juegos se implementan de verdad**. ASTEROIDES fue el primero, TETRIS el segundo; este es el tercero.

El origen no es un archivo suelto sino un standalone repartido en seis scripts globales (`main.js`, `game.js`, `paddle.js`, `ball.js`, `blocks.js`, `levels.js`, más `assets/spritesheet.js`) que se comunican por variables globales y registran sus propios listeners en `document`. Portarlo es, sobre todo, encerrar todo eso en un único módulo con estado en clausura y una API de callbacks.

Hay además dos diferencias reales con el original que este spec resuelve de forma explícita:

1. **La física avanza por frame, sin `dt`.** La bola suma `dx`/`dy` y la paleta suma `speed` una vez por `requestAnimationFrame`. En un monitor de 120 Hz el juego corre al doble de velocidad.
2. **El juego se puede ganar.** Tras el tercer nivel el original entra en un estado `win`, algo que ni ASTEROIDES ni TETRIS tienen y que la plataforma no contempla.

A cambio, la geometría no da problemas: el canvas ya es 800×600 (4:3) y encaja en `.crt-screen` sin el conflicto que sí tuvo TETRIS.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (SQL manual): `id: 'arkanoid'`, `title: 'ARKANOID'`, `cat: 'ARCADE'`, `color: 'yellow'`, `cover: 'cover-arkanoid'`.
- Nueva clase CSS `.cover-arkanoid` en `app/globals.css`, mismo patrón de pseudo-elementos que las demás `.cover-*`.
- Motor portado a TypeScript en `components/games/arkanoid/engine.ts`: puerto fiel de los seis scripts (paleta, bola con rebote angular, bloques por nivel, explosiones de sprite, progresión de niveles, vidas y puntuación), sin JSX, con la API basada en callbacks del `recipe.md`.
- **Paso fijo de simulación a 60 Hz**: el loop acumula `dt` y ejecuta `update()` en pasos de `1/60` s, de modo que las constantes del original (`speed: 7`, `5.6`, `+5%` por nivel) se portan sin tocar ni un número y la sensación de juego es idéntica en cualquier monitor.
- Assets binarios copiados a `public/games/arkanoid/`: `spritesheet-breakout.png`, `sounds/ball-bounce.mp3` y `sounds/break-sound.mp3`.
- Carga del spritesheet **antes** del primer frame: `createArkanoidGame` lanza la carga y arranca el `requestAnimationFrame` cuando la imagen resuelve.
- Los 2 efectos de sonido del original (rebote y rotura de bloque), con botón **SONIDO ON/OFF** en el HUD, activo por defecto, y preferencia persistida en `av_arkanoid_sound`. La tecla `s` del original sigue alternándolo.
- Wrapper cliente `components/games/arkanoid-player.tsx`: HUD de la plataforma con sus 4 stats fijos (Jugador / Puntuación / Vidas / Nivel), botones PAUSA/FIN/SALIR, botón SONIDO, overlay de "NIVEL N SUPERADO" y de "¡VICTORIA!", `GameOverModal` y guardado vía `insertScore`.
- `app/games/[id]/play/page.tsx`: una rama más — `id === "arkanoid"` renderiza `ArkanoidPlayer`.
- CSS `.arkanoid-canvas` y `.arkanoid-touch-controls` en `app/globals.css`, con el breakpoint de 840px ya usado en el resto del sitio.
- Controles táctiles bajo 840px: `.td-pad` con dos botones grandes ← y →, inyectando `ArrowLeft`/`ArrowRight` por `setKey`.

**Out of scope (para otro spec):**

- Niveles adicionales más allá de los 3 de `LEVELS`, y el modo de bucle infinito. Superar el tercero termina la partida.
- Power-ups clásicos de Arkanoid (bola múltiple, paleta ancha, láser, imán) y bloques de varios golpes o indestructibles. El original no los tiene.
- Rebalancear velocidades, vidas o puntuación.
- Control de la paleta por ratón o arrastrando el dedo sobre el canvas. La entrada es exclusivamente por teclas y por los botones táctiles que inyectan esas mismas teclas.
- Música de fondo, control de volumen, y extender el sonido al resto de la plataforma (navegación, UI, ASTEROIDES). Este spec deja el audio contenido en ARKANOID.
- La pantalla de inicio ("pulsa una tecla para empezar"), el HUD dibujado en canvas y el botón "Reiniciar" dibujado en canvas del standalone. Los reemplazan el flujo de `/games/arkanoid`, `player-hud` y `GameOverModal`.
- Récords fuera del esquema de `scores` (mejor nivel alcanzado, bloques rotos).
- Gamepad físico y tests automatizados.
- Cualquier cambio a ASTEROIDES, a TETRIS o a los módulos genéricos sobre `getGames()` (`components/game-card.tsx`, `components/games-browser.tsx`, `app/games/[id]/page.tsx`, `app/hall-of-fame/`, `lib/data/*`).

## Data model

**SQL (manual, en el SQL Editor de Supabase):**

```sql
insert into games (id, title, short, long, cat, cover, color) values
  ('arkanoid', 'ARKANOID',
   'Rompe el muro de ladrillos con la paleta y no dejes caer la bola.',
   'Tres niveles de ladrillos te separan de la victoria: una cuadrícula completa, un diamante hueco y un tablero de ajedrez. Mueve la paleta para devolver la bola, aprovecha los bordes para angular el rebote hasta sesenta grados y aguanta con tres vidas mientras la bola acelera un cinco por ciento en cada nivel.',
   'ARCADE', 'cover-arkanoid', 'yellow');
```

`best` y `plays` no se insertan: los calcula la vista `games_with_stats` desde `scores`.

**TypeScript:**

```ts
// components/games/arkanoid/engine.ts — puerto del standalone, sin JSX
export type ArkanoidOutcome = "defeat" | "victory";

export type ArkanoidCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onLevelCleared?: (level: number) => void; // nivel superado, no el último
  onSoundToggled?: (enabled: boolean) => void; // la tecla `s` avisa al reproductor
  onGameOver?: (finalScore: number, outcome: ArkanoidOutcome) => void;
};

export type ArkanoidOptions = {
  soundEnabled?: boolean; // por defecto true
};

export type ArkanoidGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void;
  forceGameOver: () => void;
  continueLevel: () => void; // sale del estado "nivel superado" y arranca el siguiente
  setSoundEnabled: (enabled: boolean) => void;
};

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks,
  options?: ArkanoidOptions,
): ArkanoidGame;
```

Preferencia persistida (leída y escrita por `arkanoid-player.tsx`, nunca por el motor):

```ts
// localStorage
// "av_arkanoid_sound" -> "on" | "off"  (valor inválido o ausente → "on")
```

Geometría y constantes del motor, portadas 1:1:

```ts
const CANVAS_W = 800,
  CANVAS_H = 600; // 4:3, rellena .crt-screen
const PADDLE = { w: 120, h: 16, y: 560, speed: 7 };
const BALL = { radius: 8, base: 5.6, maxBounceAngle: Math.PI / 3 };
const SPEED_INCREASE_PER_LEVEL = 0.05; // speed = 5.6 * 1.05^(level-1)
const BLOCK = {
  rows: 6,
  cols: 10,
  w: 76,
  h: 26,
  gap: 4,
  topOffset: 60,
  points: 10,
};
const ROW_COLORS = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
const EXPLOSION_DURATION = 150; // ms, 4 frames del spritesheet
const STEP = 1 / 60; // paso fijo de simulación
const LIVES = 3;
```

Estado del juego (mismo shape que el original, en clausura):

```ts
// screen: "playing" | "levelCleared"   ("start", "gameover" y "win" ya no son estados
//                                       dibujados: los resuelven el reproductor y GameOverModal)
// score, lives, level
// paddle: { x }              ball: { x, y, dx, dy, speed }
// blocks: { row, col, color, x, y, alive }[]
// explosions: { x, y, w, h, color, startTime }[]   startTime en el reloj interno del motor
```

Assets (rutas nuevas bajo `public/`):

```
public/games/arkanoid/spritesheet-breakout.png
public/games/arkanoid/sounds/ball-bounce.mp3
public/games/arkanoid/sounds/break-sound.mp3
```

Convenciones:

- Las tablas `SPRITES` y `EXPLOSION_FRAMES` de `assets/spritesheet.js` se portan **1:1** como constantes del motor, con las mismas coordenadas `sx/sy/sw/sh`.
- El original dibujaba el spritesheet a un `<canvas>` intermedio antes de usarlo; el puerto conserva ese paso, que evita el coste de decodificación por frame.
- El loop acumula `dt` y ejecuta `update()` en pasos fijos de `STEP`. El acumulador se limita a un máximo de 3 pasos por frame, para que una pestaña en segundo plano no dispare cientos de simulaciones de golpe.
- Las explosiones se cronometran con el **reloj interno acumulado del motor**, no con `performance.now()`. Eso hace innecesario el `shiftExplosions(delta)` del original, que solo existía para corregir el tiempo perdido durante la pausa.
- Pausa: se salta `update()` pero se sigue llamando a `draw()`, así el frame queda visible bajo el overlay "EN PAUSA". Al reanudar se descarta el `dt` acumulado.
- El motor no toca `window`/`document` fuera de sus propios `keydown`/`keyup`, que remueve en `destroy()`. En particular no lee ni escribe `localStorage`: la preferencia de sonido entra por `options` y por `setSoundEnabled`.
- `preventDefault()` solo sobre los códigos que el motor consume: `ArrowLeft`, `ArrowRight`, `KeyA`, `KeyD`, `KeyS`.
- El original leía las teclas por `e.key` (`'a'`, `'A'`, `'ArrowLeft'`); el puerto usa `e.code` (`KeyA`, `ArrowLeft`) porque es lo que `setKey` inyecta desde los botones táctiles y lo que ya usan ASTEROIDES y TETRIS.
- Perder la última vida emite `onGameOver(score, "defeat")`; superar el nivel 3 emite `onGameOver(score, "victory")`. En ambos casos lo que se guarda en `scores.score` es el `score` acumulado, sin bonus de final de partida.
- Superar un nivel que no es el último deja el motor en `screen: "levelCleared"`: deja de actualizar, sigue dibujando el último frame y emite `onLevelCleared(level)`. Solo `continueLevel()` lo saca de ahí.
- Sonido: cada efecto crea un `new Audio(src)` con `volume = 0.5` y `.play().catch(() => {})`, igual que el original. Con `soundEnabled` en `false` la función retorna de inmediato.

## Implementation plan

1. **Insertar la fila del catálogo (paso manual del usuario).** Ejecutar el `insert into games` de arriba en el SQL Editor de Supabase.
   _Test:_ `/games` muestra la tarjeta "ARKANOID" junto a "ASTEROIDES" y "TETRIS"; `/games/arkanoid` muestra el detalle con `best = 0`, `plays = 0` y leaderboard vacío; `/games/arkanoid/play` todavía renderiza el reproductor mock genérico.

2. **Arte de portada.** Agregar `.cover-arkanoid` en `app/globals.css`, junto a las demás `.cover-*`: fondo ámbar oscuro, tres franjas de ladrillos en la mitad superior con `repeating-linear-gradient` en los colores de fila del original (rojo, amarillo, cyan) vía `::after`, y en la inferior la paleta amarilla con la bola encima vía `::before`. Debe distinguirse de la `.cover-bricks` que ya existe en el archivo.
   _Test:_ la tarjeta en `/games` y el hero de `/games/arkanoid` muestran el arte nuevo; `.cover-asteroids`, `.cover-tetris` y `.cover-bricks` no cambian.

3. **Assets.** Copiar `spritesheet-breakout.png` a `public/games/arkanoid/` y los dos `.mp3` a `public/games/arkanoid/sounds/`. No copiar el `.DS_Store` de la carpeta de origen.
   _Test:_ abrir las tres rutas directamente en el navegador (`/games/arkanoid/spritesheet-breakout.png` y las dos de audio) devuelve el archivo, sin 404.

4. **Motor, núcleo.** Crear `components/games/arkanoid/engine.ts` con: tablas `SPRITES`/`EXPLOSION_FRAMES`, carga del spritesheet al canvas intermedio, `LEVELS` y creación de bloques, paleta, bola con rebote en paredes, en bloques (por menor solape) y en la paleta (ángulo hasta 60°), pérdida de vida al caer, progresión de nivel con `screen: "levelCleared"`, victoria tras el nivel 3, loop `requestAnimationFrame` con paso fijo de `1/60`, listeners `keydown`/`keyup` sobre `e.code`, y la API `pause`/`resume`/`destroy`/`setKey`/`forceGameOver`/`continueLevel`. Sin explosiones y sin sonido todavía. No se conecta a ningún componente.
   _Test:_ `npm run build` compila sin errores de tipos.

5. **Motor, explosiones y sonido.** Añadir la cola de explosiones (4 frames del spritesheet durante 150 ms, cronometrada con el reloj interno del motor) y el disparo de los dos efectos de audio en sus mismos momentos que el original (rebote en pared y en paleta → `ball-bounce`; rotura de bloque → `break-sound`), más `setSoundEnabled(enabled)` y el manejo de la tecla `KeyS`, que emite `onSoundToggled` hacia el reproductor.
   _Test:_ `npm run build` sigue limpio.

6. **Reproductor y rama de ruta.** Crear `components/games/arkanoid-player.tsx` siguiendo la estructura de `asteroids-player.tsx`: HUD con Jugador / Puntuación / Vidas / Nivel, marco `.crt` con el canvas 800×600 y el overlay "EN PAUSA", `.crt-bottom`, botones PAUSA/FIN/SALIR, `GameOverModal` con `insertScore` importado de `lib/data/scores.ts`, nombre precargado desde `av_user`. Agregar `.arkanoid-canvas` en `app/globals.css` y la línea `if (game.id === "arkanoid") return <ArkanoidPlayer game={game} />;` en `app/games/[id]/play/page.tsx`. El componente registra su propio listener de `KeyP` que llama a `togglePause()`.
   _Test manual:_ en `/games/arkanoid/play` se juega con teclado; el HUD refleja el estado real del motor; PAUSA congela con el frame visible y REANUDAR continúa sin salto; FIN abre `GameOverModal` con la puntuación alcanzada; guardar inserta una fila en `scores` con `game_id = 'arkanoid'`, visible en `/games/arkanoid` y en `/hall-of-fame`.

7. **Overlays de nivel y victoria, y botón SONIDO.** En el reproductor: `onLevelCleared(level)` muestra un overlay `.crt-content` con "NIVEL N SUPERADO — PULSA UNA TECLA" y cualquier `keydown` o toque sobre el marco llama a `continueLevel()`; `onGameOver(score, "victory")` abre `GameOverModal` precedido del rótulo "¡VICTORIA!". Añadir a `hud-actions` un botón `SONIDO ON`/`SONIDO OFF` (`.btn ghost`) que lee su valor inicial de `av_arkanoid_sound` en el `useEffect` de montaje, lo pasa como `options` a `createArkanoidGame`, y al cambiar llama a `setSoundEnabled` y reescribe la clave. `onSoundToggled` (tecla `s`) actualiza el mismo estado de React, de modo que botón y tecla nunca se desincronizan.
   _Test manual:_ superar el nivel 1 muestra el overlay y una tecla avanza al nivel 2 con la bola más rápida; superar el nivel 3 abre el modal con "¡VICTORIA!" y la puntuación real; el botón SONIDO silencia y devuelve el audio en el acto, la tecla `s` hace lo mismo y el estado sobrevive a recargar la página.

8. **Controles táctiles.** Agregar el bloque `.arkanoid-touch-controls` en el reproductor (`.td-pad` con dos botones ← y →) y su CSS con el `@media (max-width: 840px)`, siguiendo el bloque de `.tetris-touch-controls`. Cada botón usa `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel` sobre `setKey`.
   _Test manual:_ bajo 840px los botones mueven la paleta igual que el teclado y mantener pulsado la mueve de forma continua; en escritorio no se renderizan.

9. **Repaso final con Playwright.** Comparar `/games/arkanoid/play` contra el juego original y contra el resto del sitio (HUD, marco `.crt`, tipografía) en viewport de escritorio y móvil. Verificar en particular que los sprites del spritesheet no quedan apagados sobre el `.crt-screen` negro con líneas de escaneo, y que la paleta sigue siendo alcanzable con los botones táctiles a lo ancho del tablero. Ajustar escalado del canvas y colocación de los controles.

## Acceptance criteria

- [x] `npm run dev` levanta sin errores en consola en `/games`, `/games/arkanoid` y `/games/arkanoid/play`.
- [x] `select * from games_with_stats where id = 'arkanoid'` devuelve la fila, y `best`/`plays` se mueven al insertar puntuaciones reales.
- [x] `/games` muestra la tarjeta "ARKANOID" con `.cover-arkanoid`, sin cambios en las tarjetas de "ASTEROIDES" ni "TETRIS".
- [x] `/games/arkanoid` muestra cover, tags, descripción, stat-strip y el leaderboard lateral.
- [x] El canvas rellena el marco `.crt` (4:3) sin deformación ni recorte, en escritorio y en móvil.
- [x] Los tres assets se sirven desde `public/games/arkanoid/` sin ningún 404 en la pestaña de red.
- [x] El tablero no dibuja nada hasta que el spritesheet carga; una vez cargado, paleta, bola y bloques usan sus sprites del original.
- [x] `ArrowLeft`/`KeyA` y `ArrowRight`/`KeyD` mueven la paleta, que se detiene en los bordes del canvas sin salirse.
- [x] La bola rebota en las tres paredes y en la paleta, y el punto de impacto en la paleta cambia el ángulo de salida hasta un máximo de 60°.
- [x] Romper un bloque suma exactamente 10 puntos y dispara su animación de explosión de 4 frames durante 150 ms.
- [x] Que la bola caiga por debajo del canvas resta una vida y la reposiciona sobre la paleta; a las 3 pérdidas se abre `GameOverModal` con la puntuación final real.
- [x] Los 3 niveles cargan sus layouts del original: cuadrícula completa, diamante hueco y tablero de ajedrez.
- [x] La velocidad de la bola sube un 5% por nivel (`5.6 × 1.05^(nivel-1)`).
- [ ] Superar un nivel que no es el último muestra el overlay "NIVEL N SUPERADO" con el frame congelado, y cualquier tecla o toque arranca el siguiente. _(implementado y revisado por código; no se forzó en vivo un despeje completo de nivel en el repaso de Playwright — ver nota final)_
- [ ] Superar el nivel 3 termina la partida con el rótulo "¡VICTORIA!" y abre `GameOverModal` con la puntuación alcanzada. _(implementado y revisado por código; no verificado en vivo por el mismo motivo)_
- [x] El juego corre a la misma velocidad percibida en un monitor de 60 Hz y en uno de 120 Hz.
- [x] El HUD (Jugador / Puntuación / Vidas / Nivel) refleja el estado real del motor, no valores simulados, y no aparece ningún HUD dibujado dentro del canvas.
- [x] `KeyP` y el botón PAUSA producen exactamente el mismo estado: juego congelado con el frame visible, overlay "EN PAUSA" y etiqueta del botón en "REANUDAR".
- [x] REANUDAR continúa sin salto brusco de la bola, y las explosiones en curso no se saltan sus frames por el tiempo pausado.
- [x] El botón FIN termina la partida inmediatamente con la puntuación alcanzada hasta ese momento.
- [x] Suenan los dos efectos en sus momentos: rebote (pared y paleta) y rotura de bloque.
- [x] El botón SONIDO y la tecla `s` alternan entre ON y OFF, silencian de inmediato, quedan sincronizados entre sí, y el estado sobrevive a recargar la página (`av_arkanoid_sound`).
- [x] Guardar en `GameOverModal` inserta una fila en `scores` con `game_id = 'arkanoid'`, visible en `/hall-of-fame`.
- [x] El nombre precargado en el modal sigue viniendo de `av_user` en `localStorage`.
- [x] La única clave nueva en `localStorage` es `av_arkanoid_sound`.
- [x] Bajo 840px aparecen los dos botones táctiles y mueven la paleta igual que el teclado; en escritorio no se renderizan.
- [x] Salir de `/games/arkanoid/play` detiene el loop: sin errores en consola y sin listeners huérfanos.
- [x] `npm run build` termina sin errores.

## Decisions

- **Sí:** `id: 'arkanoid'` y `title: 'ARKANOID'`. Sigue el precedente de `asteroids` (spec 05): id en inglés para la ruta, la carpeta del motor y la clase de cover, título visible en mayúsculas.
- **Sí:** `cat: 'ARCADE'`. Romper un muro con una paleta es arcade puro; `PUZZLE` ya lo ocupa TETRIS y encajaría peor.
- **Sí:** `color: 'yellow'`. Es el único de los cuatro valores permitidos que queda libre y que `components/game-card.tsx` mapea a su propia clase de botón. Se descartó `green` porque `game-card.tsx` no lo mapea y cae al estilo cyan por defecto, dejando la tarjeta indistinguible de la de ASTEROIDES.
- **Sí:** **paso fijo de simulación a 60 Hz** con acumulador de `dt`. El original avanza una cantidad fija por frame y por tanto va al doble de velocidad en un monitor de 120 Hz. El paso fijo conserva las fórmulas y constantes exactamente como están y da la misma sensación de juego en cualquier pantalla.
- **No:** escalar las velocidades por `dt` como hace ASTEROIDES. Obligaría a reescribir todas las constantes a px/segundo y el rebote angular, y el resultado ya no sería el mismo juego.
- **No:** portar el `update` por frame tal cual. Es el bug que el paso fijo viene a arreglar.
- **Sí:** el estado de victoria termina la partida vía `onGameOver(score, "victory")`, con un rótulo "¡VICTORIA!" en el reproductor para distinguirlo de perder. Es lo que hace el original y no inventa gameplay.
- **No:** niveles infinitos en bucle ni layouts nuevos. Ambos son gameplay que el original no tiene; si se quieren, van en su propio spec.
- **Sí:** el paso entre niveles se conserva como pausa explícita: el motor entra en `screen: "levelCleared"` y solo `continueLevel()` lo saca. El reproductor pinta el overlay y escucha la tecla. Respeta el "pulsa una tecla para continuar" del original sin dibujar nada dentro del canvas.
- **No:** transición automática tras un temporizador. Pierde la pausa deliberada que el original da al jugador entre niveles.
- **Sí:** el HUD usa **solo los 4 stats fijos** (Jugador / Puntuación / Vidas / Nivel). Arkanoid encaja exacto en ellos y no necesita el quinto stat condicional que sí necesitaron ASTEROIDES ("DISPARO TRIPLE") y TETRIS ("COMBO").
- **No:** añadir un stat de bloques restantes. Es información que el original no muestra.
- **Sí:** la partida arranca al montar el reproductor, sin pantalla de inicio. Quien llega a `/games/arkanoid/play` ya pulsó JUGAR en la página de detalle; una segunda pantalla de "pulsa una tecla" es un clic redundante que ni ASTEROIDES ni TETRIS piden.
- **Sí:** portar el **spritesheet** `spritesheet-breakout.png` a `public/games/arkanoid/` con sus tablas de frames. Es lo único que conserva el look del original, incluida la animación de explosión de 4 frames.
- **No:** redibujar paleta, bola y bloques con formas de canvas en estilo neon. Sería rediseñar el juego y obligaría a inventar las explosiones desde cero.
- **Sí:** el motor **espera a que el spritesheet cargue** antes de arrancar el loop. Evita el instante inicial del original en el que la bola ya se mueve sobre un tablero invisible. `destroy()` funciona aunque se llame antes de que la imagen resuelva.
- **Sí:** portar los **2 efectos de sonido** con botón SONIDO ON/OFF en el HUD, activo por defecto y persistido en `av_arkanoid_sound`. Mismo patrón que TETRIS fijó en el spec 07: si el juego original suena, la versión de Arcade Vault suena, y con un control visible para callarlo.
- **Sí:** la tecla `s` del original se conserva y queda sincronizada con el botón del HUD vía `onSoundToggled`. Es la tecla que documenta el juego de origen; el botón existe porque en móvil no hay teclado y porque un control escondido es inservible para quien no lo conoce.
- **No:** música de fondo, control de volumen, ni extender el sonido al resto de la plataforma. Igual que en el spec 07, el audio queda contenido en el juego.
- **Sí:** los sonidos se reproducen con `new Audio(src)` por evento, como el original, en vez de con Web Audio. Son archivos, no síntesis; el patrón de `beep()` del spec 07 no aplica aquí.
- **Sí:** controles táctiles con **dos botones grandes ← y →** que inyectan `ArrowLeft`/`ArrowRight` por `setKey`. Un único camino de entrada, el mismo que el teclado, como exige el `recipe.md`, y consistente con ASTEROIDES y TETRIS.
- **No:** arrastrar el dedo sobre el canvas para mover la paleta. Sería un segundo camino de entrada que no pasa por `setKey` y que hay que diseñar y probar aparte.
- **Sí:** puerto **1:1** del balance: `BASE_BALL_SPEED 5.6`, `+5%` por nivel, paleta 120×16 a velocidad 7, 3 vidas, 10 puntos por bloque, ángulo máximo de 60° y los 3 layouts de `LEVELS`. Mismo criterio que los specs 05 y 07.
- **Sí:** se apagan el HUD dibujado en canvas y el botón "Reiniciar" dibujado en canvas. El HUD lo lleva `player-hud` y el reinicio lo lleva `GameOverModal` con "JUGAR DE NUEVO". `drawHUD`, `drawStartScreen`, `drawGameOverScreen`, `drawWinScreen`, `drawRestartButton` y `handleCanvasClick` no se portan.
- **Sí:** el motor **no** gestiona `KeyP`; lo escucha `arkanoid-player.tsx` y llama a su propio `togglePause()`. La pausa vive como estado de React (overlay y etiqueta del botón); si el motor la alternara por su cuenta, los dos estados se desincronizarían. Precedente de los specs 05 y 07.
- **Sí:** el motor lee `e.code` en vez del `e.key` del original. `setKey` inyecta códigos desde los botones táctiles, y es lo que ya usan los otros dos motores.
- **Sí:** las explosiones se cronometran con el reloj interno acumulado del motor. Hace innecesario el `shiftExplosions(delta)` del original, que solo existía para corregir el tiempo perdido en la pausa.
- **No:** que el motor lea o escriba `localStorage`. La preferencia de sonido entra por `options` y por `setSoundEnabled`, como exige el `recipe.md`.
- **No:** power-ups, bloques de varios golpes, gamepad ni tests automatizados. No están en el original ni fueron pedidos.

## Risks

| Riesgo                                                                                                                                                                                                        | Mitigación                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El acumulador del paso fijo entra en espiral de la muerte: si un frame tarda mucho, ejecuta muchos pasos, tarda más aún, y se realimenta.                                                                     | El acumulador se limita a un máximo de 3 pasos por frame; el tiempo sobrante se descarta.                                                                                                                         |
| El original repartía su estado en variables globales entre seis archivos (`GameState`, `Ball`, `Paddle`, `Blocks`); al encerrarlo en una clausura es fácil dejar alguna referencia compartida entre partidas. | Todo el estado se crea dentro de `createArkanoidGame`; `destroy()` + volver a crear el motor es el único camino de reinicio, igual que en ASTEROIDES.                                                             |
| El loop `requestAnimationFrame` sigue vivo tras navegar fuera del reproductor y dibuja sobre un canvas desmontado.                                                                                            | `destroy()` cancela el rAF y remueve los listeners; se llama siempre desde el cleanup del `useEffect`. Además debe funcionar si se llama mientras el spritesheet aún carga.                                       |
| Las flechas hacen scroll de la página o pelean con el input de iniciales de `GameOverModal`.                                                                                                                  | `preventDefault` solo sobre los códigos consumidos (`ArrowLeft`, `ArrowRight`, `KeyA`, `KeyD`, `KeyS`), activo únicamente mientras el juego está montado y sin modal abierto. Patrón del spec 05.                 |
| El listener de "pulsa una tecla para continuar" del overlay de nivel superado se dispara con el modal de fin de partida abierto o mientras se escriben las iniciales.                                         | El listener solo se registra mientras el estado del reproductor es `levelCleared`, y se ignora si `over` es true. Mismo criterio que el `KeyP` del spec 07.                                                       |
| Un botón táctil queda trabado al arrastrar el dedo fuera y la paleta se va sola contra la pared.                                                                                                              | Liberar con `onPointerUp`, `onPointerLeave` **y** `onPointerCancel`. Trampa ya pagada en el spec 05.                                                                                                              |
| Importar `insertScore` desde `lib/data/games.ts` rompe el build completo con un error engañoso de "Pages Router".                                                                                             | Siempre desde `lib/data/scores.ts`, que solo importa `lib/supabase/client.ts`. Trampa ya pagada en el spec 06.                                                                                                    |
| Next.js 16.2.10 difiere de las APIs conocidas por entrenamiento para Client Components, `params`, montaje de `<canvas>` o servido de estáticos desde `public/`.                                               | Antes de los pasos 3 y 6, revisar la página correspondiente en `node_modules/next/dist/docs/01-app/`, como exige `CLAUDE.md`.                                                                                     |
| Los sprites del original fueron diseñados sobre un `#000` plano y pueden quedar apagados sobre el `.crt-screen`, que añade viñeta y líneas de escaneo.                                                        | El paso 9 los revisa con Playwright. Si algún sprite queda ilegible se ajusta su brillo en el dibujado, dejando constancia de la desviación del 1:1.                                                              |
| `new Audio()` por evento puede acumular decenas de elementos al romper bloques en cadena, o fallar si el navegador limita la reproducción simultánea.                                                         | Se conserva el `.catch(() => {})` del original, que ya ignora cualquier fallo. Los elementos quedan sin referencias y el recolector de basura los libera.                                                         |
| Con dos fuentes que alternan el sonido (la tecla `s` y el botón del HUD) es fácil que la etiqueta del botón y el estado real se desincronicen.                                                                | La tecla `s` no decide nada por su cuenta: emite `onSoundToggled` hacia el reproductor, que es el único dueño del valor, reescribe `av_arkanoid_sound` y devuelve el nuevo estado al motor por `setSoundEnabled`. |
| El bloque `.arkanoid-touch-controls` sería un tercer duplicado casi idéntico de las reglas de `.asteroids-touch-controls` y `.tetris-touch-controls` en `globals.css`.                                        | Aceptado en este spec por coherencia con lo ya existente. Factorizar las tres en una clase común es una limpieza de CSS que va en su propio spec.                                                                 |

## Lo que **no** está en este spec

- Niveles adicionales, bucle infinito de niveles, y rebalanceo de velocidades o puntuación.
- Power-ups (bola múltiple, paleta ancha, láser) y bloques de varios golpes o indestructibles.
- Control de la paleta por ratón o por arrastre sobre el canvas.
- Música de fondo, control de volumen, y sonido en el resto de la plataforma.
- La pantalla de inicio, el HUD en canvas y el botón "Reiniciar" en canvas del standalone.
- Estadísticas fuera del esquema de `scores`.
- Gamepad físico y tests automatizados.
- Factorizar los bloques CSS duplicados de controles táctiles.
- Cualquier cambio a ASTEROIDES, a TETRIS o a los componentes genéricos sobre `getGames()`.

Cada uno de estos, si se implementa, va en su propio spec.
