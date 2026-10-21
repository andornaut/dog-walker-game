# Tech Plan

## Platform and delivery

- **Deploys:** see [Deploying](../README.md#deploying).
- **Engine:** Phaser 4 and TypeScript, built with Vite into static files.
- **Hosting:** Cloudflare Workers static assets, no Worker script.
- **Platforms:** web, phone browser first. iOS and Android later by wrapping the web build with Capacitor.
- **Repo:** private GitHub repository `andornaut/dog-walker-game`.
- **Tooling:** follows `andornaut/cloudflare-starter`: Node 24, Vitest, ESLint with the shared house rules, Prettier, markdownlint, husky and lint-staged, Dependabot, and the Test and AI attributions workflows.

## Site

`/` is a static home page, `/play/` the game, `/data/` every game data table plus simulated runs, and `/art/` the art gallery (copied from `public/art/`). The HTML pages are Vite build inputs under `pages/`, Vite's root, each at its URL's path. They load modules as `/src/...`, which `vite.config.ts` aliases to the repository's `src/`.

## Architecture

The player-facing rules (controls, layout, movers, pulls, feedback) are in `gameplay/design.md`; this section covers how the code carries them out.

### The walk

- **Collisions:** the pack collides as it is drawn. Each part's hit rectangle is the walker's or a dog's opaque pixels, `PART_INSET` inside them, and the pack's outline is their bounding box, leashes included (`src/layout/packFormation.ts`). An obstacle's hit box is the bounding box of its sprites' opaque pixels at its depth, `PART_INSET` inside, cut to its lanes (`obstacleHitBox` in `src/runner/walk.ts`). Pickups and lucky finds use `ROAD_HIT_SIZE` (`src/assets/spriteKeys.ts`). The spawn planner spaces rows by the longest obstacle (`plannedCellInset`) and keeps a pack-fit gap of the longest pack outline (`tallestPackLength`).
- **Cosmetic layers:** ambient movers (`src/road/ambient.ts`, each zone's mix in `src/data/ambient.ts`), roadside props (`src/road/roadsideProps.ts`) and hit obstacles left on the road as scenery (`src/road/struckScenery.ts`) collide with nothing and the walk never reads them. Ambient movers draw from the run's `ambient` stream, which the session never reads, and roadside props draw no random numbers, so a seed plays the same walk with or without them.
- **Fixed step:** `RunScene` steps the walk session at 1/60 s, as many steps per frame as the wall-clock time since the last frame holds, banking at most a second (`src/runner/fixedStep.ts`). It reads the frame timestamps, not Phaser's delta, which Phaser smooths and clamps, so a slow device keeps to real time and a replay matches the run step for step.
- **Movers:** `src/runner/movers.ts` plans each mover's whole path from the zone's spawn stream, so the game and the simulator's bot see the same moves. `planSpawns` (`src/runner/spawning.ts`) places the obstacles that open a card first, then the other movers, then the other spawns, so a card is the last thing skipped. It holds the on-screen mover caps (`counts.maxMovers` and its dart and slow-vehicle limits) and the pack-fit gap (`packFitsBetween`) wherever a mover can stand.
- **Pausing:** the walk steps only while `walkPaused` (`src/hud/topBar.ts`) finds nothing pausing it. Each overlay reports to `MenuFlow.pause()` (`src/scenes/run/menuFlow.ts`), so a new overlay pauses the walk too.
- **Pseudo-3D road:** game logic keeps a flat road (lane x, distance ahead of the walker in road pixels, scale 1 at the pack). Only drawing projects it, through `src/layout/projection.ts` with `ROAD_CAMERA` (`src/data/screen.ts`). `src/layout/roadRaster.ts` draws the road and verges row by row into one canvas texture. Road sprites scale smoothly with distance, drawn from the smallest of their art steps (1x and the manifest's `<key>@88`, `@75`, `@62` and `@50` variants that are loaded) at least their projected size (`src/layout/depthScale.ts`).
- **Pulls:** `src/runner/pulls.ts` draws no random numbers: each pull follows from the road, so the input log needs nothing for them. A pull into a lane where an obstacle or mover would reach the pack before the player could steer back (`seconds.pullReactionWindow`) waits until the lane clears.
- **Walk session:** `src/runner/session.ts` is the walk's one step order, pure and shared by `RunScene` and the simulator. A step applies its inputs (lane moves, heading home), then the pulls, the Zoomies' drift and the walk, then any firing hold; then it opens the queued cards, ends the zone (fees, then the fork) or plans the next zone. Its random streams are named from the run's seed (`runStreams`; each zone's spawns from `spawns-<zone index>`), so a seed and an input log replay the same walk wherever they are played. It returns events that the scene plays as sounds and effects and the simulator counts.

### Screens and UI

- **Accessibility:** reduced motion (a setting, defaulting to `prefers-reduced-motion`) drops decorative motion but keeps every highlight and state change, the road scroll and the lane slide. No state relies on colour alone. Tap targets are at least 44 game pixels. Text meets 4.5:1 contrast and essential icons 3:1.
- **Crash screen:** `src/crash/` shows it on the first uncaught error or unhandled rejection, ignoring extension, cross-origin (`Script error.`) and ResizeObserver-loop errors. Phaser does not catch errors in its step, so they reach `window` and stop its loop. It writes nothing (the next launch banks the last zone checkpoint) and offers Reload; with `dev=1` it adds the message, stack and a Copy button.
- **Input:** the pack's lane slide is drawn as of the frame's time, from the current step with the queued moves applied (`leadWalk` in `src/scenes/run/interpolate.ts`), so a move shows on the next frame; the rest of the road blends between the last two steps. In the walk the latest finger down steers, so a thumb resting on a card never holds the steering; every other scene follows the first finger down until it lifts.
- **Interaction states:** every tile, tab, card option and button shows one state from `src/ui/interaction.ts` (`buttonState`, `itemTile`, `tileState`): disabled, normal, selected or primary, drawn as `art/style-guide.md` sets out. Each piece has a drawn fallback while its art is missing.
- **Rendering:** a fixed portrait resolution (`SCREEN_CONFIG`), scaled by the largest whole number of device pixels per game pixel that fits, centred and letterboxed, with `pixelArt`. Every screen rect comes from `screenLayout` (`src/layout/screenLayout.ts`), and the walk bar's and dog cards' insides from `src/hud/walkHud.ts`. Every game UI element is drawn in the canvas; HTML is only the page shell, the dev panel and the crash screen.
- **Scenes:** `StartScene` is the home screen, with `ShopScene`, the only place to buy, over it. `RunScene` runs the walk, with its parts in `src/scenes/run/`, one concern each. It starts from the `RunSceneData` that `StartScene`, or `BootScene` for a dev link, builds with `runSceneData` (`src/scenes/run/runStart.ts`): the setup (a waiting replay log's, else the page's) with its pack, gear and walker over the starter's pick, the dog slots, the walker's sprite and the replayed inputs. `HudScene` draws the walk bar, debuff bars, dog cards, owner tabs and message strip, and stays visible during cards. It reads the walk through `HudWalk` and the bar's buttons act through `HudRun` (`src/scenes/hudWalk.ts`): `RunScene` implements `HudRun` and passes itself when it launches the HUD, and the help's picture of the HUD passes a still `HudWalk`. `CardScene` (2 or 3 cards) and `PauseScene` open over the dimmed walk, and the HUD takes no taps under them. `ZoneCelebrationScene` opens after each zone but the last, before the fork card.
- **Sound:** `src/audio/` maps cues to manifest keys and mixes music and effects from settings, ducking music and muting effects while the player has paused, and muting both while hidden. `src/scenes/soundboard.ts` is the Phaser wrapper.
- **Text:** bitmap fonts tinted to palette colours, body text at 2x. Text that doesn't fit is shortened, wrapped or moved to the enlarged card.

### Source layout

Each context keeps its pure code at its root and the code that imports Phaser in a `phaser/` subfolder.

- `src/assets/`: manifest and Aseprite parsing, art keys and depth steps; `atlas/` packs the atlases at build time
- `src/audio/`: sound cues, the music and effects mix, and the sound format
- `src/crash/`: the crash screen
- `src/data/`: content and tuning
- `src/dataPage/`: the `/data/` page, with filter pills kept in the query string
- `src/headers/`: the build-time security headers
- `src/home/`, `src/help/`, `src/hud/`: view models for the home, settings, stats and end screens, the help screen, and the walk bar and pause menu
- `src/input/`: keys and the touch gesture state machine
- `src/layout/`: screen geometry and the road projection
- `src/lib/`: helpers with no game knowledge
- `src/pack/`: the pack drawing every screen shares: each leash from the walker's hand to the dog's collar and the draw order (dogs by their feet rows, then leashes, then the walker). `phaser/` draws the pack for the walk, the start screen's gate and the end screen's walk home, so the three draw it alike
- `src/pwa/`, `src/dev/`: phone app and dev tools
- `src/road/`: road clipping, the roadside, ambient movers and struck scenery; `phaser/` draws the backdrop band
- `src/rules/`, `src/state/`: run state and pure rules
- `src/runner/`: the walk session, lane motion, spawn planning, collisions, movers and pulls
- `src/save/`: persistence
- `src/scenes/`, `src/main.ts`: the Phaser scenes
- `src/sim/`: the run simulator
- `src/site/`: tests of the site nav's stylesheet, `public/nav.css`
- `src/testing/`: helpers shared by the tests
- `src/tools/`: the art manifest, the data export and the depth preview
- `src/ui/`: the pixel-art UI kit; `phaser/` draws text, panels and the dimmed ramps

**Boundary:** only `src/main.ts`, `src/scenes/` and the `phaser/` folders may import Phaser or code that does, and only tests may import `src/testing/`. A context listed in `CONTEXTS` (`eslint.config.mjs`) imports only the folders and modules its row lists; `src/lib/` imports nothing from `src/`. No value imports form a cycle (`import-x/no-cycle`); type-only imports are erased, so they may. ESLint enforces all four, so all game logic runs in unit tests without a renderer.

### Assets

- **Atlases:** a build packs every image and sprite frame into atlas pages of at most 2048 px a side (`src/assets/atlas/atlasPlugin.ts`), grouped `boot`, `ui`, `home`, `run` and `cards`, with `/art/atlas-manifest.json` mapping each key and frame to its page and rect. `home` and `run` sprite frames are trimmed to their opaque pixels with their offsets recorded, so origins, flips and anchors measure the whole frame. BootScene gives each key its own texture whose frames are rects of the shared page, so keys, frame names and `<texture>:<tag>` animations work unchanged. It loads `boot`, then `ui` and `home` and the home screen's sounds (`HOME_CUES`), shows the home screen, and loads the rest behind it; Start walk and Help wait for those. `src/scenes/homeArt.test.ts` fails for an art key or sound the home screen names that boot leaves until later. The dev server loads every key from its own files.
- **Checks:** `npm run check:art` runs only the art tests, which fail when the committed manifest differs from what the files give. A test fails when `shared/export/` is stale. `npm run art:unused` lists manifest keys that no source file or game data names.
- **Data export:** `npm run export:data` writes `shared/export/game-data.json` (the world, content, card faces, tuning and help pages, with their art keys) and `shared/export/layout.json` (screen regions, lanes, HUD, camera, depth steps, sprite sizes, pack formations and scene panels) from the game's modules, for art's tools. `npm run build` runs it first and the dev server reruns it as `src/` changes.
- **Depth preview:** `npm run art:depth-preview -- <key> [zone]` draws a road sprite through the walk's projection at a sweep of distances on each zone's road, writing PNGs and a contact sheet to `out/depth-preview/<key>/`.
- **Keys:** kebab-case and unique. Dog-keyed art (`dog-<art>`, `face-dog-<art>`, `portrait-dog-<art>`, `owner-<art>` and the like) and zone-keyed art (`backdrop-<art>`, `road-<art>` and the like) name their dog or zone by the `art` id in its data, so a renamed dog or zone keeps its art. Animation keys are `<texture>:<tag>`. Sprites anchor on the feet, and a missing key draws a placeholder box.
- **Manifest:** `public/art/manifest.json` is derived from the files under `public/art/` and committed (`src/tools/artManifest.ts`): a key is its file's name less the extension, and its kind is its folder (`sprites/`, `images/`, `fonts/`, `sounds/`). `public/art/manifest.extra.json` holds what a file cannot say, such as a sound's `loop`. A build writes it before packing the atlases, the dev server rewrites it as the art changes, and `npm run art:manifest` writes it. Valibot validates it and the sprite JSON at boot.
- **Shared tables:** `shared/` holds the files the game and art's tools both read: `depth-steps.json` (each depth step's key suffix and scale, and the frame size rule), and the tables art's tools generate, `palette.json` (`art/tools/pixel.py palette`), `verges.json` (`art/tools/backdrops.py verges --write`) and `roadside.json` (`art/tools/roadside.py table --write`, which a test compares against). Never edit a generated table by hand.

### Tests and simulator

- **Simulator:** `src/sim/` plays whole runs on the real rules over a matrix of card policies, route policies, skill presets (`src/sim/skills.ts`), gear, packs and walkers. A player is a steering bot that plays the game's own walk session at its 1/60 s step: its lane moves are the steps' inputs and the policies choose each card as it opens, so a run's seed and its input log (`RunResult.inputs`) replay it in the game. The bot and the policies draw from streams of their own (`bot`, `policy`), so results are deterministic per seed. `npm run simulate -- --help` lists the options and columns. Compare balance changes before and after at the same seed.
- **Tests:** Vitest over all pure logic; scenes are checked by playing and by headless screenshots.

## Game data

- **Card text:** generated from the effects and tuning, covered by a snapshot test.
- **Choices:** `cardFor` builds a card (text, affected dogs, options disabled when unaffordable); `chooseOption` applies a choice and returns the new run state plus the outcome events the scenes animate.
- **Effects:** card options are lists of effects from a closed set of kinds, naming money amounts and modifiers by their `tuning.ts` key. Hearts deltas are written inline. A new kind is code in `src/rules/` plus a test.
- **Format:** typed TypeScript modules in `src/data/`. Content is `as const satisfies Type`. Tuning uses plain `satisfies` so its values stay `number` for live tuning.
- **Integrity:** `src/data/data.test.ts` checks the rulebook's invariants, and type-level tests show invalid data fails to compile.
- **Live tuning:** editing a value file under the dev server updates the running game through Vite HMR. Scenes and rules read tuning at the time of use.
- **Ownership:** gameplay edits values and content in the value files. Tech owns `types.ts`, `index.ts`, `screen.ts`, `src/rules/` and the tests.
- **Units:** money (integer cents), hearts, seconds, probability, pixels and multipliers are branded types in the rules; value files hold plain numbers.
- **Zones and forks:** `world.ts` lists the zones from easiest to hardest. A walk is `walkLength` zones from `firstZone`, ending on `lastZone`. The run's `route` lists the zones walked by id, and `zoneIndex` is a position in it. After each zone but the last, `offerFork` offers up to three unwalked zones in world order, each carrying an upgrade; the fork before the last zone leads only to `lastZone`. Its choice is an ordinary card choice that takes the upgrade and appends the zone to the route.

## Save data

- **Achievements:** `src/rules/achievements.ts` judges each badge's conditions when a run is banked, on a purchase and on launch.
- **Contents:** bank, owned dogs, gear, slots and walkers, chosen walker, last loadout, stats and logbook, shown hints, settings, earned achievements and the zone checkpoint (with the run's route), all referenced by data ids.
- **Format:** one JSON document under `dog-walker-game:save` with a `version` field; every write replaces it.
- **Scenes:** `src/scenes/profileStore.ts` holds the loaded save for every scene and is the only way scenes read or change it.
- **Scope:** one profile per browser, local only, per origin.
- **Storage:** an async interface. The web adapter wraps `localStorage`; a Capacitor `Preferences` adapter will replace it in the app, where iOS can evict web storage. When storage fails, the game stays playable and says progress won't be saved.
- **Validation:** a Valibot schema parses every load. Unknown ids are dropped. A save that fails validation is kept under `dog-walker-game:save-backup` and the game starts fresh.
- **Version:** before v1 ships, a save-format change or an id rename (a dog, gear item, walker or encounter) bumps `SAVE_VERSION` (`src/save/schema.ts`) and an older save resets to a default save, kept as a backup like one that fails validation; there are no migrations. A save from a later version than the running game (after a rollback, or on a stale page) is left as stored: the game plays from a default save in memory, writes nothing for the session, and the home screen asks the player to reload.
- **Writes:** on a purchase, a loadout, walker, settings or hint change, after each zone (the checkpoint) and at run end. An unfinished run is banked on the next launch as a run that headed home.

## Phone

- **Audio:** resumes from iOS's `interrupted` or `suspended` state on each return to the foreground and each gesture (`touchend` on iOS), unless the settings mute it.
- **Installable web app:** `/manifest.webmanifest` and a service worker, `/sw.js`, built by `src/pwa/precachePlugin.ts`, precache the game, the atlas pages and the other art (sounds in one format only). HTML, the art manifest and the site nav are network-first; hashed assets, precached files and sounds are cache-first. `updateAction` (`src/pwa/updateReady.ts`) decides updates: a fresh load holds the boot for up to 4 seconds while it checks for a new version; before the player interacts, a waiting version takes over at once and reloads; after, the page never reloads on its own and the home screen shows an "Update ready" toast.
- **Installed app:** on `/play/` in `fullscreen` or `standalone` display mode, or with iOS's `navigator.standalone`, `public/nav.js` leaves the nav bar out, so no link leaves the app.
- **Phone events** (`PHONE_EVENTS` in `src/pwa/events.ts`): going back, hiding the app, turning sideways and losing focus each open the pause menu; hiding also checkpoints. The run holds a screen wake lock.
- **Portrait only:** the manifest locks `portrait`, and a phone on its side gets a "Turn your phone upright" notice over the page.
- **Security headers:** `src/headers/securityHeadersPlugin.ts` writes `dist/_headers` at build time: nosniff, referrer and permissions policies, and a CSP per path allowing `'self'` plus hashes of each page's inline blocks. No script injects a `<style>`, so no hash depends on a script's text. Content-hashed output under `/assets/*` is cached immutably, and the build fails for an unhashed name there. Font descriptors (`*.fnt`) are served as `text/xml`, which Cloudflare compresses.
- **Sound format:** each sound ships as Ogg and AAC (`.m4a`). The page picks the first the browser plays (`src/audio/soundFormat.ts`), boot loads only that file, and the page registers `/sw.js?sound=<format>` because a worker has no `canPlayType`.
- **Touch:** the canvas takes no browser gestures (`touch-action: none`). Tap targets are at least 44×44 render px. Every full-screen page and overlay closes from the same top-right control (`src/ui/closeControl.ts`).

## Dev tools

`/play/` reads a run setup from the URL; invalid values, unknown ids included, are warned about and ignored. A URL with any run parameter (all but `dev` and `route`) skips the home screen and starts the walk, its pack and gear replacing the saved loadout for that walk only. Reaching the home screen removes every parameter but `dev` from the URL.

| Param    | Value                           | Default         |
| -------- | ------------------------------- | --------------- |
| `dev`    | `1` shows the overlay           | `0`             |
| `gear`   | a gear id, or `none`            | saved loadout   |
| `money`  | whole cents                     | gear's starting |
| `pack`   | 1 to 3 dog ids, comma-separated | saved loadout   |
| `route`  | zone ids walked, from the first | pre-fork route  |
| `seed`   | integer 0 to 4294967295         | random          |
| `speed`  | scroll-speed multiplier         | 1               |
| `walker` | a walker id                     | saved walker    |
| `zone`   | 1 to the walk's length          | 1               |

- **Build label:** the Dev bar and the crash screen's dev details show `v<version> · <commit>`, from `__APP_VERSION__` (package.json) and `__COMMIT__`, which `vite.config.ts` defines from `WORKERS_CI_COMMIT_SHA`, else `git rev-parse HEAD`, else `dev` (`src/tools/buildVersion.ts`).
- **Dev panel:** a "Dev" bar below the canvas opens the cheat sheet. Its top section, Cheats on/off, Start at and the cheats (Invincible owners, Show hit boxes, Movement speed: slow, normal or fast), is staged until Apply; applied cheats last for the tab (`sessionStorage`) and never reach the save. Below a divider, the save cheats (+$100, +$1,000, Unlock all, Reset save) act at once: they are queued in `sessionStorage`, written at the next boot before the save loads, and reload to the start screen.
- **Input log:** lane moves, card choices and heading home are recorded with their step's time in a versioned log (a replay rejects a log of any other version), whose setup names the pack, gear, walker and route, so a replay does not depend on the saved loadout. RunScene writes the finished run's log to `sessionStorage` key `dog-walker-game:dev-last-log` and the next walk started plays a log found under `dog-walker-game:dev-replay`.
- **Overlay** (backquote): the seed, zone, distance, speed, money, hearts and FPS, and a zone clock (`src/dev/zoneClock.ts`) that splits the zone's wall-clock time into road time, held time and lag. C copies a link that reproduces the run.
- **Random streams:** one seed feeds `spawns-<zone>`, `ambient`, `cards`, `forks` and `quips`, where `<zone>` is the position in the walk. `cards` also draws a lucky find's effects, a dog's dodges (a dog with no dodge chance draws nothing) and each fork's upgrades.

## Open questions

- Monetization and app-store needs
- Playtesting on phones

## Remaining for the first build

Nothing on the tech side.
