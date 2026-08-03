# GAME JAM 06 — FRENESÍ

> **Status:** Draft
> **Depends on:** 05-asteroids-game, 06-leaderboard-catalogo-supabase
> **Date:** 2026-07-31
> **Objective:** Diseñar "FRENESÍ" (`id: "frenesi"`) como reinterpretación del duelo de paletas propuesto en `suggested-games.md`, convirtiéndolo en una arena de supervivencia sin fin con multibola, power-ups que caen al campo y obstáculos centrales que desvían las pelotas.

## Why this spec exists

Este spec es una de dos alternativas del mismo concepto base RALLY — la hermana es `specs/game-jam/05-rally-clasico.md` ("RALLY"). El eje que las separa es **Fidelidad**: en la hermana RALLY es un puerto fiel del duelo de paletas clásico (una pelota, dos paletas, sets a 11 puntos, sin añadidos); aquí FRENESÍ conserva el mismo esquema de control de paleta (↑/↓) pero reinterpreta la mecánica como una arena arcade sin fin — varias pelotas a la vez, power-ups que aparecen en el campo, obstáculos que rebotan la pelota y una IA que solo defiende, sin estructura de sets. **Solo una de las dos se implementará**; el humano elige cuál.

FRENESÍ toma la mecánica base de paleta y pelota de `suggested-games.md` (fila RALLY, 2026-07-29) y le añade el twist de caos multibola con potenciadores, en la línea de "Reinterpretación con su propio twist" del menú de ejes. El esquema de control no cambia — la diferencia es qué ocurre en la cancha, no cómo se maneja la paleta.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (SQL manual): `id: 'frenesi'`, `title: 'FRENESÍ'`, `cat: 'VERSUS'`, `color: 'yellow'`, `cover: 'cover-frenesi'`, con traducción al inglés (`title_en`/`short_en`/`long_en`).
- Nueva clase CSS `.cover-frenesi` en `app/globals.css`: fondo negro con línea central punteada, varias pelotas amarillas con estela, cápsulas de power-up en verde y magenta y un obstáculo circular central brillante, mismo patrón de pseudo-elementos que las demás `.cover-*`.
- Motor diseñado desde cero en `components/games/frenesi/engine.ts`: cancha con muros, paleta del jugador (izquierda) y paleta de la IA (derecha) que solo defiende, hasta 5 pelotas simultáneas con rebote anguloso, dos o tres obstáculos circulares fijos en el centro que desvían las pelotas, cápsulas de power-up que aparecen en el campo y se activan al ser tocadas por una pelota (bola extra, agrandar paleta, encoger paleta IA, acelerar, ralentizar), 3 vidas, niveles por puntuación acumulada, sin JSX, con la API basada en callbacks del `recipe.md`.
- Wrapper cliente `components/games/frenesi-player.tsx`: HUD de la plataforma (Jugador / Puntuación / Vidas / Nivel) con un quinto `hud-stat` condicional **BOLAS xN** (visible solo con más de una pelota en juego), `<HudMenu>` con `<SkinSelector>` y botones PAUSA/FIN/SALIR, `<TouchPad>` compartido (dpad con ↑/↓ activos, resto atenuado), `GameOverModal` y guardado vía `insertScore` de `lib/data/scores.ts`.
- `app/games/[id]/play/page.tsx`: una rama más — `id === "frenesi"` renderiza `FrenesiPlayer`.
- CSS `.frenesi-canvas` en `app/globals.css` (posicionado absoluto para rellenar `.crt-screen`, como `.asteroids-canvas`). Los controles táctiles usan el `<TouchPad>` compartido de spec 12, sin CSS por juego.
- `setupHiDpiCanvas(canvas, 800, 600)` llamado una vez antes de crear el motor.

**Out of scope (para otro spec):**

- La versión clásica fiel de sets — vive en `specs/game-jam/05-rally-clasico.md`, un spec independiente.
- Sonido y música — no fue pedido y no hay assets de audio disponibles.
- Modo de dos jugadores humanos (segundo teclado, pantalla partida o red). El rival es una IA que solo defiende.
- Sprites o imágenes — todo se dibuja con formas planas y degradados en canvas; ningún asset bajo `public/`.
- Estructura de sets a un número fijo de puntos — es justo el rasgo que la distingue de la hermana RALLY; aquí no hay sets.
- Obstáculos móviles o destructibles — los obstáculos centrales son fijos.
- Power-ups adicionales fuera de los cinco listados, o efectos permanentes que persistan entre vidas.
- Tests automatizados (unit/e2e) y soporte de gamepad físico.
- Cualquier cambio a ASTEROIDES, TETRIS, ARKANOID, SERPIENTE, CRUCE o a los módulos genéricos sobre `getGames()`.

## Data model

**SQL (manual, en el SQL Editor de Supabase):**

```sql
insert into games (id, title, short, long, cat, cover, color, title_en, short_en, long_en) values
  ('frenesi', 'FRENESÍ',
   'Duelo de paletas convertido en caos: multibola, power-ups y obstáculos en el campo.',
   'Defiende tu lado contra una IA en una arena sin fin donde el duelo clásico de paletas se desata: varias pelotas rebotan a la vez, cápsulas de power-up aparecen en el campo para sumar bolas, agrandar tu paleta o encoger la del rival, y obstáculos centrales desvían cada tiro. Cada pelota que cuela suma puntos; quedarte sin pelotas en tu lado cuesta una vida, y perder tres termina la partida.',
   'VERSUS', 'cover-frenesi', 'yellow',
   'FRENZY',
   'A paddle duel turned to chaos: multiball, power-ups and obstacles on the field.',
   'Defend your side against an AI in an endless arena where the classic paddle duel breaks loose: several balls bounce at once, power-up capsules appear on the field to add balls, grow your paddle or shrink the rival''s, and central obstacles deflect every shot. Every ball you sneak past scores points; running out of balls on your side costs a life, and losing three ends the game.');
```

`best` y `plays` no se insertan: los calcula la vista `games_with_stats` desde `scores`.

Nota (de `recipe.md` §2): `color: 'yellow'` tiene clase de botón propia en `components/game-card.tsx`, así que la tarjeta se distingue de verdad. Comparte `color` y `cat` con la hermana RALLY a propósito: el eje que las separa es la fidelidad de la mecánica, no la categoría ni el color (mismo criterio que CRUCE/ASCENSO, ambas cyan).

**TypeScript:**

```ts
// components/games/frenesi/engine.ts — motor diseñado desde cero, sin JSX
export type FrenesiCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onBallsChange?: (balls: number) => void; // <= 1 → el stat BOLAS se oculta
  onGameOver?: (finalScore: number) => void;
};

export type FrenesiGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void; // "ArrowUp" | "ArrowDown"
  forceGameOver: () => void;
};

export function createFrenesiGame(
  canvas: HTMLCanvasElement,
  callbacks: FrenesiCallbacks,
): FrenesiGame;
```

El selector de skin lo añade el agente `skin-designer` tras la implementación (regla dura de `/spec-impl-game`): en ese momento el motor gana `FrenesiOptions { skin?: SkinId }` y `setSkin()`, y el reproductor un `<SkinSelector>` persistido en `av_frenesi_skin`. No se detalla aquí porque el motor de este spec nace sin skins.

Geometría del canvas (constantes del motor, no configurables):

```ts
const CANVAS_W = 800,
  CANVAS_H = 600; // 4:3, rellena .crt-screen
const WALL = 12; // grosor de los muros superior e inferior
const PADDLE_W = 14,
  PADDLE_H = 90; // alto base de paleta, modificable por power-up
const PLAYER_X = 30;
const AI_X = CANVAS_W - 30 - PADDLE_W; // 756
const BALL_R = 9;
const BUMPERS = [
  { x: 400, y: 180, r: 34 },
  { x: 400, y: 420, r: 34 },
  { x: 400, y: 300, r: 24 },
]; // obstáculos circulares fijos en el centro
```

Física, pelotas y puntuación:

```ts
const BALL_SPEED_START = 340; // px/s al sacar
const BALL_SPEED_HIT_STEP = 14; // +px/s por golpe de paleta
const BALL_SPEED_MAX = 700;
const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60°, mismo criterio que ARKANOID
const MAX_BALLS = 5; // techo de pelotas simultáneas
const PLAYER_SPEED = 500; // px/s de la paleta del jugador
const POINT_VALUE = 100; // a scores.score por cada pelota que cuela en el lado IA
const START_LIVES = 3;
const LEVEL_POINTS = 1000; // sube 1 nivel por cada 1000 puntos acumulados
const SERVE_DELAY_MS = 600; // pausa antes de sacar una nueva pelota tras perder el rally
```

Power-ups (cápsulas en el campo; se activan cuando **cualquier** pelota las toca):

```ts
const POWERUP_R = 16;
const POWERUP_SPAWN_MS_BASE = 6000; // intervalo base entre apariciones en el nivel 1
const POWERUP_SPAWN_MS_MIN = 2500; // el intervalo baja por nivel hasta este piso
const POWERUP_EFFECT_MS = 8000; // duración de los efectos temporales
// tipos: "extra"  → +1 pelota (hasta MAX_BALLS)
//        "grow"   → paleta del jugador +40% de alto durante POWERUP_EFFECT_MS
//        "shrink" → paleta de la IA -30% de alto durante POWERUP_EFFECT_MS
//        "fast"   → todas las pelotas +25% de velocidad durante POWERUP_EFFECT_MS
//        "slow"   → todas las pelotas -25% de velocidad durante POWERUP_EFFECT_MS
```

Comportamiento de la IA (solo defiende; escala por nivel):

```ts
const AI_SPEED_BASE = 320; // px/s en el nivel 1
const AI_SPEED_STEP = 24; // +px/s por nivel
const AI_SPEED_MAX = 540;
```

Estado del juego (clausura interna del motor, no exportado):

```ts
// player: { y: number; halfExtra: number }   // halfExtra: alto extra por "grow", con temporizador
// ai: { y: number; halfShrink: number }       // halfShrink: alto restado por "shrink", con temporizador
// balls: Array<{ x: number; y: number; vx: number; vy: number; speed: number }>  // 1..MAX_BALLS
// powerups: Array<{ x: number; y: number; type: PowerupType }>
// effects: { grow?: number; shrink?: number; fast?: number; slow?: number }  // ms restantes
// score, lives, level: number
// serveTimerMs: number      // > 0 → esperando el saque de una nueva pelota tras perder el rally
// powerupTimerMs: number    // cuenta atrás para la próxima aparición de cápsula
```

Convenciones:

- El rebote en la paleta es anguloso, con el mismo criterio de ARKANOID que usa la hermana RALLY: `offset = clamp((ballCenterY - paddleCenterY) / (paddleHalf), -1, 1)`, `angle = offset * MAX_BOUNCE_ANGLE`. El `paddleHalf` de cada paleta incorpora los power-ups activos (`grow`/`shrink`).
- Cada pelota rebota en los muros superior e inferior, en las dos paletas y en los obstáculos circulares centrales (reflexión respecto a la normal en el punto de contacto). Los obstáculos son fijos y nunca se destruyen.
- Una pelota que cruza el borde derecho (lado IA) cuela: suma `POINT_VALUE` al `score` y se elimina del campo. Una pelota que cruza el borde izquierdo (lado jugador) se elimina sin sumar nada.
- Perder una vida ocurre **solo cuando no queda ninguna pelota en juego** tras salir la última por el lado del jugador: entonces se descuenta una vida y, tras `SERVE_DELAY_MS`, se saca una única pelota nueva desde el centro. Que salgan pelotas por el lado del jugador mientras aún quedan otras en juego no cuesta vida — solo reduce el caos. Perder la última vida dispara `onGameOver`.
- La partida arranca con una sola pelota; el power-up "extra" añade pelotas hasta `MAX_BALLS`. `onBallsChange` reporta el número de pelotas en juego; el `hud-stat` BOLAS solo se muestra con más de una (mismo patrón condicional que COMBO en TETRIS y DISPARO TRIPLE en ASTEROIDES).
- Las cápsulas de power-up aparecen cada `powerupTimerMs` en una posición aleatoria del tercio central de la cancha (fuera de los obstáculos), y se activan cuando cualquier pelota entra en su radio. El intervalo entre apariciones baja por nivel de `POWERUP_SPAWN_MS_BASE` hacia `POWERUP_SPAWN_MS_MIN`.
- Los efectos temporales (`grow`, `shrink`, `fast`, `slow`) duran `POWERUP_EFFECT_MS` y no persisten entre vidas: al perder una vida se limpian todos los efectos y power-ups del campo.
- El nivel sube cada `LEVEL_POINTS` puntos acumulados; cada nivel acelera la paleta de la IA y sube la frecuencia de aparición de power-ups. No hay sets ni objetivo de puntos: el juego es de supervivencia sin fin.
- La IA persigue con su velocidad de nivel la pelota **más cercana a su lado que se acerca a ella** (`vx > 0`); si ninguna se acerca, deriva hacia el centro. Con varias pelotas no puede cubrirlas todas — de ahí que colar puntos sea posible pese a que la IA "solo defiende".
- `dt` se limita (`Math.min(dt, 0.05)`, igual que ASTEROIDES) para que una pestaña en segundo plano no teletransporte las pelotas ni la paleta.
- El motor arranca su propio loop `requestAnimationFrame` al crearse; no hay `start()` separado.
- El motor no toca `window`/`document` fuera de sus propios `keydown`/`keyup`, que remueve en `destroy()`. No lee ni escribe `localStorage`.
- `preventDefault()` solo sobre `ArrowUp` y `ArrowDown`, para que las flechas no hagan scroll de la página.
- Pausa = se salta `update(dt)` pero se sigue llamando a `draw()`, con el frame congelado (incluidas pelotas, power-ups y temporizadores de efecto) bajo el overlay "EN PAUSA"; al reanudar se descarta el `dt` acumulado.
- El HUD dibujado dentro del canvas no existe: puntuación, vidas, nivel y número de bolas viven en el `player-hud`; el estado de los efectos activos se comunica visualmente por el tamaño de las paletas y el color/estela de las pelotas, no por texto en la cancha.
- No hay assets bajo `public/`: paletas, pelotas, obstáculos, cápsulas, muros y línea central se dibujan con rectángulos, círculos y degradados planos en canvas.
- Lo que se guarda en `scores.score` al terminar es el `score` acumulado (pelotas coladas × `POINT_VALUE`), sin bonus adicional de fin de partida.

## Implementation plan

1. **Insertar la fila del catálogo (paso manual del usuario).** Ejecutar el `insert into games` de arriba en el SQL Editor de Supabase.
   _Test:_ `/games` muestra la tarjeta "FRENESÍ" junto a las demás; `/games/frenesi` muestra el detalle con `best = 0`, `plays = 0` y leaderboard vacío; `/games/frenesi/play` todavía renderiza el reproductor mock genérico.
2. **Arte de portada.** Agregar `.cover-frenesi` en `app/globals.css`: fondo negro con `radial-gradient`, línea central punteada, varias pelotas amarillas con brillo, cápsulas verde/magenta y un obstáculo circular central luminoso (`::after`/`::before`), mismo patrón que las demás `.cover-*`.
   _Test:_ la tarjeta en `/games` y el hero de `/games/frenesi` muestran el arte nuevo; ninguna otra `.cover-*` cambia, incluida `.cover-rally`.
3. **Motor, núcleo.** Crear `components/games/frenesi/engine.ts` con: cancha, paletas, una sola pelota, rebote anguloso, muros, obstáculos centrales fijos con reflexión por normal, colar/perder pelota, vidas, saque con retardo, niveles por puntuación, IA que defiende la pelota más cercana, loop `requestAnimationFrame` propio con `dt` acumulado, listeners con `preventDefault` solo sobre `ArrowUp`/`ArrowDown`, y la API `pause`/`resume`/`destroy`/`setKey`/`forceGameOver`. Sin power-ups ni multibola todavía. No se conecta a ningún componente.
   _Test:_ `npm run build` compila sin errores de tipos.
4. **Motor, multibola y power-ups.** Añadir al motor el array de pelotas (hasta `MAX_BALLS`), la regla de perder vida solo cuando no queda ninguna, las cápsulas de power-up con su temporizador de aparición, los cinco efectos (`extra`, `grow`, `shrink`, `fast`, `slow`) con sus temporizadores de duración, la limpieza de efectos al perder una vida, y el callback `onBallsChange`.
   _Test:_ `npm run build` sigue limpio.
5. **Reproductor y rama de ruta.** Crear `components/games/frenesi-player.tsx` siguiendo la estructura de `snake-player.tsx`: HUD con Jugador / Puntuación / Vidas / Nivel y el `hud-stat` condicional BOLAS xN, marco `.crt` con el canvas 800×600 y el overlay "EN PAUSA", `.crt-bottom` con el `title` traducido (`useLanguage` + `localizedGameText`), `<HudMenu>` con PAUSA/FIN/SALIR, `GameOverModal` con `insertScore` de `lib/data/scores.ts`, nombre precargado desde `av_user`. Llamar `setupHiDpiCanvas(canvas, 800, 600)` antes de `createFrenesiGame`. Agregar `.frenesi-canvas` en `app/globals.css` y la línea `if (game.id === "frenesi") return <FrenesiPlayer game={game} />;` en `app/games/[id]/play/page.tsx`.
   _Test manual:_ en `/games/frenesi/play` se juega con ↑/↓; recoger un power-up "extra" añade una pelota y aparece el stat BOLAS; el HUD refleja el estado real del motor; PAUSA congela con el frame visible y REANUDAR continúa sin salto; FIN abre `GameOverModal`; guardar inserta una fila en `scores` con `game_id = 'frenesi'`; el canvas se ve nítido en emulación de 3x.
6. **Mando táctil.** Cablear `<TouchPad>` como hermano de `.crt` dentro de `.crt-stage`, con `dpad` mapeando `up → "ArrowUp"` y `down → "ArrowDown"` (`left`/`right` y `buttonA`/`buttonB` quedan `undefined` → atenuados e inertes, nunca ocultos), `dpadRepeat={false}` (la paleta se mueve de forma continua mientras la celda está presionada), `disabled={paused || over}` y `onKey` sobre `setKey`. Sin CSS táctil por juego.
   _Test manual:_ emular `(pointer: coarse)` — el mando aparece con ↑/↓ activos y el resto atenuado, y mueve la paleta igual que el teclado; con ratón en escritorio no se renderiza; pausar o terminar la partida libera toda tecla mantenida.
7. **Repaso final con Playwright.** Comparar `/games/frenesi/play` contra el resto del sitio (HUD, marco `.crt`, tipografía) en escritorio y móvil, incluido un viewport apaisado y corto. Jugar varios minutos para confirmar que hasta 5 pelotas + power-ups + obstáculos no degradan el framerate ni acumulan memoria. Verificar que las cápsulas, los obstáculos y las pelotas se distinguen entre sí y del `.crt-screen` negro, y calibrar la frecuencia de power-ups y la velocidad de la IA para que el caos sea legible y no injusto.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores en consola en `/games`, `/games/frenesi` y `/games/frenesi/play`.
- [ ] `select * from games_with_stats where id = 'frenesi'` devuelve la fila, y `best`/`plays` se mueven al insertar puntuaciones reales.
- [ ] `/games` muestra la tarjeta "FRENESÍ" con `.cover-frenesi`, sin cambios en las demás tarjetas, incluida "RALLY".
- [ ] `/games/frenesi` muestra cover, tags, descripción, stat-strip y el leaderboard lateral.
- [ ] El canvas rellena el marco `.crt` (4:3) sin deformación ni recorte, en escritorio y en móvil.
- [ ] La paleta del jugador se mueve arriba y abajo mientras se mantienen `ArrowUp`/`ArrowDown`, acotada entre los muros.
- [ ] La partida arranca con una sola pelota; el stat BOLAS xN no se muestra mientras solo haya una.
- [ ] Cada pelota rebota en los muros, en ambas paletas y en los obstáculos centrales fijos, que nunca se destruyen.
- [ ] El ángulo de rebote en la paleta depende del punto de impacto (hasta 60°).
- [ ] Una pelota que cruza el borde derecho suma exactamente 100 puntos y desaparece; una que cruza el izquierdo desaparece sin sumar.
- [ ] Se pierde una vida solo cuando no queda ninguna pelota en juego tras salir la última por el lado del jugador; entonces se saca una pelota nueva desde el centro.
- [ ] El power-up "extra" añade una pelota (hasta 5) y hace aparecer el stat BOLAS xN con el número real de pelotas.
- [ ] El power-up "grow" agranda la paleta del jugador durante unos segundos y luego la devuelve a su tamaño.
- [ ] El power-up "shrink" encoge la paleta de la IA durante unos segundos y luego la devuelve a su tamaño.
- [ ] Los power-ups "fast" y "slow" cambian la velocidad de todas las pelotas durante unos segundos y luego la restauran.
- [ ] Una cápsula de power-up se activa cuando cualquier pelota entra en su radio, no antes.
- [ ] Perder una vida limpia todos los efectos activos y las cápsulas del campo; los efectos no persisten entre vidas.
- [ ] El nivel sube cada 1000 puntos acumulados, acelerando la IA y aumentando la frecuencia de aparición de power-ups.
- [ ] El stat "Vidas" del HUD refleja las vidas reales restantes (arranca en 3), no un valor fijo.
- [ ] Con varias pelotas la IA no puede cubrirlas todas, de modo que colar puntos es posible pese a que solo defiende.
- [ ] Jugar varios minutos con 5 pelotas, power-ups y obstáculos no degrada el framerate ni acumula memoria de forma perceptible.
- [ ] Volver a la pestaña tras dejarla en segundo plano no teletransporta las pelotas ni la paleta.
- [ ] El HUD (Jugador / Puntuación / Vidas / Nivel + BOLAS condicional) refleja el estado real del motor, no valores simulados; no aparece HUD dibujado dentro del canvas.
- [ ] El botón PAUSA congela el juego con el frame visible (pelotas, power-ups y temporizadores incluidos) y el overlay "EN PAUSA"; REANUDAR continúa sin salto.
- [ ] El botón FIN termina la partida inmediatamente con la puntuación alcanzada hasta ese momento.
- [ ] Perder la última vida termina la partida y abre `GameOverModal` con la puntuación final real.
- [ ] Guardar en `GameOverModal` inserta una fila en `scores` con `game_id = 'frenesi'`, visible en `/hall-of-fame`.
- [ ] El nombre precargado en el modal sigue viniendo de `av_user` en `localStorage`.
- [ ] Bajo `(pointer: coarse)` el `<TouchPad>` aparece con las celdas ↑/↓ activas y el resto atenuado pero nunca oculto, y mueve la paleta igual que el teclado; con ratón en escritorio no se renderiza.
- [ ] Pausar o terminar la partida con una celda del mando presionada libera la tecla: ninguna queda trabada.
- [ ] En un viewport táctil estrecho (≤520px) o corto (≤560px) la nav/footer se ocultan y el HUD colapsa a Puntuación·Vidas·Nivel más un menú `≡` (`<HudMenu>`), con el mando cabiendo sin scroll.
- [ ] Las flechas no hacen scroll de la página mientras el juego está montado.
- [ ] El canvas se mantiene nítido en emulación de alta densidad (3x) vía `setupHiDpiCanvas`.
- [ ] Salir de `/games/frenesi/play` detiene el loop: sin errores en consola y sin listeners huérfanos.
- [ ] `npm run build` termina sin errores.

## Decisions

- **Sí:** motor diseñado desde cero, sin puerto de código existente. Igual que su hermana, no hay `game.js` de referencia en `references/started-games/`. Supuesto explícito de esta ejecución.
- **Sí:** `id: 'frenesi'`, distinto del `id: 'rally'` de la hermana. Solo uno de los dos specs se implementará, pero cada versión necesita su propio `id` porque es la clave primaria de `games`, la carpeta del motor (`components/games/frenesi/`) y la clase `.cover-frenesi`. `frenesi` no colisiona con ningún `id` de `implemented-games.md`. Supuesto explícito: el nombre "FRENESÍ" no viene del prompt, que solo pedía "un modo con twist".
- **Sí:** `title: 'FRENESÍ'` con `title_en: 'FRENZY'`, más `short_en`/`long_en` traducidos. La traducción concreta es un **supuesto** de esta ejecución (el agente no pregunta; dejarla en blanco sería un fallback silencioso a español).
- **Sí:** `cat: 'VERSUS'`, `color: 'yellow'` — iguales a los de la hermana RALLY. El eje que separa las dos versiones es la **fidelidad** de la mecánica, no la categoría ni el color; usar los mismos evita fabricar una diferencia visual que no representa una decisión real de catálogo (mismo criterio que CRUCE/ASCENSO). Supuesto explícito.
- **Sí:** reinterpretación como **arena de supervivencia sin fin**, sin estructura de sets. Es el rasgo que define esta versión frente al modo clásico primero-a-N de la hermana, y encaja con "Reinterpretación con su propio twist" del menú de ejes.
- **No:** conservar los sets a 11 puntos de RALLY. Los sets pertenecen a la versión fiel; mezclarlos con multibola y power-ups difuminaría el eje que separa ambos specs.
- **Sí:** hasta 5 pelotas simultáneas, con la vida perdida **solo** cuando no queda ninguna en juego. Que cada pelota colada por el lado del jugador restara una vida haría el caos multibola injustamente letal; así el jugador puede sacrificar pelotas y seguir vivo. `MAX_BALLS = 5` es un **supuesto** de partida, ajustable en el paso 7.
- **Sí:** los cinco power-ups listados (`extra`, `grow`, `shrink`, `fast`, `slow`) se activan al ser tocados por una pelota, no al ser recogidos por la paleta. En una arena multibola la pelota es el agente natural que recorre el campo; obligar a llevar la paleta a la cápsula chocaría con defender. El conjunto de cinco tipos y sus magnitudes son **supuestos** de esta ejecución; el prompt solo enumeraba "power-ups, múltiples pelotas, campo con obstáculos" como ejemplos.
- **No:** power-ups permanentes o que persistan entre vidas. Un efecto permanente rompe el equilibrio a largo plazo en un juego sin fin; los efectos son temporales y se limpian al perder una vida.
- **Sí:** dos o tres obstáculos circulares **fijos** en el centro que desvían las pelotas por reflexión. Aportan el "campo con obstáculos" del prompt sin la complejidad de obstáculos móviles o destructibles, que quedan fuera de alcance. Sus posiciones son un **supuesto** de partida, ajustable en el paso 7.
- **No:** obstáculos móviles o destructibles. Añadirían un motor de colisión dinámica que excede el twist pedido; se reservan para otro spec.
- **Sí:** la IA **solo defiende** (nunca ataca ni recoge power-ups) y persigue la pelota más cercana que se acerca a ella. Con varias pelotas no puede cubrirlas todas, lo que hace posible colar puntos — el modelo de puntuación depende de ello.
- **Sí:** el nivel sube por puntuación acumulada (cada 1000 puntos), no por sets ganados. En un juego sin sets, la puntuación es la única medida de progreso disponible. `LEVEL_POINTS = 1000` es un **supuesto** de partida.
- **Sí:** quinto `hud-stat` condicional **BOLAS xN**, visible solo con más de una pelota. Mismo patrón que COMBO en TETRIS y DISPARO TRIPLE en ASTEROIDES; evita un dato muerto permanente cuando solo hay una pelota.
- **Sí:** mismo esquema de control que la hermana — `ArrowUp`/`ArrowDown`, movimiento continuo, `dpadRepeat={false}`. El eje es la fidelidad de la mecánica, no el input; el control de paleta no cambia entre las dos versiones.
- **Sí:** `title: 'FRENESÍ'` en vez de "Pong" o similar. Mismo criterio de marca que RALLY: la mecánica de paleta y pelota es genérica, pero no se usa el nombre "Pong" (marca viva de Atari).
- **No:** sonido, sprites, segundo jugador humano. No fue pedido y no hay assets; el rival es una IA por coherencia con el esquema de `scores`.

## Risks

| Riesgo                                                                                                                | Mitigación                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cinco pelotas + power-ups + obstáculos pueden degradar el framerate o acumular memoria en partidas largas.            | Arrays de tamaño acotado (`MAX_BALLS`, pocas cápsulas y obstáculos fijos); sin asignaciones por frame en el loop caliente. Verificado en el paso 7 con Playwright.                                                                    |
| El caos multibola puede volverse ilegible o injusto si aparecen demasiados power-ups o la IA es demasiado dura.       | Frecuencia de power-ups y velocidad de la IA son valores de partida, calibrados con prueba manual en el paso 7; criterio de aceptación sobre legibilidad del caos.                                                                    |
| La reflexión de la pelota en los obstáculos circulares puede dejar la pelota atrapada rebotando dentro del obstáculo. | Reposicionar la pelota fuera del radio del obstáculo tras cada reflexión (empujarla al perímetro por la normal), no solo invertir la velocidad. Revisado en el paso 7.                                                                |
| Una pelota rápida atraviesa una paleta u obstáculo por _tunneling_ entre frames (colisión discreta).                  | Acotar `BALL_SPEED_MAX` y detectar el cruce por barrido entre posición previa y nueva, no solo por solape; `dt` limitado a `0.05` s.                                                                                                  |
| La mecánica de rebote en paleta se solapa con ARKANOID, como advirtió `suggested-games.md`.                           | FRENESÍ es una arena multibola de supervivencia contra una IA, no un rompe-ladrillos; el twist (power-ups, obstáculos, sin fin) la aleja aún más de ARKANOID que la versión fiel. Decisión consciente de catálogo que toma el humano. |
| El nombre "Pong" o una estética idéntica a un juego de marca podría leerse como copia.                                | Título genérico ("FRENESÍ"), colores y formas propios; nunca se usa "Pong" en título, textos ni assets.                                                                                                                               |
| Importar `insertScore` desde `lib/data/games.ts` rompe el build con un error engañoso de "Pages Router".              | `frenesi-player.tsx` importa `insertScore` **solo** desde `lib/data/scores.ts`, como los demás reproductores.                                                                                                                         |
| Next.js 16.2.10 no es el Next.js del conocimiento de entrenamiento.                                                   | Antes de los pasos 3 y 5, consultar `node_modules/next/dist/docs/01-app/`, como exige `CLAUDE.md`.                                                                                                                                    |

## Lo que **no** está en este spec

- La versión clásica fiel de sets (`specs/game-jam/05-rally-clasico.md`).
- Sonido y música.
- Modo de dos jugadores humanos (segundo teclado, pantalla partida o red).
- Sprites o imágenes; todo se dibuja con formas planas y degradados en canvas.
- Estructura de sets a un número fijo de puntos.
- Obstáculos móviles o destructibles.
- Power-ups fuera de los cinco listados, o efectos permanentes que persistan entre vidas.
- Tests automatizados y soporte de gamepad físico.

Cada uno de estos, si se implementa, va en su propio spec.
