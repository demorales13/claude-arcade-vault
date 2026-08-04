-- Arcade Vault — verificación post-migración para PRODUCCIÓN.
--
-- Ejecutar después de 01-baseline.sql y 02-seed-games.sql. Todas son consultas
-- de solo lectura. Compara cada resultado con el "esperado" documentado aquí y
-- en specs/23-migracion-a-produccion.md.

-- 1) Catálogo de juegos: se esperan 6 filas.
select count(*) as total_games from public.games;

-- 2) IDs presentes: arkanoid, asteroids, crossing, invasion, snake, tetris.
select id, title, cat, color from public.games order by id;

-- 3) Leaderboard vacío: se esperan 0 filas.
select count(*) as total_scores from public.scores;

-- 4) Políticas RLS: se esperan exactamente 6 filas, ver comentario con el nombre
--    esperado de cada una.
--    games:    "public read games"
--    scores:   "public read scores", "authenticated insert own scores"
--    profiles: "public read profiles", "own insert profile", "own update profile"
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 5) games_with_stats debe tener security_invoker = true en reloptions.
select reloptions
from pg_class
where relname = 'games_with_stats'
  and relnamespace = 'public'::regnamespace;

-- 6) Índices esperados: games_pkey, profiles_pkey, profiles_username_key,
--    scores_pkey, scores_game_id_score_idx.
select indexname, tablename
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;

-- 7) games_with_stats: cada fila debe mostrar best = 0 y plays = 0 en un
--    proyecto recién sembrado sin scores.
select id, best, plays from public.games_with_stats order by id;
