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
- Save data: proposed browser `localStorage` for v1 (bank and owned items); local only, no accounts
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

## Porting notes

Running list of things to watch so mobile stays easy: touch controls, screen sizes/aspect ratios, performance, audio unlock on mobile browsers, offline play.

- The page disables browser touch gestures (`touch-action: none`) and pinch zoom, so taps and swipes reach the game.
- Phones taller than 9:16 are common. Open: fix the width and let the height grow, so the extra height shows more road instead of letterbox bars.
