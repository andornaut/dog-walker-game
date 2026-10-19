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

- **Format:** typed TypeScript modules in `src/data/` (dogs, quips, encounters, forced stops, lucky encounters, upgrades, shop, debuffs, zones, walkers, tuning). Content is `as const satisfies Type`. Tuning uses plain `satisfies`, so its values stay `number` for live tuning.
- **Ownership:** the gameplay agent edits values and content in the value files. Tech owns `types.ts`, `index.ts`, `src/rules/` and all tests.
- **Effects:** card options are lists of effects from a closed set of kinds. Effects name tuning numbers by key instead of copying them, so every number lives once in `tuning.ts`. A new card built from existing kinds is a data change; a new kind is code in `src/rules/` plus a test.
- **Card text:** generated from the effects and tuning, with a snapshot test.
- **Units:** money (integer cents), hearts, seconds, probability, pixels and multipliers are distinct branded types in the rules. Value files hold plain numbers, branded when read. Hearts deltas in effects are -3 to 3.
- **Integrity:** `src/data/data.test.ts` checks the rulebook's invariants (each encounter keeps a free option, the stop pool covers every zone, start hearts at most max, and so on) plus type-level tests that invalid data fails to compile.
- **Live tuning:** editing a value file under the dev server updates the running game through Vite HMR. Scenes and rules read tuning at the time of use.
- **Choices:** `cardFor` builds a card from an encounter, stop or upgrade offer and the run state (generated text, affected dogs, options disabled with a reason when unaffordable). `chooseOption` applies the chosen option and returns the new run state and the outcome events the scenes animate.

## Save data

Player state that outlives a run. Local only: no accounts, no cloud saves.

- **Profiles:** one per browser.
- **Contents:** bank (integer cents), owned gear, unlocked dogs, chosen walker, last loadout, stats, settings, and the zone checkpoint, all referenced by data ids (`koda`, `luckyCollar`).
- **Stats** (`gameplay/game-design.md`, Home screen and progression):
  - Overall: runs by outcome (finished, headed home, out of dogs), best run and lifetime earnings, total firings and firings per owner, best zone reached, and times each world was finished.
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

- The page disables browser touch gestures (`touch-action: none`) and pinch zoom, so taps and swipes reach the game.
- Scaling: Phaser `Scale.FIT`, the largest 9:16 view that fits the window. The scale is fractional, so pixel sizes are uneven, and phones taller than 9:16 get letterbox bars.

## Open questions

- Playtesting builds on phones early
- Monetization and app-store needs
