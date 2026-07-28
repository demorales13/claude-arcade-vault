# Recipe — how a game plugs into Arcade Vault

Reference material for the `/add-game` skill. It is **not** text to copy verbatim into a spec — it is
the shape the spec must respect, plus the traps already paid for in specs 05 and 06.

Everything here was derived from the one game that is actually wired up: `asteroids`
(`specs/05-asteroids-game.md`, `specs/06-leaderboard-catalogo-supabase.md`).

---

## 1. The file map

Adding a game touches exactly six things:

| #   | What         | Where                                                                                                           |
| --- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| 1   | Catalog row  | `insert into games (...)` — **manual SQL**, Supabase SQL Editor                                                 |
| 2   | Card art     | `.cover-<id>` in `app/globals.css` (cover block, near the other `.cover-*`)                                     |
| 3   | Engine       | `components/games/<id>/engine.ts` — pure TS, no JSX, no React                                                   |
| 4   | Player       | `components/games/<id>-player.tsx` — `"use client"` wrapper                                                     |
| 5   | Route branch | one `if` line in `app/games/[id]/play/page.tsx`                                                                 |
| 6   | Game CSS     | `.<id>-canvas` and `.<id>-touch-controls` in `app/globals.css`, with the `@media (max-width: 840px)` breakpoint |

Plus, only if the game has binary/data assets: files moved under `public/`.

**Do not touch these — they are already generic over `getGames()`:**
`app/data/games.ts` (types only, no catalog), `components/game-card.tsx`,
`components/games-browser.tsx`, `app/games/[id]/page.tsx` (detail + leaderboard aside),
`app/hall-of-fame/`, `app/page.tsx`, `components/game-over-modal.tsx`, `lib/data/games.ts`,
`lib/data/scores.ts`.

`best` and `plays` come for free from the `games_with_stats` view. The leaderboard on the detail page
and in the Hall of Fame come for free from `getTopScores()`. A new game needs **zero** work in any of
them.

---

## 2. The catalog row

```sql
insert into games (id, title, short, long, cat, cover, color, title_en, short_en, long_en) values
  ('<id>', '<TÍTULO>', '<una línea>', '<un párrafo>', '<CAT>', 'cover-<id>', '<color>',
   '<TITLE>', '<one line>', '<one paragraph>');
```

Both constrained by CHECK — a wrong value fails the insert:

- `cat` ∈ `ARCADE` · `PUZZLE` · `SHOOTER` · `VERSUS`
- `color` ∈ `cyan` · `magenta` · `yellow` · `green`

`cover` is by convention `cover-<id>`, matching the CSS class. There is no `best`/`plays` column —
they are computed by the view.

`title_en`/`short_en`/`long_en` are **optional** (nullable, no `NOT NULL`/`check`) — the English
translation of `title`/`short`/`long`, shown when the language selector is set to English
(`lib/i18n/localize-game.ts`). If omitted, the UI falls back to the Spanish text instead of showing
a blank field, so a game can ship without them — but fill them in when the translation is available,
since a silent Spanish fallback is easy to miss later.

Note: `components/game-card.tsx` maps `color` to a button class for `magenta`/`yellow` and falls
through to the default cyan class otherwise — `green` currently renders like cyan. Worth mentioning
in the spec if the user picks `green`.

---

## 3. The engine contract

Modeled on `components/games/asteroids/engine.ts` (574 lines, exactly three exports — everything else
stays closure-local):

```ts
export type <Name>Callbacks = {
  onScoreChange?: (score: number) => void;
  onLivesChange?: (lives: number) => void;
  onLevelChange?: (level: number) => void;
  // …plus any game-specific stat, e.g. onTripleShotChange?: (secondsLeft: number) => void
  onGameOver?: (finalScore: number) => void;
};

export type <Name>Game = {
  pause: () => void;
  resume: () => void;        // resets the accumulated dt so physics doesn't jump
  destroy: () => void;       // cancels the rAF loop AND removes the window key listeners
  setKey: (code: string, pressed: boolean) => void;  // touch controls inject the same codes as the keyboard
  forceGameOver: () => void; // the HUD "FIN" button
};

export function create<Name>Game(
  canvas: HTMLCanvasElement,
  callbacks: <Name>Callbacks,
): <Name>Game;
```

Rules that came out of spec 05:

- The engine **starts its own loop immediately** when created. There is no separate `start()`.
- It registers its own `keydown`/`keyup` on `window` and removes them in `destroy()`. It touches no
  other `window`/`document` API.
- It calls `preventDefault()` only on the codes it actually consumes, and only while mounted — so
  arrows and space don't scroll the page.
- Pause = skip `update(dt)` but keep calling `draw()`, so the last frame stays visible under the
  "EN PAUSA" overlay.
- `dt` is clamped (asteroids uses `Math.min(dt, 0.05)`) so a background tab doesn't teleport entities.
- When porting, keep the original constants and formulas 1:1 unless the spec explicitly decides to
  rebalance. The port is a translation, not a redesign.
- The canvas HUD of the original is **not** ported — the platform HUD outside the canvas is the single
  source of truth. Same for the original's "GAME OVER / press space" screen; `GameOverModal` replaces it.

---

## 4. The player contract

Modeled on `components/games/asteroids-player.tsx` (239 lines). Copy its structure:

```tsx
"use client";
export function <Name>Player({ game }: { game: GameWithStats }) { … }
```

- Single prop: `game: GameWithStats`. Imports `type { GameWithStats } from "@/lib/data/games"`.
- Local `readUserName()` reads `localStorage["av_user"]` → `u?.name || "INVITADO"`, applied in a
  mount-time `useEffect`.
- Refs: `canvasRef`, `gameRef: useRef<<Name>Game | null>(null)`.
- A `buildCallbacks()` helper wiring engine callbacks straight to `useState` setters;
  `onGameOver` sets the final score **and** opens the modal.
- `useEffect(…, [])` creates the engine on mount, and the cleanup calls `instance.destroy()`.
- `togglePause` → `pause()`/`resume()`; `endGame` → `forceGameOver()`; `restart` → `destroy()` then
  re-create with fresh callbacks and reset `paused`/`over`/`saved`.
- `bindKey(code)` returns `onPointerDown` (with `preventDefault`), `onPointerUp`, `onPointerLeave`
  **and** `onPointerCancel` — all four, so a finger dragged off a button never leaves a key stuck.

Markup skeleton (classes already exist in `globals.css`):

```
.av-player.fade-in
  .player-hud
    hud-stat ×4 fixed: Jugador · Puntuación · Vidas · Nivel   (+ conditional game-specific stats)
    .hud-actions: PAUSA/REANUDAR (btn yellow) · FIN (btn magenta) · SALIR (btn ghost → /games/{id})
  .crt
    .crt-screen > <canvas width={W} height={H} className="<id>-canvas" />
                  + .crt-content "EN PAUSA" overlay when paused
    .crt-bottom: SEÑAL OK · {game.title} · CRT-83 · 60 HZ · CARGA · 1MB
  .<id>-touch-controls  (.td-pad + .td-actions, .td-btn buttons with aria-label)
  {over && <GameOverModal … />}
```

HUD value formatting, kept consistent across games: score `toLocaleString("es-ES")`, lives
`"♥ ".repeat(lives).trim() || "—"`, level `String(level).padStart(2, "0")`.

Saving the score:

```tsx
onSave={async () => {
  try {
    await insertScore({ game: game.id, score, name });
    setSaved(true);
  } catch (err) {
    console.error("No se pudo guardar la puntuación", err);
  }
}}
```

`GameOverModal` is presentational — it never calls `insertScore` itself.

---

## 5. The route branch

`app/games/[id]/play/page.tsx` is a flat `if` chain, one line per game:

```tsx
if (game.id === "asteroids") return <AsteroidsPlayer game={game} />;
if (game.id === "<id>") return <<Name>Player game={game} />;

return <GamePlayer game={game} />;  // generic simulated fallback
```

---

## 6. CSS

Cover art follows a `background` gradient plus an `::after` (and optionally `::before`) pseudo-element
of layered gradients. The real `.cover-asteroids` as the pattern:

```css
.cover-asteroids {
  background: radial-gradient(circle at 50% 50%, #0a0020, #000);
}
.cover-asteroids::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 65%, #888 0 16px, transparent 17px),
    radial-gradient(circle at 78% 25%, #aaa 0 22px, transparent 23px),
    radial-gradient(circle at 40% 10%, var(--cyan) 0 2px, transparent 3px);
}
.cover-asteroids::before {
  content: "▲";
  position: absolute;
  left: 42%;
  top: 50%;
  color: var(--cyan);
  font-size: 22px;
  text-shadow: 0 0 8px var(--cyan);
}
```

Canvas and touch controls follow `.asteroids-canvas` / `.asteroids-touch-controls`: the canvas is
absolutely positioned to fill `.crt-screen`, the touch block is `display: none` by default and
switched on inside `@media (max-width: 840px)`.

---

## 7. Implementation plan skeleton

Adapt, don't copy blindly. Drop step 5 if the game has no assets. Each step leaves the app runnable
and carries its own `Test:`.

1. **SQL (manual, user).** Run the `insert into games` in the Supabase SQL Editor.
   _Test:_ `/games` shows the new card; `/games/<id>` shows the detail page with `best = 0`,
   `plays = 0` and an empty leaderboard; `/games/<id>/play` still renders the generic mock player.
2. **Cover art.** Add `.cover-<id>` to `app/globals.css`.
   _Test:_ the card and the detail hero show the new art, and no other `.cover-*` changed.
3. **Engine.** Create `components/games/<id>/engine.ts` — the full port/design, wired to nothing yet.
   _Test:_ `npm run build` compiles with no type errors.
4. **Player + route branch.** Create `components/games/<id>-player.tsx` and add the `if` line in
   `app/games/[id]/play/page.tsx`. Add `.<id>-canvas` CSS.
   _Test:_ play with the keyboard at `/games/<id>/play`; the HUD reflects real engine state; PAUSA
   freezes and REANUDAR continues without a jump; FIN opens `GameOverModal`; saving inserts a row in
   `scores` with the right `game_id`.
5. **Assets.** Move sprites/audio/level data to `public/` and point the engine at them.
   _Test:_ assets load with no 404s in the network tab.
6. **Touch controls.** Add the `.<id>-touch-controls` block and its CSS with the 840px breakpoint.
   _Test:_ at < 840px in responsive devtools the buttons drive the game exactly like the keyboard;
   at desktop width they are not rendered.
7. **Final pass with Playwright.** Compare against the original game and against the rest of the site
   (HUD, `.crt` frame, typography) at desktop and mobile widths. Adjust canvas scaling, touch button
   placement, and any extra `hud-stat`.

---

## 8. Base acceptance criteria

Every game spec should carry these, plus its own mechanics-specific ones:

- [ ] `npm run dev` runs with no console errors on `/games`, `/games/<id>` and `/games/<id>/play`.
- [ ] `select * from games_with_stats where id = '<id>'` returns the row, with `best`/`plays` moving
      as real scores are inserted.
- [ ] `/games` shows the new card with its own cover, and no other card changed.
- [ ] `/games/<id>` shows cover, tags, description, stat-strip and the leaderboard aside.
- [ ] The HUD (Jugador / Puntuación / Vidas / Nivel) reflects live engine state, not simulated values.
- [ ] PAUSA freezes the game with the frame still visible and the "EN PAUSA" overlay; REANUDAR
      continues with no physics jump.
- [ ] FIN ends the run immediately and opens `GameOverModal` with the score reached so far.
- [ ] Saving in `GameOverModal` inserts a row into `scores` with `game_id = '<id>'`, visible in
      `/hall-of-fame`.
- [ ] The prefilled name still comes from `av_user` in `localStorage`.
- [ ] At < 840px the touch controls appear and drive the game; at desktop width they do not.
- [ ] The canvas scales inside the `.crt` frame at both widths without distorting or clipping the HUD.
- [ ] Navigating away from `/games/<id>/play` stops the loop — no console errors, no leaked listeners.
- [ ] `npm run build` finishes with no errors.

---

## 9. Known traps

Each of these was paid for once already. Carry the relevant ones into the spec's Risks table.

- **`insertScore` must come from `lib/data/scores.ts`, never from `lib/data/games.ts`.** The latter
  imports `lib/supabase/server.ts`, which depends on `next/headers`; importing it from a Client
  Component breaks the whole Turbopack build with a misleading "Pages Router" error. This is why the
  two data modules are split.
- **`destroy()` in the `useEffect` cleanup is mandatory.** Otherwise the `requestAnimationFrame` loop
  keeps running after navigation and draws into an unmounted canvas.
- **Fix the canvas aspect ratio in CSS.** Scaling with `max-width: 100%` alone distorts the picture in
  narrow containers.
- **Release touch keys on `onPointerUp`, `onPointerLeave` _and_ `onPointerCancel`.** A finger dragged
  off a button otherwise leaves the key stuck down.
- **`preventDefault` only while the game is mounted and no modal is open**, so the arrows and space
  don't fight the modal's input or scroll the page.
- **Next.js 16.2.10 is not the Next.js in training data.** Before writing anything Next-specific
  (`params`, Client Components, metadata, static assets), read the relevant page under
  `node_modules/next/dist/docs/01-app/`. `CLAUDE.md` insists on this.
- **The env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`**, not `..._ANON_KEY` — the older specs say
  otherwise; the code wins.
- **Score inserts are public and unauthenticated.** Accepted technical debt from spec 06; do not
  "fix" it inside a game spec.
