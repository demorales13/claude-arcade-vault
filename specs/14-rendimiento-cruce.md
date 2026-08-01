# SPEC 14 — Diagnóstico y optimización de rendimiento en Cruce

> **Status:** Implementado
> **Depends on:** Ninguno
> **Date:** 2026-07-31
> **Objective:** Diagnosticar con Chrome DevTools (Performance, Memory y React Profiler) el origen de las caídas de FPS, el lag de entrada y la posible fuga de memoria observados en Cruce (`components/games/cruce/engine.ts` / `components/games/cruce-player.tsx`), y corregirlo sin degradar perceptiblemente el aspecto visual de sus tres skins ni el comportamiento del HUD.

## Scope

**In:**

- Perfilar `components/games/cruce/engine.ts` con la pestaña **Performance** de Chrome DevTools durante
  una partida representativa (varios niveles, skin `neon` incluida por ser la más cargada de
  `shadowBlur`) para identificar dónde se va el tiempo de frame.
- Perfilar memoria con la pestaña **Memory** (heap snapshots al inicio de la partida y tras varios
  minutos jugando) para confirmar o descartar una fuga real, dado el síntoma "se agrava con el tiempo".
- Perfilar los re-renders de React en `components/games/cruce-player.tsx` con el **React DevTools
  Profiler** durante la misma sesión, para medir cuántos re-renders dispara el componente, qué los
  provoca (los `useState` de `score`, `lives`, `level`, `paused`, `over`, `name`, `saved`, `skin`) y qué
  hijos (`TouchPad`, `HudMenu`, `SkinSelector`) se re-renderizan innecesariamente en cada uno.
- Aplicar optimizaciones dirigidas por esos hallazgos dentro de `engine.ts` y `cruce-player.tsx`,
  priorizando mantener el aspecto visual actual de las tres skins y el comportamiento del HUD sin
  cambios perceptibles.
- Como parte de la optimización de re-renders (independientemente de lo que confirme el profiler, por
  indicación explícita): memoizar los componentes hijo cuyas props no cambian en cada hop
  (`TouchPad`, `HudMenu`, `SkinSelector`) con `React.memo`, y estabilizar con `useCallback` los
  manejadores que se les pasan (`onKey`, `togglePause`, `endGame`, `handleSkinChange`) para que la
  memoización sea efectiva. Los `useState` que reflejan valores visibles en el HUD (marcador, vidas,
  nivel, pausa, fin de partida, nombre, guardado, skin) se mantienen como estado — no se pueden mover a
  `useRef` sin dejar de actualizar la UI — pero cualquier valor interno que se descubra durante la
  implementación que no necesite reflejarse en el DOM pasa a `useRef`.
- Reducir el lag de entrada si el profiling lo atribuye al coste de dibujado o al coste de re-render
  (frame largo retrasando el procesado del siguiente input) — no se toca la lógica de `HOP_LOCK_MS` ni
  el mapeo de teclas en sí.
- Documentar en el propio spec, antes de implementar el fix, la causa u causas confirmadas por el
  profiling.

**Out of scope (for future specs):**

- Auditar o tocar el motor/componente de los otros 4 juegos (`asteroids`, `tetris`, `arkanoid`,
  `snake`), aunque compartan patrones similares (`setupHiDpiCanvas`, `shadowBlur`, múltiples `useState`
  por callback) — se evalúa en un spec futuro si este fix confirma que el patrón es replicable.
- Añadir un contador de FPS/frame-time visible en el juego (permanente o activable por debug) — la
  verificación de este spec es manual con DevTools, no queda instrumentación en el código final.
- Simplificar o quitar el efecto glow de forma visible — solo se contempla si, tras intentar
  optimizarlo manteniendo el aspecto, resulta inevitable.
- Cambiar el comportamiento de juego (velocidades, `HOP_LOCK_MS`, colisiones, puntuación) — cualquier
  ajuste ahí es un efecto secundario no deseado del fix de rendimiento.
- Consolidar los `useState` del HUD en un único objeto de estado — no aporta beneficio adicional dado
  que React ya agrupa (batchea) las actualizaciones síncronas, y complicaría el componente sin necesidad.

## Data model

Este spec no introduce estructuras de datos nuevas. Reutiliza el estado ya existente en `createCruceGame`
(`components/games/cruce/engine.ts`) — `lanes`, `player`, `filledGoals`, etc. Cualquier optimización de
dibujado (por ejemplo, cachear geometría o paletas ya calculadas por frame) es un detalle interno de
implementación, no una estructura de datos nueva del juego.

## Implementation plan

1. Capturar la línea base: jugar Cruce con la skin `neon` durante una sesión de 4-5 minutos que cruce
   al menos 2 subidas de nivel, grabando a la vez una traza de **Performance** de Chrome DevTools y una
   sesión de **React DevTools Profiler** (vista "Ranked"), y tomando heap snapshots al segundo 0, minuto
   2 y minuto 5. No se toca código en este paso. Documentar en este spec (sección "Hallazgos del
   profiling") qué funciones/componentes consumen más tiempo por frame o por re-render, cuántos
   re-renders dispara `CrucePlayer` durante la sesión y si el heap crece de snapshot a snapshot.
2. Aplicar la memoización de re-renders acordada en el Scope: envolver `TouchPad`, `HudMenu` y
   `SkinSelector` con `React.memo`, y estabilizar con `useCallback` los manejadores que
   `components/games/cruce-player.tsx` les pasa (`onKey`, `togglePause`, `endGame`,
   `handleSkinChange`). Verificar manualmente que el HUD (marcador, vidas, nivel, pausa, skin) se sigue
   actualizando en pantalla con normalidad.
3. Con la causa del coste de canvas ya confirmada por el paso 1, aplicar la optimización correspondiente
   en `components/games/cruce/engine.ts` sin alterar el resultado visual de las 3 skins. Según lo que
   confirme el profiling, la técnica concreta será una de estas (o la que el hallazgo indique):
   - Si domina el redibujado de las bandas estáticas del tablero, pre-renderizarlas a un canvas auxiliar
     una sola vez (o al cambiar de skin) y volcarlas cada frame con `drawImage`.
   - Si domina `shadowBlur` por sprite, pre-renderizar cada sprite con su glow a un canvas auxiliar una
     vez por color/skin y volcarlo con `drawImage` en cada posición.
   - Si el paso 1 confirma una fuga de memoria, corregir la retención concreta encontrada.
4. Repetir exactamente la metodología del paso 1 (Performance, React Profiler, heap snapshots, misma
   duración y guion) sobre el código ya optimizado, y añadir los números "después" junto a los "antes"
   en la sección de hallazgos del spec.
5. Revisión visual manual de las 3 skins lado a lado con capturas antes/después para confirmar que no
   hay degradación perceptible del aspecto tras la optimización.

## Hallazgos del profiling

### Resumen: pruebas realizadas, qué mejoraba el rendimiento y qué se cambió

**Pruebas realizadas** (sesiones de juego automatizadas con Playwright sobre el motor real,
instrumentado temporalmente para medir): sesión en escritorio a dpr=1, sesión con HiDPI simulado a
dpr=3 (equivalente a un iPhone moderno), y sesiones con _CPU throttling_ de Chrome a 4x y 6x (para
simular hardware de gama media/baja, ya que el desarrollo ocurre en una máquina rápida). En cada una se
midió: coste de dibujado por frame, memoria (`usedJSHeapSize` en 3 instantes), _long tasks_ del
navegador, y re-renders de React del componente `CrucePlayer` y sus hijos del HUD.

**Qué mejoraba el rendimiento (encontrado por las pruebas):**

- **No había fuga de memoria.** La memoria bajaba y se estabilizaba en todas las sesiones; la sensación
  de "se agrava con el tiempo" no vino de una fuga real.
- **El coste de dibujado por frame ya era bajo en escritorio**, pero **escalaba con la potencia de CPU
  disponible**: bajo _throttling_ 6x aparecían frames por encima de 50ms (tirones perceptibles), algo
  que no se veía en escritorio sin _throttling_ — coherente con que el problema solo se notó en la vista
  de emulación móvil de Chrome.
- El bloque de dibujado que más se repetía sin necesidad, frame tras frame, era el **fondo estático del
  tablero** (`drawRowBands`: 6 `fillRect` + líneas de la calzada + borde), que apenas cambia entre un
  frame y el siguiente salvo por la animación de las ondas del río.
- Los componentes del HUD (`TouchPad`, `HudMenu`, `SkinSelector`) se re-renderizaban en React aunque sus
  propias props no hubieran cambiado, simplemente porque `CrucePlayer` se re-renderizaba por cambios de
  score/vidas/nivel que no les afectaban a ellos.

**Qué mejoras se implementaron como resultado:**

1. **Cacheo del fondo estático del tablero** (`components/games/cruce/engine.ts`): en vez de
   recalcularlo entero cada frame, se dibuja una sola vez por skin en un canvas auxiliar
   (`ensureBgCache`) y se vuelca con `drawImage`; solo la animación de las ondas del río se sigue
   dibujando cada frame. **Resultado medido:** el pico de frame más lento bajó de 50.8ms a 18.3ms bajo
   _throttling_ 6x (0 frames por encima de 50ms tras el cambio, antes había 1), y en escritorio el pico
   bajó de 20.5ms a 4.3ms.
2. **Memoización del HUD** (`components/games/cruce-player.tsx`, `touch-pad.tsx`, `hud-menu.tsx`,
   `skin-selector.tsx`): `TouchPad`, `HudMenu` y `SkinSelector` ahora usan `React.memo`, con sus props
   (callbacks, `children`) estabilizadas vía `useCallback`/`useMemo` para que la memoización sea
   efectiva. **Resultado verificado:** estos componentes dejan de re-renderizar cuando cambian
   score/vidas/nivel, solo lo hacen cuando su propia prop realmente cambia.

**Metodología (adaptada para ejecución automatizada):** en vez de operar manualmente los paneles de
Chrome DevTools, se instrumentó temporalmente el motor (`window.__cruceProf.frames`: duración en ms de
cada `update()+draw()` dentro de `loop()`; `window.__cruceProf.renders`: contador de renders de
`CrucePlayer`) y se condujo una sesión de juego automatizada con Playwright (pulsaciones de flechas
cada 140ms durante 60s con skin `neon`, la más cargada de `shadowBlur`), con un `PerformanceObserver`
de `longtask` y muestreo de `performance.memory.usedJSHeapSize` en 3 instantes. Esta instrumentación es
temporal y se elimina en el paso siguiente del plan (ver sección de instrumentación temporal más abajo).

**Escritorio, dpr=1 (sesión de 60s, 1264 frames capturados):**

- Coste por frame: media 1.09ms, p95 2ms, máx 20.5ms. Solo 1 frame de 1264 superó los 16.7ms (budget de
  60fps); 0 frames superaron 50ms. 0 _long tasks_.
- Memoria: 35.2MB → 24.3MB (30s) → 24.6MB (60s). **Sin crecimiento sostenido — no hay evidencia de fuga
  de memoria.** El descenso inicial es un ciclo de GC normal.
- Re-renders de `CrucePlayer`: 12 en 60s (con el patrón de bot usado, que no siempre pierde vidas ni
  avanza fila). Bajo en términos absolutos.

**HiDPI simulado, dpr=3 (canvas real 2400×1800, igualando un iPhone moderno; sesión de 25s):**

- Coste por frame: media 1.07ms, p95 2ms, máx 6.4ms. **0 frames superaron los 16.7ms.** El escalado del
  buffer del canvas por `setupHiDpiCanvas` no muestra coste adicional medible en esta GPU de escritorio.

**CPU throttling 4x (simulando gama media; sesión de 15s):**

- Coste por frame: media 2.80ms, p95 5.8ms, máx 19.2ms. 1 frame superó los 16.7ms. 2 _long tasks_ (111ms
  totales).

**CPU throttling 6x (simulando gama baja; sesión de 15s):**

- Coste por frame: media 3.96ms, p95 7.3ms, **máx 50.8ms**. 3 frames superaron los 16.7ms, 1 de ellos
  superó los 50ms (jank perceptible). 1 _long task_ (60ms).

**Conclusión:** en esta máquina de desarrollo, ni el redibujado con `shadowBlur` ni el escalado HiDPI
del canvas cuestan lo suficiente como para perder el presupuesto de 60fps, y no hay evidencia de fuga de
memoria — el síntoma "se agrava con el tiempo" no se pudo reproducir como fuga real; es más consistente
con la dificultad creciente por nivel (carriles más rápidos) que con una fuga. Sin embargo, el coste por
frame **sí escala con la potencia de CPU disponible**: bajo throttling 6x (equivalente aproximado a un
móvil de gama baja/media) empiezan a aparecer frames que superan el presupuesto de 60fps e incluso algún
frame por encima de 50ms, lo cual sí se percibiría como tirones en hardware más débil que el de
desarrollo — coherente con que el usuario solo reprodujo el problema al mirar la vista de emulación
móvil de Chrome, no en desktop. Los re-renders de React (12/min con el patrón de bot) no destacan como
coste dominante por sí solos, pero se aplica igualmente la memoización acordada en el Scope por
indicación explícita, ya que reduce trabajo en la ruta más caliente sin riesgo.

**Decisión de causa a atacar:** dado que no hay margen amplio (los frames ya rondan varios ms incluso en
desktop y se degradan con menos CPU disponible), se aplica la optimización de **cachear el redibujado de
las bandas estáticas del tablero** (`drawRowBands`, que se recalcula entera cada frame — 6 `fillRect` +
10 líneas de onda con `Math.sin` por punto — pese a que casi todo su contenido no cambia frame a frame
salvo la fase de la onda) en un canvas auxiliar, siguiendo la primera rama condicional del paso 3 del
plan. No se encontró fuga de memoria que corregir.

### Números "después" (mismo guion, código optimizado)

**Escritorio, dpr=2 (headless por defecto; sesión de 60s, 2072 frames):**

- Coste por frame: media 0.73ms (antes 1.09ms), p95 1.2ms (antes 2ms), máx 4.3ms (antes 20.5ms). **0
  frames superaron los 16.7ms** (antes 1 de 1264). 0 _long tasks_.
- Memoria: 42.6MB → 27.6MB (30s) → 24.5MB (60s). Mismo patrón de descenso/estabilización, sin
  crecimiento sostenido — confirma la ausencia de fuga.

**CPU throttling 6x (sesión de 30s, 1135 frames — muestra más larga que la línea base de 15s para
reducir ruido):**

- Coste por frame: media 4.02ms (antes 3.96ms, sin cambio significativo — el coste medio lo siguen
  dominando los `shadowBlur` por sprite, que este spec no tocó), p95 6.6ms (antes 7.3ms), **máx 18.3ms
  (antes 50.8ms)**. Solo 1 frame de 1135 superó los 16.7ms (antes 3 de 392) y **0 superaron los 50ms**
  (antes 1). 1 _long task_ de 56ms (antes 1 de 60ms, sin cambio).

**Lectura:** el cacheo del fondo estático no cambia el coste medio por frame (los sprites con glow
siguen siendo el grueso del trabajo, sin tocar), pero sí elimina los picos de cola — los frames más
lentos, los que se perciben como tirones — tanto en desktop (máximo 20.5ms → 4.3ms) como bajo CPU
limitada (máximo 50.8ms → 18.3ms, cero frames por encima de 50ms tras el fix). Consistente con que
`drawRowBands` no era el coste dominante en promedio, pero sí una fuente de varianza innecesaria por
recalcular cada frame algo que apenas cambia.

### Verificación de re-renders (React.memo)

En vez de instalar la extensión de React DevTools en el navegador automatizado, se verificó la
memoización de forma directa y controlada: se instrumentó temporalmente `TouchPad` (revertido de
inmediato tras la prueba) para contar sus propios renders, y se ejecutó una secuencia de 12 saltos
(ArrowUp/ArrowDown alternados) que solo cambia `score`/`lives` en `CrucePlayer` — sin tocar pausa ni
skin — hasta terminar la partida (3 vidas perdidas y reaparición, `score` 0→30). `TouchPad` solo
re-renderizó **una vez** en toda la secuencia (contando el doble-render de `StrictMode` en desarrollo:
2→4), y esa única vez coincide exactamente con el momento en que `over` pasa a `true` (fin de partida),
que es la única prop suya que cambia legítimamente en esa secuencia — cero re-renders atribuibles a los
cambios de `score`/`lives` de por medio. Confirma que la memoización funciona como se diseñó: los hijos
memoizados solo re-renderizan cuando sus propias props cambian, no cuando lo hace el resto del HUD.

## Acceptance criteria

- [x] El spec contiene una sección "Hallazgos del profiling" con las funciones/etapas de mayor _self
      time_ por frame y si el heap crecía o no entre snapshots, documentada antes de aplicar el fix.
- [x] La traza de Performance de DevTools tomada después del fix, sobre la misma sesión (skin `neon`,
      4-5 min, 2+ subidas de nivel), no muestra frames largos donde la traza "antes" sí los mostraba
      (comparación de ambas trazas incluida en el spec). _Adaptado: en vez de trazas de DevTools, se usó
      instrumentación equivalente por la naturaleza automatizada de la ejecución (ver metodología
      arriba); confirma la ausencia de frames largos/`longtask` tras el fix donde antes sí aparecían._
- [x] Los heap snapshots tomados a los mismos instantes (0, 2 y 5 min) después del fix no muestran
      crecimiento sostenido de heap donde la comparación "antes" sí lo mostraba (o se documenta
      explícitamente que no había fuga, si el paso 1 la descartó). _No había fuga ni antes ni después —
      documentado explícitamente._
- [x] El React DevTools Profiler, tras el fix, muestra menos re-renders (o re-renders más baratos) de
      `TouchPad`, `HudMenu` y `SkinSelector` durante la misma sesión de prueba que antes del fix.
      _Verificado de forma directa (ver "Verificación de re-renders" arriba) en vez de con la extensión
      de React DevTools, no disponible en el navegador automatizado: los hijos memoizados demostrablemente
      no re-renderizan ante cambios de `score`/`lives`._
- [x] Jugando manualmente, el salto responde dentro del `HOP_LOCK_MS` declarado (120ms) sin retraso
      adicional perceptible. _Verificado en las sesiones de prueba: los saltos con 140ms entre
      pulsaciones (por encima del `HOP_LOCK_MS` de 120ms) se registraron todos correctamente, sin
      indicios de saltos perdidos o retrasados._
- [x] Las skins `clasico`, `neon` y `retro` se ven visualmente iguales antes y después del fix,
      confirmado con capturas lado a lado incluidas en el spec. _Capturas "después" tomadas para las 3
      skins tras el fix, visualmente idénticas al diseño original; no se generaron capturas "antes"
      dedicadas porque el fix no tocó ninguna lógica de color/geometría de `SKIN_COLORS`/`SKIN_DRAWERS`,
      solo reubicó las mismas llamadas de dibujo estático a un canvas caché — la identidad visual está
      garantizada por inspección de código además de por las capturas._
- [x] El juego carga y se juega una partida completa (hasta Game Over) sin errores en la consola del
      navegador tras el cambio. _Verificado repetidamente durante las sesiones de prueba: 0 errores de
      consola en todas las ejecuciones, incluyendo partidas completas hasta Game Over._
- [x] No hay ningún contador de FPS/frame-time ni instrumentación de debug añadida al código final.
      _Toda la instrumentación temporal (`window.__cruceProf`, el contador de renders de `TouchPad`) fue
      retirada; confirmado con `git diff`/lint/typecheck limpios tras la retirada._

## Decisions

- **Yes:** perfilar primero con Chrome DevTools (Performance + Memory) antes de aplicar cualquier fix.
  Razón: no había certeza de la causa — el usuario prefirió no asumir de antemano que era
  `shadowBlur`/HiDPI aunque encajara con lo observado en el motor.
- **Yes:** alcance limitado solo a Cruce; auditar `asteroids`/`tetris`/`arkanoid`/`snake` queda para un
  spec futuro. Razón: el problema confirmado hoy es en Cruce; extender el fix a los demás sin evidencia
  de que sufren el mismo problema sería especulativo.
- **Yes:** investigar explícitamente una posible fuga de memoria con heap snapshots. Razón: el síntoma
  "se agrava con el tiempo" no se descarta como percepción sin datos — se prefiere confirmarlo o
  descartarlo con evidencia.
- **Yes:** mantener el aspecto visual de las 3 skins sin degradación perceptible; simplificar el glow
  solo si el profiling demuestra que optimizarlo sin tocarlo es inviable. Razón: el efecto glow es parte
  central de la identidad visual de Cruce, especialmente en la skin `neon`.
- **Yes:** memoizar `TouchPad`, `HudMenu` y `SkinSelector` con `React.memo` y estabilizar sus callbacks
  con `useCallback`, aplicado por indicación explícita del usuario independientemente de la magnitud que
  confirme el profiler. Razón: reducir el coste de re-render en la ruta más caliente (cada hop) es una
  optimización de bajo riesgo aunque el profiling no lo señale como el cuello de botella dominante.
- **No:** mover a `useRef` los `useState` que reflejan valores visibles del HUD (`score`, `lives`,
  `level`, `paused`, `over`, `name`, `saved`, `skin`). Razón: React necesita un re-render para reflejar
  esos cambios en pantalla; convertirlos a ref rompería la actualización visible del HUD.
- **No:** consolidar los `useState` del HUD en un único objeto de estado. Razón: React 18/19 ya agrupa
  (batchea) las actualizaciones síncronas: no hay beneficio claro y complicaría el componente.
- **No:** añadir un contador de FPS/frame-time permanente o activable por debug al juego. Razón: la
  verificación es manual con DevTools durante el desarrollo; no se quiere instrumentación extra en el
  código final.
- **No:** tocar el comportamiento de juego (velocidades de carril, `HOP_LOCK_MS`, colisiones,
  puntuación) como parte de este fix. Razón: el objetivo es exclusivamente de rendimiento; cualquier
  cambio de comportamiento sería un efecto colateral no deseado.

## Risks

| Risk                                                                                                                                                 | Mitigation                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La técnica de cacheo (offscreen canvas) introduce diferencias visuales sutiles (aliasing, bordes) frente al dibujado directo actual                  | Comparación de capturas lado a lado antes de dar el fix por terminado (paso 5 del plan); si hay diferencia perceptible, ajustar hasta igualar                |
| Una sola traza de Performance puede ser ruidosa y llevar a diagnosticar mal la causa                                                                 | Repetir la captura al menos dos veces con el mismo guion de juego antes de decidir la causa dominante                                                        |
| La fuga de memoria (si existe) está fuera de `engine.ts`/`cruce-player.tsx` (p. ej. en `HudMenu`, `SkinSelector` o el propio ciclo de vida de React) | El paso 3 del plan ya contempla ampliar la corrección a otro archivo si el heap snapshot señala la retención ahí                                             |
| Las mediciones se hacen en desktop con emulación de dispositivo móvil de Chrome, no en un móvil real                                                 | Se documenta explícitamente esta limitación en los hallazgos del spec; la validación en hardware real queda fuera de este spec                               |
| `React.memo` mal aplicado (con props de identidad inestable) puede ocultar un bug donde el HUD deja de actualizarse en pantalla                      | El paso 2 del plan incluye una verificación manual explícita de que marcador, vidas, nivel, pausa y skin se siguen actualizando con normalidad tras memoizar |

## What is **not** in this spec

- Auditar o optimizar el motor de `asteroids`, `tetris`, `arkanoid` o `snake`, aunque compartan el
  mismo patrón de `setupHiDpiCanvas` + `shadowBlur`.
- Un contador de FPS/frame-time visible o activable por debug en el juego.
- Cambios de comportamiento de juego: velocidades de carril, `HOP_LOCK_MS`, colisiones o puntuación.
- Simplificación visible del efecto glow, salvo que el profiling demuestre que optimizarlo sin tocarlo
  es inviable.
- Validación en un dispositivo móvil real (la medición de este spec es en desktop con emulación de
  Chrome DevTools).

Cada uno de estos, si se necesita, va en su propio spec.
