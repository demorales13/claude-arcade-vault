# SPEC 10 — Selector de idioma Español / Inglés para la interfaz estática

> **Status:** approved
> **Depends on:** 02-home-landing, 03-about-contact, 06-leaderboard-catalogo-supabase
> **Date:** 2026-07-27
> **Objective:** Agregar un selector ES/EN en el Nav de Arcade Vault que traduce, de forma instantánea y persistida en localStorage (`av_lang`), todo el texto estático de la interfaz pública (nav, footer, home, catálogo, detalle de juego, login, acerca de/contacto, salón de la fama), sin tocar el contenido que viene de Supabase ni la experiencia de juego (`/games/[id]/play`).

## Scope

**In:**

- Infraestructura de i18n nueva: diccionario de traducciones (`lib/i18n/translations.ts`), un `LanguageProvider` de cliente con contexto de React y un hook `useLanguage()` (`lib/i18n/language-context.tsx`), sin dependencias npm nuevas — mismo criterio "hand-rolled" que el resto del mock del sitio.
- Selector ES/EN en `components/nav.tsx` (nav de escritorio y panel móvil), que llama a `setLanguage()`.
- Persistencia en `localStorage` bajo la clave `av_lang` (`"es" | "en"`), mismo patrón que `av_user`/`av_scores`/`av_arkanoid_sound`.
- Idioma por defecto cuando no hay `av_lang` guardado: se detecta `navigator.language` en el primer render de cliente — `en*` → inglés, cualquier otro valor (incluido `es*`) → español.
- Traducción de todo el texto estático de: `Nav` (links, selector, "CRÉDITOS · 03", botón de sesión, aria-labels), el footer de `app/layout.tsx` (extraído a un nuevo Client Component `components/site-footer.tsx` para poder leer el idioma).
- Traducción de Home (`app/page.tsx`): se extrae el JSX actual a un nuevo Client Component `components/home-content.tsx` que recibe `games`/`recentScores`/`topPlayers` ya resueltos como props; `app/page.tsx` queda como Server Component que solo hace el `fetch` y renderiza `<HomeContent .../>`. Incluye hero, las 4 `FEATURES`, títulos de sección, bloque de stats, actividad en vivo (incluidos los estados vacíos), pricing/FAQ y el CTA final.
- Traducción del catálogo (`app/games/page.tsx`): el hero ("INSERTA UNA MONEDA PARA JUGAR") se extrae a un pequeño Client Component `components/games-catalog-hero.tsx`; `GamesBrowser` y `GameCard` (ya son Client Components) traducen su placeholder de búsqueda, el chip "TODOS" (→ "ALL"; el resto de categorías —`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`— son iguales en ambos idiomas y no cambian), el estado "NO HAY RESULTADOS" y la etiqueta "MEJOR PUNTUACIÓN"/botón "JUGAR" de la tarjeta.
- Traducción del detalle de juego (`app/games/[id]/page.tsx`): se extrae a un nuevo Client Component `components/game-detail-content.tsx` que recibe `game`/`scores` como props. Incluye las etiquetas fijas ("1 JUGADOR", "TECLADO / TÁCTIL", "RETRO 1985", "Partidas", "Mejor global", "Dificultad"), los botones y el título "MEJORES PUNTUACIONES". `game.title`/`game.short`/`game.long`/`game.cat` (contenido de Supabase) no se tocan.
- Traducción de Login (`components/auth-form.tsx`): tabs, labels de campos, placeholders, botones, divisor social y la línea de términos.
- Traducción de Acerca de + Contacto (`app/about/page.tsx`, `components/about-contact-form.tsx`): hero, highlights, bloque de contacto, labels/placeholders del formulario, botón de envío y la pantalla de éxito tipo terminal (excepto el mensaje de error del Server Action, ver "Out of scope").
- Traducción de Salón de la Fama (`components/hall-of-fame-board.tsx`): título, subtítulo, "CAMPEÓN", cabeceras de tabla, estados vacíos, "TU MEJOR MARCA EN…" y el botón de volver. Los nombres de jugadores y `game.title` (contenido de Supabase) no se tocan.
- `.toLocaleString(locale)` pasa a usar `"es-ES"` o `"en-US"` según el idioma activo, en todos los archivos donde ya se usa (`home-content.tsx`, `game-card.tsx`, `game-detail-content.tsx`, `hall-of-fame-board.tsx`).

**Out of scope (para otro spec):**

- Todo lo que ocurre dentro de `/games/[id]/play`: `game-player.tsx`, `asteroids-player.tsx`, `tetris-player.tsx`, `arkanoid-player.tsx`, `snake-player.tsx`, `GameOverModal` y los 4 `engine.ts`. El HUD (Jugador/Puntuación/Vidas/Nivel), los botones PAUSA/FIN/SALIR, los overlays (EN PAUSA, NIVEL N SUPERADO, ¡VICTORIA!) y el modal de fin de partida quedan en español.
- Contenido que vive en Supabase: títulos, descripciones cortas/largas y categorías de los juegos, nombres de jugadores guardados y fechas de partidas.
- El nombre por defecto `"INVITADO"` que se guarda en `av_user` (login como invitado / HUD del reproductor) — es un valor de datos persistido, no una etiqueta de interfaz, y traducirlo dinámicamente lo desincronizaría de lo ya guardado.
- El mensaje de error `"Todos los campos son obligatorios."` de `app/actions/contact.ts` — corre en el servidor como Server Action y no tiene forma de conocer el idioma elegido en el cliente sin hilos adicionales (cookie, param); la validación del lado del cliente en `about-contact-form.tsx` ya impide llegar a ese caso en el flujo normal.
- `<html lang>` y el `<title>`/`<meta description>` de `app/layout.tsx` (ya decidido: quedan fijos en español).
- Rutas con prefijo de idioma (`/en/...`, `/es/...`) o cualquier i18n routing de Next.js.
- Cualquier idioma además de español e inglés.
- Tests automatizados.

## Data model

```ts
// lib/i18n/translations.ts
export type Locale = "es" | "en";

const es = {
  nav: {
    home: "Inicio",
    library: "Biblioteca",
    hallOfFame: "Salón de la Fama",
    about: "Acerca de",
    signIn: "Iniciar Sesión",
    signOut: "Cerrar Sesión",
    menu: "Menú",
    credits: "CRÉDITOS · 03",
  },
  footer: {
    copyright: "© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0",
  },
  common: {
    allCategory: "TODOS", // el chip "TODOS" en games-browser; el resto de categorías no cambia
  },
  home: {
    /* ~25 claves: heroEyebrow, heroTitleLine1-3, heroSub, ctaExplore, ctaCreateAccount,
       scrollHint, sectionWhyTitle, features (4 × {title, desc}), sectionGamesTitle,
       viewAllGames, sectionStatsTitle, stats (3 × {n, unit, sub}), sectionActivityTitle,
       recentScoresTitle, recentScoresEmpty, topPlayersTitle, viewHallOfFame,
       topPlayersEmpty, sectionPricingTitle, pricing{...}, faq (3 × {q, a}),
       finalTitle, finalCta, finalTag */
  },
  gamesCatalog: {
    /* heroSubtitle, searchPlaceholder, noResultsTitle, noResultsBody */
  },
  gameCard: { bestScore: "MEJOR PUNTUACIÓN", play: "JUGAR" },
  gameDetail: {
    /* tagSinglePlayer, tagKeyboardTouch, tagRetro, statPlays, statBest, statDifficulty,
       playNow, backToVault, leaderboardTitle */
  },
  auth: {
    /* subtitle, tabSignIn, tabSignUp, fieldUser, fieldEmail, fieldPassword,
       submitSignIn, submitSignUp, guestButton, socialDivider, googleButton,
       githubButton, termsLine */
  },
  about: {
    /* kicker, title, mission, highlights (3 × string), contactKicker, contactTitle,
       contactSub, tips (3 × string) */
  },
  contactForm: {
    /* fieldName, fieldEmail, fieldMessage, msgPlaceholder, submitIdle, submitPending,
       successLines (4 × string), successButton */
  },
  hallOfFame: {
    /* title, subtitle, champion, colRank, colPlayer, colScore, colDate,
       emptyForGame, yourBestIn, backToLibrary */
  },
} satisfies Record<string, unknown>;

// "en" debe tener exactamente las mismas claves que "es" — el tipo lo obliga.
const en: typeof es = {/* misma forma, valores en inglés */};

export const translations: Record<Locale, typeof es> = { es, en };
export type Dictionary = typeof es;
```

```ts
// lib/i18n/language-context.tsx
"use client";

export type LanguageContextValue = {
  language: Locale;
  setLanguage: (lang: Locale) => void;
  dict: Dictionary; // translations[language]
  localeTag: "es-ES" | "en-US"; // para reemplazar los .toLocaleString("es-ES") existentes
};

export function LanguageProvider({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element;
export function useLanguage(): LanguageContextValue;
```

**localStorage:**

```
// "av_lang" -> "es" | "en"  (valor ausente o inválido -> se resuelve por navigator.language)
```

**Convenciones:**

- El primer render (SSR y la hidratación inicial en cliente) siempre asume `"es"`, igual que el `<html lang="es">` fijo de `app/layout.tsx`. Un `useEffect` dentro de `LanguageProvider` lee `av_lang`; si no existe, usa `navigator.language` (`en*` → `"en"`, cualquier otro valor → `"es"`) y solo entonces cambia el estado si corresponde a `"en"`. Esto puede producir un cambio visible ES→EN justo después de la primera pintura para quien visita por primera vez con el navegador en inglés — aceptado explícitamente (ver Decisions/Risks).
- `setLanguage` escribe de inmediato en `localStorage["av_lang"]` y actualiza el contexto; ningún componente lee `localStorage` directamente salvo `LanguageProvider`.
- Consumo en componentes: `const { dict, language, setLanguage, localeTag } = useLanguage();` y luego `{dict.nav.home}` / `score.toLocaleString(localeTag)`. Sin funciones `t()` con claves de texto — el objeto `dict` ya da autocompletado y errores de tipo si falta una clave.
- `game.title`, `game.short`, `game.long`, `game.cat`, nombres de jugadores y fechas nunca pasan por `dict` — siguen viniendo tal cual de Supabase.

## Implementation plan

1. **Infraestructura de i18n.** Crear `lib/i18n/translations.ts` (diccionario `es`/`en` completo, con las claves listadas en Data model) y `lib/i18n/language-context.tsx` (`LanguageProvider` + `useLanguage()`). No se conecta a ningún componente todavía.
   _Test:_ `npm run build` compila sin errores de tipos.

2. **Envolver el árbol con el provider.** Importar `LanguageProvider` en `app/layout.tsx` alrededor de `<Nav />`, `<main>` y el footer. Extraer el footer a `components/site-footer.tsx` (Client Component) que usa `useLanguage()`.
   _Test:_ `npm run dev` levanta sin errores; el footer sigue mostrando el texto en español (nada visible cambia todavía).

3. **Selector de idioma en el Nav.** Agregar el toggle ES/EN a `components/nav.tsx` (nav de escritorio y panel móvil) llamando a `setLanguage`, y traducir todos los textos del Nav vía `dict`.
   _Test manual:_ el botón cambia el idioma de los links del Nav al instante; recargar la página conserva el idioma elegido.

4. **Traducir Home.** Crear `components/home-content.tsx` (Client Component) con el JSX actual de `app/page.tsx`, recibiendo `games`/`recentScores`/`topPlayers` como props ya resueltas; `app/page.tsx` queda como Server Component delgado que solo hace el `fetch` y renderiza `<HomeContent ... />`.
   _Test manual:_ en `/`, alternar el selector traduce hero, las 4 `FEATURES`, stats, actividad en vivo (incluidos los estados vacíos), pricing/FAQ y el CTA final, sin recargar la página.

5. **Traducir catálogo y tarjetas.** Crear `components/games-catalog-hero.tsx` para el hero de `app/games/page.tsx`; traducir `components/games-browser.tsx` (placeholder de búsqueda, chip "TODOS", estado "NO HAY RESULTADOS") y `components/game-card.tsx` (etiqueta "MEJOR PUNTUACIÓN" y botón "JUGAR").
   _Test manual:_ en `/games`, alternar el selector traduce el hero, el buscador, el chip "TODOS" y las tarjetas; el resto de categorías (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`) se ve igual en ambos idiomas.

6. **Traducir detalle de juego.** Crear `components/game-detail-content.tsx` con el JSX actual de `app/games/[id]/page.tsx`, recibiendo `game`/`scores` como props; el `page.tsx` queda delgado.
   _Test manual:_ en `/games/<id>`, alternar el selector traduce las 3 etiquetas fijas, el stat-strip, los botones y "MEJORES PUNTUACIONES"; título, descripción y categoría del juego no cambian.

7. **Traducir Login.** Traducir `components/auth-form.tsx` completo (tabs, labels, placeholders, botones, divisor social, línea de términos).
   _Test manual:_ en `/login`, alternar el selector traduce todo el formulario sin perder lo ya escrito en los campos.

8. **Traducir Acerca de + Contacto.** Traducir `app/about/page.tsx` y `components/about-contact-form.tsx`, incluida la pantalla de éxito tipo terminal.
   _Test manual:_ en `/about`, alternar el selector traduce hero, highlights, bloque de contacto y el formulario; enviar el formulario sigue funcionando en ambos idiomas (el mensaje de error de validación del servidor queda en español, según lo acordado en Scope).

9. **Traducir Salón de la Fama.** Traducir `components/hall-of-fame-board.tsx` (título, subtítulo, "CAMPEÓN", cabeceras de tabla, estados vacíos, "TU MEJOR MARCA EN…", botón de volver).
   _Test manual:_ en `/hall-of-fame`, alternar el selector traduce todo lo anterior; nombres de jugadores y títulos de juego no cambian.

10. **Formato numérico por idioma.** Reemplazar los `.toLocaleString("es-ES")` restantes por `.toLocaleString(localeTag)` en `home-content.tsx`, `game-card.tsx`, `game-detail-content.tsx` y `hall-of-fame-board.tsx`.
    _Test manual:_ con el selector en inglés, las puntuaciones usan coma como separador de miles; en español, punto.

11. **Repaso final con Playwright.** Recorrer las 7 páginas en scope (`/`, `/games`, `/games/<id>`, `/login`, `/about`, `/hall-of-fame`, más Nav/footer compartidos) alternando el selector, en viewport de escritorio y móvil, verificando que ningún texto en scope queda a medio traducir y que `/games/<id>/play` permanece siempre en español. Ajustar cualquier desbordamiento de texto en inglés (suele diferir en longitud del español) en chips, botones y tarjetas.

## Acceptance criteria

- [ ] `npm run dev` levanta sin errores en consola en `/`, `/games`, `/games/<id>`, `/login`, `/about` y `/hall-of-fame`.
- [ ] El Nav muestra un selector ES/EN visible en escritorio y en el panel móvil, y ambos reflejan siempre el mismo idioma activo.
- [ ] Cambiar el idioma traduce el texto de la página actual **al instante**, sin recargar ni navegar.
- [ ] El idioma elegido persiste en `localStorage` bajo la clave `av_lang` y sobrevive a recargar la página y a navegar entre rutas.
- [ ] Sin `av_lang` guardado, un navegador configurado en inglés (`navigator.language` que empieza con `en`) arranca en inglés tras el primer render; cualquier otro idioma de navegador arranca en español.
- [ ] Nav, footer, Home, catálogo (`/games`), detalle de juego, Login, Acerca de/Contacto y Salón de la Fama muestran **todo** su texto estático en el idioma activo, sin mezclar español e inglés en la misma pantalla.
- [ ] `game.title`, `game.short`, `game.long` y `game.cat` (contenido de Supabase) se muestran igual sin importar el idioma elegido.
- [ ] El chip "TODOS" del catálogo se traduce a "ALL"; los chips `ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS` no cambian visualmente entre idiomas.
- [ ] Las puntuaciones y contadores (`.toLocaleString`) usan separador de miles con coma en inglés y con punto en español, en Home, tarjetas de juego, detalle de juego y Salón de la Fama.
- [ ] El formulario de contacto (`/about`) se envía correctamente en ambos idiomas y muestra la pantalla de éxito traducida; el mensaje de error de validación del servidor permanece en español en ambos idiomas.
- [ ] `/games/<id>/play` (los 4 reproductores y el genérico) se muestra siempre en español, sin importar el idioma elegido en el resto del sitio, incluyendo HUD, botones PAUSA/FIN/SALIR, overlays y `GameOverModal`.
- [ ] `<html lang>` y el `<title>`/`<meta description>` de `app/layout.tsx` permanecen fijos en español en ambos idiomas.
- [ ] El nombre `"INVITADO"` guardado al jugar como invitado no cambia de idioma dinámicamente.
- [ ] Cambiar de idioma en una página y navegar a otra mantiene el nuevo idioma sin parpadeo de vuelta al español.
- [ ] Ningún archivo de `en` en `lib/i18n/translations.ts` deja una clave sin traducir (el tipo `typeof es` lo fuerza en tiempo de compilación).
- [ ] La única clave nueva agregada a `localStorage` por este spec es `av_lang`.
- [ ] `npm run build` termina sin errores.

## Decisions

- **Yes:** alcance limitado a la interfaz estática pública (Nav, footer, Home, catálogo, detalle de juego, Login, Acerca de/Contacto, Salón de la Fama). Confirmado con el usuario entre tres alcances posibles.
- **No:** incluir el HUD, los overlays y `GameOverModal` de los reproductores en este spec. El usuario eligió explícitamente el alcance más chico de los tres ofrecidos.
- **No:** traducir contenido de Supabase (títulos, descripciones y categorías de los juegos). Requeriría columnas o claves nuevas en la tabla `games` y es un spec en sí mismo.
- **Yes:** selector en el Nav + `localStorage` (`av_lang`), sin cambiar ninguna URL. Sigue el patrón mock ya existente (`av_user`, `av_scores`, `av_arkanoid_sound`) y no rompe ningún enlace ya compartido.
- **No:** i18n routing de Next.js con prefijos `/es`/`/en`. Más ceremonia, y rompería las URLs actuales de juegos y del salón de la fama.
- **Yes:** detectar `navigator.language` cuando no hay preferencia guardada, con fallback a español para cualquier idioma no reconocido. Da una primera experiencia razonable a un visitante angloparlante sin forzar una elección manual.
- **Yes:** `<html lang>` y el `<title>`/`<meta description>` de `app/layout.tsx` quedan fijos en español. Se generan en servidor y no hay forma de conocer el idioma antes de la primera pintura con una preferencia que solo vive en `localStorage`.
- **No:** reescribir `document.title`/`lang` desde el cliente tras montar. Añadiría un cambio visible post-carga sin beneficio real de SEO (los rastreadores leen el HTML servido, no el DOM tras hidratar).
- **Yes:** extraer el marcado de Home, catálogo y detalle a Client Components hermanos (`home-content.tsx`, `games-catalog-hero.tsx`, `game-detail-content.tsx`) que reciben los datos ya resueltos como props. Sigue el mismo patrón que ya usan `GamesBrowser` y `HallOfFameBoard`, sin tocar cómo se hace el `fetch`.
- **No:** convertir esas páginas enteras en Client Components con fetch en cliente. Cambiaría la arquitectura de datos del proyecto (Server Components + `lib/data/*`) mucho más de lo que pide este spec.
- **Yes:** `.toLocaleString` alterna entre `"es-ES"` y `"en-US"` según el idioma activo. Mismo cambio mecánico en los 4 archivos que ya formatean números; evita que el inglés se vea con puntos como separador de miles.
- **Yes:** `useLanguage()` devuelve un `dict` tipado en vez de una función `t(key: string)`. Da autocompletado y error de compilación si falta una clave en `en`, y evita bugs de claves mal escritas en strings sueltos.
- **No:** usar `next-intl` u otra librería de i18n. El resto del proyecto es "hand-rolled" (todo se resuelve hoy con `localStorage` + Context/props), y el volumen de texto no justifica una dependencia nueva.
- **No:** traducir el nombre `"INVITADO"` guardado como dato. Es un valor persistido, no una etiqueta de interfaz; traducirlo dinámicamente lo desincronizaría de lo ya guardado en `localStorage`.
- **No:** traducir el mensaje de error del Server Action de contacto (`"Todos los campos son obligatorios."`). Corre en el servidor sin conocer el idioma del cliente, y la validación del lado del cliente en `about-contact-form.tsx` ya evita llegar a ese caso en el flujo normal.

## Risks

| Riesgo                                                                                                                                                                                                                                                                                   | Mitigación                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El primer render siempre asume español (para coincidir con `<html lang="es">`); un visitante angloparlante sin `av_lang` guardado ve un salto ES→EN justo después de la primera pintura, una vez que el `useEffect` de `LanguageProvider` lee `navigator.language`.                      | Aceptado explícitamente (ver Decisions). El salto ocurre una sola vez, antes de cualquier interacción, y no vuelve a pasar una vez que `av_lang` queda guardado.                                            |
| Al extraer Home, el hero del catálogo y el detalle de juego a nuevos Client Components, es fácil olvidar pasar alguna prop (`games`, `recentScores`, `topPlayers`, `game`, `scores`) o dejar duplicada lógica que hoy vive en el Server Component (`colorByTitle`, `slice(0, 6)`, etc.). | Cada Client Component nuevo recibe exactamente los mismos props que hoy calcula el `page.tsx` correspondiente; el paso 4/6 del plan mueve el JSX tal cual, sin recalcular nada dentro del nuevo componente. |
| El diccionario `en` puede quedar incompleto o con una clave de menos y no fallar en runtime, solo verse en blanco.                                                                                                                                                                       | El tipo `en: typeof es` fuerza un error de compilación si falta cualquier clave; `npm run build` (pasos 1 y 11) lo detecta antes de mergear.                                                                |
| Textos en inglés más largos o más cortos que el español (p. ej. "MEJOR PUNTUACIÓN" vs "BEST SCORE", o los tres FAQ) pueden desbordar chips, botones o tarjetas de ancho fijo.                                                                                                            | Revisado explícitamente en el paso 11 con Playwright, en escritorio y móvil, para las 7 páginas en scope.                                                                                                   |
| `components/nav.tsx` ya maneja bastante estado (usuario, menú móvil, pathname); agregar el estado de idioma ahí mismo en vez de consumir el contexto puede desincronizar el Nav del resto del sitio.                                                                                     | El Nav consume `useLanguage()` como cualquier otro componente — no guarda su propio estado de idioma ni escribe `localStorage["av_lang"]` directamente; solo `LanguageProvider` lo hace.                    |
| Next.js 16.2.10 no es el Next.js del conocimiento de entrenamiento, en particular para Client/Server Component boundaries y cómo un Server Component le pasa props ya resueltas a un Client Component hijo.                                                                              | Antes del paso 1, revisar `node_modules/next/dist/docs/01-app/` como exige `CLAUDE.md`, en particular la sección de Client vs Server Components.                                                            |
| Si a futuro se agrega un idioma más (p. ej. portugués), el diseño actual de `Record<Locale, Dictionary>` con `Locale = "es"                                                                                                                                                              | "en"` obliga a tocar varios archivos.                                                                                                                                                                       | Aceptado: este spec cubre explícitamente solo dos idiomas (ver Scope); una tercera lengua es trabajo de otro spec. |

## Lo que **no** está en este spec

- Todo lo que ocurre dentro de `/games/[id]/play`: HUD, botones PAUSA/FIN/SALIR, overlays de pausa/nivel/victoria y `GameOverModal` de los 4 reproductores y del genérico.
- Traducción del contenido que vive en Supabase: títulos, descripciones y categorías de los juegos, nombres de jugadores y fechas.
- Traducción dinámica del nombre `"INVITADO"` guardado en `av_user`.
- El mensaje de error de validación del Server Action de contacto.
- `<html lang>` y metadata (`<title>`/`<meta description>`) de `app/layout.tsx`.
- Rutas con prefijo de idioma o cualquier i18n routing de Next.js.
- Cualquier idioma además de español e inglés.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
