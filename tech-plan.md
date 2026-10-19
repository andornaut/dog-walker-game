# Tech Plan

## Platform and delivery

- **Platforms:** web, phone browser first. iOS and Android later by wrapping the web build (Capacitor).
- **Engine:** Phaser 4 + TypeScript, built with Vite into static files.
- **Repo:** private GitHub repository `andornaut/dog-walker-game`.
- **Hosting:** Cloudflare Workers static assets, no Worker script.
- **Deploys:** Cloudflare Workers Builds deploys every push to `main`, independently of GitHub CI, so a commit with red CI still deploys.
- **Tooling:** follows `andornaut/cloudflare-starter`: Node 24, Vitest, ESLint with the shared house rules, Prettier, markdownlint, husky + lint-staged, Dependabot, and the Test and AI attributions workflows.
- **Type checking:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` and `noFallthroughCasesInSwitch`.

## Site

`/` is a static home page, `/play/` the game, `/data/` every game data table plus simulated runs, and `/art/` the art gallery (copied from `public/art/`). The HTML pages are Vite build inputs.

## Architecture

- **Rendering:** 360×640 internal, portrait, scaled with Phaser `Scale.FIT` and `pixelArt`. Every game UI element is drawn in the canvas; HTML is only the page shell, the dev panel and the crash screen.
- **Crash screen:** `src/crash/` shows it once, on the first uncaught error or unhandled rejection, and ignores extension, cross-origin (`Script error.`) and ResizeObserver-loop errors. Phaser does not catch errors in its step, so they reach `window` and stop its loop. It pauses the game, writes nothing (the next launch banks the last zone checkpoint) and offers Reload; with `dev=1` it adds the message, stack and a Copy button.
- **Screen layout:** top bar 360×40, backdrop band 360×150 (the zone's neighbourhood and scenery gags, never part of a lane), dog column 80×450 with 3 slots, and road 280×450 split into 5 lanes. A fired dog's slot empties, so the road never changes width.
- **Pseudo-3D road:** game logic keeps the flat road (lane x, distance ahead of the walker in road pixels, scale 1 at the pack); only drawing goes through `src/layout/projection.ts` (`ROAD_CAMERA` in `src/data/screen.ts`). The road and verge are drawn row by row into one canvas texture (`src/layout/roadRaster.ts`), with 2x and 4x shrunk strips for rows that cover more than 2 strip rows. Sprites snap to 1, 0.75 or 0.5 scale and use a manifest's `<key>@75` or `<key>@50` when loaded. Spawns come into view at the far edge of the projected road, about 630 road pixels ahead.
- **Scenes:** `RunScene` draws the road, walker, pack and spawns, and pauses during cards. `HudScene` draws the top bar and dog column and stays visible during cards. `CardScene` shows 2 or 3 cards over the dimmed road and reports the choice to `RunScene`.
- **Text:** bitmap fonts `font-body` and `font-title`, tinted to palette colours. Body text is drawn at 2x; text that doesn't fit is shortened, wrapped, or moved to the enlarged card.
- **Input:** keys (arrows, A/D or H/L) move one lane per press. Touch is a relative drag: each lane-width of travel from where the press started moves the target lane by one, and the pack moves toward it lane by lane. A tap moves one lane toward the tapped half of the road, a tap on a dog's slot gives a treat, and the top bar pauses. A pull that moves the pack re-anchors the drag at the pointer, so getting back takes another lane-width of drag.
- **Accessibility:** reduced motion (a setting, defaulting to `prefers-reduced-motion`) drops decorative motion but keeps every highlight and state change, the road scroll and the lane slide. No state relies on colour alone. Tap targets are at least 48 CSS px with 8 px between them. Text meets 4.5:1 contrast and essential icons 3:1.
- **Sound:** `src/audio/` maps cues to manifest keys and mixes music and effects volumes from settings, ducking music under cards and muting while paused or hidden. `src/scenes/soundboard.ts` is the Phaser wrapper. Each sound ships as Ogg plus AAC.
- **Source layout:**
  - `src/data/`: content and tuning
  - `src/rules/`, `src/state/`: run state and pure rules
  - `src/runner/`: lane motion, zones, spawn planning, collisions, the hit stop, pulls
  - `src/input/`: keys and the touch gesture state machine
  - `src/home/`, `src/hud/`, `src/help/`: view models for the home, settings, stats and end screens, the top bar and pause menu, and the help screen
  - `src/text/`: the pixel font
  - `src/layout/`: screen geometry
  - `src/assets/`: manifest and Aseprite parsing
  - `src/save/`: persistence
  - `src/sim/`: the run simulator
  - `src/pwa/`, `src/dev/`: phone app and dev tools
  - `src/dataPage/`: the `/data/` page
  - `src/headers/`: the build-time security headers
  - `src/crash/`: the crash screen
  - `src/scenes/`, `src/main.ts`: everything that touches Phaser
- **Boundary:** only `src/scenes/` and `src/main.ts` may import Phaser, and only tests may import `src/testing/`. ESLint enforces both, so all game logic runs in unit tests without a renderer.
- **Assets:** the art agent exports into `public/art/`. `public/art/manifest.json` lists `sprites` (PNG plus Aseprite hash JSON), `fonts` (XML BMFont), `images` and `sounds`, with paths relative to `public/art/`; Valibot validates it and the sprite JSON at boot. Keys are kebab-case and unique. Dog-keyed art (`dog-<art>` and its depth variants, `face-dog-<art>`, `portrait-dog-<art>`, `face-owner-<art>`, `owner-<art>` and the `ui-doghouse` tag) names the dog by the `art` id in its data, so a renamed dog keeps its art until the art is renamed. Animation keys are `<texture>:<tag>`. Sprites anchor on the feet, and a missing key draws a placeholder box. Art rules live in `art/style-guide.md`.
- **Atlases:** a build packs every image and sprite frame into a few atlas pages (`src/atlas/atlasPlugin.ts`): at most 2048 px a side, grouped `boot` (the loading screen), `ui`, `run` and `cards` (cards and help), each frame untrimmed with its edge pixels extruded 1 px, written to `/art/atlas/<group>-<n>.png` with `/art/atlas-manifest.json` mapping each key and frame to its page and rect. BootScene loads the `boot` page first, then the rest, and gives each key its own texture whose frames are rects of the shared page, so texture keys, frame names, `<texture>:<tag>` animations and anchors work unchanged. The loading bar weighs each file by its size, a page by its `bytes` in the atlas manifest, so a few large pages move it steadily. A key the atlas leaves out, and every key on the dev server, loads from its own files. `public/art/` stays as the art agent exports it.
- **Tests:** Vitest over all pure logic; scenes are checked by playing and by headless screenshots.
- **Simulator:** `src/sim/` plays whole runs on the real rules over a matrix of card policies (hearts unless an owner would drop to 1, always hearts, always pay), players and packs. A player is a steering bot of a skill preset (novice, typical, expert in `src/sim/skills.ts`: reaction delay, look-ahead, error rate, lane-change cooldown), which plays the pure walk loop (`stepWalk` with pulls, chases and movers, no renderer) and plans lane changes over what it has seen; its hit rates are measured. A `--hit` player instead hits each obstacle at a fixed rate, for comparison with older results. The walk is stepped from event to event (a contact, a lane move ending, a tell, a pull, a bot input) instead of every frame. `npm run simulate -- [--skill novice,typical,expert] [--hit 6,10,15] [--policy ...] [--runs 1000] [--seed 1] [--out rows.json]`; `--help` lists the columns. Results are deterministic per seed: the bot's errors draw from their own stream, and each zone's spawns from their own, as in the game. The Badges column counts the achievements a run earns on its own facts. Balance changes are compared before and after at the same seed.

## Game data

- **Format:** typed TypeScript modules in `src/data/`. Content is `as const satisfies Type`. Tuning uses plain `satisfies` so its values stay `number` for live tuning.
- **Ownership:** gameplay edits values and content in the value files. Tech owns `types.ts`, `index.ts`, `screen.ts`, `src/rules/` and the tests.
- **Effects:** card options are lists of effects from a closed set of kinds, naming money amounts and modifiers by their `tuning.ts` key. Hearts deltas are written inline. A new kind is code in `src/rules/` plus a test.
- **Card text:** generated from the effects and tuning, covered by a snapshot test.
- **Units:** money (integer cents), hearts, seconds, probability, pixels and multipliers are branded types in the rules; value files hold plain numbers. Hearts deltas are -3 to 3.
- **Integrity:** `src/data/data.test.ts` checks the rulebook's invariants, and type-level tests show invalid data fails to compile.
- **Live tuning:** editing a value file under the dev server updates the running game through Vite HMR. Scenes and rules read tuning at the time of use.
- **Choices:** `cardFor` builds a card (text, affected dogs, options disabled when unaffordable); `chooseOption` applies a choice and returns the new run state plus the outcome events the scenes animate.

## Save data

- **Scope:** one profile per browser, local only, per origin.
- **Contents:** bank (cents), owned dogs, gear and slots, chosen walker, last loadout, stats and logbook (`gameplay/game-design.md`, Home screen and progression), shown hints, settings, earned achievements with the time each was earned, and the zone checkpoint (with the run's achievement counters), all referenced by data ids.
- **Format:** one JSON document under `dog-walker-game:save` with a `version` field; every write replaces it.
- **Validation:** a Valibot schema parses every load. Unknown ids are dropped. A save that fails validation is kept under a backup key and the game starts fresh.
- **Migrations:** ordered pure functions between save versions, each tested against a fixture. Renaming a content id needs one.
- **Storage:** an async interface. The web adapter wraps `localStorage`; a Capacitor `Preferences` adapter will replace it in the app, where iOS can evict web storage. When storage fails, the game stays playable and says progress won't be saved.
- **Writes:** on a purchase, a loadout, walker, settings or hint change, after each zone (the checkpoint) and at run end. An unfinished run is banked on the next launch as a run that headed home.
- **Achievements:** `src/rules/achievements.ts` judges each badge's conditions (a closed set of kinds with thresholds in the data) when a run is banked, on a purchase and on launch. Badges earned at run end celebrate on the end screen; those earned on launch or by a purchase celebrate over the home screen.
- **Scenes:** `src/scenes/profileStore.ts` holds the loaded save for every scene and is the only way scenes read or change it.

## Phone

- The canvas takes no browser gestures (`touch-action: none`).
- Installable web app: `/manifest.webmanifest` and a service worker, `/sw.js`, built by `src/pwa/precachePlugin.ts`, precache the game, the atlas pages and atlas manifest, and every other file in the art manifest (fonts, and sounds in one format only). Boot makes about 30 requests: the page, its scripts, the two manifests, four atlas pages, four font files and a file per sound. HTML and the art manifest are network-first; hashed assets, precached files and sound files are cache-first. A new version activates on the next launch, or sooner through the "Update ready" toast, shown on the home screen only, whose Reload posts `skip-waiting` and reloads on `controllerchange`.
- Sound format: each sound ships as Ogg and AAC (`.m4a`). The page picks the first the browser plays, Ogg before AAC (`src/audio/soundFormat.ts`, asking `canPlayType` the same types Phaser checks). BootScene loads only that file, and the page registers `/sw.js?sound=<format>` so the worker precaches only that format; a worker has no `canPlayType` of its own. A sound the install did not store is cached on its first fetch.
- Installed app: on `/play/` in `fullscreen` or `standalone` display mode, or with iOS's `navigator.standalone`, `public/nav.js` leaves the nav bar out (and follows a display-mode change), so no link leaves the app and the game takes the full height under the top safe-area inset.
- Security headers: `src/headers/securityHeadersPlugin.ts` writes `_headers` at build time: nosniff, referrer and permissions policies, and a CSP per path (`/`, `/play/*`, `/data/*`, `/art/*`) allowing `'self'` plus hashes of each page's inline blocks. Google Fonts is allowed only on `/` and `/art/*`. `/sw.js` keeps the platform's `max-age=0, must-revalidate`.
- Phone events (`PHONE_EVENTS` in `src/pwa/`): `back-pressed` pauses, `app-hidden` pauses and checkpoints, and `turned-sideways` pauses. The run holds a screen wake lock, and the first gesture unlocks audio.
- Portrait only: the manifest locks `portrait`, and a phone on its side (coarse pointer, landscape, viewport at most 500 CSS px tall) gets a "Turn your phone upright" notice over the page.
- Audio resumes from iOS's `interrupted` or `suspended` on each return to the foreground and each gesture (`touchend` on iOS), unless the settings mute it.
- Help tap targets (close X, page dots, Back, Next) are at least 44×44 render px, larger than their art where needed.

## Dev tools

`/play/` reads a run setup from the URL. Invalid values are warned about and ignored. A renamed dog id is warned about and replaced by its new one, in a URL and in a replayed log's setup. A URL with any run parameter (all but `dev`) skips the home screen and starts the walk; the setup's pack and gear replace the saved loadout for that walk without changing it, and the result is banked as usual.

| Param   | Value                           | Default         |
| ------- | ------------------------------- | --------------- |
| `seed`  | integer 0 to 4294967295         | random          |
| `pack`  | 1 to 3 dog ids, comma-separated | saved loadout   |
| `gear`  | a gear id, or `none`            | saved loadout   |
| `zone`  | 1 to 4                          | 1               |
| `money` | whole cents                     | gear's starting |
| `speed` | scroll-speed multiplier         | 1               |
| `dev`   | `1` shows the overlay           | `0`             |

- One seed feeds independent random streams: `spawns-<zone>`, `rolls`, `cards`, `pulls`, `quips` and `scenery`. Pulls draw each dog's first pull time, each pull's side and each interval's jitter from `pulls`, so the input log needs nothing for them.
- Lane moves, treats, card choices and heading home are recorded with their simulation step's time in a versioned input log that replays the run exactly. The log's setup names the pack and gear walked, so a replay does not depend on the saved loadout. RunScene writes the finished run's log to `sessionStorage` key `dog-walker-game:dev-last-log` and plays a log found under `dog-walker-game:dev-replay`.
- The overlay (backquote) shows the seed, zone, distance, speed, money, hearts and FPS; C copies a link that reproduces the run.
- The dev panel is a collapsible HTML bar under the canvas. Opened, its sheet sits below the game at the game's full size and the page scrolls to it. It has the run-setup form, overlay toggle, the far-road fade toggle (off by default), run link, replay, and save tools (reset, +$1,000, unlock all).

## Open questions

- Playtesting on phones
- Monetization and app-store needs
