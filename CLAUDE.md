# CLAUDE.md

## Project

Arcade Vault ("Es una plataforma para jugar online y competir por la mayor cantidad de puntos") is a Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 project. It is a visual/mock port of the `references/templates/home-about` reference template — see `specs/` for what has been implemented so far and in what order.

Current routes: `/` (Home landing), `/games` (Biblioteca), `/games/[id]` (Detalle), `/games/[id]/play` (Reproductor), `/login` (Auth), `/hall-of-fame` (Salón de la Fama), `/about` (Acerca de + formulario de contacto). Session and scores are mocked via `localStorage` (`av_user`, `av_scores`); the contact form's email send is mocked via a Server Action (`app/actions/contact.ts`) — see `.env.example` for the Resend-shaped env vars it is written against, none of which are read yet.

## Next.js version warning

`package.json` pins `next@16.2.10`, which is **not** the Next.js you know from training data — APIs, conventions, and file structure may differ. Before writing or changing any Next.js-specific code (routing, data fetching, config, metadata, images, fonts, etc.), read the relevant page under `node_modules/next/dist/docs/` (organized as `01-app/`, `02-pages/`, `03-architecture/`, `04-community/`) rather than relying on prior knowledge. Pay attention to deprecation notices there.

## Spec-driven workflow

This repo works by spec, not by ad hoc prompting. Two custom skills drive it, defined in `.claude/skills/`:

- **`/spec`** (`.claude/skills/spec/SKILL.md`) — interactively designs a new feature spec. Asks clarifying questions in phases, builds the spec section by section against `.claude/skills/spec/template.md`, and saves the result to `specs/NN-slug.md` in `Draft` state. Never writes code.
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
