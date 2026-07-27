---
name: add-game
description: Designs the spec for adding a playable game (with its leaderboard) to the Arcade Vault catalog — either porting an existing game from a folder or designing one from scratch. Asks the game-specific questions a generic spec would miss and saves specs/NN-slug.md in Draft. Never writes code.
disable-model-invocation: true
argument-hint: "<game name> [path to existing game code]"
---

# /add-game — Spec designer for new games

This skill produces the spec for adding **one** playable game to Arcade Vault. It is a specialized
sibling of `/spec`: same philosophy, same document shape, same hard rules — but it already knows the
recipe for wiring a game into this platform, so it asks about the game instead of asking about the
plumbing.

**You do not write code here.** The output is a single file: `specs/NN-slug.md`, state `Draft`.

Two entry paths:

- **Import** — the game already exists as vanilla HTML/canvas code somewhere (typically under
  `references/started-games/`). The user points at the folder and the spec describes the port.
- **From scratch** — no code exists yet. The spec describes designing the engine as well as wiring it.

## Command flow

Follow the phases in order. **Do not skip phases.** Your replies must be in the same language as the
initial prompt. The spec file itself is written in the language the repo's existing specs use
(currently Spanish) — stay consistent with `specs/`.

### Phase 0 — Load context

Before asking anything:

1. Read `CLAUDE.md` for project conventions.
2. Read `.claude/skills/spec/template.md` — the document shape. This skill does not redefine it.
3. Read `recipe.md` (sibling of this file) — the canonical "how a game plugs into Arcade Vault"
   reference. Everything you propose in Phase 3 comes from there.
4. Read `specs/05-asteroids-game.md` and `specs/06-leaderboard-catalogo-supabase.md` — the two specs
   that established the pattern. Skim the `Decisions` sections; several of them are binding for every
   future game.
5. List `specs/` to find the next free sequential number.

### Phase 1 — Determine the mode

Parse `$ARGUMENTS`. It may contain a game name, a path, both, or nothing.

**If a path was given** (or you can find an obvious candidate under `references/started-games/`),
you are in **Import** mode:

1. Confirm the path with the user before reading anything.
2. Read the source: `index.html`, the main `game.js`, any `style.css`, extra modules
   (`levels.js`, `assets/spritesheet.js`), and list any binary assets.
3. From the source, extract on your own — do not ask the user what the code already answers:
   - the logical canvas size (`<canvas width height>`),
   - every key the game listens to (`keydown`/`keyup` handlers),
   - the game-over condition and what resets it,
   - whether it has lives, levels, and any other state worth a HUD stat,
   - what HUD the canvas draws itself,
   - which assets (images, audio, level data) live outside `game.js`.
4. Present that extraction as a short summary and ask the user to **confirm or correct** it.

**If no path was given**, ask first:

> ¿El juego ya existe como código (dime la carpeta) o lo diseñamos desde cero en este spec?

If from scratch, tell the user plainly that the spec will have to define the gameplay too, which
makes it a bigger spec, and offer to split it (mechanics spec first, integration spec after) if the
game is not simple.

### Phase 2 — Clarify through questions

Ask in blocks of 3 to 5, numbered, one per line. Concrete questions with 2–4 options and a marked
recommendation. Wait for an answer before the next block. Never assume.

The blocks below are the ones a generic `/spec` would miss. Skip any question the source code
already answered in Phase 1 — confirm it instead of asking it again.

**Block A — Catalog entry** (this is a row in the Supabase `games` table, not a code change):

1. `id` — lowercase slug, used for the route `/games/<id>`, the engine folder, the player file and
   the `.cover-<id>` class. Note: `asteroids` set the precedent that ids may be in English even
   though titles are in Spanish.
2. `title` — visible name, Spanish, uppercase.
3. `short` — one line for the card. `long` — one paragraph for the detail page.
4. `cat` — **only** `ARCADE`, `PUZZLE`, `SHOOTER` or `VERSUS`. The column has a CHECK constraint;
   anything else fails the insert.
5. `color` — **only** `cyan`, `magenta`, `yellow` or `green`. Same CHECK constraint.
6. Cover art concept for `.cover-<id>`: what the pseudo-element art should evoke. It is pure CSS
   gradients, no images.

**Block B — Engine**:

1. Logical canvas size (kept fixed, scaled by CSS — see `recipe.md`).
2. Which callbacks the HUD needs beyond score/lives/level, if any. Asteroids added a fifth
   conditional stat (`onTripleShotChange`); a puzzle game might need lines cleared or next piece.
3. Pause semantics: freeze `update(dt)` but keep drawing (the established pattern), or something else.
4. What exact number is saved to `scores.score` at game over.
5. Does the game have levels? If not, say so explicitly — the HUD stat still exists in the markup.

**Block C — Controls**:

1. Which key codes the engine listens to (`ArrowLeft`, `Space`, `KeyP`, …).
2. How those map to on-screen touch buttons below 840px. Remember `setKey(code, pressed)` injects
   the same codes the keyboard uses — no separate input path.
3. Any input the touch layout cannot express (mouse-driven paddle, drag) — flag it early, it changes
   the touch design.

**Block D — Assets** (skip if the source has none):

1. Sprites/audio/level data outside the main script → they move to `public/`. Confirm the target
   paths and how the engine references them.
2. Does the game need to preload assets before the first frame? That changes the mount flow.

**Block E — Fidelity and scope**:

1. Faithful 1:1 port, or is the balance adjusted? (Spec 05 chose 1:1 and said so explicitly.)
2. The canvas-drawn HUD gets turned off — the platform HUD is the source of truth. Confirm.
3. Sound: if the original has it, is it in or out of this spec?

**Detect scope creep.** If an answer opens a second feature — multiplayer, sound where the original
had none, per-level high scores, statistics beyond the `scores` schema, gamepad support — say so and
propose recording it under "Out of scope" for a future spec. Do not silently absorb it.

**Stop asking when** you can answer, without assuming:

1. Which files appear or change (the list in `recipe.md`, made concrete for this game)?
2. What is the first executable step and the last one?
3. How do I verify the game is finished?

### Phase 3 — Draft the spec section by section

**Never generate the whole spec in one response.** Show one section, ask
"¿Esta sección queda así o quieres ajustarla?", apply changes, then move on.

Order follows `.claude/skills/spec/template.md`:

1. **Header** — status `Draft`, `Depends on` (at minimum the spec that put the catalog in Supabase),
   today's date, and a one-sentence objective.
2. **Scope** — In / Out. The "Out" must name what Phase 2 flagged as scope creep.
3. **Data model** — the `insert into games` row, the engine's exported types
   (`<Name>Callbacks`, `<Name>Game`, `create<Name>Game`), and any new asset paths.
4. **Implementation plan** — start from the 7-step skeleton in `recipe.md` and adapt it. Drop the
   assets step if the game has none. Each step keeps the app runnable and carries its own `Test:`.
5. **Acceptance criteria** — start from the base checklist in `recipe.md`, then add the criteria
   specific to this game's mechanics. Every item boolean and verifiable.
6. **Decisions** — Yes/No pairs with reasons. Carry forward the platform-wide decisions from
   `recipe.md` that apply, and record every choice the user made in Phase 2.
7. **Risks** — table. `recipe.md` lists the known traps; include the ones that apply plus anything
   specific to this game.
8. **Lo que no está en este spec** — the deliberate repetition of the "Out" scope.

Pre-fill each section from `recipe.md` so the user edits rather than dictates. But every pre-filled
value that came from a guess, not from an answer, must be flagged as such when you show the section.

### Phase 4 — Save the spec

When every section is confirmed:

1. Take the next sequential number from `specs/`.
2. Propose the filename (`NN-<id>-game.md` or similar, matching what `specs/` already looks like) and
   confirm it before writing.
3. Write the file with state `Draft`.
4. Confirm to the user:
   - the path written,
   - that the state is `Draft` and **the human** changes it to `Approved` after re-reading,
   - that the next command is `/spec-impl NN-slug`,
   - that the SQL insert in the plan is a **manual step** they run in the Supabase SQL Editor.
5. **Stop there.** Do not offer to implement, do not write code, do not run the SQL.

## Hard rules

- **Never write code.** Only the spec's `.md` file at the end.
- **Never set the state to `Approved`.** That gate belongs to the human, per `CLAUDE.md`.
- **Never propose implementing the spec after saving it.** Your job ends at the confirmation.
- **Never invent `id`, `cat`, `color`, or asset paths.** `cat` and `color` are CHECK-constrained in
  the database — a wrong value fails the insert at implementation time, not at spec time.
- **One game per spec.** If the user wants to port two games, that is two specs. Say so.
- **Never skip the SQL step in the plan.** The catalog lives in Supabase; a game that is only code is
  invisible on the site.

## Tone

Direct and specific. Do not apologize for asking. The user invoked this skill precisely because they
want the questions. Number them so they are easy to answer, and when you offer options, say which one
you recommend and why.
