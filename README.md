# dog-walker-game

[![Test](https://github.com/andornaut/dog-walker-game/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/dog-walker-game/actions/workflows/test.yml)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

A cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road turns into a choice. Built with [Phaser](https://phaser.io/) and TypeScript, and served as static files from [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

Play it at <https://dog-walker-game.andornaut.workers.dev/play/>. The site also has the game data tables at [`/data/`](https://dog-walker-game.andornaut.workers.dev/data/) and the art gallery at [`/art/`](https://dog-walker-game.andornaut.workers.dev/art/).

## Docs

Each folder's README is its plan, with what's left for the first build:

- [art/](art/README.md): art rules, assets and pipeline
- [gameplay/](gameplay/README.md): the game design, tuning and playtesting
- [src/](src/README.md): stack, architecture and save data

## Developing

Requires Node 24 (`.nvmrc`).

The site's built pages are in `pages/`, each at its URL's path (`pages/play/index.html` is `/play/`): Vite bundles the TypeScript they load. `public/` is copied into the build unchanged: the art, the nav bar, the icons, and the art gallery and mock pages under `public/art/`, which load no TypeScript. `shared/` holds the files art's tools and the game both read.

```bash
npm install

# Dev server
npm run dev

# Type check with tsc
npm run check

# Prettier check, ESLint and markdownlint
npm run lint

# Rewrite files with Prettier and apply ESLint fixes
npm run format

# Run the unit tests
npm test

# Build to dist/
npm run build

# Build, then serve it through wrangler dev
npm run preview

# Remove build and Wrangler state
npm run clean
```

Tooling for the art scripts (details in [src/README.md](src/README.md), Assets):

```bash
# Write shared/export/game-data.json and layout.json from the game's modules
npm run export:data

# Write public/art/manifest.json from the art files
npm run art:manifest

# Fail if the committed manifest differs from what the art files give
npm run art:manifest -- --check

# Draw a road sprite at a sweep of distances into out/depth-preview/<key>/
npm run art:depth-preview -- cone woof-way
```

CI runs check, lint, test and build, and the AI attributions scan.

## Deploying

Pushes to `main` deploy through [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), which runs `npm run build:deploy` (type check, tests, then the build) and then `npx wrangler deploy` on Node `24.21.0` (the `NODE_VERSION` build variable). A commit that fails the type check or a test doesn't deploy; lint runs only in GitHub CI. The build watch paths exclude `**/*.md`, `art/**` and `gameplay/**`, which are not build inputs, so a push that changes only those doesn't deploy. Build settings are on the `dog-walker-game` Worker, under Settings → Build in the Cloudflare dashboard.

To deploy by hand, to the account pinned by `account_id` in `wrangler.jsonc`:

```bash
npx wrangler login
npm run deploy
```

To serve a custom domain, add a `routes` entry to `wrangler.jsonc`.

The build writes `dist/_headers`, the security headers Cloudflare serves with each static asset, from `src/headers/securityPolicy.ts`, with the hashes of every page's inline blocks.

## License

Everything here (code, art, sound, music and writing) is licensed [CC BY-NC-SA 4.0](./LICENSE): share and remix it with credit to andornaut and a link to this project, for non-commercial use, under the same license. The game's names and logos are not licensed, so a remix must use its own name.
