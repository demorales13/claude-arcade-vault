# SPEC 05 — Asteroids real como nuevo juego "ASTEROIDES"

> **Status:** Implemented
> **Depends on:** 01-mvp-visual
> **Date:** 2026-07-24
> **Objective:** Agregar "ASTEROIDES" (`id: "asteroids"`) como nuevo juego del catálogo de Arcade Vault, con el motor real portado de `references/started-games/02-asteroids/game.js` reemplazando la simulación visual solo en su Reproductor (`/games/asteroids/play`), integrado con el HUD y el flujo de guardado de puntuación existentes; el resto del catálogo (incluido "ROCAS") no se modifica.

## Scope

**In:**

- Nueva entrada en `app/data/games.ts` (`GAMES`): `id: "asteroids"`, `title: "ASTEROIDES"`, `cat: "SHOOTER"`, `color: "cyan"`, `cover: "cover-asteroids"`, `short`/`long` describiendo el juego real (nave que rota/propulsa, asteroides que se parten en fragmentos, power-up de disparo triple, 3 vidas con invencibilidad temporal), `best: 0`, `plays: "0"`.
- Nueva clase CSS `.cover-asteroids` en `app/globals.css` (arte de tarjeta distinto de `.cover-rocas`, mismo patrón de pseudo-elementos `::after`/`::before` que las demás `.cover-*`).
- Motor del juego portado a TypeScript en `components/games/asteroids/engine.ts`: puerto fiel de `game.js` (clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, constantes `RADII`/`SPEEDS`/`POINTS`, física, colisiones, wrapping toroidal, sistema de niveles y power-up de disparo triple), sin JSX, expone una API (`start`/`pause`/`resume`/`destroy`, callbacks `onScoreChange`/`onLivesChange`/`onLevelChange`/`onTripleShotChange`/`onGameOver`) para ser consumido por React.
- Wrapper cliente `components/games/asteroids-player.tsx`: monta el `<canvas>` (800×600 lógico, escalado por CSS al contenedor), instancia el motor, reutiliza el `player-hud`/marco `.crt` de Arcade Vault con un quinto `hud-stat` ("DISPARO TRIPLE") visible solo mientras el power-up está activo, botones PAUSA/FIN/SALIR wireados al motor real, y controles táctiles (D-pad izq/der + PROPULSAR/DISPARAR) siempre visibles en viewport < 840px, inyectando las mismas teclas que el motor ya escucha.
- `components/game-over-modal.tsx`: extracción del modal "FIN DEL JUEGO" (input de iniciales, guardado en `av_scores`, botones "JUGAR DE NUEVO"/"VOLVER AL VAULT") ya existente en `game-player.tsx`, para que lo compartan `game-player.tsx` (mock) y `asteroids-player.tsx` (real) sin duplicar markup.
- `app/games/[id]/play/page.tsx`: rama por `id` — `"asteroids"` renderiza `AsteroidsPlayer`, cualquier otro id sigue renderizando `GamePlayer` (mock) sin cambios de comportamiento.
- Pausa real: al pausar se detiene `update(dt)` del motor pero sigue `draw()` (frame congelado) con el overlay "EN PAUSA" ya existente encima; al reanudar se resetea el `dt` acumulado para evitar salto brusco.
- Guardado de puntuación real: al llegar a 0 vidas (o al pulsar FIN), se abre `game-over-modal.tsx` con la puntuación real alcanzada y guarda en `av_scores` con `game: "asteroids"`, igual esquema que hoy.

**Out of scope (para otro spec):**

- Cualquier cambio a "ROCAS" (`app/data/games.ts`, su Reproductor mock, su cover art) — queda exactamente como está.
- Conectar `best` de "ASTEROIDES" (o de cualquier juego) a puntuaciones reales de `av_scores` — sigue siendo un valor mock estático, igual que el resto de `GAMES`.
- Conectar `/hall-of-fame` a puntuaciones reales — sigue siendo 100% mock vía `seededScores`, sin leer `av_scores`.
- Cualquier gameplay nuevo o distinto al de `game.js` (nuevos power-ups, jefes, niveles infinitos con dificultad distinta, sonido/música).
- Guardar high scores por nivel o estadísticas adicionales más allá del esquema actual de `av_scores` (`game`, `score`, `name`, `at`).
- Tests automatizados (unit/e2e).
- Soporte de gamepad/mando físico.

## Data model

```ts
// app/data/games.ts — nueva entrada en GAMES (mismo tipo Game existente, sin cambios de tipo)
{
  id: "asteroids",
  title: "ASTEROIDES",
  short: "Destruye asteroides en el vacío, nivel tras nivel.",
  long: "Pilota una nave triangular que rota y propulsa en gravedad cero. Dispara para fragmentar rocas grandes en medianas y pequeñas, sobrevive con 3 vidas y busca el power-up de disparo triple antes de que el campo se llene.",
  cat: "SHOOTER",
  cover: "cover-asteroids",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

```ts
// components/games/asteroids/engine.ts — puerto de game.js, sin JSX
export type AsteroidsCallbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  onTripleShotChange?: (secondsLeft: number) => void; // 0 = inactivo
  onGameOver?: (finalScore: number) => void;
};

export type AsteroidsGame = {
  pause: () => void;
  resume: () => void;
  destroy: () => void; // detiene el rAF loop y listeners, para desmontaje de React
  setKey: (code: string, pressed: boolean) => void; // usado por los controles táctiles, misma clave que keydown/keyup ("ArrowLeft", "ArrowRight", "ArrowUp", "Space")
  forceGameOver: () => void; // usado por el botón FIN del HUD
};

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsGame;
```

```ts
// components/game-over-modal.tsx — extraído de game-player.tsx, reutilizado por ambos reproductores
export function GameOverModal(props: {
  score: number;
  name: string;
  onNameChange: (name: string) => void;
  saved: boolean;
  onSave: () => void; // dispara saveScore({ game, score, name }) hacia av_scores
  onRestart: () => void;
  backHref: string; // "/games"
}): React.JSX.Element;
```

```ts
// Claves de localStorage — sin cambios de esquema, solo un nuevo valor de "game"
// "av_scores" -> Array<{ game: "asteroids" | ...; score: number; name: string; at: number }>
```

Convenciones:

- `engine.ts` conserva 1:1 las constantes y fórmulas de `game.js` (`RADII`, `SPEEDS`, `POINTS`, `THRUST`, `DRAG`, `POWERUP_DROP_CHANCE`, etc.) — no se ajusta el balance del juego.
- `createAsteroidsGame` arranca el loop inmediatamente al llamarse (equivalente a `initGame()` + `requestAnimationFrame(loop)` en el original); no hay un método `start()` separado.
- El motor nunca lee `window`/`document` fuera de los listeners de teclado que él mismo registra y limpia en `destroy()`.

## Implementation plan

1. Agregar la entrada `asteroids` a `GAMES` en `app/data/games.ts` y la clase `.cover-asteroids` en `app/globals.css` (mismo patrón que `.cover-rocas`/`.cover-invaders`: `background` + pseudo-elemento `::after` con `radial-gradient`s de rocas/estrellas). Test: `/games` muestra la tarjeta "ASTEROIDES" con su propio cover; `/games/asteroids` muestra el detalle (cover, tags, leaderboard mock); `/games/asteroids/play` sigue usando el Reproductor mock genérico (sin cambios todavía).
2. Crear `components/games/asteroids/engine.ts`: puerto de `game.js` a TypeScript (clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, constantes, `update`/`draw`, colisiones, wrapping, niveles, power-up de disparo triple), envuelto en `createAsteroidsGame(canvas, callbacks)` con la API definida en Data model. No se conecta a ningún componente todavía. Test: `npm run build` compila sin errores de tipos.
3. Extraer `components/game-over-modal.tsx` del JSX del modal "FIN DEL JUEGO" ya existente en `components/game-player.tsx`, y actualizar `game-player.tsx` para usarlo vía props. Test manual: en un juego mock (ej. `/games/bloque-buster/play`) el flujo completo (FIN → input iniciales → GUARDAR PUNTUACIÓN → toast → JUGAR DE NUEVO/VOLVER AL VAULT) se comporta exactamente igual que antes.
4. Crear `components/games/asteroids-player.tsx`: monta el `<canvas>` (800×600 lógico, `max-width: 100%; height: auto`), instancia `createAsteroidsGame`, reutiliza `player-hud`/`.crt` con un `hud-stat` adicional "DISPARO TRIPLE" (visible solo con `onTripleShotChange > 0`), conecta PAUSA/FIN/SALIR a `pause`/`resume`/`forceGameOver`/`destroy`, y muestra `GameOverModal` cuando `onGameOver` dispara. Actualizar `app/games/[id]/play/page.tsx` para renderizar `AsteroidsPlayer` cuando `id === "asteroids"` y `GamePlayer` en cualquier otro caso. Test manual: en `/games/asteroids/play`, jugar con teclado (flechas + espacio) — la nave rota/propulsa/dispara, los asteroides se parten, el score/vidas/nivel del HUD reflejan el estado real, perder una vida muestra el parpadeo de invencibilidad, llegar a 0 vidas abre `GameOverModal` con la puntuación real y guardarla persiste en `av_scores` con `game: "asteroids"`.
5. Agregar controles táctiles (D-pad izquierda/derecha + botones PROPULSAR/DISPARAR) dentro de `asteroids-player.tsx`, visibles solo en viewport < 840px, cada botón llamando `engine.setKey(code, true/false)` en `onPointerDown`/`onPointerUp` (mismos códigos que el teclado). Test manual: con devtools en modo responsive (< 840px), los botones táctiles mueven la nave, la propulsan y disparan igual que el teclado.
6. Repaso final de fidelidad visual y responsive: comparar `/games/asteroids/play` contra el juego original (`references/started-games/02-asteroids/`) y contra el resto del sitio (HUD, marco `.crt`, tipografía), en viewport de escritorio y móvil, usando Playwright. Ajustar cualquier detalle de escalado del canvas, posición de los controles táctiles o el nuevo `hud-stat` de disparo triple.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores en consola en `/games`, `/games/asteroids` y `/games/asteroids/play`.
- [ ] `/games` muestra la tarjeta "ASTEROIDES" (cover `.cover-asteroids`) junto a las demás, sin ningún cambio visual en la tarjeta "ROCAS".
- [ ] `/games/asteroids` (Detalle) muestra cover, tags, descripción, stat-strip y leaderboard mock, igual que cualquier otro juego.
- [ ] En `/games/asteroids/play`, las flechas rotan/propulsan la nave y espacio dispara, con física y wrapping toroidal idénticos a `game.js` (misma sensación de inercia/rotación).
- [ ] Los asteroides grandes se destruyen en 2 medianos, los medianos en 2 pequeños, y los pequeños desaparecen sin dividirse, sumando los puntos correspondientes (20/50/100) al HUD real.
- [ ] El HUD de Arcade Vault (Jugador/Puntuación/Vidas/Nivel) refleja en vivo el estado real del motor, no valores simulados.
- [ ] Al recoger el power-up de disparo triple aparece el stat "DISPARO TRIPLE" en el HUD con la cuenta regresiva, y desaparece al expirar.
- [ ] Perder una vida muestra el parpadeo de invencibilidad temporal de la nave; al llegar a 0 vidas se abre `GameOverModal` con la puntuación final real.
- [ ] El botón PAUSA congela el juego (deja de actualizarse pero el frame queda visible) con el overlay "EN PAUSA"; REANUDAR continúa sin salto brusco de física.
- [ ] El botón FIN fuerza el fin de partida inmediatamente, abriendo `GameOverModal` con la puntuación alcanzada hasta ese momento.
- [ ] Guardar la puntuación en `GameOverModal` la persiste en `localStorage` (`av_scores`) con `game: "asteroids"`.
- [ ] En un juego mock (ej. `/games/bloque-buster/play`), el flujo de `GameOverModal` (extraído) se comporta exactamente igual que antes de este spec.
- [ ] En viewport móvil (< 840px), aparecen los controles táctiles (D-pad + PROPULSAR/DISPARAR) y controlan la nave correctamente; en escritorio no aparecen.
- [ ] El canvas se escala visualmente para caber en el marco `.crt` tanto en escritorio como en móvil, sin recortar el HUD ni los controles táctiles.
- [ ] `npm run build` termina sin errores.

## Decisions

- **Yes:** crear "ASTEROIDES" (`id: "asteroids"`) como entrada nueva e independiente del catálogo, sin tocar "ROCAS". El usuario corrigió explícitamente que no se debía reemplazar "ROCAS" aunque temáticamente se parezcan; son dos juegos distintos en el catálogo.
- **No:** eliminar o renombrar "ROCAS". Queda fuera de alcance — es una decisión de curación del catálogo que el usuario no pidió.
- **Yes:** `id` y clase de cover en inglés (`"asteroids"`, `.cover-asteroids`), a diferencia del resto de slugs del catálogo que están en español (`bloque-buster`, `rocas`, etc.). Instrucción explícita del usuario; el `title` visible sigue en español ("ASTEROIDES") para mantener consistencia con el resto de la UI.
- **Yes:** HUD de Arcade Vault (`player-hud`/`.crt`) alimentado por el estado real del motor, en vez del HUD original dibujado en canvas. Evita duplicar información (score/vidas/nivel en dos lugares) y mantiene consistencia visual con el resto del sitio.
- **No:** dejar que el canvas dibuje su propio HUD (como en el standalone). Se apagaría esa parte del motor porque quedaría redundante con el HUD externo.
- **Yes:** reutilizar el modal "FIN DEL JUEGO" existente, extraído a `components/game-over-modal.tsx` para compartirlo entre el Reproductor mock y el real. Evita duplicar markup y mantiene una única UX de guardado de puntuación en todo el sitio.
- **No:** usar la pantalla "GAME OVER / ESPACIO PARA REINICIAR" dibujada en canvas del original. Quedaría inconsistente con el flujo de guardado de puntuación (`av_scores`) que ya existe en el sitio.
- **Yes:** motor portado como módulo TS puro (`components/games/asteroids/engine.ts`) separado del componente React (`asteroids-player.tsx`), con una API basada en callbacks. Permite portar la lógica de `game.js` casi 1:1 (fiel al original) sin mezclarla con JSX, y hace testeable/reemplazable el motor de forma aislada.
- **No:** meter la lógica del motor directamente en el componente cliente. Mezclaría clases imperativas con hooks de React, dificultando seguir la fidelidad línea a línea con `game.js`.
- **Yes:** pausa implementada deteniendo `update(dt)` pero manteniendo `draw()` (frame congelado) con el overlay "EN PAUSA" ya existente. El motor original no tiene pausa nativa; este enfoque reutiliza el overlay visual que ya existe en el sitio sin tener que dibujar un estado nuevo.
- **Yes:** controles táctiles (D-pad + PROPULSAR/DISPARAR) incluidos en este mismo spec, visibles por breakpoint (< 840px, mismo umbral que el resto del sitio) en vez de detección real de touch (`ontouchstart`). Más simple y consistente con cómo el resto del proyecto ya decide su layout móvil.
- **No:** joystick virtual único. Un D-pad + botones discretos mapea más directamente a las teclas que el motor ya escucha (`ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space`), sin necesitar lógica de arrastre/ángulo.
- **Yes:** canvas con sistema de coordenadas lógico fijo 800×600 (idéntico al original, sin tocar física/colisiones) escalado visualmente por CSS. Evita reescribir cálculos de posición/colisión para tamaños variables, y resuelve el responsive solo en la capa de presentación.
- **Yes:** indicador de disparo triple movido al HUD de Arcade Vault (`hud-stat` "DISPARO TRIPLE") en vez de seguir dibujado en el canvas. Consistente con la decisión de que todo el HUD informativo vive fuera del canvas.
- **No:** conectar `best` (de "ASTEROIDES" o cualquier juego) ni `/hall-of-fame` a `av_scores` reales. Es un cambio más amplio que afecta datos mock de todo el catálogo; queda fuera de este spec.
- **No:** soporte de gamepad físico ni sonido/música. No estaban en el juego original tal como se pidió portarlo, y no fueron solicitados.

## Risks

| Risk                                                                                                                                                                                                                                                    | Mitigation                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.2.10/React 19 podrían diferir de las APIs conocidas por entrenamiento para `params` dinámicos, Client Components o `useEffect` con `<canvas>`/`requestAnimationFrame`.                                                                       | Antes del paso 4, revisar `node_modules/next/dist/docs/01-app/` para confirmar el patrón vigente de acceso a `params` y montaje de canvas en Client Components.                                                                          |
| El loop `requestAnimationFrame` del motor podría seguir corriendo tras desmontar `asteroids-player.tsx` (navegación a "SALIR"/"VOLVER AL VAULT"), causando fugas de memoria o errores por dibujar en un canvas ya desmontado.                           | `destroy()` del motor cancela el `requestAnimationFrame` y remueve los listeners de teclado; se llama siempre desde el cleanup del `useEffect` de `asteroids-player.tsx`.                                                                |
| Los listeners de teclado del motor (`keydown`/`keyup` en `window`) podrían interferir con otros elementos interactivos de la página (inputs del modal, navegación) o disparar scroll de la página con las flechas/espacio.                              | El motor solo escucha mientras está activo (entre `createAsteroidsGame` y `destroy`); se llama `e.preventDefault()` en `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space` únicamente mientras el juego está montado y no en pausa/modal abierto. |
| Los controles táctiles y el teclado físico podrían pisarse entre sí si ambos modifican el mismo estado `keys` sin sincronizarse (ej. un botón táctil queda "trabado" en `true` tras un `pointerup` perdido, como al arrastrar el dedo fuera del botón). | Usar `onPointerUp`/`onPointerLeave`/`onPointerCancel` (no solo `onPointerUp`) para liberar la tecla, y `engine.setKey` escribe sobre el mismo objeto `keys` que ya usan los listeners de teclado, sin estado duplicado.                  |
| Escalar el canvas por CSS (`max-width: 100%; height: auto`) sin fijar `aspect-ratio` podría deformar la proporción 4:3 (800×600) en contenedores angostos.                                                                                              | Fijar `aspect-ratio: 800 / 600` (o el `width`/`height` del `.crt-screen`) en el CSS del canvas para que el escalado sea siempre proporcional.                                                                                            |
| Extraer `game-over-modal.tsx` de `game-player.tsx` podría romper sutilmente el flujo mock existente si algún prop/callback queda mal cableado.                                                                                                          | Paso 3 del plan se prueba de forma aislada (manual, en un juego mock) antes de tocar nada del Reproductor real en el paso 4.                                                                                                             |

## Lo que **no** está en este spec

- Cualquier cambio a "ROCAS" (catálogo, Reproductor mock, cover art).
- Conectar `best` o `/hall-of-fame` a puntuaciones reales de `av_scores`.
- Gameplay nuevo o distinto al de `game.js` (power-ups nuevos, jefes, sonido/música).
- Estadísticas o historial de puntuaciones más allá del esquema actual de `av_scores`.
- Tests automatizados.
- Soporte de gamepad físico.

Cada uno de estos, si se implementa, va en su propio spec.
