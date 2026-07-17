# SPEC 02 — Home landing de Arcade Vault

> **Status:** Completado
> **Depends on:** 01-mvp-visual
> **Date:** 2026-07-17
> **Objective:** Añadir la landing page "Inicio" del template `home-about` como nueva ruta `/` de Arcade Vault, mudando la Biblioteca actual a `/games` y actualizando el Nav y los enlaces internos en consecuencia.

## Scope

**In:**

- Nueva landing page en `/` (puerto de `home.jsx`): hero con eslogan y CTAs, siluetas pixel decorativas flotantes, sección "¿Por qué Arcade Vault?" (feature cards), preview de juegos (mini-rail con los primeros 6 de `GAMES`), sección de stats estáticos, "Actividad en vivo" (últimas puntuaciones + top jugadores, **datos hardcodeados igual que el template**, sin relación con `localStorage`/leaderboard real), sección de precios (plan único gratis + FAQ), CTA final.
- Animación reveal-on-scroll (`IntersectionObserver`, clases `.reveal`/`.in`) portada tal como en el template, para las secciones de Home.
- Biblioteca (contenido actual de `app/page.tsx`) se muda a `app/games/page.tsx`, sin cambios de comportamiento — sigue siendo la misma pantalla de búsqueda/filtros/grid.
- `components/nav.tsx` actualizado:
  - Nuevo link "Inicio" → `/`.
  - Link "Biblioteca" pasa a apuntar a `/games` (antes `/`).
  - Logo pasa a apuntar a `/` (Home) en vez de a la Biblioteca.
  - Lógica de estado activo (`isBiblioteca`/nuevo `isHome`) actualizada: `isHome` = `pathname === "/"`, `isBiblioteca` = `pathname.startsWith("/games")`.
- Los 3 botones "VOLVER AL VAULT" / "VOLVER A LA BIBLIOTECA" (`app/games/[id]/page.tsx`, `components/game-player.tsx`, `app/hall-of-fame/page.tsx`) actualizados de `href="/"` a `href="/games"`.
- Ampliación de `app/globals.css` con las clases de la sección `HOME PAGE` de `styles.css` (`.home-hero`, `.home-title`, `.home-silos`, `.feature-grid`/`.feature-card`, `.mini-rail`/`.mini-card`, `.home-stats`, `.activity-grid`, `.pricing-grid`, `.home-final`, `.reveal`, etc.), reutilizadas tal cual.
- Iconos SVG decorativos del template (siluetas flotantes, `FeatureIcon`) portados como componentes/inline SVG dentro de la página Home.

**Out of scope (para otro spec):**

- Página "Acerca de" (`about.jsx`) y su formulario de contacto — no se implementan en este spec. El link "Acerca de" **no** se agrega al Nav todavía (se evita un link muerto).
- Cualquier lógica real detrás de "Actividad en vivo": esos datos quedan estáticos, tal como en el template.
- Internacionalización (el contenido sigue en español).
- Tests automatizados.

## Data model

Este spec no introduce estructuras de datos nuevas: la sección "Juegos disponibles ahora" reutiliza `GAMES` (de `app/data/games.ts`, ya existente), y la sección "Actividad en vivo" usa arrays estáticos hardcodeados dentro del propio componente `Home` (igual que el template), sin persistencia ni `localStorage` nuevos.

## Implementation plan

1. Ampliar `app/globals.css` con las clases de la sección "HOME PAGE" de `styles.css` (`.home-hero`, `.home-title`, `.home-silos`, `.feature-grid`/`.feature-card`, `.mini-rail`/`.mini-card`, `.home-stats`, `.activity-grid`, `.pricing-grid`, `.home-final`, `.reveal`, etc.). No se toca ningún componente todavía; `npm run dev` sigue mostrando la Biblioteca en `/` sin errores.
2. Crear `app/games/page.tsx` copiando el contenido actual de `app/page.tsx` (Biblioteca) sin cambios de comportamiento. Test manual: `/games` muestra la Biblioteca (buscador, chips, grid) igual que antes en `/`; `/` sigue funcionando igual que hasta ahora (todavía no se ha tocado).
3. Actualizar los 3 enlaces "VOLVER AL VAULT" / "VOLVER A LA BIBLIOTECA" (`app/games/[id]/page.tsx`, `components/game-player.tsx`, `app/hall-of-fame/page.tsx`) de `href="/"` a `href="/games"`. Test manual: desde el detalle de un juego, el reproductor y el salón de la fama, el botón de volver lleva a `/games`.
4. Reescribir `components/nav.tsx`: agregar el link "Inicio" → `/`, cambiar el link "Biblioteca" para que apunte a `/games`, cambiar el logo para que apunte a `/`, y actualizar la lógica `isHome`/`isBiblioteca` según el pathname. Test manual: desde cualquier ruta, los links del Nav (escritorio y menú móvil) resaltan la página activa correctamente y navegan a las rutas correctas.
5. Crear `app/page.tsx` (Home, client component por el `IntersectionObserver` del reveal-on-scroll) — puerto de `home.jsx`: hero con siluetas flotantes y CTAs, sección "¿Por qué Arcade Vault?", preview de juegos (mini-rail con los primeros 6 de `GAMES`, cada mini-card navega a `/games/[id]`), sección de stats, "Actividad en vivo" (datos estáticos), sección de precios con FAQ, CTA final. Test manual: `/` muestra el nuevo landing completo sin errores de consola; las animaciones reveal-on-scroll se activan al hacer scroll; los CTAs navegan a `/games` y `/login` correctamente; las mini-cards navegan al detalle correcto.
6. Repaso final de fidelidad visual y responsive: recorrer `/` (Home) y `/games` (Biblioteca) en escritorio y en un viewport móvil, comparar contra el template de referencia y ajustar cualquier detalle de CSS que falte (siluetas, feature cards, mini-rail, stats, activity-grid, pricing-grid). Usa playwright para esto.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores en consola en `/` y en `/games`.
- [ ] `/` muestra la landing Home completa: hero con título/CTAs/siluetas, sección "¿Por qué Arcade Vault?", preview de juegos, stats, "Actividad en vivo", precios/FAQ y CTA final.
- [ ] `/games` muestra la Biblioteca (buscador, chips de categoría, grid de juegos) con el mismo comportamiento que tenía antes en `/`.
- [ ] El Nav muestra 3 links: "Inicio" (`/`), "Biblioteca" (`/games`) y "Salón de la Fama" (`/hall-of-fame`); no incluye "Acerca de".
- [ ] El link activo en el Nav (escritorio y menú móvil) coincide con la ruta actual: "Inicio" en `/`, "Biblioteca" en `/games` y `/games/[id]*`.
- [ ] El logo del Nav navega a `/`.
- [ ] En Home, el botón "▶ EXPLORAR JUEGOS" y el CTA final "INSERTAR MONEDA →" navegan a `/games`.
- [ ] En Home, el botón "✦ CREAR CUENTA" y el CTA de precios "EMPEZAR GRATIS →" navegan a `/login`.
- [ ] En Home, hacer clic en una mini-card de la sección "Juegos disponibles ahora" navega a `/games/[id]` del juego correcto.
- [ ] En Home, el botón "VER SALÓN →" navega a `/hall-of-fame`.
- [ ] Al hacer scroll en Home, las secciones con clase `.reveal` aparecen animadas (fade-in + translateY) una sola vez.
- [ ] Los botones "VOLVER AL VAULT" (detalle de juego, reproductor) y "VOLVER A LA BIBLIOTECA" (salón de la fama) navegan a `/games`.
- [ ] Navegar a `/games/id-que-no-existe` sigue mostrando la página 404 de Next.js (comportamiento heredado, sin regresión).
- [ ] En un viewport móvil (< 840px), el Nav colapsa a menú hamburguesa funcional tanto en `/` como en `/games`, y el nuevo landing Home es legible/usable (feature-grid, mini-rail, stats y pricing-grid colapsan a columnas según el CSS del template).

## Decisions

- **Yes:** mover Biblioteca de `/` a `/games` y poner el nuevo landing Home en `/`. Encaja con la intención del template, donde "Inicio" y "Biblioteca" son destinos distintos en el Nav; `/games` conviven sin conflicto con la ruta dinámica `/games/[id]`.
- **No:** poner Home en una ruta secundaria (`/inicio` o `/home`) dejando Biblioteca en `/`. Se descartó por indicación explícita del usuario, que prefirió mudar Biblioteca en vez de relegar Home.
- **Yes:** dejar la página "Acerca de" (`about.jsx`) totalmente fuera de este spec, incluyendo su link en el Nav. Evita un link muerto a una ruta que no existe y mantiene el spec enfocado en una sola pantalla nueva.
- **No:** agregar el link "Acerca de" deshabilitado o con indicador "Próximamente". Complejidad visual innecesaria para una pantalla que se implementará en otro spec.
- **Yes:** la sección "Actividad en vivo" de Home usa datos estáticos hardcodeados, igual que en el template, sin relación con `localStorage` ni con el leaderboard real (`seededScores`). Es puramente decorativa en el template original y mantenerla así evita inventar un modelo de datos nuevo sin caso de uso real.
- **No:** derivar "Actividad en vivo" de `PLAYERS`/`seededScores`. Añadiría lógica que el template no tiene, para una sección que es solo ambientación visual.
- **Yes:** actualizar los 3 botones "volver" (`/games/[id]`, reproductor, salón de la fama) para que apunten a `/games` en vez de `/`. Preserva su significado original ("volver a la biblioteca"), que ahora vive en esa ruta.
- **Yes:** reutilizar tal cual las clases CSS del template (`app/globals.css`) para la sección Home, consistente con la decisión ya tomada en spec 01 de priorizar fidelidad visual exacta sobre reconstrucción con utilidades de Tailwind.

## Risks

| Risk | Mitigation |
| --- | --- |
| Next.js 16.2.10 podría manejar de forma distinta la convivencia de una ruta estática (`/games`) con una ruta dinámica hija (`/games/[id]`) respecto a lo esperado por entrenamiento. | Antes del paso 2, revisar `node_modules/next/dist/docs/01-app/` para confirmar que `app/games/page.tsx` y `app/games/[id]/page.tsx` coexisten sin conflicto de enrutamiento. |
| El componente Home usa `IntersectionObserver` en un `useEffect`; si se aplica `opacity:0` vía estilo inline en vez de la clase CSS `.reveal`, podría causar un flash o desajuste de hidratación. | Aplicar el estado inicial oculto únicamente vía la clase CSS `.reveal` (ya definida en `globals.css`), nunca con estilos inline calculados en el render inicial, igual que en el template. |
| Al mover Biblioteca de `/` a `/games`, cualquier enlace interno olvidado que siga apuntando a `/` esperando ver la Biblioteca quedaría apuntando al nuevo landing Home. | El paso 3 del plan de implementación audita explícitamente los 3 enlaces "volver" conocidos; el paso 6 (repaso final) incluye recorrer las 5 rutas existentes para detectar cualquier enlace remanente no actualizado. |

## Lo que **no** está en este spec

- Página "Acerca de" (`about.jsx`) y su formulario de contacto.
- El link "Acerca de" en el Nav.
- Lógica real detrás de "Actividad en vivo" (queda estática/decorativa).
- Internacionalización (i18n).
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
