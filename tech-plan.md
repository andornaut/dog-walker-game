# Tech Plan

## Agreed

- Web build first
- Port to iOS and Android later
- Mostly vibe coded (AI-assisted)
- **Engine:** Phaser 4 + TypeScript, built with Vite. Web-native, AI tools write it well, fully terminal-driven, and the build is static files. Mobile later by wrapping the web build (e.g. Capacitor).
- **Repo:** private GitHub repository `andornaut/dog-walker-game`. Milestones live in `gameplay/v1-plan.md`, not in a GitHub Projects board.
- **Hosting:** Cloudflare Workers static assets (no Worker script), free and unmetered.
- **Deploys:** Cloudflare Workers Builds deploys every push to `main`. It runs independently of GitHub CI, so a commit with red CI still deploys. This is a deliberate exception to gating a release on its checks.
- **Tooling:** copied from `andornaut/cloudflare-starter`: Node 24, Vitest, ESLint with the shared house rules, Prettier, markdownlint, husky + lint-staged pre-commit, Dependabot, and the Test and AI attributions workflows.

## Alternatives considered

- **Godot:** exports to web, iOS and Android from one project, but editor-centric and outside the JS/TS toolchain
- **Kaplay, PixiJS + own game layer:** lighter, smaller ecosystems
- **Rust-based** (e.g. Bevy, macroquad): web via WASM; mobile support varies
- **VPS + nginx:** works equally well for static files, but needs a server and deploy step to maintain

## Open questions

- Project structure & conventions beyond the Milestone 1 scaffold
- Testing / playtesting builds on phones early
- Monetization & app-store needs (later)

## Architecture

- **Site:** `/` is a static home page (owned by art), `/play/` is the game (`play/index.html`, built from `src/`), and `/art/` is the art gallery, copied as-is from `public/art/`. Both HTML pages are Vite build inputs.
- **Render resolution:** 360×640 internal (portrait 9:16), scaled with `pixelArt` (no smoothing).
- **All UI in the canvas:** the road, top bar, dog column and choice cards are Phaser scenes drawn at the same pixel scale with a pixel font. HTML is only the page shell. One scale and one input system: while cards are up, lane taps are not listened for.
- **Screen layout:**
  - A top bar for status (money, zone progress), separate from the road so it never hides obstacles scrolling in from the top.
  - A fixed-width dog column on the left with 3 slots. A fired dog's slot empties, so the road never changes width mid-run.
  - The road fills the rest.
- **Scenes:**
  - `RunScene`: road, walker, pack and spawns. Paused during encounters, which stops its scrolling, timers and tweens.
  - `HudScene`: top bar and dog column, on top for the whole run. It stays visible during encounters, so money and owner happiness are in view while choosing, and it can highlight the dogs a card affects.
  - `CardScene`: launched on an encounter. It dims the road, shows three cards over it, and resumes `RunScene` after a choice.
- **Game state:** plain TypeScript with no Phaser dependency (money, owner happiness, pack, zone progress), plus pure functions for encounter rules. Scenes only render it. Tuning numbers live in one data file.
- **Assets:** the art agent exports into `public/art/`, which Vite serves at `/art/` and copies into `dist/`. `public/art/manifest.json` lists every asset with paths relative to `public/art/`: `sprites` (key, png, json: PNG sheets with Aseprite hash JSON and frameTags, loaded with `load.aseprite` and `anims.createFromAseprite`), `fonts` (key, png, fnt: XML BMFont, which `load.bitmapFont` requires, drawn with `bitmapText`) and `images` (key, png). Keys are kebab-case and unique. Mock pages live in `public/art/mocks/`, listed in `public/art/mocks/index.json` rather than the manifest. A scene draws a placeholder box for any key that has not landed yet. Sprite and road tile size is 32×32. Art-side rules live in `art/style-guide.md`.
- **Tests:** Vitest unit tests over pure game logic (lane geometry, game state, encounter rules). Scenes are checked by playing.

## Save data

Player state that outlives a run. Local only: no accounts, no cloud saves.

- **Profiles:** one per browser.
- **Contents:** bank (integer cents), owned gear, unlocked dogs, last loadout, stats and settings, referenced by data ids (`koda`, `luckyCollar`).
- **Stats** (`gameplay/v1-plan.md`, Meta progression):
  - Overall: runs by outcome (finished, headed home, out of dogs), best run and lifetime earnings, total firings and firings per owner, best zone reached, and times each world was finished.
  - Per dog: walks, zones finished, times fired.
  - A run banked from a zone checkpoint counts as headed home.
- **Format:** one JSON document under one key (`dog-walker-game:save`) with a `version` field. Every write replaces the whole document.
- **Validation:** a Valibot schema parses every load. The types come from the schema. Ids the data no longer has are dropped. A save that fails validation is kept under a backup key, and the game starts fresh instead of crashing.
- **Migrations:** an ordered list of pure functions (v1 to v2, and so on), each tested against a fixture save. Renaming a dog or gear id needs one.
- **Storage interface:** async (`load()` and `save()` return promises) from the start. The web adapter wraps `localStorage`; a Capacitor `Preferences` adapter replaces it in the mobile app, where iOS can evict web view storage. If storage is unavailable or throws (private browsing, quota), the game stays playable and says progress won't be saved.
- **When it writes:** on a shop purchase, at run end, and after each zone. The zone checkpoint records the run's earnings so far. On the next launch an unfinished run is banked as if the player had headed home.
- **Code:** `src/save/` holds pure schema, migrations and load/save logic, tested with an in-memory store. Only the adapter touches browser storage.
- **Scope:** saves are per origin. Moving to a custom domain starts players from zero unless saves are exported or migrated.

## Porting notes

Running list of things to watch so mobile stays easy: touch controls, screen sizes/aspect ratios, performance, audio unlock on mobile browsers, offline play.

- The page disables browser touch gestures (`touch-action: none`) and pinch zoom, so taps and swipes reach the game.
- Scaling: Phaser `Scale.FIT`, the largest 9:16 view that fits the window. The scale is fractional, so pixel sizes are uneven, and phones taller than 9:16 get letterbox bars. Integer scaling, and a taller road on tall phones, were considered and not taken.
