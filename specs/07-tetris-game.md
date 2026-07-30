# SPEC 07 — Tetris real como nuevo juego "TETRIS"

> **Status:** Implemented
> **Depends on:** 05-asteroids-game, 06-leaderboard-catalogo-supabase
> **Date:** 2026-07-27
> **Objective:** Agregar "TETRIS" (`id: "tetris"`) como segundo juego jugable del catálogo de Arcade Vault, portando el motor real de `C:\Courses\ClaudeCode.FernandoHerrera.2026\03-claude-tetris\game.js` a `components/games/tetris/engine.ts` e integrándolo con el HUD, el marco `.crt` y el guardado de puntuaciones en Supabase ya existentes.

## Why this spec exists

El catálogo real en Supabase arranca deliberadamente con un solo juego (`asteroids`), y el spec 06 dejó escrito que los demás se agregan **uno por uno, a medida que se implementan de verdad**. Este spec agrega el segundo.

El juego de origen es un standalone completo con funcionalidades que la plataforma ya cubre de otra manera: pantalla de inicio, high scores en `localStorage` y formulario de nombre. Portarlo no es copiar el archivo: es quedarse con el motor y dejar que el catálogo, el HUD y `GameOverModal` hagan el resto. Sus dos rasgos propios que **no** tienen equivalente en la plataforma —las 4 skins de bloque y los efectos de sonido— sí se portan enteros.

Además hay un conflicto geométrico real: el tablero de Tetris es 10×20 celdas (canvas 300×600, relación 1:2) y `.crt-screen` es `aspect-ratio: 4 / 3`. Este spec lo resuelve explícitamente.

## Scope

**In:**

- Nueva fila en la tabla `games` de Supabase (SQL manual): `id: 'tetris'`, `title: 'TETRIS'`, `cat: 'PUZZLE'`, `color: 'magenta'`, `cover: 'cover-tetris'`.
- Nueva clase CSS `.cover-tetris` en `app/globals.css`, mismo patrón de pseudo-elementos que las demás `.cover-*`.
- Motor portado a TypeScript en `components/games/tetris/engine.ts`: puerto fiel de `game.js` (7 tetrominós, rotación con kicks, ghost piece, gravedad por nivel, soft/hard drop, limpieza de líneas, combo, Back-to-Back, T-Spin, Perfect Clear y textos flotantes de efecto), sin JSX, con la API basada en callbacks del `recipe.md`.
- Canvas lógico **800×600** (4:3) con el tablero de 300×600 dibujado centrado con offset `(250, 0)`; los laterales sobrantes alojan la pieza SIGUIENTE (derecha) y los textos de efecto (izquierda).
- **Las 4 skins de bloque del original** (`retro`, `neon`, `pastel`, `pixel`) con sus 4 funciones de dibujado y sus 4 paletas, cambiables en vivo desde el reproductor y con **`neon` como predeterminada**.
- **Los 6 efectos de sonido del original** (`clear`, `combo`, `tetris`, `tspin`, `b2b`, `perfect`), sintetizados con Web Audio sin archivos, más un control ON/OFF en el HUD.
- Wrapper cliente `components/games/tetris-player.tsx`: HUD de la plataforma con el slot de "Vidas" convertido en **LÍNEAS** y un quinto `hud-stat` condicional **COMBO xN**, selector de skin y botón SONIDO, botones PAUSA/FIN/SALIR, `GameOverModal` y guardado vía `insertScore`.
- `app/games/[id]/play/page.tsx`: una rama más — `id === "tetris"` renderiza `TetrisPlayer`.
- CSS `.tetris-canvas`, `.tetris-touch-controls` y `.hud-select` en `app/globals.css`, con el breakpoint de 840px ya usado en el resto del sitio.
- Controles táctiles bajo 840px: `.td-pad` con ← ↓ →, `.td-actions` con ROTAR y SOLTAR, con repetición al mantener pulsado.
- Persistencia de las dos preferencias en `localStorage`, bajo el prefijo `av_` del sitio: `av_tetris_skin` y `av_tetris_sound`.

**Out of scope (para otro spec):**

- Música de fondo. Se portan solo los 6 efectos puntuales del original, que no tiene música.
- Sonido en el resto de la plataforma (ASTEROIDES, navegación, UI) y un control de volumen global. Este spec deja el audio contenido en TETRIS.
- El toggle de tema claro/oscuro del standalone (`tetris-theme` y el atributo `data-theme`). No se migra: Arcade Vault tiene un solo tema.
- El sistema de high scores local del standalone: claves `tetris-highscores` y `tetris-records`, pantalla de inicio con el Top 5, botón "Resetear récords" y formulario de nombre. Lo reemplazan `scores` en Supabase y `GameOverModal`.
- Récords adicionales fuera del esquema de `scores` (mejor combo, líneas máximas) — la tabla solo guarda `player_name` y `score`.
- Pieza reservada (hold), cola de varias piezas siguientes, SRS oficial de 4 estados con tabla de kicks, y DAS/ARR configurables. Serían un rediseño del juego, no un puerto.
- Gamepad físico y tests automatizados.
- Cualquier cambio a ASTEROIDES o a los módulos genéricos sobre `getGames()` (`components/game-card.tsx`, `components/games-browser.tsx`, `app/games/[id]/page.tsx`, `app/hall-of-fame/`, `lib/data/*`).

## Data model

**SQL (manual, en el SQL Editor de Supabase):**

```sql
insert into games (id, title, short, long, cat, cover, color) values
  ('tetris', 'TETRIS',
   'Encaja las piezas, completa líneas y sobrevive a la caída.',
   'Siete tetrominós caen sobre un tablero de 10 por 20 celdas que se acelera nivel tras nivel. Rota, desplaza y suelta cada pieza para completar líneas, encadena combos y busca el TETRIS de cuatro líneas, el T-Spin y el Perfect Clear antes de que la pila llegue arriba.',
   'PUZZLE', 'cover-tetris', 'magenta');
```

`best` y `plays` no se insertan: los calcula la vista `games_with_stats` desde `scores`.

**TypeScript:**

```ts
// components/games/tetris/engine.ts — puerto de game.js, sin JSX
export type TetrisSkin = "retro" | "neon" | "pastel" | "pixel";

export const SKIN_LABELS: Record<TetrisSkin, string>; // "Retro" | "Neon" | "Pastel" | "Pixel Art"

export type TetrisCallbacks = {
  onScoreChange?: (score: number) => void;
  onLinesChange?: (lines: number) => void; // ocupa el slot "Vidas" del HUD
  onLevelChange?: (level: number) => void;
  onComboChange?: (combo: number) => void; // <= 1 → el stat COMBO se oculta
  onGameOver?: (finalScore: number) => void;
};

export type TetrisOptions = {
  skin?: TetrisSkin; // por defecto "neon"
  soundEnabled?: boolean; // por defecto true
};

export type TetrisGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void;
  setKey: (code: string, pressed: boolean) => void;
  forceGameOver: () => void;
  setSkin: (skin: TetrisSkin) => void; // aplica en el siguiente frame, sin reiniciar
  setSoundEnabled: (enabled: boolean) => void;
};

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks,
  options?: TetrisOptions,
): TetrisGame;
```

Preferencias persistidas (leídas y escritas por `tetris-player.tsx`, nunca por el motor):

```ts
// localStorage
// "av_tetris_skin"  -> TetrisSkin   (valor inválido o ausente → "neon")
// "av_tetris_sound" -> "on" | "off" (valor inválido o ausente → "on")
```

Geometría del canvas (constantes del motor, no configurables):

```ts
const COLS = 10,
  ROWS = 20,
  BLOCK = 30;
const CANVAS_W = 800,
  CANVAS_H = 600; // 4:3, rellena .crt-screen
const BOARD_X = 250,
  BOARD_Y = 0; // (800 - COLS * BLOCK) / 2
// gutter izquierdo  0–250  → textos de efecto, centrados en x = 125
// gutter derecho  550–800  → etiqueta "SIGUIENTE" + preview 4×4 (120×120)
```

Estado del juego (mismo shape que el original):

```ts
// board: number[][] de 20 filas × 10 columnas, 0 = vacío, 1..7 = tipo de pieza
// current / next: { type: number; shape: number[][]; x: number; y: number }
// score, lines, level, combo, b2bActive, lastMoveWasRotation, floatingTexts
```

Convenciones:

- `PIECES`, `LINE_SCORES` (`[0,100,300,500,800]`), `TSPIN_SCORES` (`[100,200,400,600]`), `PERFECT_CLEAR_SCORES` (`[0,800,1200,1800,2000]`), los kicks de rotación (`[0,-1,1,-2,2]`) y la fórmula de velocidad (`dropInterval = max(100, 1000 - (level-1)*90)`) se conservan **1:1**. No se rebalancea nada.
- El offset `(BOARD_X, BOARD_Y)` existe **solo** en el dibujado. `collide()`, `rotateCW()` y `detectTSpin()` trabajan en celdas y no cambian ni una línea respecto al original.
- Las 4 paletas de `SKINS` y las 4 funciones de dibujado (`drawBlockRetro`, `drawBlockNeon`, `drawBlockPastel`, `drawBlockPixel`, más los auxiliares `shadeColor` y `drawRoundedRectPath`) se portan **1:1**, con sus mismos hexadecimales. La skin activa afecta por igual al tablero, a la pieza actual, al fantasma y al panel SIGUIENTE.
- La rejilla del tablero usaba `getComputedStyle(document.documentElement)` para leer `--grid-line`; en el puerto es una constante del motor, para no depender de variables CSS del sitio.
- Sonido: `beep()`/`playSound()` se portan con las mismas frecuencias, formas de onda y duraciones. El `AudioContext` se crea **de forma perezosa en el primer efecto**, que siempre ocurre después de una pulsación del jugador, así que la política de autoplay del navegador nunca lo bloquea. `destroy()` lo cierra.
- Con `soundEnabled` en `false`, `playSound()` retorna de inmediato y no se crea ningún `AudioContext`.
- `createTetrisGame` arranca el loop inmediatamente; no hay `start()` separado.
- El motor no toca `window`/`document` fuera de sus propios `keydown`/`keyup`, que remueve en `destroy()`. En particular no lee ni escribe `localStorage`: las preferencias entran por `options` y por `setSkin`/`setSoundEnabled`.
- Lo que se guarda en `scores.score` al terminar es el `score` acumulado, sin bonus de final de partida.

## Implementation plan

1. **Insertar la fila del catálogo (paso manual del usuario).** Ejecutar el `insert into games` de arriba en el SQL Editor de Supabase.
   _Test:_ `/games` muestra la tarjeta "TETRIS" junto a "ASTEROIDES"; `/games/tetris` muestra el detalle con `best = 0`, `plays = 0` y leaderboard vacío; `/games/tetris/play` todavía renderiza el reproductor mock genérico.

2. **Arte de portada.** Agregar `.cover-tetris` en `app/globals.css`, junto a las demás `.cover-*`: fondo con degradado magenta oscuro, franja de bloques apilados en la parte inferior con `repeating-linear-gradient`, y una pieza I vertical en cyan cayendo sobre ella vía `::before`.
   _Test:_ la tarjeta en `/games` y el hero de `/games/tetris` muestran el arte nuevo; `.cover-asteroids` no cambia.

3. **Motor, núcleo.** Crear `components/games/tetris/engine.ts` con: creación del tablero, `PIECES`, spawn aleatorio, `collide()`, `rotateCW()` + kicks, gravedad por `dropInterval`, soft drop, hard drop, ghost piece, limpieza de líneas básica (`LINE_SCORES × nivel`), subida de nivel cada 10 líneas, rejilla, preview de SIGUIENTE en el gutter derecho, loop `requestAnimationFrame` propio con `dt` acumulado, listeners `keydown`/`keyup` con `preventDefault` solo sobre `ArrowLeft`/`ArrowRight`/`ArrowDown`/`ArrowUp`/`KeyX`/`Space`, y la API `pause`/`resume`/`destroy`/`setKey`/`forceGameOver`. Los bloques se dibujan por ahora solo con `drawBlockNeon`. No se conecta a ningún componente todavía.
   _Test:_ `npm run build` compila sin errores de tipos.

4. **Motor, las 4 skins.** Portar las 4 paletas de `SKINS` y los 4 dibujantes (`drawBlockRetro`, `drawBlockNeon`, `drawBlockPastel`, `drawBlockPixel`) con sus auxiliares `shadeColor` y `drawRoundedRectPath`, más el despacho por skin activa en `drawBlock` y el método `setSkin(skin)`, que aplica en el siguiente frame sin reiniciar la partida. La skin por defecto es `neon`.
   _Test:_ `npm run build` sigue limpio.

5. **Motor, puntuación avanzada y efectos.** Agregar al motor: contador de combo y su multiplicador, Back-to-Back (+50% sobre la base), `detectTSpin()` con la regla de las 3 esquinas, bonus de Perfect Clear, la cola de textos flotantes (`TETRIS`, `T-SPIN X`, `BACK-TO-BACK`, `COMBO xN`, `PERFECT CLEAR!`) dibujada en el gutter izquierdo con fade, y el flash del tablero alternando la clase `.flash` sobre el canvas.
   _Test:_ `npm run build` sigue limpio.

6. **Motor, sonido.** Portar `ensureAudioCtx()`, `beep()` y `playSound()` con las mismas frecuencias, ondas y duraciones, enganchados a los mismos 6 momentos que el original (`clear`, `combo`, `tetris`, `tspin`, `b2b`, `perfect`), más `setSoundEnabled(enabled)`. El `AudioContext` se crea perezosamente en el primer efecto y se cierra en `destroy()`.
   _Test:_ `npm run build` sigue limpio.

7. **Reproductor y rama de ruta.** Crear `components/games/tetris-player.tsx` siguiendo la estructura de `asteroids-player.tsx`: HUD con Jugador / Puntuación / **LÍNEAS** / Nivel y el `hud-stat` condicional COMBO, marco `.crt` con el canvas 800×600 y el overlay "EN PAUSA", `.crt-bottom`, botones PAUSA/FIN/SALIR, `GameOverModal` con `insertScore` importado de `lib/data/scores.ts`, nombre precargado desde `av_user`. Agregar `.tetris-canvas` (y `.tetris-canvas.flash`) en `app/globals.css` y la línea `if (game.id === "tetris") return <TetrisPlayer game={game} />;` en `app/games/[id]/play/page.tsx`. El componente registra su propio listener de `KeyP` que llama a `togglePause()`.
   _Test manual:_ en `/games/tetris/play` se juega con teclado; el HUD refleja el estado real del motor; PAUSA congela con el frame visible y REANUDAR continúa sin salto; FIN abre `GameOverModal` con la puntuación alcanzada; guardar inserta una fila en `scores` con `game_id = 'tetris'`, visible en `/games/tetris` y en `/hall-of-fame`.

8. **Controles de skin y sonido en el HUD.** Agregar a `hud-actions` un `<select className="hud-select">` con las 4 skins (etiquetas de `SKIN_LABELS`) y un botón `SONIDO ON`/`SONIDO OFF` (`.btn ghost`). Ambos leen su valor inicial de `av_tetris_skin` / `av_tetris_sound` en el `useEffect` de montaje, lo pasan como `options` a `createTetrisGame`, y al cambiar llaman a `setSkin`/`setSoundEnabled` y reescriben la clave. Agregar `.hud-select` a `app/globals.css`, con la tipografía y el borde del resto del HUD.
   _Test manual:_ cambiar de skin repinta tablero, pieza, fantasma y panel SIGUIENTE en el acto, sin perder la partida ni la puntuación; SONIDO OFF silencia los efectos y ON los devuelve; recargar la página conserva ambas preferencias; con SONIDO OFF desde el arranque no se crea ningún `AudioContext`.

9. **Controles táctiles.** Agregar el bloque `.tetris-touch-controls` en el reproductor (`.td-pad` con ←/↓/→ y `.td-actions` con ROTAR y SOLTAR, este último con el acento magenta de `.td-fire`) y su CSS con el `@media (max-width: 840px)`. Cada botón usa `onPointerDown`/`onPointerUp`/`onPointerLeave`/`onPointerCancel` sobre `setKey`. La repetición al mantener pulsado (`ArrowLeft`/`ArrowRight`/`ArrowDown`: 250 ms de retardo y luego cada 100 ms) se implementa en el componente, no en el motor.
   _Test manual:_ bajo 840px los botones mueven, bajan, rotan y sueltan igual que el teclado, y mantener pulsado repite el movimiento; en escritorio no se renderizan.

10. **Repaso final con Playwright.** Comparar `/games/tetris/play` contra el juego original y contra el resto del sitio (HUD, marco `.crt`, tipografía) en viewport de escritorio y móvil, **capturando las 4 skins** para verificar que ninguna queda ilegible sobre el fondo negro del `.crt-screen` ni pelea con las líneas de escaneo. Ajustar escalado del canvas, posición del panel SIGUIENTE, tamaño de los textos de efecto y colocación de los controles.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores en consola en `/games`, `/games/tetris` y `/games/tetris/play`.
- [ ] `select * from games_with_stats where id = 'tetris'` devuelve la fila, y `best`/`plays` se mueven al insertar puntuaciones reales.
- [ ] `/games` muestra la tarjeta "TETRIS" con `.cover-tetris`, sin cambios en la tarjeta "ASTEROIDES".
- [ ] `/games/tetris` muestra cover, tags, descripción, stat-strip y el leaderboard lateral.
- [ ] El canvas rellena el marco `.crt` (4:3) con el tablero centrado, la pieza SIGUIENTE a la derecha y los textos de efecto a la izquierda, sin deformación en escritorio ni en móvil.
- [ ] Al entrar por primera vez la skin activa es **neon**, con las 7 piezas en sus colores y su brillo (`shadowBlur`).
- [ ] El selector del HUD ofrece las 4 skins (Retro, Neon, Pastel, Pixel Art) y cada una dibuja los bloques con el estilo del original: plano con highlight superior, neón con borde y núcleo, redondeado con brillo, y pixel con sombreado diagonal.
- [ ] Cambiar de skin en mitad de una partida repinta tablero, pieza actual, fantasma y panel SIGUIENTE sin reiniciar ni alterar puntuación, líneas o nivel.
- [ ] La skin elegida sobrevive a recargar la página (`av_tetris_skin`).
- [ ] Con el sonido activo suenan los 6 efectos en sus momentos: limpiar líneas, combo, TETRIS, T-Spin, Back-to-Back y Perfect Clear.
- [ ] El botón SONIDO alterna entre ON y OFF, silencia de inmediato y su estado sobrevive a recargar la página (`av_tetris_sound`).
- [ ] Arrancando con el sonido en OFF no se crea ningún `AudioContext` (verificable en el panel de rendimiento o instrumentando el constructor).
- [ ] Salir del reproductor cierra el `AudioContext`: no quedan contextos de audio vivos tras navegar fuera.
- [ ] `ArrowLeft`/`ArrowRight` mueven la pieza; `ArrowUp` y `KeyX` la rotan; una rotación pegada a la pared aplica el kick y nunca atraviesa bloques.
- [ ] `ArrowDown` baja la pieza y suma 1 punto por celda; `Space` la suelta de golpe y suma 2 por celda recorrida.
- [ ] Completar 1/2/3/4 líneas suma `100/300/500/800 × nivel`; con 4 líneas aparece el texto "TETRIS".
- [ ] Cada 10 líneas eliminadas sube el nivel y la caída se acelera según `1000 - (nivel-1)×90`, con mínimo de 100 ms.
- [ ] Dos limpiezas consecutivas muestran el `hud-stat` COMBO xN, que desaparece al colocar una pieza sin limpiar líneas.
- [ ] Un T-Spin válido (rotar una pieza T con 3 de sus 4 esquinas ocupadas) muestra "T-SPIN" y suma su bonus, incluso con 0 líneas.
- [ ] Dos TETRIS o T-Spins consecutivos muestran "BACK-TO-BACK" y suman el 50% extra sobre la base.
- [ ] Vaciar el tablero por completo muestra "PERFECT CLEAR!" y suma su bonus.
- [ ] La pieza fantasma se dibuja con transparencia en la posición donde caería la pieza actual.
- [ ] El HUD (Jugador / Puntuación / Líneas / Nivel) refleja el estado real del motor, no valores simulados.
- [ ] `KeyP` y el botón PAUSA producen exactamente el mismo estado: juego congelado con el frame visible, overlay "EN PAUSA" y etiqueta del botón en "REANUDAR".
- [ ] REANUDAR continúa sin salto brusco de caída.
- [ ] Que la pieza nueva no quepa al entrar termina la partida y abre `GameOverModal` con la puntuación final real.
- [ ] El botón FIN termina la partida inmediatamente con la puntuación alcanzada hasta ese momento.
- [ ] Guardar en `GameOverModal` inserta una fila en `scores` con `game_id = 'tetris'`, visible en `/hall-of-fame`.
- [ ] El nombre precargado en el modal sigue viniendo de `av_user` en `localStorage`.
- [ ] No se crea ninguna clave `tetris-highscores`, `tetris-records`, `tetris-theme` ni `tetris-skin` en `localStorage`: las únicas claves nuevas son `av_tetris_skin` y `av_tetris_sound`.
- [ ] Bajo 840px aparecen los controles táctiles y controlan el juego igual que el teclado, con repetición al mantener pulsado; en escritorio no se renderizan.
- [ ] Salir de `/games/tetris/play` detiene el loop: sin errores en consola y sin listeners huérfanos.
- [ ] `npm run build` termina sin errores.

## Decisions

- **Sí:** canvas lógico 800×600 (4:3) con el tablero de 300×600 dibujado con offset `(250, 0)`. Rellena `.crt-screen` reutilizando el mismo CSS que `.asteroids-canvas` (`inset: 0`), y como toda la lógica trabaja en celdas, la física no cambia. Se descartaron: letterbox del canvas 300×600 (dejaba ~62% del marco en negro), y sobrescribir el `aspect-ratio` del `.crt-screen` solo para este juego (tocaba CSS compartido y dejaba un televisor vertical, inconsistente con el resto del sitio).
- **Sí:** usar los laterales sobrantes del canvas para la pieza SIGUIENTE (derecha) y los textos de efecto (izquierda). En el original la preview era un segundo `<canvas>` de 120×120 y los efectos se dibujaban encima del tablero; aquí el espacio ya está y evita tapar la partida.
- **No:** mover SIGUIENTE al `player-hud` como mini-canvas. El `player-hud` es una tira horizontal de `hud-stat` de una línea; un cuadro de 120×120 la deforma.
- **Sí:** `cat: 'PUZZLE'` y `color: 'magenta'`. `magenta` diferencia la tarjeta de la de ASTEROIDES (cyan) y `components/game-card.tsx` lo mapea a su propia clase de botón, así que la diferencia se nota de verdad. Se descartó `green` porque `game-card.tsx` no lo mapea y cae al estilo cyan por defecto.
- **Sí:** el slot "Vidas" del HUD pasa a mostrar **LÍNEAS**, con el callback `onLinesChange` en lugar de `onLivesChange`. Tetris no tiene vidas y las líneas son el contador que además determina el nivel.
- **No:** dejar "Vidas" fijo en "—" y añadir LÍNEAS como quinto stat. Deja un dato muerto permanente en pantalla.
- **Sí:** COMBO xN como quinto `hud-stat` condicional, visible solo con `combo > 1`. Mismo patrón que "DISPARO TRIPLE" en ASTEROIDES (spec 05) y que el `combo-section` oculto del original.
- **Sí:** portar los 6 efectos de sonido. Decisión explícita del usuario, que revirtió la propuesta inicial de dejarlos fuera: si el juego original suena, la versión de Arcade Vault suena. Son sintetizados con Web Audio, sin archivos, así que no añaden assets ni peticiones de red.
- **Sí:** sonido **activo por defecto**, con un botón SONIDO ON/OFF en el HUD. Encender por defecto es lo que hace el original; el botón existe porque un juego que suena sin poder callarse es hostil, y porque el resto del sitio es mudo y el contraste sorprende.
- **No:** crear el `AudioContext` al montar el reproductor. Los navegadores lo dejan en `suspended` hasta que hay un gesto del usuario; creándolo perezosamente en el primer efecto —que siempre llega después de una pulsación— el problema no existe. Es lo que ya hacía `ensureAudioCtx()`.
- **No:** música de fondo, control de volumen, ni extender el sonido al resto de la plataforma. Este spec deja el audio contenido en TETRIS; generalizarlo es otro spec.
- **Sí:** portar las **4 skins** (`retro`, `neon`, `pastel`, `pixel`) con selector en el HUD y `neon` como predeterminada. Decisión explícita del usuario, que revirtió la propuesta inicial de fijar una sola. `neon` sigue siendo la que encaja con la estética del sitio, así que es lo primero que ve quien entra.
- **Sí:** cambio de skin **en vivo**, sin reiniciar la partida. La skin solo afecta a la función de dibujado del bloque; nada del estado del juego depende de ella, así que forzar un reinicio sería una limitación inventada.
- **Sí:** un `<select>` (`.hud-select`) para la skin, en lugar de un botón que cicle entre las cuatro. Es lo que usaba el original, deja ver las cuatro opciones de golpe y es accesible sin trabajo extra. Un botón cíclico ahorraría CSS pero obliga a tres clics para llegar a la última.
- **Sí:** persistir ambas preferencias en `localStorage` bajo `av_tetris_skin` y `av_tetris_sound`. El original ya persistía la skin (`tetris-skin`); se renombra al prefijo `av_` que usa el resto del sitio (`av_user`) en vez de arrastrar la clave del standalone.
- **No:** que el motor lea o escriba `localStorage`. Las preferencias entran por `options` y por `setSkin`/`setSoundEnabled`; el motor sigue sin tocar el navegador fuera de sus listeners de teclado, como exige el `recipe.md`.
- **Sí:** puerto **1:1** del sistema de puntuación completo: T-Spin con la regla de 3 esquinas, Back-to-Back, Perfect Clear, multiplicador de combo y textos flotantes. Es lo que distingue a este Tetris de uno genérico; mismo criterio que el spec 05 aplicó a ASTEROIDES.
- **No:** recortar a "líneas + combo". Dejaría de ser el mismo juego que se pidió portar.
- **Sí:** el motor **no** gestiona `KeyP`; lo escucha `tetris-player.tsx` y llama a su propio `togglePause()`. La pausa vive como estado de React (overlay "EN PAUSA" y etiqueta del botón); si el motor la alternara por su cuenta, los dos estados se desincronizarían. ASTEROIDES ya sentó el precedente de que la pausa es del reproductor, no del motor.
- **Sí:** repetición al mantener pulsado implementada en el reproductor y **solo** para los botones táctiles. En el teclado el original depende del auto-repeat del sistema operativo; replicarlo en el motor cambiaría la sensación de juego en escritorio respecto al original.
- **No:** implementar DAS/ARR configurables ni el SRS oficial con su tabla de kicks por estado. Sería rediseñar el juego; se conserva el kick simple `[0,-1,1,-2,2]` del original.
- **No:** portar el sistema de récords locales (`tetris-highscores`, `tetris-records`, pantalla de inicio, "Resetear récords", formulario de nombre). El spec 06 decidió que el leaderboard es Supabase y única fuente de verdad; duplicarlo en `localStorage` lo contradice.
- **No:** guardar mejor combo ni líneas máximas. La tabla `scores` solo tiene `player_name` y `score`; ampliar el esquema es un spec aparte.
- **No:** hold piece, cola de varias piezas siguientes, gamepad ni tests automatizados. No están en el original ni fueron pedidos.

## Risks

| Riesgo                                                                                                                                                                 | Mitigación                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El offset de dibujado `(250, 0)` se filtra a la lógica y rompe colisiones, rotaciones o la detección de T-Spin.                                                        | El offset vive únicamente en `draw()`/`drawBlock`. `collide()`, `rotateCW()` y `detectTSpin()` se portan sin tocar y siguen razonando en celdas.                             |
| `Space` y las flechas hacen scroll de la página o pelean con el input de iniciales de `GameOverModal`.                                                                 | Set `CAPTURED_CODES` con `preventDefault` solo sobre los códigos consumidos, activo únicamente mientras el juego está montado y sin modal abierto (patrón del spec 05).      |
| El loop `requestAnimationFrame` sigue vivo tras navegar fuera del reproductor y dibuja sobre un canvas desmontado.                                                     | `destroy()` cancela el rAF y remueve los listeners; se llama siempre desde el cleanup del `useEffect`.                                                                       |
| Un botón táctil queda trabado al arrastrar el dedo fuera, o el timer de repetición sigue corriendo.                                                                    | Liberar con `onPointerUp`, `onPointerLeave` **y** `onPointerCancel`, y limpiar el timer de repetición en los tres.                                                           |
| Importar `insertScore` desde `lib/data/games.ts` rompe el build completo con un error engañoso de "Pages Router".                                                      | Siempre desde `lib/data/scores.ts`, que solo importa `lib/supabase/client.ts`. Trampa ya pagada en el spec 06.                                                               |
| Next.js 16.2.10 difiere de las APIs conocidas por entrenamiento para Client Components, `params` o montaje de `<canvas>`.                                              | Antes del paso 5, revisar la página correspondiente en `node_modules/next/dist/docs/01-app/`, como exige `CLAUDE.md`.                                                        |
| El flash del tablero era una clase CSS aplicada al canvas del standalone; el motor no debería manipular clases del DOM.                                                | Se porta como `.tetris-canvas.flash` en `globals.css`; el motor solo alterna la clase sobre el canvas que ya recibió por parámetro, sin buscar nada en el documento.         |
| `KeyP` escuchado por el reproductor podría dispararse con el modal de fin de partida abierto o mientras se escriben las iniciales.                                     | El listener de `KeyP` se ignora mientras `over` es true, igual que el botón PAUSA queda inactivo en ese estado.                                                              |
| Al bajar de 840px el canvas 4:3 se encoge y el tablero, que ocupa solo 300 de los 800px lógicos, queda demasiado pequeño para jugar.                                   | El paso 10 verifica el tamaño real en móvil con Playwright; si hace falta, se reduce el ancho lógico del canvas (manteniendo 4:3) para que los gutters ocupen menos.         |
| El `AudioContext` queda vivo tras salir del reproductor y se acumula uno por partida; los navegadores limitan cuántos se pueden abrir por pestaña.                     | `destroy()` llama a `audioCtx.close()` además de cancelar el rAF, y el reproductor solo crea un motor por montaje.                                                           |
| Un `beep()` disparado justo mientras se desmonta el componente escribe sobre un contexto ya cerrado y lanza una excepción.                                             | `playSound()` conserva el `try/catch` del original, que ya ignora silenciosamente cualquier fallo de Web Audio.                                                              |
| Las skins `pastel` y `retro` fueron diseñadas contra el fondo claro/oscuro del standalone y pueden quedar apagadas sobre el `.crt-screen` negro con líneas de escaneo. | El paso 10 las captura las cuatro con Playwright. Si alguna queda ilegible se ajusta su contraste en el spec de implementación, dejando constancia de la desviación del 1:1. |
| El `<select>` del HUD hereda estilos del navegador y desentona con la tipografía pixel del resto del `player-hud`.                                                     | `.hud-select` se estila explícitamente con `var(--mono)`, el borde `var(--line)` y el fondo `var(--bg-2)` que ya usan los `hud-stat`.                                        |
| El `<select>` captura el foco y a partir de ahí las flechas manejan la lista de opciones en vez de la pieza.                                                           | Tras un cambio de skin el reproductor devuelve el foco al contenedor del juego con `blur()` sobre el select.                                                                 |

## Lo que **no** está en este spec

- Música de fondo, control de volumen, y sonido en el resto de la plataforma (ASTEROIDES, navegación, UI).
- El toggle de tema claro/oscuro del standalone.
- El sistema de récords locales del standalone (`tetris-highscores`, `tetris-records`, pantalla de inicio, "Resetear récords").
- Estadísticas fuera del esquema de `scores` (mejor combo, líneas máximas).
- Hold piece, cola de varias piezas siguientes, SRS oficial y DAS/ARR configurables.
- Gamepad físico y tests automatizados.
- Cualquier cambio a ASTEROIDES o a los componentes genéricos sobre `getGames()`.

Cada uno de estos, si se implementa, va en su propio spec.
