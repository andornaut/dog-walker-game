import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import palette from "../../shared/palette.json";

const GAME_ENTRY = new URL("../main.ts", import.meta.url);
const GAME_PAGE = new URL("../../pages/play/index.html", import.meta.url);
const PAGE_CSS = new URL("../main.css", import.meta.url);
const WEB_MANIFEST = new URL("../../public/manifest.webmanifest", import.meta.url);

async function manifest(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(WEB_MANIFEST, "utf8"));
}

// Everything that colours the space around the game's canvas: the letterbox bands, the status
// bar, the installed app's launch screen and the canvas's own clear colour before any scene
// draws. Each takes art's plum (shared/palette.json), the top bars' colour.
const AROUND_THE_GAME: [string, () => Promise<unknown>][] = [
  [
    "the page's background",
    async () =>
      /html,\s*body\s*\{[^}]*background:\s*(#[0-9a-f]{6});/u.exec(
        await readFile(PAGE_CSS, "utf8"),
      )?.[1],
  ],
  [
    "Phaser's backgroundColor",
    async () =>
      /backgroundColor:\s*"(#[0-9a-f]{6})"/u.exec(await readFile(GAME_ENTRY, "utf8"))?.[1],
  ],
  ["the manifest's background_color", async () => (await manifest()).background_color],
  ["the manifest's theme_color", async () => (await manifest()).theme_color],
  [
    "/play/'s theme-color meta",
    async () =>
      /<meta name="theme-color" content="([^"]*)"/u.exec(await readFile(GAME_PAGE, "utf8"))?.[1],
  ],
];

describe("the space around the game", () => {
  it.each(AROUND_THE_GAME)("takes the top bars' plum in %s", async (_place, colour) => {
    expect(await colour()).toBe(`#${palette.plum.hex}`);
  });
});
