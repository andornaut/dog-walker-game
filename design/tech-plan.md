# Tech Plan

## Agreed
- Web build first
- Port to iOS and Android later
- Mostly vibe coded (AI-assisted)

## First big open question: engine / framework
This choice determines how painful the mobile port is, so settle it before writing real code. Candidates to compare in a tech session (current proposal in `v1-plan.md`):
- **Godot:** exports to web, iOS and Android from one project; full engine with editor
- **Phaser (JS/TS):** web-native 2D framework; mobile via a wrapper such as Capacitor
- **Other JS/TS options** (e.g. Kaplay, PixiJS + own game layer)
- **Rust-based** (e.g. Bevy, macroquad): web via WASM; mobile support varies

Criteria: web + mobile export story, how well AI tools write code for it, pixel-art support (crisp scaling), touch input, terminal-friendly workflow, how much we have to build ourselves.

## Other open questions
- Repo & hosting (git host, where the web build lives)
- Project structure & conventions
- Save data (local only to start?)
- Asset pipeline (AI generation → cleanup → sprite sheets)
- Testing / playtesting builds on phones early
- Monetization & app-store needs (later)

## Architecture
_TBD after engine choice._

## Porting notes
Running list of things to watch so mobile stays easy: touch controls, screen sizes/aspect ratios, performance, audio unlock on mobile browsers, offline play.
