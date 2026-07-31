---
name: spec-impl-game
description: Implements an approved game spec by following /spec-impl's documented phases, then automatically chains the skin-designer and mobile-porter agents onto that game, in that order.
disable-model-invocation: true
argument-hint: <NN-spec-name>
---

# /spec-impl-game — Implementer for game specs, with skin + mobile follow-through

This command is a specialized wrapper around `/spec-impl`'s implementation phases. It exists
because implementing a **game** spec is never really done at "last plan step complete" — every
playable game is expected to end up with skins (`clasico`/`neon`/`retro`, via `skin-designer`) and,
unless it's one of the four games spec 12 already migrated, touch/mobile support (via
`mobile-porter`). Doing those two steps by hand after every game spec means remembering the game's
`id`, invoking two agents, and never running them together — both edit
`components/games/<id>-player.tsx`, so parallel invocation would race and corrupt each other's
edits.

**Important — this command does NOT invoke the `spec-impl` skill.** `/spec-impl` is deliberately
human-only (`disable-model-invocation: true` in its frontmatter) and that gate is not to be
bypassed. Instead, this command reads `.claude/skills/spec-impl/SKILL.md` as a plain document with
the `Read` tool and carries out its four phases itself, verbatim. Reading a file's text does not
invoke it — the skill's own invocation gate stays completely untouched. **Never call the `Skill`
tool with `spec-impl` as a way to shortcut this** — that would defeat the entire point of keeping
it human-only.

Once implementation finishes, this command runs `skin-designer` and, after it reports back,
`mobile-porter`, both scoped to the game that was just implemented — with no extra confirmation
needed for the chaining itself (though `/spec-impl`'s own step-by-step pauses inside Phase A still
apply).

**Use this only for specs that add a playable game to the catalog** (the ones `/add-game` and
`game-jam` produce). For any other kind of spec, use `/spec-impl` directly — there is nothing here
for it to chain.

---

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

---

## Phase A — Implement the spec, following /spec-impl's own phases

Read `.claude/skills/spec-impl/SKILL.md` with the `Read` tool and carry out its **Phases 1
through 4** exactly as written there: locate the spec, gate on the state meaning `Approved` (using
its standard error message verbatim if it doesn't), create/switch the `spec-NN-slug` branch per
`AutoCreateBranch`, show the spec summary, then implement the plan step by step, pausing for review
after each step exactly as it describes.

Three things to resolve when following that file, since it wasn't written to be read this way:

- Its `$ARGUMENTS` placeholder resolves to **this** command's `$ARGUMENTS` (`$ARGUMENTS`).
- Its `!`-prefixed session-context blocks (repo status, current branch, specs list, branch config)
  arrive as literal text when read this way, not executed — use the **Session context** section
  above instead, which was gathered fresh for this invocation.
- Its own frontmatter (`disable-model-invocation`, `allowed-tools`) is irrelevant here — it is
  being read as reference text, not invoked as a skill. **Never invoke the `spec-impl` skill via
  the `Skill` tool from within this command, under any circumstance.**

**Hard stop condition:** if those phases stop for any reason — the spec isn't found, its state
doesn't mean `Approved`, the user declines to continue on the current branch, or the step-by-step
implementation does not reach its last step — **do not proceed to Phase B.** No agent gets launched
on a partial or rejected implementation. Report whatever that stopping point reported and stop
there.

Only continue once Phase 4 of `spec-impl` (as followed here) has reached its own end state: "All
steps of the plan are implemented."

---

## Phase B — Determine the game's `id`

Before launching anything, resolve the exact catalog `id` of the game that was just implemented:

1. Look in the spec file (already read during Phase A) for `id: "<slug>"` / `id: '<slug>'` — it
   appears both in the objective line and in the manual Supabase insert row. This is the constant
   pattern across every game spec so far (e.g. `specs/05-asteroids-game.md:6`,
   `specs/07-tetris-game.md:20`, `specs/09-snake-game.md:18`).
2. If it isn't there, fall back to the `components/games/<id>/` folder created or touched during
   the implementation (visible from the diffs Phase A already showed).
3. If the `id` still can't be pinned down with confidence, or the spec that was just implemented
   turns out not to be a game spec at all (no `components/games/<id>/engine.ts` and no
   `components/games/<id>-player.tsx` resulted from it), **stop here** — do not guess. Tell the
   user the implementation itself finished fine, but no agent will be launched automatically
   because the target game couldn't be determined with confidence, and that `skin-designer`
   / `mobile-porter` can still be invoked by hand with the right `id`.

---

## Phase C — Run `skin-designer`

Launch a single `Task` call with `subagent_type: skin-designer`. The prompt must:

- Name the target game explicitly by its `id` (and title, for readability) — the agent refuses to
  act on an unnamed or ambiguous target (`.claude/agents/skin-designer.md` Phase 0).
- Mention the spec just implemented, so the agent has the same grounding this command has.
- Ask it to follow its own phases as documented (audit → build/confirm shared infra → define skin
  identities → apply → validate contrast → verify/report).

Wait for its report. If the target game is `arkanoid`, the agent will stop mid-way to ask whether
to tint the sprite atlas per skin or switch to procedural drawing
(`.claude/agents/skin-designer.md` — the Arkanoid special case). Relay that question to the user
verbatim and wait for their answer before letting the agent continue; do not choose for them.

Summarize the agent's report to the user (which skins the game ended up with, which is default)
before moving to Phase D.

---

## Phase D — Run `mobile-porter`

Only after Phase C's report has come back — **never in the same tool-call batch as Phase C, never
in parallel with it.** Both agents write to `components/games/<id>-player.tsx`; running them
concurrently would race on that file.

- If the game's `id` is one of `asteroids`, `tetris`, `arkanoid`, or `snake` — **do not launch
  `mobile-porter`.** These four were already migrated by `specs/12-juegos-en-movil-tactil.md` and
  the agent has a hard rule refusing to touch them again
  (`.claude/agents/mobile-porter.md` Phase 0 / Hard rules). Tell the user this step was skipped
  and why, and move directly to Phase E.
- Otherwise, launch a single `Task` call with `subagent_type: mobile-porter`, naming the same `id`
  explicitly, and mentioning that `skin-designer` already ran on this game (so its report is fresh
  context, not something `mobile-porter` needs to redo). Wait for its report and summarize it to
  the user.

---

## Phase E — Final report and stop

Summarize the whole chain in three parts:

1. **Implementation** — which plan steps were completed (from Phase A).
2. **Skins** — which skins the game ended up with and which is the default (from Phase C).
3. **Mobile/touch** — what was wired in, or why it was skipped (from Phase D).

Close with the same reminders `/spec-impl` itself ends on: verify the spec's acceptance criteria,
flip its status to `Implemented` (or the equivalent word), and make the final commit before
merging the branch — plus a reminder to update `implemented-games.md` if the implementation phase
didn't already do so.

---

## Hard rules

- **Never invoke the `spec-impl` skill via the `Skill` tool.** `/spec-impl` is deliberately
  human-only; this command only reads its documented phases as text and carries them out directly.
- **Never launch `skin-designer` and `mobile-porter` in the same tool-call batch or otherwise
  concurrently.** They edit the same file; Phase D must wait for Phase C's result.
- **Never launch either agent if Phase A did not reach its own successful end state.** A stopped,
  declined, or partial implementation means no agent runs.
- **Never guess the game's `id`.** If Phase B can't determine it with confidence, stop and say so
  instead of launching an agent against a wrong or invented target.
- **Never skip `skin-designer`** on the grounds that a game "looks legacy" — the legacy exclusion
  in Phase D applies only to `mobile-porter`, per the four hard-coded game ids in
  `.claude/agents/mobile-porter.md`. `skin-designer` has no such exclusion list.
- **Never invert the order.** `mobile-porter` wraps the skin selector inside `<HudMenu>`
  (`.claude/agents/mobile-porter.md`, Hard rules — it never defines skins, only wraps the existing
  selector), so it depends on `skin-designer` having already run.
- **Never use this command for a non-game spec.** If `$ARGUMENTS` points at a spec that isn't
  adding a playable game, say `/spec-impl` is the right command and stop before Phase A.
