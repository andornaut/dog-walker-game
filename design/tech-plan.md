# Tech Plan

## Agreed

- Web build first
- Port to iOS and Android later
- Mostly vibe coded (AI-assisted)
- **Engine:** Phaser 4 + TypeScript, built with Vite. Web-native, AI tools write it well, fully terminal-driven, and the build is static files. Mobile later by wrapping the web build (e.g. Capacitor).
- **Repo:** private GitHub repository `andornaut/dog-walker-game`. Milestones live in `v1-plan.md`, not in a GitHub Projects board.
- **Hosting:** Cloudflare Workers static assets (no Worker script), free and unmetered.
- **Deploys:** Cloudflare Workers Builds deploys every push to `main`. It runs independently of GitHub CI, so a commit with red CI still deploys.
- **Tooling:** copied from `andornaut/cloudflare-starter`: Node 24, Vitest, ESLint with the shared house rules, Prettier, markdownlint, husky + lint-staged pre-commit, Dependabot, and the Test and AI attributions workflows.

## Alternatives considered

- **Godot:** exports to web, iOS and Android from one project, but editor-centric and outside the JS/TS toolchain
- **Kaplay, PixiJS + own game layer:** lighter, smaller ecosystems
- **Rust-based** (e.g. Bevy, macroquad): web via WASM; mobile support varies
- **VPS + nginx:** works equally well for static files, but needs a server and deploy step to maintain

## Open questions

- Project structure & conventions beyond the Milestone 1 scaffold
- Save data: proposed browser `localStorage` for v1 (bank and owned items); local only, no accounts
- Asset pipeline tooling (AI generation → cleanup → sprite sheets); the art-side rules live in `art-style-guide.md`
- Testing / playtesting builds on phones early
- Monetization & app-store needs (later)

## Architecture

- **Render resolution:** 180×320 internal (portrait 9:16), scaled to fit with `pixelArt` (no smoothing). Provisional until the art style guide settles base resolution and tile size.
- **Scenes:** one placeholder `RunScene` for Milestone 1. The rest is TBD.
- **Tests:** Vitest unit tests over pure game logic (e.g. lane geometry). Scenes are checked by playing.

## Porting notes

Running list of things to watch so mobile stays easy: touch controls, screen sizes/aspect ratios, performance, audio unlock on mobile browsers, offline play.

- The page disables browser touch gestures (`touch-action: none`) and pinch zoom, so taps and swipes reach the game.
