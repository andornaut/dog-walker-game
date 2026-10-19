# dog-walker-game

[![Test](https://github.com/andornaut/dog-walker-game/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/dog-walker-game/actions/workflows/test.yml)

A cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road turns into a choice. Built with [Phaser](https://phaser.io/) and TypeScript, and served as static files from [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

Play it at <https://dog-walker-game.andornaut.workers.dev>. The game design, v1 plan and tech plan live in [design/](design/README.md).

## Requirements

- Node 24 (`.nvmrc`)
- A free Cloudflare account, to deploy

## Usage

```bash
npm install
npm run dev
```

## Deploying

Pushes to `main` deploy through [Cloudflare Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/), which builds and deploys independently of GitHub CI. To set it up, connect this repository to a Worker named `dog-walker-game` in the Cloudflare dashboard, with build command `npm run build` and deploy command `npx wrangler deploy`.

To deploy by hand instead:

```bash
npx wrangler login
npm run deploy
```

Deploys go to the Cloudflare account pinned by `account_id` in `wrangler.jsonc`. To serve a custom domain instead, add a `routes` entry to `wrangler.jsonc`.

## Developing

```bash
# Type check with tsc
npm run check

# Prettier check and ESLint
npm run lint

# Rewrite files with Prettier
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

Check, lint, test, and build are what CI runs, over the whole repository rather than the lines a change touched.
