# SPEC 01 — MVP visual de Arcade Vault

> **Status:** Approved
> **Depends on:** —
> **Date:** 2026-07-17
> **Objective:** Implementar, solo en su capa visual y sin lógica de juego real, las 5 pantallas del template de referencia (Biblioteca, Detalle, Reproductor, Auth y Salón de la Fama) como rutas reales de Next.js App Router.

## Por qué existe este spec

El template de referencia es una SPA en React (via CDN, Babel) con enrutamiento por hash y estado centralizado en un único componente `App`. Este spec decide portarlo a rutas reales de Next.js App Router (en vez de replicar el router por hash) porque encaja mejor con el stack del proyecto y con RSC. Como no hay un único componente `App` que centralice estado, la sesión de usuario y las puntuaciones se leen/escriben directamente desde `localStorage` en cada componente cliente que las necesita (Nav, Reproductor, Salón de la Fama), sin un Context global.

## Scope

**In:**

- 5 rutas reales: `/` (Biblioteca), `/games/[id]` (Detalle), `/games/[id]/play` (Reproductor), `/login` (Auth), `/hall-of-fame` (Salón de la Fama).
- Nav compartido (enlaces de escritorio + menú móvil hamburguesa) con estado de sesión visual (nombre de usuario o botón "Iniciar sesión").
- Datos mock de juegos, jugadores y generador de puntuaciones en `app/data/` (equivalente TS de `data.jsx`).
- Ampliación de `app/globals.css` con el resto de clases del `styles.css` de referencia (`av-hero`, `av-grid`, `card`, `crt`, `modal`, `hall-table`, `auth-card`, etc.), reutilizadas tal cual en los componentes.
- Simulación visual de la pantalla "Reproductor" (puntuación auto-incremental, vidas, nivel, pausa, modal de fin de partida con input de iniciales) igual que el template, sin lógica de juego real.
- Sesión de usuario "falsa" (login sin validar credenciales, más opción "jugar como invitado"), persistida en `localStorage`.
- Guardado de la puntuación al finalizar una partida simulada, persistido en `localStorage` y reflejado de forma mock en el Salón de la Fama ("tu mejor marca").
- `id` de juego inválido en `/games/[id]` y `/games/[id]/play` responde con `notFound()` de Next.js.
- Diseño responsive (colapso del nav a menú hamburguesa en móvil) igual que el template.

**Out of scope (for future specs):**

- Cualquier lógica de juego real (mecánica, físicas, colisiones): todas las "partidas" son simuladas visualmente, tal como en el template.
- Autenticación real: sin backend, sin validación de credenciales, sin OAuth funcional (los botones GOOGLE/GITHUB son solo visuales).
- Persistencia en servidor o base de datos: todo vive en `localStorage` del navegador.
- Multijugador o partidas en tiempo real (DUELO PIXEL se muestra como una tarjeta más, sin trato especial).
- Internacionalización: el contenido queda en español, tal como en el template.
- Tests automatizados (unit/e2e).
- Página de perfil/cuenta más allá de mostrar el nombre de usuario y un botón de cerrar sesión en el Nav.

## Data model

```ts
// app/data/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export type Game = {
  id: string;          // slug, ej. "bloque-buster"
  title: string;
  short: string;        // descripción corta (tarjeta)
  long: string;         // descripción larga (detalle)
  cat: GameCategory;
  cover: string;         // sufijo de clase CSS, ej. "cover-bricks"
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;          // mejor puntuación global (mock)
  plays: string;         // ej. "12.4K"
};

export const GAMES: Game[];
export const CATS: ("TODOS" | GameCategory)[];
export const PLAYERS: string[]; // nombres usados para generar leaderboards

export type ScoreRow = { rank: number; name: string; score: number; date: string };

// Generador determinista de leaderboard mock a partir de una semilla.
export function seededScores(seed: number, count?: number): ScoreRow[];
```

```ts
// Claves de localStorage (mismas que el template)
// "av_user"   -> { name: string } | null
// "av_scores" -> Array<{ game: string; score: number; name: string; at: number }>
```

Conventions:

- `Game.id` es el mismo valor usado como param dinámico en `/games/[id]` y `/games/[id]/play`.
- `seededScores` debe ser puro (misma semilla → mismo resultado) para que SSR e hidratación no diverjan.
- Las puntuaciones guardadas en `av_scores` son un log de partidas (append-only); no se deduplican ni se ordenan al guardar.

## Implementation plan

1. Crear `app/data/games.ts` con los tipos (`Game`, `GameCategory`, `ScoreRow`), `GAMES`, `CATS`, `PLAYERS` y `seededScores` (puerto TS de `data.jsx`). El resto del sistema sigue arrancando igual.
2. Completar `app/globals.css` con las clases restantes de `styles.css` (`av-hero`, `av-filters`, `av-grid`, `.card` y `.cover-*`, `av-detail`, `.leaderboard`/`.lb-row`, `av-player`, `.crt`/`.crt-screen`, `.modal-bd`/`.modal`, `av-auth-wrap`/`.auth-card`, `av-hall`, `.podium`, `.hall-table`, utilidades varias). No se toca ningún componente todavía; `npm run dev` sigue mostrando el placeholder actual sin errores.
3. Crear `components/nav.tsx` (client component, puerto de `nav.jsx`): logo, links de escritorio, contador de créditos estático, botón de sesión (lee `av_user` de `localStorage`, botón de cerrar sesión), menú móvil hamburguesa. Integrarlo en `app/layout.tsx` junto con el footer (mismo texto que `app.jsx`). Manual test: el nav aparece en todas las páginas, el menú móvil abre/cierra.
4. Crear `components/game-card.tsx` (client component, por el efecto tilt al mover el mouse) y reescribir `app/page.tsx` (Biblioteca): hero, buscador, chips de categoría, grid de tarjetas — puerto de `biblioteca.jsx` usando `GAMES`/`CATS` de `app/data/games.ts`, navegando con `<Link href={`/games/${id}`}>`. Manual test: buscar y filtrar por categoría funciona, clic en tarjeta navega al detalle.
5. Crear `app/games/[id]/page.tsx` (Detalle, server component): busca el juego por `id` (`notFound()` si no existe), muestra cover, tags, descripción, stat-strip y leaderboard mock vía `seededScores`, con botones a `/games/[id]/play` y a `/`. Manual test: navegar desde una tarjeta muestra el detalle correcto; un id inexistente muestra la 404 de Next.js.
6. Crear `components/game-player.tsx` (client component) y `app/games/[id]/play/page.tsx` — puerto de `reproductor.jsx`: HUD simulado (puntuación auto-incremental, vidas, nivel), CRT con "enemigos" animados por CSS, pausa, modal de fin de partida con input de iniciales que guarda en `av_scores` (`localStorage`) y botones para reiniciar o volver. Manual test: jugar, pausar, finalizar, guardar puntuación y volver a la biblioteca sin errores en consola.
7. Crear `components/auth-form.tsx` (client component) y `app/login/page.tsx` — puerto de `auth.jsx`: tabs iniciar sesión/crear cuenta, campos, botón de invitado; guarda `av_user` en `localStorage` y redirige a `/`. Manual test: iniciar sesión (o como invitado) actualiza el nombre en el Nav y persiste tras recargar la página.
8. Crear `app/hall-of-fame/page.tsx` (client component, ya que lee `av_user`) — puerto de `salon.jsx`: tabs por juego, podio top 3, tabla de posiciones, fila "tu mejor marca" si hay usuario logueado. Manual test: cambiar de juego en las tabs actualiza podio y tabla; con sesión iniciada aparece la fila del usuario.
9. Repaso final de fidelidad visual y responsive: recorrer las 5 rutas en escritorio y en un viewport móvil, comparar contra el template de referencia y ajustar cualquier detalle de CSS que falte.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores en consola en ninguna de las 5 rutas.
- [ ] `/` muestra el hero, el buscador y el grid de juegos; buscar por texto y filtrar por categoría (chips) reduce la lista correctamente.
- [ ] Hacer clic en una tarjeta o en su botón "JUGAR" navega a `/games/[id]` con el juego correcto.
- [ ] `/games/[id]` muestra cover, tags, descripción, stat-strip y un leaderboard de 10 filas generado por `seededScores`.
- [ ] Visitar `/games/id-que-no-existe` y `/games/id-que-no-existe/play` muestra la página 404 de Next.js.
- [ ] En `/games/[id]/play` la puntuación sube automáticamente, el botón "PAUSA" detiene el incremento y "REANUDAR" lo continúa.
- [ ] Pulsar "FIN" en `/games/[id]/play` abre el modal de fin de partida con la puntuación final.
- [ ] Guardar la puntuación en el modal la persiste en `localStorage` (`av_scores`) y muestra el mensaje de confirmación.
- [ ] En `/login`, iniciar sesión (o "JUGAR COMO INVITADO") guarda el usuario en `localStorage` (`av_user`), redirige a `/` y el Nav muestra el nombre de usuario.
- [ ] Recargar la página después de iniciar sesión conserva el nombre de usuario en el Nav (sesión persistida).
- [ ] Cerrar sesión desde el Nav borra `av_user` y el Nav vuelve a mostrar el botón "Iniciar Sesión".
- [ ] `/hall-of-fame` muestra podio (top 3) y tabla completa para el juego seleccionado en las tabs; cambiar de tab cambia los datos mostrados.
- [ ] Con sesión iniciada, `/hall-of-fame` muestra la fila "tu mejor marca"; sin sesión, esa fila no aparece.
- [ ] En un viewport móvil (< 840px) el Nav colapsa a menú hamburguesa funcional en las 5 rutas.

## Decisions

- **Yes:** rutas reales de App Router en inglés (`/`, `/games/[id]`, `/games/[id]/play`, `/login`, `/hall-of-fame`) en vez de replicar el router SPA por hash del template. Encaja mejor con Next.js/RSC y con la navegación nativa del navegador (back/forward, SEO).
- **No:** mantener el hash-router (`location.hash` + estado en `App`). Reinventaría algo que Next.js ya resuelve con rutas reales.
- **Yes:** mantener la simulación visual completa del Reproductor (puntuación auto-incremental, pausa, modal de fin de partida). Es puramente decorativa/mock, no es "un juego real", y conserva la demostración completa del flujo visual.
- **No:** congelar el Reproductor en un estado estático. Se descartó porque perdía la demostración de pausar/terminar/guardar puntuación, parte central del valor visual del MVP.
- **Yes:** `localStorage` como mecanismo de persistencia, con las mismas claves del template (`av_user`, `av_scores`). No hay backend en el alcance de este spec y alcanza para simular sesión y puntuaciones entre recargas.
- **No:** persistencia en servidor o base de datos. Fuera de alcance de este MVP visual.
- **Yes:** reutilizar tal cual las clases CSS del template en `app/globals.css` en vez de reconstruir con utilidades de Tailwind. Prioriza fidelidad visual exacta y evita reinterpretar los efectos CRT/neón en utilidades.
- **No:** traducir el diseño a Tailwind utility-first. Riesgo de desviarse del look de referencia sin beneficio para un MVP.
- **Yes:** estado de sesión y puntuaciones leído/escrito directamente en `localStorage` desde cada componente cliente que lo necesita (Nav, Reproductor, Salón de la Fama), sin Context global. No existe un componente `App` único como en el template; cada ruta es independiente en App Router.
- **No:** Context/Provider global de sesión. Capa de abstracción innecesaria para consumidores tan simples.
- **Yes:** `notFound()` de Next.js para ids de juego inválidos en `/games/[id]` y `/games/[id]/play`. Es el mecanismo estándar de Next.js y evita renders vacíos silenciosos como en el template original.

## Risks

| Risk                                                                                     | Mitigation                                                                                                                          |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.2.10 puede diferir de las APIs conocidas por entrenamiento (ej. `params` como `Promise` en Server Components) | Antes de implementar cada ruta dinámica, revisar `node_modules/next/dist/docs/01-app/` para la firma correcta en esta versión.       |
| Acceso a `localStorage` durante el render en servidor rompe (no existe `window` en SSR)   | Todo acceso a `localStorage` vive dentro de componentes `"use client"`, leído en `useEffect`/manejadores de evento, nunca en el render inicial del servidor. |
| Desajuste de hidratación si `seededScores` no es determinista entre servidor y cliente     | Mantener `seededScores` como función pura, sin `Date.now()`/`Math.random()` reales — usar el generador seedeado ya definido.         |
| `localStorage` deshabilitado (modo privado o política del navegador)                       | Envolver lecturas/escrituras en `try/catch` (igual que el template); si falla, la sesión/puntuación simplemente no persiste.          |

## Lo que **no** está en este spec

- Cualquier lógica de juego real (mecánica, físicas, colisiones, puntuación calculada por gameplay real).
- Autenticación real (backend, validación de credenciales, OAuth funcional).
- Persistencia en servidor o base de datos.
- Multijugador o partidas en tiempo real.
- Internacionalización (i18n).
- Tests automatizados.
- Página de perfil/cuenta más allá del nombre de usuario y cerrar sesión en el Nav.

Cada uno de estos, si se implementa, va en su propio spec.
