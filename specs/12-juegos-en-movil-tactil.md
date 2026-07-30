# SPEC 12 — Juegos jugables en dispositivos móviles táctiles

> **Status:** Approved
> **Depends on:** 05-asteroids-game, 07-tetris-game, 08-arkanoid-game, 09-snake-game
> **Date:** 2026-07-30
> **Objective:** Hacer que los cuatro juegos sean realmente jugables en un teléfono táctil, sustituyendo los cuatro mandos por juego por un mando compartido (cruceta + hasta dos botones), añadiendo un modo de juego inmersivo que oculta el chrome del sitio y adapta el layout a vertical y horizontal, y reparando el control por puntero de ARKANOID.

## Why this spec exists

En escritorio el reproductor se ve bien. En un teléfono real no. La captura que aportó el usuario
(Android, `192.168.50.34:3000`, ASTEROIDES en vertical) muestra el problema: el nav pegajoso, el HUD y
los botones PAUSA/FIN/SALIR ocupan la mitad superior de la pantalla, el canvas queda en una franja
estrecha y el mando táctil cae por debajo del pliegue.

La auditoría del código encontró cinco fallos concretos, no uno:

1. Los cuatro mandos táctiles se muestran con `@media (max-width: 840px)` (`app/globals.css:1462`,
   `:1509`, `:1569`, `:1627`). Un teléfono en **horizontal** mide 844–932px de ancho, así que queda
   **sin controles y sin teclado**. Es el fallo más grave: el juego es literalmente injugable.
2. `.crt-screen` tiene `aspect-ratio: 4 / 3` sin tope de altura (`app/globals.css:1327`). En horizontal
   el marco resulta más alto que el viewport y el área de juego se va fuera de pantalla.
3. No existe `export const viewport` en ninguna parte del proyecto. Sin `viewportFit: "cover"` no hay
   safe areas, y el doble tap sobre la cruceta hace zoom.
4. `.modal-bd` no tiene `overflow-y: auto` (`app/globals.css:1704`). En horizontal el `GameOverModal`
   queda cortado y el botón GUARDAR PUNTUACIÓN es inalcanzable: **no se puede terminar una partida**.
5. ARKANOID perdió el control por puntero en el port. El original
   (`references/started-games/04-arkanoid/game.js:87`) movía la paleta con `mousemove`; el motor actual
   (`components/games/arkanoid/engine.ts`) solo acepta `setKey`, a `PADDLE.speed = 7` px por paso.

Además, `app/globals.css:1421-1631` contiene cuatro bloques CSS de ~45 líneas casi idénticos, con
markup distinto por juego (`.td-pad` + `.td-actions` en tres juegos, `.td-dpad` 3×3 en SERPIENTE) y sin
ninguna clase base compartida. Este spec los unifica antes de que un quinto juego duplique el patrón
una vez más.

## Scope

**In:**

- Componente compartido nuevo `components/games/touch-pad.tsx` (`"use client"`): cruceta configurable
  (celdas 3×3, solo se dibujan las que tienen código) más 0–2 botones de acción declarados por el juego.
  Sustituye a los cuatro bloques `.<id>-touch-controls` actuales.
- Componente compartido nuevo `components/games/hud-menu.tsx` (`"use client"`): envuelve el contenido
  de acciones del HUD. En escritorio se renderiza inline, idéntico a hoy; en modo inmersivo se colapsa
  tras un botón `≡`. Incluye el botón de pantalla completa.
- Helper nuevo `lib/canvas-hidpi.ts` con `setupHiDpiCanvas(canvas, logicalW, logicalH)` para que el
  canvas deje de verse borroso en pantallas de alta densidad.
- Modo de juego inmersivo, solo CSS: en dispositivo táctil y pantalla estrecha o baja, `/play` oculta
  el nav y el footer, reduce el bisel del `.crt`, elimina los márgenes de `.av-player` y pone tope de
  altura a `.crt-screen`.
- Layout horizontal: la cruceta flota sobre el borde izquierdo del canvas y los botones sobre el
  derecho, respetando `env(safe-area-inset-*)`.
- HUD colapsado en inmersivo: una sola fila con `Puntuación · Vidas · Nivel`, y el resto (Jugador,
  SKIN, PAUSA, FIN, SALIR, pantalla completa) dentro del menú `≡`.
- `export const viewport` en `app/games/[id]/play/page.tsx` con `maximumScale: 1`,
  `userScalable: false` y `viewportFit: "cover"`. **Solo en `/play`**, no en el resto del sitio.
- Bloqueo del scroll accidental: `touch-action: none` sobre `.crt-screen` y el mando,
  `overscroll-behavior: none` en el contenedor del reproductor, dentro de la consulta táctil.
- Control por puntero en ARKANOID: nuevo método `setPointerX` en `ArkanoidGame` y arrastre de la paleta
  sobre el canvas en `arkanoid-player.tsx`, conviviendo con las flechas.
- Arreglo de `.modal-bd` (`overflow-y: auto`, `align-items: flex-start`) y de `.modal .input-row`
  (`flex-wrap`) para que el `GameOverModal` sea usable en horizontal.
- Corrección de la repetición automática de TETRIS: hoy `tetris-player.tsx:109-143` aplica el
  auto-repeat a los cinco botones, incluidos ROTAR y SOLTAR; pasa a aplicarse solo a las direcciones.
- Corrección del latch de teclas de ASTEROIDES: hoy el `onKeyDown` del motor ignora las pulsaciones en
  pausa pero la ruta táctil llama a `setKey` directamente, así que PROPULSAR pulsado durante la pausa
  deja la tecla trabada. El mando compartido suelta todas las teclas retenidas al deshabilitarse.
- Eliminación de los cuatro bloques CSS `.<id>-touch-controls` y de la clase muerta `.td-thrust`
  (`asteroids-player.tsx:236` la usa; no existe ninguna regla para ella en `app/globals.css`).
- Actualización de `.claude/skills/add-game/recipe.md` (secciones 4, 6, 7 y 8) para que los juegos
  futuros usen `<TouchPad>` en vez de crear otro bloque `.<id>-touch-controls`.

**Out of scope (para otro spec):**

- Todo lo que no sea `/games/[id]/play`: home, catálogo, detalle, login, salón de la fama y about se
  quedan exactamente como están, incluido su comportamiento responsive actual.
- Vibración háptica (`navigator.vibrate`) al pulsar el mando. Descartado explícitamente.
- `screen.orientation.lock()` y cualquier bloqueo de orientación. Solo funciona en Android sobre
  fullscreen y no en iOS.
- Gestos de swipe sobre el canvas como alternativa a la cruceta. Ya se descartó en el spec 09 y se
  vuelve a descartar aquí.
- PWA, manifest, instalación en pantalla de inicio, modo offline.
- Cambios de mecánica, balance, dificultad o puntuación en cualquiera de los cuatro juegos. Este spec
  es de entrada y layout, no de diseño de juego.
- Rediseño del `.crt` en escritorio. Con ratón, el reproductor debe quedar pixel a pixel como hoy.
- Nuevos juegos, nuevas skins, nuevos sonidos.
- Tests automatizados (unit/e2e) y la instalación de Playwright como dependencia del repositorio.
- Soporte de gamepad físico.
- Traducción del mando o del menú `≡` al inglés: `/play` sigue fijo en español salvo el título del HUD,
  como fijaron los specs 10 y 11.

## Data model

Este spec no toca Supabase. No hay tablas, columnas ni claves de `localStorage` nuevas.

**Mando compartido — `components/games/touch-pad.tsx`:**

> **Corrección post-implementación (2026-07-30), en dos rondas:**
>
> 1. Tras ver los pasos 1–3 en su dispositivo real, el usuario pidió explícitamente **un único mando
>    con geometría idéntica en los cuatro juegos** — cruz de 4 direcciones + 2 botones circulares,
>    siempre dibujados los seis — en vez de que cada juego dibuje solo las celdas que usa. Esto revoca
>    las Decisions que originalmente decían lo contrario (ver más abajo) y sustituye la tabla de este
>    spec. **Esta parte se mantiene.**
> 2. La primera implementación de esa corrección superponía el mando sobre el canvas en **ambas**
>    orientaciones. Al probarlo en su dispositivo real, el usuario reportó que en vertical eso tapa la
>    zona de juego (capturó ARKANOID con la cruz cubriendo la paleta y la bola). Se revierte esa parte:
>    el mando **vuelve a ir debajo del canvas en vertical** (como decía el spec original en los pasos
>    4/6), y solo se superpone sobre el canvas en horizontal bajo, donde no sobra alto. La geometría
>    unificada de la ronda 1 no cambia — solo dónde se coloca.
>
> El resto del spec (viewport, HUD colapsado, bloqueo de scroll, ARKANOID por puntero, canvas HiDPI,
> `GameOverModal`, `recipe.md`) no cambia.

```ts
export type TouchPadButton = {
  code: string; // "Space", "ArrowUp", … el mismo código que inyecta el teclado
  label: string; // "FUEGO"
  ariaLabel: string; // "Disparar"
  repeat?: boolean; // auto-repeat mientras se mantiene; por defecto false
};

export type TouchPadDpad = {
  up?: string;
  down?: string;
  left?: string;
  right?: string;
};

export type TouchPadProps = {
  dpad: TouchPadDpad; // celda sin código: se dibuja atenuada e inerte, no se oculta
  dpadRepeat?: boolean; // repetición en ◀ ▼ ▶; por defecto false. ▲ nunca repite (ver nota)
  buttonA?: TouchPadButton; // círculo grande
  buttonB?: TouchPadButton; // círculo pequeño
  disabled?: boolean; // pausa o game over: atenúa y suelta todo lo retenido
  onKey: (code: string, pressed: boolean) => void;
};

export function TouchPad(props: TouchPadProps): JSX.Element;
```

Nota sobre `▲`: es la acción de rotar/propulsar en los juegos que la usan, nunca un movimiento
discreto, así que nunca auto-repite aunque `dpadRepeat` esté activo para el resto de la cruz. Esto es
lo que exige el criterio de aceptación de TETRIS ("mantener ROTAR gira la pieza una sola vez").

Wiring por juego (única fuente de verdad de qué código emite cada celda fija; una celda sin código
se dibuja atenuada e inerte, con la misma geometría que las demás):

| Juego       | ▲                     | ▼           | ◀ / ▶        | Botón A (grande) | Botón B (pequeño) |
| ----------- | --------------------- | ----------- | ------------ | ---------------- | ----------------- |
| `asteroids` | `ArrowUp` (propulsar) | —           | rotar nave   | `Space` "FUEGO"  | —                 |
| `tetris`    | `ArrowUp` (rotar)     | `ArrowDown` | mover pieza  | `Space` "SOLTAR" | —                 |
| `arkanoid`  | —                     | —           | mover paleta | —                | —                 |
| `snake`     | `ArrowUp`             | `ArrowDown` | girar        | —                | —                 |

`dpadRepeat` es `true` solo en `tetris` (aplica a ◀ ▼ ▶, nunca a ▲). En los demás juegos es `false`.

**Menú del HUD — `components/games/hud-menu.tsx`:**

```ts
export type HudMenuProps = {
  children: React.ReactNode; // el contenido actual de .hud-actions + jugador + selector de skin
};
```

Sin props de estado del juego: el menú es puramente presentacional y CSS decide si se muestra inline
(escritorio) o colapsado tras `≡` (inmersivo). El botón de pantalla completa vive dentro del propio
componente y se oculta si `document.documentElement.requestFullscreen` no existe.

**Canvas de alta densidad — `lib/canvas-hidpi.ts`:**

```ts
export function setupHiDpiCanvas(
  canvas: HTMLCanvasElement,
  logicalW: number, // 800 en los cuatro juegos
  logicalH: number, // 600 en los cuatro juegos
): void;
```

Fija `canvas.width = logicalW * dpr`, `canvas.height = logicalH * dpr` y aplica `ctx.scale(dpr, dpr)`,
de forma que los motores sigan dibujando en coordenadas lógicas 800×600 sin enterarse.

**Nuevo método del motor de ARKANOID:**

```ts
// components/games/arkanoid/engine.ts
export type ArkanoidGame = {
  // … pause, resume, destroy, setKey, forceGameOver, continueLevel,
  //    setSoundEnabled, setSkin — sin cambios
  setPointerX: (logicalX: number | null) => void;
};
```

`logicalX` es el centro deseado de la paleta en coordenadas lógicas del canvas (0–800). `null` devuelve
el control a las flechas. Pulsar `ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD` limpia el objetivo del puntero.

**Breakpoints nuevos** (conviven con los `max-width` existentes, no los sustituyen):

```css
/* 1. mando táctil visible: cualquier dispositivo de puntero grueso */
@media (pointer: coarse) { … }

/* 2. modo inmersivo: teléfono en vertical (estrecho) u horizontal (bajo) */
@media (pointer: coarse) and (max-width: 520px),
       (pointer: coarse) and (max-height: 560px) { … }

/* 3. controles superpuestos sobre el canvas */
@media (pointer: coarse) and (orientation: landscape) and (max-height: 560px) { … }
```

Comprobación de los umbrales elegidos:

| Dispositivo          | Viewport   | Mando | Inmersivo  | Superpuesto |
| -------------------- | ---------- | ----- | ---------- | ----------- |
| Teléfono vertical    | 412 × 915  | sí    | sí (ancho) | no          |
| Teléfono horizontal  | 915 × 412  | sí    | sí (alto)  | sí          |
| Tablet vertical      | 820 × 1180 | sí    | no         | no          |
| Tablet horizontal    | 1180 × 820 | sí    | no         | no          |
| Escritorio con ratón | cualquiera | no    | no         | no          |

**Convenciones:**

- El mando compartido no conoce ningún motor: solo emite `onKey(code, pressed)` con los mismos códigos
  que inyecta el teclado, igual que hacen hoy los cuatro bloques por juego.
- Cada botón y cada dirección usa `onPointerDown`, `onPointerUp`, `onPointerLeave` **y**
  `onPointerCancel`, los cuatro, como exige `.claude/skills/add-game/recipe.md`.
- Cuando `disabled` pasa de `false` a `true`, el mando emite `onKey(code, false)` por cada código que
  tuviera retenido y cancela cualquier temporizador de repetición.
- El nav y el footer se ocultan con `body:has(.av-player)` dentro de la consulta inmersiva. Es CSS puro:
  no hace falta un layout anidado en `/play` ni estado en React.
- El mapeo de puntero a coordenadas lógicas en ARKANOID usa `getBoundingClientRect()`, así que es
  independiente del `devicePixelRatio` y del escalado CSS del canvas.
- La detección de fullscreen es por característica, nunca por user agent.

## Implementation plan

1. **`viewport` en `/play`.** Añadir `export const viewport: Viewport` en
   `app/games/[id]/play/page.tsx` (es un Server Component `async`, así que puede exportarlo). Antes de
   escribirlo, leer
   `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`, como exige
   `CLAUDE.md`.
   _Test manual:_ en `/games/<id>/play` el doble tap ya no hace zoom; en `/games` el pinch-zoom sigue
   funcionando igual que antes.

2. **Mando compartido.** Crear `components/games/touch-pad.tsx` con la API del Data model — cruz de 4
   direcciones + 2 botones circulares, siempre dibujados los seis, celda sin código atenuada e inerte —
   y el bloque CSS único `.touch-pad` en `app/globals.css`, visible bajo `@media (pointer: coarse)`. Sin
   conectar a ningún juego todavía.
   _Test:_ `npm run build` compila sin errores de tipos.

3. **Migrar los cuatro reproductores al mando.** Sustituir los bloques `.asteroids-touch-controls`,
   `.tetris-touch-controls`, `.arkanoid-touch-controls` y `.snake-touch-controls` por `<TouchPad>`
   **fuera del bisel `.crt`, no dentro de él**: envolver `.crt` y `<TouchPad>` en un nuevo contenedor
   `.crt-stage` (solo `position: relative`, sin fondo ni padding propios — puro contexto de
   posicionamiento), de forma que el mando quede como hermano del bisel completo (canvas + `.crt-bottom`
   con el texto "SEÑAL OK…"), no como un hijo suyo. Meterlo dentro de `.crt` lo hace parecer soldado al
   marco decorativo del CRT; como hermano, se lee como una sección de control aparte, debajo del
   aparato. Wiring de `<TouchPad>` según la tabla; borrar los cuatro bloques CSS
   (`app/globals.css:1421-1631`) y la clase muerta `.td-thrust`. Pasar `disabled` cuando el juego está
   en pausa o terminado.
   _Test manual:_ en un viewport táctil los cuatro juegos se controlan igual que antes y el mando se ve
   **idéntico en los cuatro** (misma cruz, mismos dos círculos, solo cambia qué celda está activa), sin
   tapar el canvas y visualmente fuera del bisel oscuro del CRT; mantener SOLTAR en TETRIS ya no repite
   el hard-drop; pulsar PROPULSAR durante la pausa en ASTEROIDES ya no deja la nave acelerando al
   reanudar; con ratón en escritorio no se renderiza ningún mando.

4. **Modo inmersivo.** Añadir la consulta inmersiva: ocultar `.av-nav` y el footer vía
   `body:has(.av-player)`, reducir el bisel de `.crt` de 24px, anular los márgenes de `.av-player` y
   poner `max-height` a `.crt-screen` contra el alto disponible, respetando `env(safe-area-inset-*)`. El
   `max-height` debe descontar el espacio que ocupa el mando (paso 3, en flujo normal debajo del
   canvas) para que ambos quepan sin scroll.
   _Test manual:_ en un teléfono en vertical el canvas y el mando debajo caben en pantalla a la vez,
   sin necesidad de hacer scroll; en una tablet el layout sigue siendo el de escritorio más el mando.

5. **HUD colapsado y menú `≡`.** Crear `components/games/hud-menu.tsx` y envolver con él el contenido
   de `.hud-actions`, el nombre del jugador y el selector de skin en los cuatro reproductores y en
   `components/game-player.tsx`. Añadir dentro el botón de pantalla completa con detección de
   característica.
   _Test manual:_ en escritorio el HUD es idéntico al actual; en inmersivo queda una fila con
   `Puntuación · Vidas · Nivel` y el resto se despliega desde `≡`; el botón de pantalla completa no
   aparece en iOS Safari.

6. **Layout horizontal.** Añadir la consulta de superposición, solo para horizontal bajo
   (`@media (pointer: coarse) and (orientation: landscape) and (max-height: 560px)`): sacar el mando
   del flujo normal, anclar la cruceta al borde izquierdo y los botones al derecho sobre el canvas, con
   `env(safe-area-inset-left)` / `env(safe-area-inset-right)` / `env(safe-area-inset-bottom)` y opacidad
   reducida en reposo. En vertical y en tablet horizontal (donde sí sobra alto) el mando sigue debajo
   del canvas, como en el paso 3 — esta superposición es exclusiva del caso estrecho de horizontal.
   _Test manual:_ girando el teléfono a horizontal, el canvas ocupa toda la pantalla y los controles
   flotan encima sin quedar bajo el notch ni bajo la barra de gestos; volviendo a vertical, el mando
   vuelve a su sitio debajo del canvas sin tapar nada.

7. **Bloqueo de scroll.** Aplicar `touch-action: none` sobre `.crt-screen` y el mando, y
   `overscroll-behavior: none` en el contenedor del reproductor, dentro de la consulta
   `@media (pointer: coarse)`.
   _Test manual:_ arrastrar el dedo sobre el juego no mueve la página ni dispara el pull-to-refresh;
   fuera de `/play` el scroll sigue funcionando con normalidad.

8. **Arrastre de paleta en ARKANOID.** Añadir `setPointerX` al motor (objetivo de puntero que tiene
   prioridad sobre las flechas hasta que se pulse una) y los handlers `onPointerDown`/`onPointerMove`/
   `onPointerUp`/`onPointerCancel` sobre el canvas en `components/games/arkanoid-player.tsx`,
   convirtiendo `clientX` a coordenadas lógicas con `getBoundingClientRect()`.
   _Test manual:_ la paleta sigue el dedo a lo largo de todo el ancho; soltar la deja donde estaba;
   pulsar una flecha recupera el control por teclado; con ratón en escritorio la paleta también sigue
   al cursor, como en el `game.js` original.

9. **Canvas nítido.** Crear `lib/canvas-hidpi.ts` y llamarlo desde los cuatro reproductores justo antes
   de crear el motor. Verificar antes que ningún motor lee `canvas.width` / `canvas.height` como ancho
   lógico (los cuatro usan constantes propias `W`/`H`); si alguno lo hace, se ajusta ese motor en este
   mismo paso.
   _Test manual:_ en una pantalla de densidad 3x el juego se ve nítido; la geometría, la física y las
   colisiones no cambian en ninguno de los cuatro juegos.

10. **`GameOverModal` y `recipe.md`.** Añadir `overflow-y: auto` y `align-items: flex-start` a
    `.modal-bd`, y `flex-wrap: wrap` a `.modal .input-row`. Actualizar las secciones 4, 6, 7 y 8 de
    `.claude/skills/add-game/recipe.md` para que describan `<TouchPad>` y el modo inmersivo en vez del
    patrón `.<id>-touch-controls` con breakpoint de 840px.
    _Test manual:_ en un teléfono en horizontal se puede leer el modal completo, escribir el nombre y
    pulsar GUARDAR PUNTUACIÓN; la fila aparece en `/hall-of-fame`.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores de consola en `/games/asteroids/play`, `/games/tetris/play`,
      `/games/arkanoid/play` y `/games/snake/play`.
- [ ] En un teléfono en horizontal (844–932px de ancho) el mando táctil **aparece**. Hoy no aparece.
- [ ] En un teléfono en vertical, el canvas y el mando (debajo, no superpuesto) caben en pantalla a la
      vez sin scroll, con el nav y el footer ocultos, y el mando no tapa ninguna parte del juego.
- [ ] En un teléfono en horizontal, la cruceta flota sobre el borde izquierdo del canvas y los botones
      sobre el derecho, sin quedar bajo el notch ni bajo la barra de gestos.
- [ ] En una tablet táctil (820×1180 y 1180×820) aparece el mando pero **no** el modo inmersivo: el nav
      y el footer siguen visibles.
- [ ] Con ratón en escritorio no se renderiza ningún mando, y el HUD, el `.crt` y el `.crt-bottom` son
      idénticos a los actuales.
- [ ] El doble tap sobre la cruceta no hace zoom en `/play`, y el pinch-zoom sigue funcionando en
      `/games`.
- [ ] Arrastrar el dedo sobre el canvas no hace scroll de la página ni dispara el pull-to-refresh.
- [ ] Un dedo arrastrado fuera de un botón del mando nunca deja la tecla trabada.
- [ ] Pulsar PAUSA con un botón del mando retenido suelta esa tecla: al reanudar, la nave de ASTEROIDES
      no sigue acelerando sola.
- [ ] Mantener pulsado SOLTAR en TETRIS ejecuta **un solo** hard-drop, no uno cada 100 ms.
- [ ] Mantener pulsado ROTAR en TETRIS gira la pieza una sola vez por pulsación.
- [ ] Mantener pulsada ◀ o ▶ en TETRIS sí repite el desplazamiento, con el mismo retardo de 250 ms e
      intervalo de 100 ms de hoy.
- [ ] En ARKANOID la paleta sigue el dedo a lo largo de todo el ancho del canvas, y pulsar una flecha
      devuelve el control al mando/teclado.
- [ ] En ARKANOID con ratón en escritorio la paleta también sigue al cursor.
- [ ] El mando se ve **idéntico** (misma cruz de 4 direcciones, mismos 2 botones circulares, misma
      posición) en los cuatro juegos. SERPIENTE y ASTEROIDES/TETRIS muestran las 4 direcciones activas;
      ARKANOID muestra solo ◀ ▶ activas y ▲ ▼ atenuadas; los botones sin función en un juego (ambos en
      ARKANOID y SERPIENTE, el B en ASTEROIDES y TETRIS) se ven atenuados pero **nunca se ocultan**.
- [ ] El HUD en modo inmersivo muestra `Puntuación · Vidas · Nivel` en una sola fila, y Jugador, SKIN,
      PAUSA, FIN y SALIR se despliegan desde el botón `≡`.
- [ ] El botón de pantalla completa entra en fullscreen donde la API está soportada, y no se renderiza
      donde no lo está.
- [ ] El `GameOverModal` es legible y scrollable en un teléfono en horizontal, y el botón GUARDAR
      PUNTUACIÓN es alcanzable.
- [ ] Se puede completar una partida entera desde el teléfono en los cuatro juegos: jugar, terminar,
      ver el modal y guardar la puntuación, que aparece en `/hall-of-fame`.
- [ ] En una pantalla de densidad 3x el canvas se ve nítido, y la física y las colisiones de los cuatro
      juegos son idénticas a las de antes del cambio.
- [ ] `app/globals.css` ya no contiene `.asteroids-touch-controls`, `.tetris-touch-controls`,
      `.arkanoid-touch-controls`, `.snake-touch-controls` ni `.td-thrust`.
- [ ] Este spec no añade ninguna clave nueva a `localStorage` ni ninguna columna a Supabase.
- [ ] Salir de `/games/<id>/play` sigue deteniendo el loop: sin errores de consola y sin listeners
      huérfanos.
- [ ] `.claude/skills/add-game/recipe.md` describe `<TouchPad>` y ya no propone crear un bloque
      `.<id>-touch-controls` con breakpoint de 840px.
- [ ] `npm run build` termina sin errores.

## Decisions

- **Yes:** alcance limitado a `/games/[id]/play` y los cuatro juegos. Elegido explícitamente por el
  usuario. El resto del sitio ya colapsa razonablemente y mezclarlo aquí haría el spec inmanejable.
- **Yes:** un único mando compartido en vez de cuatro bloques por juego. Hoy hay cuatro copias de ~45
  líneas de CSS y tres estructuras de markup distintas para el mismo problema; el próximo juego haría
  la quinta.
- **Invertida el 2026-07-30 por el usuario, tras ver los pasos 1–3 implementados:** ~~cada juego
  declara entre 0 y 2 botones de acción y el mando dibuja solo los que existen~~. El usuario vio que
  esto producía un mando de forma distinta por juego (cruceta de 2, 3 o 4 celdas; 0 o 2 botones; verde
  en SERPIENTE, cyan en el resto) y no lo aceptó: quiere **una sola geometría fija** — cruz de 4
  direcciones + 2 botones circulares — igual en los cuatro juegos, tomando como referencia una imagen
  aportada por él (`idea-canvas-controls.png` + una captura de la forma exacta del mando). Pasa a ser
  **Yes:** el mando dibuja siempre las 4 direcciones y los 2 botones; una celda sin código asociado se
  atenúa (opacidad reducida) y queda inerte, en vez de ocultarse o no existir.
- **Invertida junto con la anterior:** ~~**No:** dibujar siempre dos botones y agrisar los no usados~~.
  Es exactamente lo que pidió el usuario al ver el resultado de la decisión anterior: prefiere ruido
  visual atenuado y consistente a una forma que cambia de un juego a otro.
- **No:** rellenar el hueco con PAUSA en los juegos que no usan los dos botones. PAUSA ya vive en el
  menú `≡` y duplicarla en el mando invita a pulsarla sin querer en mitad de la partida.
- **Yes:** `@media (pointer: coarse)` como criterio de visibilidad del mando. **Esto revoca
  conscientemente la decisión del spec 05** (`specs/05-asteroids-game.md:135`), que eligió el
  breakpoint de 840px "en vez de detección real de touch". Aquel criterio dejaba a un teléfono en
  horizontal sin ningún control, que es el fallo más grave que este spec repara.
- **No:** seguir gateando por ancho. Ya se demostró incorrecto en el dispositivo real del usuario.
- **No:** `ontouchstart` o sniffing de user agent. `pointer: coarse` es la consulta estándar para esto
  y no requiere JavaScript.
- **Yes:** el modo inmersivo se activa solo en pantallas estrechas (≤520px) o bajas (≤560px), no en
  cualquier dispositivo táctil. Elegido explícitamente por el usuario: una tablet tiene sitio de sobra
  para el layout normal y ocultarle el nav sería gratuito.
- **Yes:** ocultar nav y footer con CSS (`body:has(.av-player)`) en vez de con un layout anidado o
  estado en React. `/play` no tiene layout propio hoy y añadir uno solo para esto es más maquinaria de
  la necesaria; además, el layout raíz seguiría montando el nav de todas formas.
- **Yes, confirmado el 2026-07-30 tras dos rondas:** controles superpuestos sobre el canvas **solo en
  horizontal bajo**, como decía el spec original. Se intentó ampliar también a vertical el mismo día
  (ver la nota de corrección al principio de este documento), pero el usuario lo probó en su
  dispositivo real y reportó que en vertical la cruz tapaba la paleta y la bola de ARKANOID — no hay
  presión de espacio en vertical que justifique el riesgo de ocultar el juego. Se revierte a la
  posición original: debajo del canvas en vertical, superpuesto solo en horizontal bajo, donde el alto
  disponible sí lo justifica.
- **No:** tres columnas (cruceta | canvas | botones) en horizontal. Nada taparía el juego, pero el
  canvas quedaría notablemente más pequeño.
- **Yes:** HUD colapsado a `Puntuación · Vidas · Nivel` con el resto tras `≡`. Elegido explícitamente
  por el usuario. Son los tres valores que cambian durante la partida; el nombre del jugador y la skin
  no.
- **No:** dibujar vidas y nivel superpuestos en una esquina del canvas. Cada motor tendría que
  aprender a dibujar HUD, y `recipe.md` es explícito en que el HUD de la plataforma es la única fuente
  de verdad.
- **Yes:** modo inmersivo automático por CSS **más** un botón opcional de pantalla completa. Elegido
  explícitamente por el usuario. El CSS funciona igual en todas partes; el botón añade valor donde la
  API existe y desaparece donde no.
- **No:** depender de la Fullscreen API para el modo inmersivo. En iOS Safari no funciona sobre
  elementos arbitrarios, así que el modo se habría roto justo en la mitad del parque de dispositivos.
- **No:** `screen.orientation.lock()`. Solo funciona en Android y exige estar ya en fullscreen; forzar
  la orientación además molesta a quien tiene el teléfono apoyado.
- **Yes:** bloquear zoom y scroll, pero **solo en `/play`** mediante el `viewport` de esa ruta. Elegido
  explícitamente por el usuario. Un juego de acción no quiere pinch-zoom accidental, pero el resto del
  sitio sí debe poder ampliarse.
- **No:** declarar `userScalable: false` en `app/layout.tsx`. Afectaría a las siete rutas e impediría
  ampliar el texto en todo el sitio, que es un problema de accesibilidad real.
- **Yes:** reparar el control por puntero de ARKANOID en este spec. Elegido explícitamente por el
  usuario. Es una regresión del port, no una funcionalidad nueva: el `game.js` original ya lo tenía.
- **No:** compensar subiendo `PADDLE.speed`. Sería cambiar el balance del juego para tapar un fallo de
  entrada, y empeoraría el control con teclado en escritorio.
- **Yes:** el objetivo del puntero tiene prioridad sobre las flechas hasta que se pulse una flecha.
  Evita que la paleta se pelee entre dos fuentes de entrada simultáneas.
- **Yes:** escalado por `devicePixelRatio` mediante un helper compartido que mantiene las coordenadas
  lógicas 800×600. Elegido explícitamente por el usuario. Los motores no se enteran y no hay que tocar
  ninguna constante de física.
- **No:** cambiar las constantes `W`/`H` de cada motor. Sería reescribir cuatro motores para un
  problema de presentación.
- **Yes:** arreglar `.modal-bd` dentro de este spec. Elegido explícitamente por el usuario. Sin ello no
  se puede guardar una puntuación desde un teléfono en horizontal, así que el resto del trabajo se
  quedaría a medias.
- **Yes:** actualizar `recipe.md`. Elegido explícitamente por el usuario. Si no, el próximo `/add-game`
  reintroduce el patrón que este spec acaba de eliminar.
- **No:** vibración háptica. Descartado explícitamente por el usuario. No está soportada en iOS Safari
  y añade una preferencia más que persistir.
- **No:** gestos de swipe sobre el canvas. Se mantiene la decisión del spec 09: la cruceta ya cubre
  toda la entrada direccional y los gestos añaden una capa de detección propia.
- **No:** tocar el reproductor genérico simulado (`components/game-player.tsx`) más allá de envolver su
  HUD con `<HudMenu>`. No tiene canvas ni motor, así que no necesita mando.

## Risks

| Riesgo                                                                                                                                                                                                                                                                      | Mitigación                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@media (pointer: coarse)` revoca el criterio de ancho fijado en `specs/05-asteroids-game.md:135`. Alguien que lea el spec 05 aislado creerá que el comportamiento es un bug.                                                                                               | Queda documentado como revocación consciente en Decisions, y `recipe.md` se actualiza en el paso 10 para que la referencia viva también cambie.                                                                                                                                                               |
| Escalar el canvas por `devicePixelRatio` rompe cualquier motor que lea `canvas.width` como ancho lógico, y el síntoma sería geometría desplazada, no un error de compilación.                                                                                               | El paso 9 empieza verificando los cuatro motores antes de tocar nada; los cuatro usan constantes propias `W`/`H` según la auditoría. Criterio de aceptación explícito sobre física y colisiones sin cambios.                                                                                                  |
| `body:has(.av-player)` depende de `:has()`. En un navegador sin soporte, el nav no se oculta.                                                                                                                                                                               | Degradación visible pero no bloqueante: el juego se sigue pudiendo jugar, solo con menos espacio. No se añade fallback en JavaScript por no meter estado donde el CSS basta.                                                                                                                                  |
| Los controles superpuestos en horizontal pueden tapar elementos del juego (un asteroide, la bola de ARKANOID) justo donde está el dedo. En vertical, un intento previo de superponerlos también tapó la paleta de ARKANOID — confirmado en el dispositivo real del usuario. | En vertical el mando va debajo del canvas (paso 3), no superpuesto, así que no puede tapar nada. En horizontal (paso 6): opacidad reducida en reposo y anclaje a los bordes extremos, donde ningún motor concentra acción; se revisa juego por juego y se ajusta la posición si algún caso resulta injugable. |
| `touch-action: none` mal aplicado puede dejar `/play` sin ningún scroll incluso cuando el contenido no cabe, atrapando al usuario.                                                                                                                                          | Se aplica solo a `.crt-screen` y al mando, nunca al contenedor de página. El modo inmersivo garantiza además que el contenido cabe sin scroll.                                                                                                                                                                |
| Cinco de los diez pasos tocan los cuatro reproductores a la vez, así que una regresión en el patrón compartido rompe los cuatro juegos de golpe.                                                                                                                            | Los pasos 3, 5, 8 y 9 llevan cada uno su test manual sobre los cuatro juegos, y el criterio de aceptación exige que el escritorio quede idéntico a hoy.                                                                                                                                                       |
| El repositorio no tiene Playwright instalado (`package.json` no lo lista) ni ningún test automatizado, así que toda la verificación es manual.                                                                                                                              | Se verifica con Playwright vía MCP en viewports emulados (412×915, 915×412, 820×1180) y en el dispositivo real que el usuario ya tiene apuntando a `192.168.50.34:3000`. Instalarlo como dependencia queda fuera.                                                                                             |
| Next.js 16.2.10 no es el Next.js del conocimiento de entrenamiento, y `viewport` es exactamente una de las APIs que cambiaron.                                                                                                                                              | El paso 1 empieza leyendo `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`, como exige `CLAUDE.md`.                                                                                                                                                                    |

## Lo que **no** está en este spec

- Cualquier ruta que no sea `/games/[id]/play`.
- Vibración háptica.
- Bloqueo de orientación.
- Gestos de swipe.
- PWA, manifest o modo offline.
- Cambios de mecánica, balance o puntuación en cualquier juego.
- Rediseño del `.crt` en escritorio.
- Instalación de Playwright y tests automatizados.
- Soporte de gamepad físico.
- Traducción del mando o del menú `≡` al inglés.

Cada uno de estos, si se implementa, va en su propio spec.
