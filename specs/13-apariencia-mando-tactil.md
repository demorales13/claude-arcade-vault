# SPEC 13 — Apariencia del mando táctil estilo Gamepad MK-II

> **Status:** Implemented
> **Depends on:** 12-juegos-en-movil-tactil
> **Date:** 2026-07-30
> **Objective:** Restilizar visualmente el mando táctil compartido (`components/games/touch-pad.tsx`) para que la cruceta, los botones A/B y su carcasa coincidan con el mockup `references/gamepad-assets/gamepad.html` (paleta cian/magenta, iconos SVG, gema pulsante del hub, carcasa con gradiente y sombra), sin tocar su comportamiento funcional, su wiring por juego ni su posición en el layout que fijó el spec 12.

## Scope

**In:**

- Restilizar `components/games/touch-pad.tsx` y sus clases en `app/globals.css` (`.touch-pad*`) para
  igualar la apariencia de `references/gamepad-assets/gamepad.html`:
  - **Carcasa** (`.touch-pad` en modo normal, es decir fuera de la superposición en horizontal bajo):
    panel con gradiente (`linear-gradient(180deg, #1c1c28, #0c0c14)`), borde cian tenue, `border-radius`,
    sombra exterior con glow cian, borde interior fino y textura de puntos de fondo — igual que `.gp`
    en la referencia. Envuelve juntos la cruceta y los botones A/B, tal como hoy los mantiene en un
    mismo `flex` con `justify-content: space-between`.
  - **Sin carcasa en horizontal bajo**: en la consulta superpuesta
    (`@media (pointer: coarse) and (orientation: landscape) and (max-height: 560px)`), la cruceta y los
    botones se restilizan individualmente pero siguen flotando sueltos en sus esquinas opuestas, sin
    panel envolvente.
  - **Cruceta**: cuatro teclas cuadradas de 50px (grid 156×156px) con iconos de flecha en SVG (en vez
    de los glifos unicode ▲▼◀▶ actuales), sombra de profundidad tipo tecla física, y `drop-shadow` de
    glow cian sobre el SVG al pulsar/activar.
  - **Hub central**: gema romboidal cian con animación de pulso continuo (`pulse-led`, 2s), igual que
    `.dp-hub-gem` de la referencia.
  - **Botones A/B**: círculos de 74px, mismo tamaño para ambos. A fijo en magenta, B fijo en cian
    (por posición, no por juego), con relleno radial, texto en fuente pixel con `text-shadow` de glow
    del color correspondiente, y anillo discontinuo (`ab-ring`) que aparece al pulsar/activar.
  - **Celdas inactivas** (`is-inactive` / `disabled`): conservan el atenuado actual (opacidad ~0.32)
    aplicado sobre el nuevo estilo, sin ocultarse — el criterio del spec 12 no cambia.
  - **Recalcular el presupuesto de alto** que el spec 12 reserva bajo el canvas en modo vertical (hoy
    440px) para que el mando más grande (carcasa + cruceta 156px + botones 74px) siga cabiendo sin
    scroll junto al canvas.
  - **Downscale en pantallas estrechas**: una variante compacta de estas mismas medidas (inspirada en
    el propio `@media (max-width: 620px)` de la referencia) para que la carcasa no desborde en móviles
    angostos, reutilizando los breakpoints ya existentes del spec 12.

**Out (para otro spec o explícitamente descartado):**

- Cualquier cambio al **wiring por juego** (qué código emite cada celda, tabla del spec 12).
- Cualquier cambio de **comportamiento**: auto-repeat, `dpadRepeat`, liberar teclas retenidas al
  deshabilitar, prioridad puntero/teclado en ARKANOID, etc. Este spec es solo apariencia.
- Carcasa en el modo superpuesto de horizontal bajo — decidido explícitamente que no.
- Cambios a `hud-menu.tsx`, al `viewport` de `/play`, al `GameOverModal`, o a cualquier otra pieza del
  spec 12 no relacionada con el aspecto visual del mando.
- Vibración háptica, gestos de swipe o bloqueo de orientación — siguen fuera, como ya fijó el spec 12.
- Cargar fuentes nuevas: `Press Start 2P` y `JetBrains Mono` ya están cargadas vía `next/font/google`
  en `app/layout.tsx`; no se añade el `<link>` a Google Fonts que usa el `gamepad.html` standalone.
- Modificar `references/gamepad-assets/gamepad.html`, `gamepad-neon.png` o su `README.md` — son solo
  referencia visual, de solo lectura para este spec.
- Cambiar el criterio de visibilidad (`@media (pointer: coarse)`) o los breakpoints de inmersivo/
  landscape ya fijados por el spec 12, salvo el recálculo puntual del presupuesto de alto.
- Soporte de gamepad físico, nuevos juegos o nuevas skins.

## Data model

Este spec no introduce ninguna estructura de datos nueva ni cambia la API (`TouchPadProps`, `TouchPadButton`, `TouchPadDpad`) del componente — es un cambio puramente visual sobre JSX/CSS ya existentes (iconos SVG en vez de glifos, clases y variables CSS para la carcasa, el hub y los botones). No toca Supabase ni `localStorage`. Se salta esta sección.

## Implementation plan

1. **SVG de flechas en la cruceta.** En `components/games/touch-pad.tsx`, reemplazar los glifos
   unicode ▲▼◀▶ por los mismos paths SVG triangulares que usa la referencia (rotados según la
   dirección), envueltos en un `<svg class="touch-pad-arm-icon">` por celda. En CSS, añadir
   `filter: drop-shadow(...)` cian sobre el icono cuando la celda está pulsada/activa.
   _Test:_ `npm run build` compila sin errores de tipos; con devtools en modo táctil, las cuatro
   flechas se ven como triángulos SVG en vez de caracteres.

2. **Teclas de la cruceta con profundidad 3D.** Actualizar `.touch-pad-arm` en `app/globals.css`:
   celdas de 50px (grid total 156×156), fondo con gradiente oscuro, `box-shadow` de profundidad
   (sombra base + highlight interior), y estado pulsado que traslada 3px hacia abajo y cambia a
   glow cian (fondo, `box-shadow` y color) — igual que `.dp`/`.dp.on` de la referencia. Se mantienen
   los bordes redondeados por posición que ya existen hoy.
   _Test manual:_ en un viewport táctil emulado, pulsar cada flecha produce el hundimiento + glow
   cian; soltar vuelve al estado de reposo.

3. **Gema del hub.** Añadir `.touch-pad-hub-gem` (rombo vía `clip-path`, cian, con glow) dentro de
   `.touch-pad-hub`, y la animación `@keyframes touch-pad-hub-pulse` (igual que `pulse-led` de la
   referencia: opacidad y escala oscilando cada 2s, continua e independiente del estado del mando).
   _Test manual:_ la gema pulsa de forma continua sin importar si el mando está activo, atenuado o
   deshabilitado.

4. **Botones A/B: color, tamaño y glow.** Igualar `.touch-pad-circle-a` y `.touch-pad-circle-b` a
   74×74px cada uno. A fijo en magenta (`--magenta`), B fijo en cian (`--cyan`) por posición, con
   relleno radial, `text-shadow` de glow del color correspondiente sobre la etiqueta, `box-shadow`
   de profundidad y estado pulsado con `translateY` + glow ampliado. Añadir el anillo discontinuo
   (`border: 1px dashed currentColor`) que aparece al pulsar, igual que `.ab-ring` en la referencia.
   _Test manual:_ en `asteroids`/`tetris` (usan `buttonA`) el círculo A se ve magenta con "FUEGO"/
   "SOLTAR"; el círculo B, sin uso en ningún juego todavía, se ve cian pero atenuado por
   `is-inactive`, del mismo tamaño que A.

5. **Carcasa `.touch-pad-shell`.** Envolver la cruceta y los botones en un contenedor con el estilo
   `.gp` de la referencia (gradiente, borde, radio, sombra exterior con glow, borde interior fino,
   textura de puntos de fondo), visible **solo** en el modo de flujo normal (vertical/tablet, fuera
   de la consulta de horizontal bajo). Dentro de la consulta de horizontal bajo
   (`app/globals.css:1640`) la carcasa se desactiva y la cruceta/botones vuelven a flotar sueltos en
   sus esquinas opuestas, como hoy.
   _Test manual:_ en un teléfono vertical, el mando se ve dentro de un panel con borde y sombra
   brillante; en horizontal bajo, sigue viéndose como piezas sueltas en las esquinas, ya con el
   nuevo estilo de colores/iconos/gema.

6. **Recalcular el presupuesto de alto reservado.** Medir en devtools (412×915) el alto real de la
   nueva carcasa junto al HUD colapsado, y ajustar la constante `440px` de
   `calc(max(240px, (100dvh - 440px)) * 4/3)` (`app/globals.css:1482`) al valor necesario para que
   el canvas y el mando con carcasa sigan cabiendo sin scroll en vertical.
   _Test manual:_ en 412×915 y 390×844 el canvas y el mando caben sin scroll.

7. **Downscale en pantallas estrechas.** Añadir una variante compacta (inspirada en el propio
   `@media (max-width: 620px)` de la referencia) que reduzca la carcasa/cruceta/botones a medidas
   más pequeñas (dpad 144×144, arm 46px, círculo 64px) cuando el ancho disponible sea insuficiente,
   reutilizando el breakpoint ya existente del modo inmersivo (`max-width: 520px`) en vez de crear
   uno nuevo.
   _Test manual:_ en un iPhone SE emulado (375×667) el mando no desborda ni se corta contra los
   bordes de la pantalla.

8. **Verificación final en los cuatro juegos.** Repetir la prueba manual del spec 12 (jugar una
   partida completa, PAUSA no deja teclas trabadas, etc.) en `asteroids`, `tetris`, `arkanoid` y
   `snake`, confirmando que el comportamiento funcional no cambió y solo cambió la apariencia.
   _Test manual:_ los cuatro juegos se controlan igual que antes; visualmente el mando coincide con
   el mockup de referencia en los cuatro.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores de consola en `/games/asteroids/play`, `/games/tetris/play`,
      `/games/arkanoid/play` y `/games/snake/play`.
- [ ] La cruceta usa flechas SVG triangulares (no glifos unicode) en las cuatro direcciones.
- [ ] Cada tecla de la cruceta mide 50×50px y la cuadrícula completa 156×156px, con sombra de
      profundidad en reposo y hundimiento + glow cian al pulsarla/activarla.
- [ ] El hub central muestra una gema romboidal cian que pulsa continuamente (opacidad/escala en
      ciclo de ~2s), sin importar si el mando está activo, atenuado o deshabilitado.
- [ ] Los botones A y B miden 74×74px cada uno; A es magenta y B es cian, en los cuatro juegos, sin
      excepción por wiring.
- [ ] Al pulsar/activar un botón A o B aparece el anillo discontinuo alrededor y el glow del color
      correspondiente se intensifica.
- [ ] En modo de flujo normal (vertical o tablet), la cruceta y los botones aparecen envueltos en un
      panel con gradiente, borde y sombra exterior con glow, con textura de puntos de fondo.
- [ ] En horizontal bajo (`orientation: landscape` y `max-height: 560px`), la cruceta y los botones
      **no** tienen panel envolvente y siguen flotando sueltos en esquinas opuestas, como hoy.
- [ ] En un teléfono en vertical (412×915 y 390×844) el canvas y el mando (con la nueva carcasa)
      caben en pantalla a la vez sin necesidad de scroll.
- [ ] En un viewport estrecho (375×667, iPhone SE) el mando no desborda horizontalmente ni queda
      cortado contra los bordes de la pantalla.
- [ ] Las celdas de la cruceta y los botones sin código asociado (`is-inactive`/`disabled`) se ven
      atenuados (no ocultos), como ya exige el spec 12, con el nuevo estilo aplicado por debajo.
- [ ] El wiring por juego de la tabla del spec 12 (qué código emite cada celda) no cambia en ninguno
      de los cuatro juegos.
- [ ] El comportamiento funcional del mando no cambia: auto-repeat en TETRIS (◀ ▼ ▶ sí, ▲ no),
      liberar teclas retenidas al pausar/deshabilitar, y prioridad puntero/teclado en ARKANOID siguen
      exactamente igual que antes de este spec.
- [ ] Con ratón en escritorio no se renderiza ningún mando (comportamiento sin cambios).
- [ ] Este spec no añade ninguna clave nueva a `localStorage` ni ninguna columna a Supabase, y no
      modifica `TouchPadProps`, `TouchPadButton` ni `TouchPadDpad`.
- [ ] Se puede completar una partida entera desde un teléfono en los cuatro juegos (jugar, terminar,
      guardar puntuación en `/hall-of-fame`), igual que verificaba el spec 12.
- [ ] `references/gamepad-assets/gamepad.html`, `gamepad-neon.png` y su `README.md` quedan sin
      modificar.
- [ ] `npm run build` termina sin errores.

## Decisions

- **Yes:** restilizar cruceta, botones A/B, hub y añadir la carcasa (`.touch-pad-shell`) en modo de
  flujo normal, igualando la referencia `references/gamepad-assets/gamepad.html`. Elegido
  explícitamente por el usuario en vez de restilizar solo cruceta/botones sin carcasa.
- **No:** carcasa en el modo superpuesto de horizontal bajo. Elegido explícitamente por el usuario:
  en ese modo la cruceta y los botones ya flotan sueltos en esquinas opuestas del canvas (decisión
  del spec 12), y un panel partido en dos mitades no tendría sentido visual ni encaje real.
- **Yes:** A magenta / B cian, mismo tamaño (74px) para ambos, igual que la referencia. Revoca la
  jerarquía visual actual (A grande=62px, B pequeño=46px, ambos cian) que reflejaba "botón principal
  vs. botón sin uso". Se prefiere la fidelidad visual a la referencia; el atenuado de `is-inactive`
  sigue comunicando qué botón no tiene función en cada juego.
- **Yes:** sustituir los glifos unicode de la cruceta por SVG, con `drop-shadow` de glow al activarse,
  igual que la referencia. Elegido explícitamente por el usuario.
- **Yes:** añadir la gema pulsante del hub (`pulse-led` equivalente), continua e independiente del
  estado del mando. Elegido explícitamente por el usuario.
- **Yes:** igualar las dimensiones exactas de la referencia (cruceta 156×156px, botones 74px) en vez
  de mantener el tamaño compacto actual. Elegido explícitamente por el usuario, a costa de tener que
  recalcular el presupuesto de alto del spec 12 (paso 6 del plan).
- **Yes:** recalcular la constante `440px` de `app/globals.css:1482` en vez de dejarla fija. Es
  consecuencia directa de la decisión anterior: un mando más grande necesita más alto reservado para
  seguir cabiendo sin scroll en vertical.
- **Yes:** añadir un downscale para pantallas estrechas (inspirado en el propio
  `@media (max-width: 620px)` de la referencia), reutilizando el breakpoint `max-width: 520px` que ya
  usa el modo inmersivo del spec 12, en vez de introducir un breakpoint nuevo. Mantiene una sola
  fuente de verdad para "pantalla estrecha" en el proyecto.
- **No:** cargar la fuente vía `<link>` a Google Fonts como hace el `gamepad.html` standalone.
  `Press Start 2P` y `JetBrains Mono` ya están cargadas en `app/layout.tsx` vía `next/font/google`;
  añadir un segundo origen de fuente sería redundante y rompería el patrón de auto-hosting del
  proyecto.
- **No:** cambiar `TouchPadProps`, el wiring por juego, el criterio de visibilidad
  (`@media (pointer: coarse)`) o cualquier comportamiento (auto-repeat, prioridad puntero/teclado en
  ARKANOID, liberación de teclas al pausar). Este spec es exclusivamente de apariencia; tocar
  cualquiera de esos puntos reabriría decisiones ya cerradas en el spec 12.
- **No:** modificar `references/gamepad-assets/` (el propio `gamepad.html`, la captura o el
  `README.md`). Son la referencia visual de solo lectura para este spec, no artefactos a mantener.

## Risks

| Riesgo                                                                                                                                                                      | Mitigación                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La carcasa y el mando más grande (156px cruceta, 74px botones) rompen el presupuesto de alto sin scroll que el spec 12 afinó en dispositivo real.                           | El paso 6 recalcula la constante `440px` midiendo el alto real en devtools, y el criterio de aceptación exige verificar 412×915 y 390×844 sin scroll antes de cerrar el spec.                |
| El downscale de pantallas estrechas (paso 7) puede solaparse con la consulta inmersiva existente (`max-width: 520px`) y producir un tamaño intermedio no probado.           | Se reutiliza el mismo breakpoint en vez de crear uno nuevo, y el criterio de aceptación incluye una prueba explícita en 375×667.                                                             |
| Fijar A=magenta/B=cian por posición (en vez de por función) puede confundir si en el futuro un juego usa B como botón principal.                                            | Documentado en Decisions como elección consciente de fidelidad visual; el atenuado `is-inactive` sigue indicando qué botón no tiene función, independientemente del color.                   |
| `clip-path` (gema del hub) y `filter: drop-shadow` (iconos SVG) tienen soporte amplio pero no universal en navegadores muy antiguos.                                        | Degradación aceptable: sin esas propiedades el mando pierde brillo decorativo pero sigue siendo completamente funcional (mismos botones, mismo `onKey`). No se añade fallback en JavaScript. |
| Tocar `app/globals.css:1482` (presupuesto de alto) es una línea compartida entre los cuatro juegos; un valor mal calculado rompe el layout vertical de los cuatro a la vez. | El paso 8 repite la verificación manual del spec 12 en los cuatro juegos antes de cerrar el spec.                                                                                            |
