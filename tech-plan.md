# Tech Plan

## Platform and delivery

- **Platforms:** web first; iOS and Android later by wrapping the web build (Capacitor).
- **Engine:** Phaser 4 + TypeScript, built with Vite. The build is static files, and the workflow is terminal-driven and AI-assisted.
- **Repo:** private GitHub repository `andornaut/dog-walker-game`. Milestones live in `gameplay/game-design.md`, not in a GitHub Projects board.
- **Hosting:** Cloudflare Workers static assets (no Worker script), free and unmetered.
- **Deploys:** Cloudflare Workers Builds deploys every push to `main`. It runs independently of GitHub CI, so a commit with red CI still deploys.
- **Tooling:** follows `andornaut/cloudflare-starter`: Node 24, Vitest, ESLint with the shared house rules, Prettier, markdownlint (pinned in `package.json`), husky + lint-staged pre-commit, Dependabot, and the Test and AI attributions workflows.
- **Type checking:** `strict`, plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` and `noFallthroughCasesInSwitch`.

## Site

- `/` is a static home page, `/play/` is the game (`play/index.html`, built from `src/`), `/data/` shows every game data table, and `/art/` is the art gallery, copied as-is from `public/art/`.
- The HTML pages are Vite build inputs. `public/` is copied as-is.

## Architecture

- **Render resolution:** 360×640 internal (portrait 9:16), scaled with `pixelArt` (no smoothing).
- **All UI in the canvas:** the road, top bar, dog column, cards and menus are Phaser scenes drawn at one pixel scale with a pixel font. HTML is only the page shell. While cards are up, lane input is not listened for.
- **Screen layout:**
  - A top bar for status (money, zone progress) and pause, separate from the road so it never hides obstacles scrolling in from the top.
  - A fixed-width dog column on the left with 3 slots. A fired dog's slot empties, so the road never changes width.
  - The road fills the rest, split into 5 lanes.
- **Scenes:** `RunScene` draws the road, walker, pack and spawns, and pauses during cards. `HudScene` draws the top bar and dog column and stays visible during cards. `CardScene` dims the road, shows 2 or 3 cards, and reports the chosen option to `RunScene`.
- **Source layout:**
  - `src/data/`: game content and tuning (see Game data).
  - `src/rules/` and `src/state/`: run state and pure rule functions.
  - `src/runner/`: lane motion, pulls and input locks, zones by distance, spawn planning, road items and collisions.
  - `src/input/`: keyboard bindings and the touch gesture state machine.
  - `src/layout/`: screen geometry.
  - `src/assets/`: manifest parsing and Aseprite animation specs.
  - `src/save/`: persistence (see Save data).
  - `src/scenes/` and `src/main.ts`: everything that touches Phaser.
- **Boundary:** only `src/scenes/` and `src/main.ts` may import Phaser or a scene. ESLint's `no-restricted-imports` enforces it, so all game logic runs in unit tests without a renderer.
- **Assets:** the art agent exports into `public/art/`, served at `/art/`. `public/art/manifest.json` lists every asset with paths relative to `public/art/`: `sprites` (key, png, json: PNG sheets with Aseprite hash JSON and frameTags), `fonts` (key, png, fnt: XML BMFont, which `load.bitmapFont` requires) and `images` (key, png). Keys are kebab-case and unique. Animation keys are `<texture>:<tag>`, because tag names repeat across sprites and Phaser animation keys are global. Sprites anchor on the feet. A missing key falls back to a placeholder box. Art rules live in `art/style-guide.md`.
- **Tests:** Vitest unit tests over all pure logic. Scenes are checked by playing and by headless screenshots.

## Game data

- **Format:** typed TypeScript modules in `src/data/` (dogs, quips, encounters, forced stops, lucky encounters, upgrades, shop, debuffs, zones, walkers, hints, help, tuning). Content is `as const satisfies Type`. Tuning uses plain `satisfies`, so its values stay `number` for live tuning.
- **Ownership:** the gameplay agent edits values and content in the value files. Tech owns `types.ts`, `index.ts`, `screen.ts`, `src/rules/` and all tests.
- **Effects:** card options are lists of effects from a closed set of kinds. Effects name tuning numbers by key instead of copying them, so every number lives once in `tuning.ts`. A new card built from existing kinds is a data change; a new kind is code in `src/rules/` plus a test.
- **Card text:** generated from the effects and tuning, with a snapshot test.
- **Units:** money (integer cents), hearts, seconds, probability, pixels and multipliers are distinct branded types in the rules. Value files hold plain numbers, branded when read. Hearts deltas in effects are -3 to 3.
- **Integrity:** `src/data/data.test.ts` checks the rulebook's invariants (each encounter keeps a free option, the stop pool covers every zone, start hearts at most max, and so on) plus type-level tests that invalid data fails to compile.
- **Live tuning:** editing a value file under the dev server updates the running game through Vite HMR. Scenes and rules read tuning at the time of use.
- **Choices:** `cardFor` builds a card from an encounter, stop or upgrade offer and the run state (generated text, affected dogs, options disabled with a reason when unaffordable). `chooseOption` applies the chosen option and returns the new run state and the outcome events the scenes animate.

## Save data

Player state that outlives a run. Local only: no accounts, no cloud saves.

- **Profiles:** one per browser.
- **Contents:** bank (integer cents), owned gear, unlocked dogs, dog slots owned, chosen walker, last loadout, stats, logbook, shown first-time hints, settings (reduced motion, music and sound volume), and the zone checkpoint, all referenced by data ids (`koda`, `luckyCollar`).
- **Stats** (`gameplay/game-design.md`, Home screen and progression):
  - Overall: runs by outcome (finished, headed home, out of dogs), best run and lifetime earnings, total firings, and best zone completed (heading home mid-zone counts only the zones before it). Firings per owner equal the per-dog counts, since each dog has one owner, and worlds finished equal runs finished while there is one world.
  - Logbook: the best walk (amount, zones, dogs) and the last walk (the same plus its outcome).
  - Per dog: walks, zones finished, times fired.
  - A run banked from a zone checkpoint counts as headed home.
- **Format:** one JSON document under one key (`dog-walker-game:save`) with a `version` field. Every write replaces the whole document.
- **Validation:** a Valibot schema parses every load, and the types come from the schema. Ids the data no longer has are dropped. A save that fails validation is kept under a backup key, and the game starts fresh.
- **Migrations:** an ordered list of pure functions from each save version to the next, each tested against a fixture save. Renaming a dog or gear id needs one.
- **Storage interface:** async. The web adapter wraps `localStorage`; a Capacitor `Preferences` adapter replaces it in the mobile app, where iOS can evict web view storage. If storage is unavailable or throws (private browsing, quota), the game stays playable and says progress won't be saved.
- **When it writes:** on a shop purchase, at run end, and after each zone. The zone checkpoint records the run's earnings so far. On the next launch an unfinished run is banked as if the player had headed home.
- **Scope:** saves are per origin. Moving to a custom domain starts players from zero unless saves are exported or migrated.

## Porting notes

Things to watch so mobile stays easy: touch controls, screen sizes and aspect ratios, performance, audio unlock on mobile browsers, offline play.

- The page disables browser touch gestures (`touch-action: none`) and pinch zoom, so taps and drags reach the game.
- Scaling: Phaser `Scale.FIT`, the largest 9:16 view that fits the window. The scale is fractional, so pixel sizes are uneven, and phones taller than 9:16 get letterbox bars.
- Installable web app: `/manifest.webmanifest` (start URL `/play/`, fullscreen with a standalone fallback, portrait) and a service worker, `/sw.js`, built by `src/pwa/precachePlugin.ts`. It precaches the game page, its assets and every file in `public/art/manifest.json`. The HTML and the art manifest are network-first with a cache fallback, and hashed assets are cache-first. A new version activates on the next launch, never mid-run.
- Phone events on `window` (`PHONE_EVENTS` in `src/pwa/`): `back-pressed` (Android back) maps to pause, and `app-hidden` pauses the run and checkpoints the save. The run holds a screen wake lock. The first gesture unlocks audio.

## Dev tools

`/play/` reads a run setup from the URL (`src/dev/`). Invalid values are warned about and ignored, and parsing never throws.

| Param   | Value                              | Default                      |
| ------- | ---------------------------------- | ---------------------------- |
| `seed`  | integer 0 to 4294967295            | random, shown in the overlay |
| `pack`  | 1 to 3 dog ids, comma-separated    | saved loadout                |
| `gear`  | a gear id, or `none`               | saved loadout                |
| `zone`  | 1 to 4                             | 1                            |
| `money` | whole cents                        | the gear's starting money    |
| `speed` | scroll-speed multiplier, 0.1 to 10 | 1                            |
| `dev`   | `1` shows the overlay at load      | `0`                          |

- One seed feeds independent random streams (spawns per zone, rolls, pulls, cards), so a draw in one never shifts another.
- Lane moves and card choices are recorded with their simulation time in a versioned input log, and replaying it reproduces the run exactly.
- The dev overlay (backquote toggles it) shows the seed, zone, distance, speed, money, hearts and FPS. C copies a link that reproduces the run.
- The dev panel (`src/dev/devPanel.ts`) is plain HTML under the canvas: a one-line bar that opens a sheet with a run-setup form validated with the URL parser's limits, the overlay toggle, the run link, replay, and save tools (reset, +$1,000, unlock all) that write the save and reload. It is visible in every build.
- Session keys (`sessionStorage`), each an input log as `encodeInputLog` writes it:
  - `dog-walker-game:dev-replay`: written by the panel's Replay before it loads `/play/` with the log's setup. RunScene is to read it at run start, play its events, and remove it. Not wired yet.
  - `dog-walker-game:dev-last-log`: RunScene is to write the finished run's log here at run end; the panel downloads it. Not written yet.

## Open questions

- Playtesting builds on phones early
- Monetization and app-store needs
