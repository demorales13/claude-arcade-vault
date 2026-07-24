# SPEC 06 — Leaderboard y catálogo de juegos en Supabase

> **Status:** Implemented
> **Depends on:** 04-supabase-integration, 05-asteroids-game
> **Date:** 2026-07-24
> **Objective:** Migrar el catálogo de juegos y las puntuaciones de datos mock (`GAMES` estático, `seededScores()`, `av_scores` en `localStorage`) a tablas reales de Supabase (`games` y `scores`), conectando `/games`, `/games/[id]`, `/hall-of-fame`, la vista previa de la home y el guardado de puntuación en `GameOverModal` a esos datos reales.

## Scope

**In:**

- SQL de migración completo (`CREATE TABLE games`, `CREATE TABLE scores`, políticas RLS, seed inicial) documentado en el spec para que lo ejecutes manualmente en el SQL Editor de Supabase — mismo patrón que el paso manual de `.env.local` del spec 04.
- Vista o query agregada para calcular `best` (máximo score) y `plays` (nº de partidas) **en vivo** desde `scores`, por juego (ej. vista SQL `games_with_stats` con `LEFT JOIN`/`GROUP BY`).
- `app/data/games.ts`: se elimina el array `GAMES`, `seededScores()` y `PLAYERS` (ya no hacen falta). Se conservan los tipos (`Game`, `GameCategory`, `ScoreRow` o equivalente) y `CATS`.
- Nuevo módulo de acceso a datos (ej. `lib/data/games.ts`) con funciones tipadas: `getGames()`, `getGame(id)`, `getTopScores(gameId, limit)`, `getRecentScores(limit)`, `getTopPlayers(limit)`, `insertScore({ game, score, name })` — usando `lib/supabase/server.ts` para lecturas en Server Components y `lib/supabase/client.ts` para el insert desde el cliente. (Ver Decisions: `insertScore` termina en un archivo separado, `lib/data/scores.ts`, por una restricción técnica de Next.js.)
- `app/games/page.tsx`: pasa a ser Server Component (`getGames()`), delegando el filtro por texto/categoría (estado de cliente) a un nuevo Client Component que conserva el comportamiento actual.
- `app/games/[id]/page.tsx`: reemplaza `GAMES.find`/`seededScores` por `getGame(id)` + `getTopScores(id, 10)` reales.
- `app/hall-of-fame/page.tsx`: Server Component (`getGames()`) + Client Component para tabs/podio/tabla que pide `getTopScores(tab, 12)` real al cambiar de pestaña.
- `app/page.tsx` (home): "JUEGOS DISPONIBLES AHORA" usa `getGames()` (primeros 6) reales; "ACTIVIDAD EN VIVO" (`LATEST_SCORES`, `TOP_PLAYERS`) usa `getRecentScores()`/`getTopPlayers()` reales en vez de los arrays hardcodeados.
- `components/game-player.tsx` y `components/games/asteroids-player.tsx`: `saveScore()` (localStorage) se reemplaza por `insertScore()` contra Supabase; `av_user` en localStorage se sigue leyendo solo para prellenar el nombre, sin cambios ahí.
- `components/game-card.tsx`: sigue mostrando `game.best`, ahora viene de la query real (mismo formato `toLocaleString`).

**Out (fuera de alcance, para otro spec):**

- Supabase Auth real / migrar `av_user` — sigue en `localStorage`, solo se lee para prellenar el nombre en el modal de fin de partida.
- Cualquier validación anti-trampa de puntuaciones (rate limiting, score plausible, captcha) más allá del RLS básico de insert público.
- Tiempo real (Supabase Realtime) — los datos se cargan al entrar a la página o cambiar de pestaña, no se actualizan solos mientras está abierta.
- Supabase CLI / carpeta de migraciones versionadas (decisión ya tomada en el spec 04).
- UI de administración para crear/editar juegos — el catálogo se siembra una sola vez por SQL.
- Los stat-blocks decorativos de la home ("12+ JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING") — quedan como copy fijo.
- Cualquier cambio visual/de diseño en las páginas afectadas — el objetivo es solo la fuente de datos.

## Data model

**SQL (para ejecutar manualmente en el SQL Editor de Supabase):**

```sql
-- Tabla de catálogo de juegos
create table games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  created_at timestamptz not null default now()
);

-- Tabla de puntuaciones (leaderboard)
create table scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references games(id),
  player_name text not null check (length(trim(player_name)) > 0),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx on scores (game_id, score desc);

-- Vista con best/plays calculados en vivo
create view games_with_stats
with (security_invoker = true) as
select
  g.*,
  coalesce(max(s.score), 0) as best,
  count(s.id) as plays
from games g
left join scores s on s.game_id = g.id
group by g.id;

-- RLS
alter table games enable row level security;
create policy "public read games" on games for select using (true);

alter table scores enable row level security;
create policy "public read scores" on scores for select using (true);
create policy "public insert scores" on scores for insert with check (score >= 0 and length(trim(player_name)) > 0);

grant select on games_with_stats to anon, authenticated;

-- Seed: catálogo (solo el/los juego(s) con jugabilidad real implementada;
-- ver Decisions — el resto se agrega juego por juego en specs futuros a
-- medida que se implementan)
insert into games (id, title, short, long, cat, cover, color) values
  ('asteroids', 'ASTEROIDES', 'Destruye asteroides en el vacío, nivel tras nivel.', 'Pilota una nave triangular que rota y propulsa en gravedad cero. Dispara para fragmentar rocas grandes en medianas y pequeñas, sobrevive con 3 vidas y busca el power-up de disparo triple antes de que el campo se llene.', 'SHOOTER', 'cover-asteroids', 'cyan');

-- Seed de puntuaciones: DESCARTADO (ver Decisions). La plataforma arranca con
-- `scores` vacía; el leaderboard se puebla solo con partidas reales.
```

**TypeScript:**

```ts
// app/data/games.ts — se conservan, el resto del archivo se elimina
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
};

export type GameWithStats = Game & { best: number; plays: number };

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
};

export const CATS: ("TODOS" | GameCategory)[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];
```

```ts
// lib/data/games.ts — nuevo módulo de acceso a datos
export async function getGames(): Promise<GameWithStats[]>;
export async function getGame(id: string): Promise<GameWithStats | null>;
export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]>;
export async function getRecentScores(
  limit: number,
): Promise<{ player: string; game: string; score: number; at: string }[]>;
export async function getTopPlayers(
  limit: number,
): Promise<{ rank: number; player: string; score: number }[]>;
```

```ts
// lib/data/scores.ts — separado de games.ts por restricción de Next.js
// (ver Decisions): mezclar next/headers (server) con código importable
// desde un Client Component rompe el build.
export async function insertScore(entry: {
  game: string;
  score: number;
  name: string;
}): Promise<void>;
```

Convenciones:

- `getGames`/`getGame`/`getTopScores`/`getRecentScores`/`getTopPlayers` (en `lib/data/games.ts`) usan `lib/supabase/server.ts` y se llaman desde Server Components. `insertScore` (en `lib/data/scores.ts`) usa `lib/supabase/client.ts` porque se dispara desde un Client Component (`GameOverModal`, vía `game-player.tsx`/`asteroids-player.tsx`) al hacer clic en "GUARDAR PUNTUACIÓN".
- `getTopScores`/`getTopPlayers` calculan `rank` en el propio módulo (posición en el array ya ordenado por `score desc`), igual que hacía `seededScores()`.
- `plays` ya no se formatea con sufijo "K" (ej. "12.4K") — se muestra el conteo real (`toLocaleString("es-ES")`), consecuencia esperada de que ahora es un dato real y no decorativo.

## Implementation plan

1. Documentar y ejecutar el SQL de migración (bloque completo de arriba) en el SQL Editor de Supabase — **paso manual del usuario**. Test: `select * from games_with_stats order by id;` en Supabase devuelve solo la fila de `asteroids` (único juego implementado), con `best = 0` y `plays = 0` (sin seed de `scores`).
2. Crear `lib/data/games.ts` con `getGames()`, `getGame(id)`, `getTopScores(gameId, limit)`, `getRecentScores(limit)`, `getTopPlayers(limit)` (lecturas vía `lib/supabase/server.ts`), sin tocar todavía ningún archivo que las use. Test: `npm run build` compila sin errores (módulo nuevo, aún no consumido).
3. Actualizar `app/games/page.tsx`: convertir a Server Component que llama `getGames()` y pasa los datos a un nuevo Client Component (ej. `components/games-browser.tsx`) que conserva el buscador y los chips de categoría (`CATS`) exactamente como hoy. Test: `/games` muestra la(s) tarjeta(s) reales desde Supabase (1 por ahora: ASTEROIDES); buscar y filtrar por categoría sigue funcionando.
4. Actualizar `app/games/[id]/page.tsx`: reemplazar `GAMES.find`/`seededScores` por `getGame(id)` + `getTopScores(id, 10)`. Test: `/games/asteroids` (y otro id cualquiera) muestra cover/tags/descripción/stat-strip con `best`/`plays` reales y el leaderboard lateral con las 10 mejores puntuaciones reales de ese juego.
5. Actualizar `app/hall-of-fame/page.tsx`: separar en Server Component (`getGames()` para las tabs) + Client Component que pide `getTopScores(tab, 12)` al montar y al cambiar de tab. Test: `/hall-of-fame` muestra podio + tabla reales por cada juego al cambiar de pestaña.
6. Actualizar `app/page.tsx` (home): la sección "JUEGOS DISPONIBLES AHORA" usa `getGames()` (primeros 6); "ACTIVIDAD EN VIVO" usa `getRecentScores()` (reemplaza `LATEST_SCORES`) y `getTopPlayers()` (reemplaza `TOP_PLAYERS`). Test: la home compila como Server Component y muestra datos reales en ambas secciones, sin romper el resto de la página (hero, features, stats decorativos sin tocar).
7. Añadir `insertScore(entry)` (vía `lib/supabase/client.ts`; terminó en `lib/data/scores.ts`, ver Decisions) y reemplazar `saveScore()` (localStorage) por esta función en `components/game-player.tsx` y `components/games/asteroids-player.tsx`; también se actualiza `app/games/[id]/play/page.tsx` (usaba `GAMES.find` síncrono, ahora `getGame(id)` async) porque alimenta a ambos players con datos reales. `av_user`/`readUserName()` no cambia (sigue solo prellenando el nombre). Test manual: jugar "ASTEROIDES" (único juego en el catálogo real por ahora), terminar la partida, guardar puntuación, y verificar en Supabase (o refrescando `/hall-of-fame`) que la fila nueva aparece con el `score`/`name`/`game_id` correctos. (`GamePlayer`, el player mock genérico, queda sin juegos que lo usen hasta que se agregue otro juego al catálogo real, pero su código también se actualiza para no romper el build.)
8. Limpieza: eliminar `GAMES`, `seededScores()` y `PLAYERS` de `app/data/games.ts`, dejando solo `Game`, `GameWithStats`, `ScoreRow`, `GameCategory`, `CATS`. Test: `npm run build` termina sin errores y sin imports rotos en todo el repo.
9. Repaso final con Playwright: recorrer `/`, `/games`, `/games/[id]`, `/hall-of-fame` y el flujo completo de guardar puntuación, comparando contra el comportamiento visual anterior (mismo look & feel, solo cambia la fuente de datos). Test: no hay errores de consola en ninguna ruta; el estado "sin puntuaciones todavía" en `/games/[id]` y `/hall-of-fame` se ve intencional (no como un error o un parpadeo roto).

## Acceptance criteria

- [x] Ejecutado el SQL en Supabase: `games` tiene 1 fila (`asteroids`, el único juego implementado); `scores` arranca vacía (0 filas) — sin seed de puntuaciones.
- [x] `select * from games_with_stats` devuelve `best = 0`/`plays = 0` para `asteroids` mientras `scores` esté vacía, y valores reales en cuanto se inserte alguna puntuación.
- [x] `npm run dev` levanta sin errores de consola en `/`, `/games`, `/games/[id]` (asteroids) y `/hall-of-fame`.
- [x] `/games` muestra la(s) tarjeta(s) leídas de Supabase (1 por ahora), con búsqueda por texto y filtro por categoría funcionando igual que antes.
- [x] `/games/[id]` muestra `best`/`plays` reales en el stat-strip y las 10 mejores puntuaciones reales de ese juego en el aside "MEJORES PUNTUACIONES".
- [x] `/hall-of-fame` muestra, para cada juego (tab), un podio (top 3) y una tabla (top 12) con datos reales de Supabase, actualizando al cambiar de pestaña.
- [x] La home ("JUEGOS DISPONIBLES AHORA" y "ACTIVIDAD EN VIVO") muestra juegos y puntuaciones reales en vez de los arrays hardcodeados `GAMES.slice(0,6)`, `LATEST_SCORES`, `TOP_PLAYERS`.
- [x] Al terminar una partida (mock o "ASTEROIDES") y guardar la puntuación en `GameOverModal`, la fila se inserta en la tabla `scores` de Supabase (verificable en el dashboard o refrescando `/hall-of-fame`); ya no se escribe en `localStorage` `av_scores`.
- [x] El nombre prellenado en `GameOverModal` sigue viniendo de `av_user` (localStorage) sin cambios de comportamiento.
- [x] `app/data/games.ts` ya no exporta `GAMES`, `seededScores` ni `PLAYERS`.
- [x] `npm run build` termina sin errores.
- [x] Ninguna página cambia su diseño/CSS visible — el cambio es exclusivamente la fuente de datos (se añadieron textos mínimos de estado vacío en `/hall-of-fame` y la home, necesarios porque el leaderboard real puede arrancar sin puntuaciones; ver Decisions/Risks).

## Decisions

- **Yes:** migrar tanto el catálogo (`games`) como las puntuaciones (`scores`) a Supabase en un mismo spec, en vez de dos specs separados. El usuario los pidió juntos ("leaderboard" + "tabla de juegos") y están acoplados: `best`/`plays` de `games` se calculan a partir de `scores`.
- **Yes:** `best`/`plays` calculados en vivo (vista `games_with_stats`) en vez de columnas fijas en `games`. Evita que queden desincronizados de las puntuaciones reales; confirmado explícitamente por el usuario.
- **No:** columnas `best`/`plays` como datos editables independientes en `games`. Redundante una vez que se calculan desde `scores`.
- **Yes:** guardado de puntuación exclusivamente en Supabase (`insertScore`), eliminando `av_scores` de `localStorage`. Confirmado por el usuario; simplifica el modelo a una sola fuente de verdad para el leaderboard.
- **Yes:** insert público sin autenticación real (RLS abierto con validación mínima `score >= 0` / `player_name` no vacío). No existe Supabase Auth todavía (diferido explícitamente en el spec 04); esto mantiene el mismo nivel de "confianza" que el `localStorage` actual, documentado como deuda técnica a resolver cuando llegue Auth real.
- **No:** rate limiting, verificación de score plausible o captcha en el insert. Fuera de alcance — se resuelve junto con Auth real en un spec futuro.
- **Yes:** migración vía SQL manual pegado en el SQL Editor de Supabase, sin CLI ni carpeta `supabase/migrations/`. Consistente con la decisión explícita del spec 04 de no usar CLI local.
- **No (revertido tras Paso 3):** seed inicial de `games` con los 9 juegos del mock. Decisión original: sembrar todo el catálogo de una vez, incluidos los 8 juegos que solo tienen un `GamePlayer` genérico/simulado (sin jugabilidad real). Revertido a pedido explícito del usuario: la biblioteca real en Supabase arranca con **solo `asteroids`** (el único juego con jugabilidad implementada de verdad — spec 05); los demás se agregan uno por uno, en specs futuros, a medida que se implementan de verdad. Los 8 registros ya sembrados se borraron de `games` (no tenían scores asociados, así que no hubo conflicto de FK).
- **Yes:** seed inicial de `games` con 1 fila (`asteroids`) vía SQL. El catálogo real solo debe reflejar juegos jugables de verdad, no placeholders.
- **No (revertido tras Paso 1):** seed inicial de `scores`. Decisión original: 12 puntuaciones por juego generadas con `random()` para que las páginas no se vieran vacías al desplegar. Revertido a pedido explícito del usuario tras ejecutar el Paso 1: la plataforma arranca sin puntuaciones y el leaderboard se puebla solo con partidas reales. Las 108 filas de seed se borraron de la tabla `scores` después de haberse insertado (el catálogo `games` no se tocó).
- **No:** intentar replicar el algoritmo pseudo-aleatorio (`seededScores()`) en SQL. Ya no aplica al no sembrar `scores`, pero se documenta como decisión descartada por si se reconsidera un seed en el futuro.
- **Yes:** `/games` y `/hall-of-fame` pasan a Server Component (fetch) + Client Component (interactividad: búsqueda, chips, tabs), separando el patrón de datos del patrón de estado. Sigue la convención ya usada en `app/games/[id]/page.tsx` (Server Component async) y es el patrón idiomático de Next.js App Router.
- **No:** mantener `/games` y `/hall-of-fame` como Client Components que hacen `fetch` en `useEffect`. Perdería los beneficios de SSR (carga inicial sin parpadeo) que sí tiene el patrón Server+Client.
- **No:** Supabase Realtime/subscripciones para que el leaderboard se actualice solo. Los datos se cargan al entrar/cambiar de pestaña; no fue pedido y añade complejidad de sincronización fuera de alcance.
- **No:** conectar los stat-blocks decorativos de la home ("12+ JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING") a conteos reales. Son copy de marketing intencionalmente aspiracional, no datos.
- **Yes:** `plays` se muestra como conteo real sin formatear con sufijo "K" (a diferencia del mock, que tenía cifras como "12.4K"). Consecuencia esperada de que ahora es un dato real y empezará bajo; no se intenta simular volumen falso.
- **Yes (ajuste técnico en Paso 7):** `insertScore` vive en un archivo separado, `lib/data/scores.ts`, en vez de junto a las funciones de lectura en `lib/data/games.ts`. Motivo: `lib/data/games.ts` importa `lib/supabase/server.ts`, que depende de `next/headers` (solo válido en Server Components); si un Client Component (`game-player.tsx`/`asteroids-player.tsx`) importa una función de ese mismo archivo, Turbopack falla el build completo ("You're importing a module that depends on next/headers... Pages Router" — aunque el proyecto es 100% App Router, es como Next.js reporta el conflicto de límite Server/Client). Separar `insertScore` en su propio módulo, que solo importa `lib/supabase/client.ts`, resuelve el conflicto sin cambiar ningún comportamiento.

## Risks

| Riesgo                                                                                                                                                                                                                 | Mitigación                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El insert público sin autenticación en `scores` permite que cualquiera con la anon key inserte puntuaciones falsas o spam masivo.                                                                                      | Documentado explícitamente en Decisions como deuda técnica aceptada; el `CHECK (score >= 0)` y `player_name` no vacío son la única barrera hasta que exista Auth real en un spec futuro.                                                                                                                                   |
| `security_invoker = true` en `create view` requiere Postgres 15+; si el proyecto Supabase corriera una versión anterior, la vista `games_with_stats` ignoraría el RLS de las tablas subyacentes o fallaría al crearse. | Antes del paso 1, verificar la versión de Postgres del proyecto Supabase (Dashboard → Database → Settings); si es menor a 15, reemplazar la vista por una función `security invoker` equivalente o calcular `best`/`plays` directamente en `getGames()`/`getGame()` con un `LEFT JOIN` en la query de `lib/data/games.ts`. |
| El seed de `scores` usa `unnest(...) with ordinality`, cuya sintaxis exacta puede variar según la versión de Postgres.                                                                                                 | Probar el `INSERT` del seed en el SQL Editor antes de darlo por bueno (paso 1); si falla, es un ajuste de sintaxis SQL aislado que no afecta el resto del plan.                                                                                                                                                            |
| Separar `/games` y `/hall-of-fame` en Server Component + Client Component podría romper sutilmente el filtro por texto/categoría o las tabs si las props no quedan bien cableadas.                                     | Cada paso (3 y 5) se prueba manualmente de forma aislada antes de avanzar al siguiente, igual que el patrón usado en el spec 05 al extraer `game-over-modal.tsx`.                                                                                                                                                          |
| Next.js 16.2.10 podría tener un contrato distinto al conocido por entrenamiento para `fetch`/datos async en Server Components o para pasar props iniciales a un Client Component.                                      | Antes de los pasos 3, 5 y 6, revisar `node_modules/next/dist/docs/01-app/` para confirmar el patrón vigente de Server Components async y paso de datos a Client Components.                                                                                                                                                |
| Sin seed de `scores` (decisión revertida tras el Paso 1), las páginas de leaderboard mostrarán "0 puntuaciones"/podio vacío al probar los pasos 3–6, ya que solo `games` tiene datos iniciales.                        | Aceptado: es el comportamiento deseado (arrancar sin puntuaciones falsas). Verificar en los pasos 3–6 que el estado vacío se ve razonable (no roto), y opcionalmente insertar 1–2 puntuaciones de prueba manualmente en el SQL Editor solo para probar visualmente, borrándolas después.                                   |

## Lo que **no** está en este spec

- Supabase Auth real / migrar `av_user`.
- Validación anti-trampa de puntuaciones (rate limiting, score plausible, captcha).
- Supabase Realtime.
- Supabase CLI / migraciones versionadas.
- UI de administración de juegos.
- Conectar los stat-blocks decorativos de la home a conteos reales.
- Cambios visuales/de diseño.

Cada uno de estos, si se implementa, va en su propio spec.
