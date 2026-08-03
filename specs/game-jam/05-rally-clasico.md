# GAME JAM 05 — RALLY

> **Status:** Draft
> **Depends on:** 05-asteroids-game, 06-leaderboard-catalogo-supabase
> **Date:** 2026-07-31
> **Objective:** Diseñar "RALLY" (`id: "rally"`) como versión clásica y fiel del duelo de paletas propuesto en `suggested-games.md`, con una sola pelota, dos paletas (jugador contra IA), rebote anguloso, sets a 11 puntos y tres sets de margen antes del game over.

## Why this spec exists

Este spec es una de dos alternativas del mismo concepto base RALLY — la hermana es `specs/game-jam/06-rally-frenesi.md` ("FRENESÍ"). El eje que las separa es **Fidelidad**: aquí RALLY es un puerto fiel del duelo de paletas clásico (una pelota, dos paletas, sets a un número fijo de puntos, sin añadidos), mientras que en la hermana el mismo esquema de control se reinterpreta como una arena sin fin con multibola, power-ups y obstáculos centrales. **Solo una de las dos se implementará**; el humano elige cuál.

RALLY es la lectura literal de la propuesta registrada en `suggested-games.md` (fila RALLY, 2026-07-29): "un duelo de paleta y pelota contra un rival controlado por IA que mejora su reacción a medida que el marcador sube", resuelto como jugador-contra-máquina con un único entero acumulativo para `scores`, no como un 1v1 entre dos humanos que no tendría leaderboard coherente en este esquema.

El concepto no presenta el conflicto geométrico que sí tuvo TETRIS (spec 07): una cancha de paletas es naturalmente apaisada y llena el canvas lógico 800×600 (4:3) de `.crt-screen` sin deformación ni barras.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (SQL manual): `id: 'rally'`, `title: 'RALLY'`, `cat: 'VERSUS'`, `color: 'yellow'`, `cover: 'cover-rally'`, con traducción al inglés (`title_en`/`short_en`/`long_en`).
- Nueva clase CSS `.cover-rally` en `app/globals.css`: fondo negro con línea central vertical punteada estilo cancha, paleta cian a la izquierda y magenta a la derecha, pelota amarilla con estela/brillo, mismo patrón de pseudo-elementos que las demás `.cover-*`.
- Motor diseñado desde cero en `components/games/rally/engine.ts`: cancha con muros superior e inferior, paleta del jugador (izquierda) y paleta de la IA (derecha), una sola pelota con rebote anguloso hasta 60° según el punto de impacto en la paleta, aceleración de la pelota por golpe dentro del rally, IA con velocidad y precisión que suben por nivel, sets a 11 puntos, 3 vidas (sets perdibles) antes de game over, sin JSX, con la API basada en callbacks del `recipe.md`.
- Wrapper cliente `components/games/rally-player.tsx`: HUD de la plataforma (Jugador / Puntuación / Vidas / Nivel) con el slot "Vidas" reflejando los sets restantes, `<HudMenu>` con `<SkinSelector>` y botones PAUSA/FIN/SALIR, `<TouchPad>` compartido (dpad con ↑/↓ activos, resto atenuado), `GameOverModal` y guardado vía `insertScore` de `lib/data/scores.ts`.
- `app/games/[id]/play/page.tsx`: una rama más — `id === "rally"` renderiza `RallyPlayer`.
- CSS `.rally-canvas` en `app/globals.css` (posicionado absoluto para rellenar `.crt-screen`, como `.asteroids-canvas`). Los controles táctiles no llevan CSS por juego: usan el `<TouchPad>` compartido de spec 12.
- `setupHiDpiCanvas(canvas, 800, 600)` llamado una vez antes de crear el motor, para nitidez en pantallas de alta densidad.

**Out of scope (para otro spec):**

- La versión de arena con power-ups y multibola — vive en `specs/game-jam/06-rally-frenesi.md`, un spec independiente.
- Sonido y música — no fue pedido y no hay assets de audio disponibles.
- Modo de dos jugadores humanos (segundo teclado, pantalla partida o red). El "versus" se resuelve como jugador-contra-IA, única forma con leaderboard coherente en el esquema de `scores`.
- Sprites o imágenes — todo se dibuja con formas planas en canvas; ningún asset bajo `public/`.
- Power-ups, obstáculos, multibola o cualquier añadido ausente del duelo de paletas clásico — pertenecen a la hermana FRENESÍ.
- Regla de "ganar por diferencia de 2" en el set — se decidió explícitamente set plano a 11 (ver Decisions).
- Tests automatizados (unit/e2e) y soporte de gamepad físico.
- Cualquier cambio a ASTEROIDES, TETRIS, ARKANOID, SERPIENTE, CRUCE o a los módulos genéricos sobre `getGames()` (`components/game-card.tsx`, `components/games-browser.tsx`, `app/games/[id]/page.tsx`, `app/hall-of-fame/`, `lib/data/*`).

## Data model

**SQL (manual, en el SQL Editor de Supabase):**

```sql
insert into games (id, title, short, long, cat, cover, color, title_en, short_en, long_en) values
  ('rally', 'RALLY',
   'Duelo de paletas contra una IA que reacciona mejor con cada set que le ganas.',
   'Enfréntate a una IA en un duelo de paleta y pelota: devuelve la pelota angulándola según dónde golpee tu paleta, gana el set llegando a 11 puntos antes que tu rival y sube de nivel para enfrentarte a una IA cada vez más rápida y precisa. Cada punto que anotas suma a tu marcador; perder tres sets termina la partida.',
   'VERSUS', 'cover-rally', 'yellow',
   'RALLY',
   'A paddle duel against an AI that reacts sharper with every set you win.',
   'Face an AI in a paddle-and-ball duel: return the ball angling it by where it strikes your paddle, win the set by reaching 11 points before your rival, and level up to face an ever faster, sharper AI. Every point you score adds to your tally; losing three sets ends the game.');
```

`best` y `plays` no se insertan: los calcula la vista `games_with_stats` desde `scores`.

Nota (de `recipe.md` §2): `color: 'yellow'` sí tiene clase de botón propia en `components/game-card.tsx` (mapea `magenta`/`yellow`), así que la tarjeta se distingue de verdad; no es la deuda visual que sí tiene `green`.

**TypeScript:**

```ts
// components/games/rally/engine.ts — motor diseñado desde cero, sin JSX
export type RallyCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void; // sets restantes (arranca en 3)
  onLevelChange?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
};

export type RallyGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void; // "ArrowUp" | "ArrowDown"
  forceGameOver: () => void;
};

export function createRallyGame(
  canvas: HTMLCanvasElement,
  callbacks: RallyCallbacks,
): RallyGame;
```

El selector de skin lo añade el agente `skin-designer` tras la implementación (regla dura de `/spec-impl-game`): en ese momento el motor gana `RallyOptions { skin?: SkinId }` y `setSkin()`, y el reproductor un `<SkinSelector>` persistido en `av_rally_skin`. No se detalla aquí porque el motor de este spec nace sin skins.

Geometría del canvas (constantes del motor, no configurables):

```ts
const CANVAS_W = 800,
  CANVAS_H = 600; // 4:3, rellena .crt-screen
const WALL = 12; // grosor de los muros superior e inferior
const PADDLE_W = 14,
  PADDLE_H = 90;
const PLAYER_X = 30; // borde izquierdo de la paleta del jugador
const AI_X = CANVAS_W - 30 - PADDLE_W; // 756, borde izquierdo de la paleta IA
const BALL_R = 9;
const NET_DASH = 18; // longitud del guion de la línea central
```

Física y puntuación:

```ts
const BALL_SPEED_START = 360; // px/s al sacar
const BALL_SPEED_HIT_STEP = 18; // +px/s por cada golpe de paleta dentro del rally
const BALL_SPEED_MAX = 720; // techo de velocidad de la pelota
const MAX_BOUNCE_ANGLE = Math.PI / 3; // 60°, mismo criterio de rebote que ARKANOID
const PLAYER_SPEED = 480; // px/s de la paleta del jugador mientras se mantiene la tecla
const SET_TARGET = 11; // primero a 11 puntos gana el set (plano, sin diferencia de 2)
const POINT_VALUE = 100; // a scores.score por cada punto que anota el jugador
const SET_BONUS = 500; // a scores.score por cada set ganado
const START_LIVES = 3; // sets que el jugador puede perder antes del game over
const SERVE_DELAY_MS = 700; // pausa con la pelota en el centro tras cada punto
```

Comportamiento de la IA (escala por nivel; sube 1 nivel por cada set que gana el jugador):

```ts
const AI_SPEED_BASE = 300; // px/s de la paleta IA en el nivel 1
const AI_SPEED_STEP = 26; // +px/s por nivel
const AI_SPEED_MAX = 520;
const AI_DEADZONE_BASE = 46; // margen vertical que la IA no corrige en el nivel 1
const AI_DEADZONE_STEP = 5; // -px por nivel (IA más precisa)
const AI_DEADZONE_MIN = 6; // piso de la zona muerta
```

Estado del juego (clausura interna del motor, no exportado):

```ts
// player: { y: number }   // esquina superior de la paleta, en [WALL, CANVAS_H - WALL - PADDLE_H]
// ai: { y: number }
// ball: { x: number; y: number; vx: number; vy: number; speed: number }
// playerSetScore, aiSetScore: number   // puntos del set en curso, 0..SET_TARGET
// score, lives, level: number
// serveTimerMs: number   // > 0 → la pelota espera en el centro antes del saque
// serveToward: 1 | -1    // dirección del próximo saque (hacia quien concedió el punto)
```

Convenciones:

- El rebote en la paleta es anguloso: `offset = clamp((ballCenterY - paddleCenterY) / (PADDLE_H / 2), -1, 1)`, `angle = offset * MAX_BOUNCE_ANGLE`; la componente horizontal invierte el signo (`vx = ±speed * cos(angle)`) y la vertical es `vy = speed * sin(angle)`. Mismo criterio que ARKANOID (spec 08), reutilizado aquí a propósito.
- La pelota acelera `BALL_SPEED_HIT_STEP` en cada golpe de paleta, con techo `BALL_SPEED_MAX`, y se reinicia a `BALL_SPEED_START` al anotarse un punto.
- La pelota rebota en los muros superior e inferior (invierte `vy`); cruzar el borde izquierdo (`ball.x < 0`) es punto para la IA, cruzar el derecho (`ball.x > CANVAS_W`) es punto para el jugador.
- Un punto del jugador suma `POINT_VALUE` al `score` acumulado y +1 a `playerSetScore`. Un punto de la IA suma +1 a `aiSetScore` y no toca el `score`.
- Cuando el jugador llega a `SET_TARGET`: gana el set, suma `SET_BONUS` al `score`, sube el nivel (IA más rápida y precisa), reinicia los marcadores del set y saca. Cuando la IA llega a `SET_TARGET`: el jugador pierde una vida, se reinician los marcadores del set y se saca; perder la última vida dispara `onGameOver`. El nivel **solo** sube al ganar el jugador un set.
- Tras cada punto la pelota se coloca en el centro y espera `SERVE_DELAY_MS` antes de salir hacia `serveToward` (el lado que concedió el punto), con un ángulo vertical leve aleatorio.
- La IA persigue la `ball.y` con su velocidad de nivel cuando la pelota va hacia ella (`vx > 0`), pero solo corrige si la distancia supera su zona muerta de nivel; cuando la pelota se aleja (`vx < 0`) deriva suavemente hacia el centro de la cancha. La zona muerta encoge por nivel: por eso la IA "reacciona mejor con cada set", tal como pide `suggested-games.md`.
- La paleta del jugador se mueve a `PLAYER_SPEED` mientras `ArrowUp`/`ArrowDown` estén presionadas (movimiento continuo por frame, no salto discreto), acotada a la cancha entre muros.
- `dt` se limita (`Math.min(dt, 0.05)`, igual que ASTEROIDES) para que una pestaña en segundo plano no teletransporte la pelota ni la paleta.
- El motor arranca su propio loop `requestAnimationFrame` al crearse; no hay `start()` separado.
- El motor no toca `window`/`document` fuera de sus propios `keydown`/`keyup`, que remueve en `destroy()`. No lee ni escribe `localStorage`.
- `preventDefault()` solo sobre los dos códigos que consume: `ArrowUp` y `ArrowDown`, para que las flechas no hagan scroll de la página.
- Pausa = se salta `update(dt)` pero se sigue llamando a `draw()`, con el frame congelado bajo el overlay "EN PAUSA"; al reanudar se descarta el `dt` acumulado.
- El HUD dibujado dentro del canvas no existe salvo el **marcador del set en curso** (`playerSetScore`–`aiSetScore`), que sí se pinta en la cancha porque es estado de juego, no de plataforma; puntuación acumulada, vidas y nivel viven solo en el `player-hud`.
- No hay assets bajo `public/`: paletas, pelota, muros y línea central se dibujan con rectángulos y un círculo planos en canvas.
- Lo que se guarda en `scores.score` al terminar es el `score` acumulado (puntos anotados × `POINT_VALUE` + sets ganados × `SET_BONUS`), sin bonus adicional de fin de partida.

## Implementation plan

1. **Insertar la fila del catálogo (paso manual del usuario).** Ejecutar el `insert into games` de arriba en el SQL Editor de Supabase.
   _Test:_ `/games` muestra la tarjeta "RALLY" junto a las demás; `/games/rally` muestra el detalle con `best = 0`, `plays = 0` y leaderboard vacío; `/games/rally/play` todavía renderiza el reproductor mock genérico.
2. **Arte de portada.** Agregar `.cover-rally` en `app/globals.css`: fondo negro con `radial-gradient`, línea central punteada vertical con `repeating-linear-gradient`, paletas cian (izquierda) y magenta (derecha) y una pelota amarilla con brillo (`::after`/`::before`), mismo patrón que las demás `.cover-*`.
   _Test:_ la tarjeta en `/games` y el hero de `/games/rally` muestran el arte nuevo; ninguna otra `.cover-*` cambia.
3. **Motor.** Crear `components/games/rally/engine.ts`: geometría de cancha, paletas, pelota, rebote anguloso, aceleración por golpe, IA con velocidad y zona muerta por nivel, sets a 11, vidas, saque con retardo, marcador del set dibujado en la cancha, loop `requestAnimationFrame` propio con `dt` acumulado, listeners `keydown`/`keyup` con `preventDefault` solo sobre `ArrowUp`/`ArrowDown`, y la API `pause`/`resume`/`destroy`/`setKey`/`forceGameOver`. No se conecta a ningún componente todavía.
   _Test:_ `npm run build` compila sin errores de tipos.
4. **Reproductor y rama de ruta.** Crear `components/games/rally-player.tsx` siguiendo la estructura de `snake-player.tsx`: HUD con Jugador / Puntuación / Vidas / Nivel (Vidas = sets restantes), marco `.crt` con el canvas 800×600 y el overlay "EN PAUSA", `.crt-bottom` con el `title` traducido (`useLanguage` + `localizedGameText`), `<HudMenu>` con las acciones PAUSA/FIN/SALIR, `GameOverModal` con `insertScore` de `lib/data/scores.ts`, nombre precargado desde `av_user`. Llamar `setupHiDpiCanvas(canvas, 800, 600)` justo antes de `createRallyGame`. Agregar `.rally-canvas` en `app/globals.css` y la línea `if (game.id === "rally") return <RallyPlayer game={game} />;` en `app/games/[id]/play/page.tsx`.
   _Test manual:_ en `/games/rally/play` se juega con ↑/↓; la paleta se mueve mientras se mantiene la tecla; el HUD refleja el estado real del motor; PAUSA congela con el frame visible y REANUDAR continúa sin salto; FIN abre `GameOverModal` con la puntuación alcanzada; guardar inserta una fila en `scores` con `game_id = 'rally'`; el canvas se ve nítido en emulación de 3x.
5. **Mando táctil.** Cablear `<TouchPad>` como hermano de `.crt` dentro de `.crt-stage`, con `dpad` mapeando `up → "ArrowUp"` y `down → "ArrowDown"` (`left`/`right` y `buttonA`/`buttonB` quedan `undefined` → atenuados e inertes, nunca ocultos ni rellenos con acciones inventadas), `dpadRepeat={false}` (la paleta se mueve de forma continua mientras la celda está presionada, no por repetición discreta), `disabled={paused || over}` y `onKey={(code, pressed) => gameRef.current?.setKey(code, pressed)}`. Sin CSS táctil por juego: las reglas compartidas de spec 12 ya lo cubren.
   _Test manual:_ emular `(pointer: coarse)` — el mando aparece con ↑/↓ activos y el resto atenuado, y mueve la paleta igual que el teclado; con ratón en escritorio no se renderiza; pausar o terminar la partida libera toda tecla mantenida.
6. **Repaso final con Playwright.** Comparar `/games/rally/play` contra el resto del sitio (HUD, marco `.crt`, tipografía) en viewport de escritorio y móvil, incluido un viewport de móvil apaisado y corto. Verificar que la cancha 800×600 llena el 4:3 sin deformación, que el marcador del set es legible sobre el `.crt-screen` negro con líneas de escaneo, y ajustar la velocidad/zona muerta de la IA para que el nivel 1 sea vencible y el juego suba de dificultad de forma perceptible al ganar sets.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores en consola en `/games`, `/games/rally` y `/games/rally/play`.
- [ ] `select * from games_with_stats where id = 'rally'` devuelve la fila, y `best`/`plays` se mueven al insertar puntuaciones reales.
- [ ] `/games` muestra la tarjeta "RALLY" con `.cover-rally`, sin cambios en las demás tarjetas.
- [ ] `/games/rally` muestra cover, tags, descripción, stat-strip y el leaderboard lateral.
- [ ] El canvas rellena el marco `.crt` (4:3) sin deformación ni recorte, en escritorio y en móvil.
- [ ] La paleta del jugador se mueve arriba y abajo mientras se mantienen `ArrowUp`/`ArrowDown`, acotada entre los muros, sin salirse de la cancha.
- [ ] La pelota rebota en los muros superior e inferior y en ambas paletas.
- [ ] El ángulo de rebote en la paleta depende del punto de impacto: golpear con el borde superior/inferior devuelve la pelota más abierta (hasta 60°) que golpear con el centro.
- [ ] La pelota acelera con cada golpe de paleta dentro de un mismo rally, con un techo de velocidad, y se reinicia a la velocidad de saque tras cada punto.
- [ ] Cuando la pelota cruza el borde derecho, el jugador anota: `Puntuación` sube en 100 y el marcador del set del jugador sube en 1.
- [ ] Cuando la pelota cruza el borde izquierdo, la IA anota: el marcador del set de la IA sube en 1, sin cambiar la `Puntuación`.
- [ ] Tras cada punto la pelota espera en el centro y sale hacia el lado que concedió el punto.
- [ ] Llegar el jugador a 11 puntos gana el set: suma 500 a la `Puntuación`, sube el `Nivel` en 1 y reinicia el marcador del set.
- [ ] Llegar la IA a 11 puntos hace perder una vida (un set), reinicia el marcador del set y no sube el nivel.
- [ ] La IA se mueve visiblemente más rápida y más precisa en niveles altos que en el nivel 1 (zona muerta menor).
- [ ] El nivel 1 es ganable por un jugador humano medio; la dificultad sube de forma perceptible al ganar sets.
- [ ] El stat "Vidas" del HUD refleja los sets restantes reales (arranca en 3), no un valor fijo.
- [ ] El marcador del set en curso se dibuja dentro de la cancha y es legible sobre el fondo negro; la puntuación acumulada, las vidas y el nivel viven solo en el `player-hud`.
- [ ] Volver a la pestaña tras dejarla en segundo plano no teletransporta la pelota ni la paleta.
- [ ] El HUD (Jugador / Puntuación / Vidas / Nivel) refleja el estado real del motor, no valores simulados.
- [ ] El botón PAUSA congela el juego con el frame visible y el overlay "EN PAUSA"; REANUDAR continúa sin salto de la pelota.
- [ ] El botón FIN termina la partida inmediatamente con la puntuación alcanzada hasta ese momento.
- [ ] Perder la última vida termina la partida y abre `GameOverModal` con la puntuación final real.
- [ ] Guardar en `GameOverModal` inserta una fila en `scores` con `game_id = 'rally'`, visible en `/hall-of-fame`.
- [ ] El nombre precargado en el modal sigue viniendo de `av_user` en `localStorage`.
- [ ] Bajo `(pointer: coarse)` el `<TouchPad>` aparece con las celdas ↑/↓ activas y el resto atenuado pero nunca oculto, y mueve la paleta igual que el teclado; con ratón en escritorio no se renderiza.
- [ ] Pausar o terminar la partida con una celda del mando presionada libera la tecla: ninguna queda trabada.
- [ ] En un viewport táctil estrecho (≤520px) o corto (≤560px) la nav/footer se ocultan y el HUD colapsa a Puntuación·Vidas·Nivel más un menú `≡` (`<HudMenu>`), con el mando cabiendo sin scroll.
- [ ] Las flechas no hacen scroll de la página mientras el juego está montado.
- [ ] El canvas se mantiene nítido en emulación de alta densidad (3x) vía `setupHiDpiCanvas`.
- [ ] Salir de `/games/rally/play` detiene el loop: sin errores en consola y sin listeners huérfanos.
- [ ] `npm run build` termina sin errores.

## Decisions

- **Sí:** motor diseñado desde cero, sin puerto de código existente. `suggested-games.md` describe la mecánica en prosa y no hay `game.js` de referencia en `references/started-games/`. Supuesto explícito de esta ejecución.
- **Sí:** `id: 'rally'`, `cat: 'VERSUS'`, `color: 'yellow'`. Tomados literalmente de la fila RALLY en `suggested-games.md`; no son un supuesto de esta ejecución.
- **Sí:** `title: 'RALLY'` idéntico en español e inglés (`title_en: 'RALLY'`), con `short_en`/`long_en` traducidos. "Rally" es un término genérico común a ambos idiomas para un intercambio de golpes; los textos largos sí se traducen. La traducción concreta es un **supuesto** de esta ejecución (el agente no pregunta y este es el único paso antes de nacer el spec; dejarla en blanco significaría un fallback silencioso a español que nadie decidió).
- **Sí:** el rival es una **IA**, no un segundo jugador humano. Es la única forma de tener un único entero acumulativo (`scores.score`) coherente con el leaderboard, tal como razona `suggested-games.md`. Un 1v1 humano no encaja en el esquema de `scores`.
- **Sí:** puntuación = puntos anotados × 100 + sets ganados × 500, guardada como el entero acumulado. Reconcilia la propuesta ("número de puntos anotados") con un formato legible de marcador. `POINT_VALUE`/`SET_BONUS` son **supuestos** de esta ejecución; no vienen del prompt.
- **Sí:** estructura de **sets a 11 puntos con 3 sets perdibles** ("primero-a-N-puntos" del encargo). `suggested-games.md` hablaba de "perder tres rallies"; se reinterpreta "rally" como "set" para dar cuerpo al modo clásico primero-a-N que pide el prompt del encargo, que tiene prioridad. Reconciliación marcada como **supuesto** explícito; `SET_TARGET = 11` y `START_LIVES = 3` no vienen del prompt.
- **No:** set con "ganar por diferencia de 2". Añade estados de deuce/ventaja que alargan el spec sin cambiar la sensación de juego; se deja set plano a 11. Se puede revisitar en un spec aparte.
- **Sí:** el nivel (y con él la dificultad de la IA) sube **solo** al ganar el jugador un set. Premia jugar bien con un reto mayor; si subiera también al perder, un jugador flojo se toparía con una IA imposible sin haber ganado nada.
- **Sí:** rebote anguloso hasta 60° según el punto de impacto, reutilizando el criterio de ARKANOID (spec 08). Es lo que da control sobre la devolución y distingue el juego de un rebote plano.
- **No:** rebote plano (solo invertir `vx`). Dejaría al jugador sin forma de colocar la pelota y haría la IA trivial de programar y de batir.
- **Sí:** la IA "reacciona mejor con cada set" mediante una zona muerta que encoge y una velocidad que sube por nivel, tal como pide `suggested-games.md`. Los valores base (`AI_SPEED_BASE`, `AI_DEADZONE_BASE`, etc.) son **supuestos** de partida, ajustables en el paso 6, no cifras cerradas.
- **Sí:** el marcador del set en curso se dibuja **dentro** de la cancha; la puntuación acumulada, vidas y nivel viven en el `player-hud`. El marcador del set es estado de juego (como la línea de peligro de ASCENSO), no un dato de plataforma, y necesita verse en el sitio donde se juega.
- **Sí:** movimiento continuo de la paleta mientras la tecla está presionada (no salto discreto), con `dpadRepeat={false}` en el `<TouchPad>`. Una paleta se controla como el empuje de ASTEROIDES, no como el salto de CRUCE.
- **Sí:** solo `ArrowUp`/`ArrowDown` como teclas. Consistente con el resto del catálogo, que consume `e.code`, lo mismo que inyecta el `<TouchPad>` vía `setKey`.
- **No:** `KeyW`/`KeyS` como alias. No aporta a un control de dos direcciones y duplica los casos de prueba de teclado.
- **Sí:** `title: 'RALLY'` en vez de "Pong". "Pong" es marca viva de Atari; la mecánica de paleta y pelota es genérica y no apropiable, pero el nombre no se usa. "Rally" es un término genérico sin riesgo de marca.
- **No:** sonido, sprites, segundo jugador humano, power-ups u obstáculos. Lo primero no fue pedido y no hay assets; lo último pertenece a la hermana FRENESÍ y es justo lo que el eje de **Fidelidad** deja fuera de la versión fiel.

## Risks

| Riesgo                                                                                                                      | Mitigación                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La mecánica de rebote en paleta se solapa con ARKANOID, como ya advirtió `suggested-games.md`, y puede sentirse redundante. | RALLY es un duelo contra una IA con marcador de sets y devolución bidireccional, no un rompe-ladrillos de una sola pared; la sensación y el objetivo son distintos. Es una decisión consciente de catálogo que el humano toma al promover este spec. |
| La IA queda imposible de batir o trivial según cómo se afinen velocidad y zona muerta.                                      | `AI_SPEED_*` y `AI_DEADZONE_*` son valores de partida, calibrados con prueba manual en el paso 6; criterio de aceptación explícito de que el nivel 1 sea ganable.                                                                                    |
| La pelota atraviesa la paleta a velocidades altas por _tunneling_ entre frames (colisión discreta).                         | Acotar `BALL_SPEED_MAX`, y detectar el cruce del plano de la paleta dentro del paso de integración (barrido entre posición previa y nueva), no solo por solape.                                                                                      |
| Un `dt` grande al volver de una pestaña en segundo plano teletransporta la pelota más allá de una paleta.                   | `dt` se limita a `0.05` s antes de integrarse, igual que ASTEROIDES; y el acumulador se descarta al reanudar desde pausa. Criterio de aceptación explícito.                                                                                          |
| El nombre "Pong" o una estética idéntica al original de Atari podría leerse como copia de marca.                            | Título genérico ("RALLY"), colores y formas propios; nunca se usa "Pong" en título, textos ni assets. La mecánica en sí no es apropiable.                                                                                                            |
| Importar `insertScore` desde `lib/data/games.ts` rompe el build con un error engañoso de "Pages Router".                    | `rally-player.tsx` importa `insertScore` **solo** desde `lib/data/scores.ts`, como los demás reproductores.                                                                                                                                          |
| Next.js 16.2.10 no es el Next.js del conocimiento de entrenamiento (Client Components, `params`, montaje de `<canvas>`).    | Antes de los pasos 3 y 4, consultar `node_modules/next/dist/docs/01-app/`, como exige `CLAUDE.md`.                                                                                                                                                   |

## Lo que **no** está en este spec

- La versión de arena con power-ups y multibola (`specs/game-jam/06-rally-frenesi.md`).
- Sonido y música.
- Modo de dos jugadores humanos (segundo teclado, pantalla partida o red).
- Sprites o imágenes; todo se dibuja con formas planas en canvas.
- Power-ups, obstáculos centrales o multibola.
- Regla de "ganar por diferencia de 2" en el set.
- Tests automatizados y soporte de gamepad físico.

Cada uno de estos, si se implementa, va en su propio spec.
