# Archie's Dog Walks

[![Test](https://github.com/andornaut/dog-walker-game/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/dog-walker-game/actions/workflows/test.yml)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

Archie's Dog Walks is a cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road counts: a plain bump costs an owner's heart, and a card obstacle turns into a choice. Built with [Phaser](https://phaser.io/) and TypeScript, and served as static files from [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

Play it at <https://dogwalker.tristamittermayer.com/play/>. The site also has the game data tables at [`/data/`](https://dogwalker.tristamittermayer.com/data/) and the art gallery at [`/art/`](https://dogwalker.tristamittermayer.com/art/).

## Docs

Each folder's README is its plan, with what's left for the first build:

- [art/](art/README.md): art rules, assets and pipeline
- [gameplay/](gameplay/README.md): the game design, tuning and playtesting
- [src/](src/README.md): stack, architecture and save data

## Developing

Requires Node 24 (`.nvmrc`). Run `npm install`, then:

| Command                                     | Does                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run art:depth-preview -- <key> [zone]` | Draw a road sprite at a sweep of distances into `out/depth-preview/<key>/` |
| `npm run art:manifest [-- --check]`         | Write `public/art/manifest.json` from the art files, or fail if it differs |
| `npm run art:unused`                        | List manifest keys no source file, game data, shared table or page names   |
| `npm run build`                             | Build to `dist/`                                                           |
| `npm run check`                             | Type check with tsc                                                        |
| `npm run check:art`                         | Run only the art tests                                                     |
| `npm run clean`                             | Remove the build and Wrangler state                                        |
| `npm run dev`                               | Dev server                                                                 |
| `npm run export:data [-- --check]`          | Write `shared/export/` from the game's modules, or fail if it differs      |
| `npm run format`                            | Rewrite files with Prettier and apply ESLint fixes                         |
| `npm run lint`                              | Prettier check, ESLint and markdownlint                                    |
| `npm run preview`                           | Build, then serve it through `wrangler dev`                                |
| `npm run simulate -- --help`                | Simulate runs ([src/README.md](src/README.md), Simulator)                  |
| `npm test`                                  | Run the unit tests                                                         |

The site's pages are in `pages/`, each at its URL's path (`pages/play/index.html` is `/play/`), and Vite bundles the TypeScript they load. `public/` is copied into the build unchanged: the art, the nav bar, the icons, and the art gallery, `public/art/index.html`. `shared/` holds the files art's tools and the game both read. [`vendor/game-kit/`](vendor/game-kit/README.md) holds the game-agnostic helpers, a copy of the game-kit repository's `kit/` that its `scripts/sync-into.sh` writes and nothing here edits, which the game imports as `@andornaut/game-kit/<path>`.

CI runs check, lint, test and build, and the AI attributions scan.

## Deploying

- [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/workers/services/view/dog-walker-game)

Pushes to `main` deploy through [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), which runs `npm run build:deploy` (the build alone) and then `npx wrangler deploy` on Node `24.21.0` (the `NODE_VERSION` build variable). The type check, lint and tests run before each push and in GitHub CI, not in the deploy build. The build watch paths exclude `**/*.md`, `art/**` and `gameplay/**`, which are not build inputs, so a push that changes only those doesn't deploy. Build settings are on the `dog-walker-game` Worker, under Settings → Build in the [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/workers/services/view/dog-walker-game).

To deploy by hand, to the account and custom domain set in `wrangler.jsonc`:

```bash
npx wrangler login
npm run deploy
```

## Licence

Everything here (code, art, sound, music and writing) is licensed [CC BY-NC-SA 4.0](./LICENSE): share and remix it with credit to andornaut and a link to this project, for non-commercial use, under the same licence. The game's names and logos are not licensed, so a remix must use its own name. The exception is `vendor/game-kit/`, the game-agnostic helpers, which is licensed [MIT](./vendor/game-kit/LICENSE).
