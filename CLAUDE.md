# CLAUDE.md

## Project

Arcade Vault ("Es una plataforma para jugar online y competir por la mayor cantidad de puntos") is a Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 project. It is a visual/mock port of the `references/templates/home-about` reference template — see `specs/` for what has been implemented so far and in what order.

Current routes: `/` (Home landing), `/games` (Biblioteca), `/games/[id]` (Detalle), `/games/[id]/play` (Reproductor), `/login` (Auth), `/hall-of-fame` (Salón de la Fama), `/about` (Acerca de + formulario de contacto). See `implemented-games.md` for the current list of games wired into the catalog and playable (update that file, not this one, whenever a game is added — see `.claude/skills/add-game/recipe.md` for how a game plugs in). The game catalog and scores are backed by real Supabase (`lib/supabase/client.ts` / `server.ts`; `lib/data/games.ts` reads the `games_with_stats` view, `lib/data/scores.ts` inserts into `scores`) — only the user session (`av_user`) is still mocked via `localStorage`, not auth. The UI has an ES/EN language selector (`lib/i18n/language-context.tsx`, persisted to `localStorage` as `av_lang`, dictionary in `lib/i18n/translations.ts`); game catalog text falls back from `title_en`/`short_en`/`long_en` to the Spanish columns via `lib/i18n/localize-game.ts` when a translation is missing. The contact form's email send is mocked via a Server Action (`app/actions/contact.ts`) — see `.env.example` for the Resend-shaped env vars it is written against, none of which are read yet.

## Next.js version warning

`package.json` pins `next@16.2.10`, which is **not** the Next.js you know from training data — APIs, conventions, and file structure may differ. Before writing or changing any Next.js-specific code (routing, data fetching, config, metadata, images, fonts, etc.), read the relevant page under `node_modules/next/dist/docs/` (organized as `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`) rather than relying on prior knowledge. Pay attention to deprecation notices there.

## Spec-driven workflow

This repo works by spec, not by ad hoc prompting. Three custom skills drive it, defined in `.claude/skills/`:

- **`/spec`** (`.claude/skills/spec/SKILL.md`) — interactively designs a new feature spec. Asks clarifying questions in phases, builds the spec section by section against `.claude/skills/spec/template.md`, and saves the result to `specs/NN-slug.md` in `Draft` state. Never writes code.
- **`/add-game`** (`.claude/skills/add-game/SKILL.md`) — the same thing, specialized for adding one playable game (plus its leaderboard) to the catalog, either porting existing code from a folder (e.g. `references/started-games/`) or designing it from scratch. It already knows the wiring recipe (`.claude/skills/add-game/recipe.md`: the manual `insert into games` SQL, `.cover-<id>`, `components/games/<id>/engine.ts`, `components/games/<id>-player.tsx`, the branch in `app/games/[id]/play/page.tsx`), so it asks about the game instead of the plumbing. Also ends at `specs/NN-slug.md` in `Draft`, never writes code. Use it for a new game; use `/spec` for anything else.
- **`/spec-impl`** (`.claude/skills/spec-impl/SKILL.md`) — implements a spec, but **only if its status line reads `Approved`** (or an equivalent word in another language). It creates/switches to a branch named `spec-NN-slug` (see `AutoCreateBranch` in `specs/.spec-config.yml`, default `true`), then implements the plan one step at a time, pausing for review after each step.

Implications for any work in this repo:

- A feature-sized change should normally go through `specs/NN-slug.md` first, not straight into code. If asked to build something nontrivial without a spec, point this workflow out.
- Never implement a spec whose status isn't `Approved` (or a same-meaning word in another language) — that gate is intentional and enforced by the human, not by the agent.
- Spec status values: `Draft` → `In review` → `Approved` → `Implemented` → `Obsolete` (or the equivalent terms in whatever language the repo's specs use — stay consistent with what's already there).
- Numbering is sequential (`01-`, `02-`, ...); check `specs/` for the next free number and existing naming conventions before creating a new spec.

## Skills

Always use /frontend-design for designing frontend user interfaces

## Architecture notes

- App Router only (`app/` directory) — there is no `pages/` directory.
- Styling is Tailwind CSS v4 via `@tailwindcss/postcss` (see `postcss.config.mjs`), plus `app/globals.css`.
- Path alias `@/*` maps to the repo root (`tsconfig.json`).
- `eslint.config.mjs` uses the flat config format (`eslint/config` + `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`), not the legacy `.eslintrc`.
- Reference templates the specs port from live in `references/templates/` (plain React-via-CDN `.jsx`/`.css`, not part of the Next.js build) — consult them for markup/CSS fidelity, but never import them directly.
- `@supabase/supabase-js` + `@supabase/ssr` are real dependencies (`lib/supabase/`); games/scores data flows through Supabase, not local mocks — see `specs/04-supabase-integration.md` and `specs/06-leaderboard-catalogo-supabase.md`.
- Each game's engine (`components/games/<id>/engine.ts`) is pure TS with no JSX/React; the `"use client"` player wrapper (`components/games/<id>-player.tsx`) is the only piece that touches React and `localStorage` (session read, per-game sound/skin prefs).
