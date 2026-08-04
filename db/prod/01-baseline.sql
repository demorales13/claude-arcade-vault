-- Arcade Vault — baseline de esquema para el proyecto Supabase de PRODUCCIÓN.
--
-- Transcripción fiel del esquema `public` verificado en el proyecto de DESARROLLO
-- (project_ref enmvnepuigjuhjpikkqn) el 2026-08-04, vía `list_tables` / `pg_policies` /
-- `pg_indexes` — no una concatenación de los fragmentos SQL de specs/04, specs/06,
-- specs/11, specs/20 y specs/22, que quedaron desfasados entre sí.
--
-- Idempotente: se puede volver a pegar este archivo sin que falle ni cambie nada.
-- Pensado para pegarse tal cual en el SQL Editor del proyecto de producción.
--
-- Orden: games -> scores -> profiles -> índices -> vista games_with_stats -> RLS -> grants.

-- =========================================================================
-- Tabla: games
-- =========================================================================
create table if not exists public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  created_at timestamptz not null default now(),
  title_en text,
  short_en text,
  long_en text
);

-- =========================================================================
-- Tabla: scores
-- =========================================================================
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games (id),
  player_name text not null check (length(trim(player_name)) > 0),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade
);

-- =========================================================================
-- Tabla: profiles
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Z0-9_]{3,12}$'),
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Índices
-- =========================================================================
create index if not exists scores_game_id_score_idx on public.scores (game_id, score desc);
create unique index if not exists profiles_username_key on public.profiles (lower(username));

-- =========================================================================
-- Vista: games_with_stats (best/plays calculados en lectura, sin columnas propias)
-- =========================================================================
create or replace view public.games_with_stats
with (security_invoker = true) as
select
  g.id,
  g.title,
  g.short,
  g.long,
  g.cat,
  g.cover,
  g.color,
  g.created_at,
  coalesce(max(s.score), 0) as best,
  count(s.id) as plays,
  g.title_en,
  g.short_en,
  g.long_en
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.games enable row level security;
alter table public.scores enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "public read games" on public.games;
create policy "public read games" on public.games
  for select using (true);

drop policy if exists "public read scores" on public.scores;
create policy "public read scores" on public.scores
  for select using (true);

drop policy if exists "authenticated insert own scores" on public.scores;
create policy "authenticated insert own scores" on public.scores
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and score >= 0
    and player_name = (select username from public.profiles where id = auth.uid())
  );

drop policy if exists "public read profiles" on public.profiles;
create policy "public read profiles" on public.profiles
  for select using (true);

drop policy if exists "own insert profile" on public.profiles;
create policy "own insert profile" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "own update profile" on public.profiles;
create policy "own update profile" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =========================================================================
-- Grants (games_with_stats necesita GRANT explícito por ser una vista nueva)
-- =========================================================================
grant select on public.games_with_stats to anon, authenticated;
