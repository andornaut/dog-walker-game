# dog-walker-game

[![Test](https://github.com/andornaut/dog-walker-game/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/dog-walker-game/actions/workflows/test.yml)

A cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road turns into a choice. Built with [Phaser](https://phaser.io/) and TypeScript, and served as static files from [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

Play it at <https://dog-walker-game.andornaut.workers.dev/play/>. The site also has the game data tables at [`/data/`](https://dog-walker-game.andornaut.workers.dev/data/) and the art gallery at [`/art/`](https://dog-walker-game.andornaut.workers.dev/art/).

## Docs

Each folder's README is its plan, with what's left for the first build:

- [art/](art/README.md): art rules, assets and pipeline
- [gameplay/](gameplay/README.md): the game design, tuning and playtesting
- [src/](src/README.md): stack, architecture and save data

## Developing

Requires Node 24 (`.nvmrc`).

The site's HTML pages are in `pages/`, each at its URL's path (`pages/play/index.html` is `/play/`). `shared/` holds the files art's tools and the game both read.

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

CI runs check, lint, test and build, and the AI attributions scan.

## Deploying

Pushes to `main` deploy through [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), which runs `npm run build` and then `npx wrangler deploy` on Node `24.21.0` (the `NODE_VERSION` build variable). It runs independently of GitHub CI, so a commit that fails CI still deploys. Build settings are on the `dog-walker-game` Worker, under Settings → Build in the Cloudflare dashboard.

To deploy by hand, to the account pinned by `account_id` in `wrangler.jsonc`:

```bash
npx wrangler login
npm run deploy
```

To serve a custom domain, add a `routes` entry to `wrangler.jsonc`.

The build writes `dist/_headers`, the security headers Cloudflare serves with each static asset, from `src/headers/securityPolicy.ts`, with the hashes of every page's inline blocks.
