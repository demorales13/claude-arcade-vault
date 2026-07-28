# SPEC 11 — Traducción del contenido de juegos (título/descripciones) según el idioma

> **Status:** Implemented
> **Depends on:** 10-selector-idioma-es-en, 06-leaderboard-catalogo-supabase
> **Date:** 2026-07-27
> **Objective:** Extender el selector ES/EN (spec 10) para que también traduzca el título, la descripción corta y la descripción larga de cada juego —contenido que hoy vive fijo en español en la tabla `games` de Supabase—, agregando columnas `title_en`/`short_en`/`long_en` con fallback automático a español cuando falten, y aplicando la traducción en catálogo, detalle, home, salón de la fama, búsqueda y el HUD del reproductor.

## Scope

**In:**

- Migración SQL en Supabase: agregar columnas `title_en`, `short_en`, `long_en` (`text`, nullable) a la tabla `games`. No se agrega `NOT NULL` ni `check` — el fallback a español ya cubre el caso de que falten.
- `games_with_stats` no requiere cambios: la vista hace `select g.*, ...`, así que las columnas nuevas quedan expuestas automáticamente.
- `UPDATE games SET ...` manual (mismo patrón que el `insert into games` de cada spec de juego) con la traducción al inglés de los 4 juegos existentes: `asteroids`, `tetris`, `arkanoid`, `snake`.
- Tipos: `Game`/`GameWithStats` en `app/data/games.ts` ganan `title_en: string | null`, `short_en: string | null`, `long_en: string | null`.
- Helper nuevo `lib/i18n/localize-game.ts` con `localizedGameText(game, language)`, que devuelve `{ title, short, long }` en el idioma activo, cayendo a español campo por campo si el `_en` correspondiente es `null`/vacío.
- Aplicar el helper en: `GameCard` (tarjeta del catálogo: título + descripción corta), `GameDetailContent` (título + descripción larga), `MiniCard` en `home-content.tsx` (título en la sección de juegos destacados del home), `HallOfFameBoard` (pestañas por juego y las líneas "sin puntuaciones en `<juego>`" / "tu mejor marca en `<juego>`"), y el buscador de `GamesBrowser` (filtra por el título en el idioma activo, no por ambos).
- `getRecentScores` (`lib/data/games.ts`): el `select` pasa de `games(title)` a `games(id, title, title_en)`; el tipo de retorno gana `gameId` y `game_en` junto a `game` (español). `home-content.tsx` localiza el nombre de juego de "Actividad en vivo" al renderizar, y `colorByTitle` pasa a indexarse por `game.id` en vez de por `game.title` (hoy se rompería con títulos bilingües).
- HUD del reproductor: en `components/game-player.tsx` y en los 4 específicos (`asteroids-player.tsx`, `tetris-player.tsx`, `arkanoid-player.tsx`, `snake-player.tsx`), la línea `{game.title} · CRT-83 · 60 HZ` usa `useLanguage()` + `localizedGameText` para mostrar el título en el idioma activo. **Única excepción** a la regla de spec 10 de que todo `/play` queda fijo en español — confirmada explícitamente con el usuario.
- Actualizar la plantilla SQL de `.claude/skills/add-game/recipe.md` (el bloque `insert into games`) para incluir `title_en`, `short_en`, `long_en` como columnas opcionales, de forma que los juegos agregados a futuro con `/add-game` sigan el mismo patrón desde el principio.

**Out of scope (queda igual que en spec 10, o para otro spec):**

- Todo lo demás dentro de `/games/[id]/play`: etiquetas del HUD, botones PAUSA/FIN/SALIR, overlays y `GameOverModal` — siguen fijos en español.
- La categoría (`game.cat`: `ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`) no se traduce — ya es igual en ambos idiomas, sin cambios respecto a spec 10.
- Cover art, colores de juego, tags fijos de la ficha ("1 JUGADOR", "TECLADO / TÁCTIL", "RETRO 1985") — son texto de interfaz ya cubierto por `dict`, no contenido de juego.
- Traducción automática/por API en tiempo real — las traducciones son texto estático escrito a mano y cargado por SQL, mismo criterio "hand-rolled" del resto del proyecto.
- Búsqueda que combine ambos idiomas a la vez — ya decidido: busca solo en el idioma activo.
- Idiomas adicionales a ES/EN, rutas con prefijo de idioma, tests automatizados — mismos límites que spec 10.

## Data model

```sql
-- Migración: nuevas columnas opcionales en games (nullable, sin NOT NULL)
alter table games
  add column title_en text,
  add column short_en text,
  add column long_en text;

-- games_with_stats no cambia: usa "select g.*", expone title_en/short_en/long_en solas.

-- Traducción de los 4 juegos existentes (paso manual del usuario en el SQL Editor de Supabase)
update games set
  title_en = 'ASTEROIDS',
  short_en = 'Destroy asteroids in the void, level after level.',
  long_en  = 'Pilot a triangular ship that rotates and thrusts in zero gravity. Fire to break large rocks into medium and small chunks, survive with 3 lives, and grab the triple-shot power-up before the field fills up.'
where id = 'asteroids';

update games set
  title_en = 'TETRIS',
  short_en = 'Fit the pieces together, clear lines, and survive the drop.',
  long_en  = 'Seven tetrominoes fall onto a 10-by-20 board that speeds up level after level. Rotate, shift, and drop each piece to clear lines, chain combos, and go for the four-line Tetris, the T-Spin, and the Perfect Clear before the stack reaches the top.'
where id = 'tetris';

update games set
  title_en = 'ARKANOID',
  short_en = 'Smash the brick wall with the paddle and don''t let the ball drop.',
  long_en  = 'Three brick layouts stand between you and victory: a full grid, a hollow diamond, and a checkerboard. Move the paddle to return the ball, use the edges to angle the bounce up to sixty degrees, and hang on with three lives as the ball speeds up five percent each level.'
where id = 'arkanoid';

update games set
  title_en = 'SNAKE',
  short_en = 'Guide the snake, eat fruit, and don''t crash into yourself.',
  long_en  = 'Control a snake that grows with every fruit it eats on a 20-by-20 grid. Each batch of fruit eaten levels up and speeds up the movement; crashing into your own body or the edge of the board ends the run instantly.'
where id = 'snake';
```

```ts
// app/data/games.ts
export type Game = {
  id: string;
  title: string;
  title_en: string | null;
  short: string;
  short_en: string | null;
  long: string;
  long_en: string | null;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
};
// GameWithStats = Game & { best: number; plays: number } — sin cambios en su definición
```

```ts
// lib/i18n/localize-game.ts
import type { Locale } from "./translations";

type LocalizableGame = {
  title: string;
  title_en: string | null;
  short: string;
  short_en: string | null;
  long: string;
  long_en: string | null;
};

export function localizedGameText(
  game: LocalizableGame,
  language: Locale,
): { title: string; short: string; long: string } {
  if (language !== "en") {
    return { title: game.title, short: game.short, long: game.long };
  }
  return {
    title: game.title_en || game.title,
    short: game.short_en || game.short,
    long: game.long_en || game.long,
  };
}
```

```ts
// lib/data/games.ts — getRecentScores
// select: "player_name, score, created_at, games(id, title, title_en)"
export async function getRecentScores(limit: number): Promise<
  {
    player: string;
    gameId: string;
    game: string; // título en español (fallback)
    game_en: string | null;
    score: number;
    at: string;
  }[]
>;
```

**Convenciones:**

- `localizedGameText` es la única función que decide el fallback; ningún componente compara `_en` contra `null`/`""` por su cuenta.
- `getRecentScores` no usa `localizedGameText` directamente (no tiene el shape `LocalizableGame` completo) — `home-content.tsx` resuelve `language === "en" ? (r.game_en || r.game) : r.game` inline, y usa `r.gameId` (no el título) para el lookup en `colorByTitle` → renombrado `colorByGameId`.

## Implementation plan

1. **Migración SQL (paso manual del usuario).** Ejecutar el `alter table` + los 4 `update` del Data model en el SQL Editor de Supabase.
   _Test:_ `select id, title, title_en, short_en, long_en from games;` devuelve las 4 filas con las columnas nuevas pobladas.

2. **Tipos y helper de localización.** Agregar `title_en`/`short_en`/`long_en` a `Game` en `app/data/games.ts`; crear `lib/i18n/localize-game.ts` con `localizedGameText`. No se conecta a ningún componente todavía.
   _Test:_ `npm run build` compila sin errores de tipos.

3. **Catálogo y tarjetas.** Aplicar `localizedGameText` en `GameCard` (título + `short`) y en el filtro de `GamesBrowser` (compara contra el título ya localizado, no `g.title` crudo).
   _Test manual:_ en `/games`, alternar el selector traduce título y descripción corta de las 4 tarjetas; buscar "snake" en inglés y "serpiente" en español encuentra la tarjeta correspondiente en cada modo.

4. **Detalle de juego.** Aplicar `localizedGameText` en `GameDetailContent` (título + `long`).
   _Test manual:_ en `/games/<id>`, alternar el selector traduce título y descripción larga; categoría, stats y botones siguen igual que en spec 10.

5. **Home.** Aplicar `localizedGameText` en `MiniCard` (título) dentro de `home-content.tsx`.
   _Test manual:_ en `/`, la sección de juegos destacados traduce el título de cada `MiniCard` al alternar el selector.

6. **Actividad en vivo.** Cambiar el `select` de `getRecentScores` (`lib/data/games.ts`) a `games(id, title, title_en)` y su tipo de retorno (`gameId`, `game`, `game_en`); en `home-content.tsx`, renombrar `colorByTitle` a `colorByGameId` (indexado por `g.id`) y mostrar `language === "en" ? (r.game_en || r.game) : r.game`.
   _Test manual:_ en `/`, "Actividad en vivo" traduce el nombre del juego de cada fila al alternar el selector, y el color neón de cada fila sigue siendo correcto en ambos idiomas.

7. **Salón de la Fama.** Aplicar `localizedGameText` en `HallOfFameBoard`: pestañas por juego y las líneas "sin puntuaciones en `<juego>`" / "tu mejor marca en `<juego>`".
   _Test manual:_ en `/hall-of-fame`, alternar el selector traduce el nombre de juego en pestañas y en ambas líneas; nombres de jugadores y puntuaciones no cambian.

8. **HUD del reproductor.** En `components/game-player.tsx` y en los 4 específicos (`asteroids-player.tsx`, `tetris-player.tsx`, `arkanoid-player.tsx`, `snake-player.tsx`), usar `useLanguage` + `localizedGameText` para traducir solo el título en `{game.title} · CRT-83 · 60 HZ`; el resto del HUD, botones y overlays quedan en español, igual que en spec 10.
   _Test manual:_ jugar cada uno de los 4 juegos con el selector en inglés muestra el título traducido en el HUD; PAUSA/FIN/SALIR y los overlays siguen en español.

9. **Plantilla de `/add-game`.** Actualizar el bloque `insert into games` de `.claude/skills/add-game/recipe.md` para incluir `title_en`/`short_en`/`long_en` como columnas opcionales, con una nota de que si se omiten, la interfaz muestra el texto en español como fallback.
   _Test:_ revisión manual del archivo — no ejecuta código.

10. **Repaso final con Playwright.** Recorrer `/games`, `/games/<id>`, `/` y `/hall-of-fame` alternando el selector, y entrar a jugar cada uno de los 4 juegos, verificando título/descripciones traducidos donde corresponde y que `/play` sigue en español salvo el título del HUD.
    _Test:_ sin errores de consola; ningún texto queda a medio traducir en las páginas y componentes en scope.

## Acceptance criteria

- [x] La tabla `games` en Supabase tiene las columnas `title_en`, `short_en`, `long_en` (nullable), y las 4 filas existentes (`asteroids`, `tetris`, `arkanoid`, `snake`) las tienen pobladas.
- [x] `npm run dev` levanta sin errores en consola en `/`, `/games`, `/games/<id>` y `/hall-of-fame`.
- [x] En `/games`, alternar el selector traduce título y descripción corta de las 4 tarjetas al instante, sin recargar.
- [x] En `/games/<id>`, alternar el selector traduce título y descripción larga al instante.
- [x] En `/`, alternar el selector traduce el título de cada `MiniCard` de la sección de juegos destacados y el nombre de juego de cada fila de "Actividad en vivo".
- [x] El color neón de cada fila de "Actividad en vivo" se mantiene correcto en ambos idiomas (indexado por `game.id`, no por título).
- [x] En `/hall-of-fame`, alternar el selector traduce el nombre de juego en las pestañas y en "sin puntuaciones en `<juego>`" / "tu mejor marca en `<juego>`"; nombres de jugadores y puntuaciones no cambian.
- [x] El buscador de `/games` encuentra el juego correcto usando el título en el idioma activo (p. ej. "snake" en inglés, "serpiente" en español).
- [x] La categoría (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`) no cambia entre idiomas, en ningún lugar.
- [x] Con el selector en inglés, el HUD de `/games/<id>/play` (los 4 juegos + el genérico) muestra el título del juego traducido en `{título} · CRT-83 · 60 HZ`; el resto del HUD, los botones PAUSA/FIN/SALIR, los overlays y `GameOverModal` permanecen en español.
- [x] Si un juego no tiene `title_en`/`short_en`/`long_en` (valor `null` o vacío), el campo correspondiente muestra el texto en español en modo inglés, sin quedar vacío.
- [x] `.claude/skills/add-game/recipe.md` documenta las 3 columnas `_en` como opcionales en la plantilla SQL de `insert into games`.
- [x] `npm run build` termina sin errores de tipos.

## Decisions

- **Yes:** alcance = título + descripción corta + descripción larga, los tres traducidos. Elegido explícitamente por el usuario ("todo, el nombre, la descripción corta, la descripción larga").
- **Yes:** columnas nuevas en Supabase (`title_en`/`short_en`/`long_en`) en vez de un diccionario estático en código. Mantiene todo el contenido del catálogo en un solo lugar y sigue el mismo patrón manual (`insert`/`update` vía SQL Editor) que ya usan specs 06-09.
- **No:** diccionario "hand-rolled" en `lib/i18n` para el contenido de juegos. Es una excepción justificada al criterio general del proyecto: el contenido de juegos ya vive en Supabase (a diferencia del texto de interfaz de `translations.ts`), así que seguir ese modelo es más consistente que partirlo en dos fuentes.
- **Yes:** fallback a español cuando falta `_en`, en vez de forzar la traducción en compilación. Un juego nuevo sin `_en` no rompe el build ni deja huecos en pantalla.
- **No:** tipar el contenido de juegos como `en: typeof es` (forzado en compilación, como en `translations.ts`). Los datos vienen de Supabase en runtime, no de un objeto TS — forzarlo requeriría validación en runtime, fuera de alcance.
- **Yes:** el HUD del reproductor traduce el título del juego, como única excepción a la regla "todo `/play` en español" de spec 10. Decisión explícita del usuario.
- **No:** traducir el resto del HUD, botones u overlays de `/play`. Se mantiene la decisión original de spec 10 sin más excepciones.
- **Yes:** "Actividad en vivo" (home) y Salón de la Fama también traducen el nombre del juego, por consistencia con catálogo y detalle. Elegido explícitamente por el usuario.
- **Yes:** la búsqueda del catálogo filtra solo por el título del idioma activo, no por ambos a la vez. Coherente con lo que el usuario ve en pantalla en ese momento.
- **Yes:** actualizar `recipe.md` de `/add-game` para incluir las columnas `_en` como opcionales en la plantilla SQL, así los juegos futuros siguen el mismo patrón desde el inicio.
- **No:** traducir la categoría (`cat`). Ya se decidió en spec 10 que es igual en ambos idiomas (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`).
- **No:** tocar `games_with_stats` ni las políticas RLS. La vista usa `select g.*, ...`, así que expone las columnas nuevas automáticamente.

## Risks

| Riesgo                                                                                                                                                                            | Mitigación                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Las columnas `_en` son nullable sin `check` — un juego nuevo agregado sin completarlas se ve bien gracias al fallback, pero la falta de traducción puede pasar desapercibida.     | `recipe.md` deja explícita la nota de que son opcionales pero recomendadas; no se puede forzar en compilación porque el dato vive en Supabase, no en código.            |
| El HUD del reproductor traduce el título pero nada más — un visitante podría esperar que todo `/play` cambie de idioma al ver el título traducido.                                | Aceptado explícitamente por el usuario como la única excepción a spec 10; el resto de `/play` sigue en español sin ambigüedad (botones, overlays, `GameOverModal`).     |
| `getRecentScores` cambia su tipo de retorno (`gameId`, `game_en` nuevos) — cualquier otro consumidor que no se actualice queda con un tipo desincronizado.                        | Solo `home-content.tsx` consume `getRecentScores` hoy (confirmado por grep); el paso 6 del plan actualiza función y consumidor juntos.                                  |
| `colorByTitle` → `colorByGameId` es un cambio silencioso: si se omite, el color neón de "Actividad en vivo" se ve mal (cae a cyan por defecto) en vez de fallar de forma visible. | Cubierto explícitamente en el test manual del paso 6: comparar el color de cada fila en ambos idiomas.                                                                  |
| Las traducciones al inglés del bloque SQL (Data model) las redacté yo, no el usuario — pueden tener matices no exactos.                                                           | El usuario revisa el bloque SQL antes de ejecutarlo manualmente en el SQL Editor de Supabase (paso 1 del plan); mismo flujo de revisión manual que ya usan specs 06-09. |

## Implementation notes

- **Desviación del Data model:** la asunción "`games_with_stats` no requiere cambios porque hace `select g.*`" resultó incorrecta — la vista real lista columnas explícitas (`g.id, g.title, g.short, g.long, g.cat, g.cover, g.color, g.created_at, ...`), sin `g.*`. Se corrigió con una migración adicional (`create or replace view games_with_stats ...`) que agrega `g.title_en, g.short_en, g.long_en` al final del `select` (Postgres no permite insertar columnas en medio de una vista existente sin `DROP`). Verificado con Playwright que `/games`, `/games/<id>`, `/` y `/hall-of-fame` ya reciben los campos `_en` correctamente.
- El paso 1 (migración SQL) se ejecutó directamente vía las herramientas MCP de Supabase conectadas a este proyecto, no de forma manual en el SQL Editor — el usuario autorizó ejecutar todo el plan sin pausas.
- Repaso final con Playwright (paso 10) cubrió: catálogo + buscador, detalle, home (MiniCard + Actividad en vivo, incluido el color neón por `game.id` en ambos idiomas), Salón de la Fama (pestañas), y el HUD de los 4 reproductores + build/type-check. Sin errores de consola en ninguna página.
