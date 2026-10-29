import { readFileSync } from "node:fs";

import { webManifestIconUrls } from "@andornaut/game-kit/pwa/precacheList";
import { describe, expect, it } from "vitest";

import { HASHED_ICONS } from "./icons";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

// The icons a page links: its favicons and apple-touch-icon.
function linkedIcons(html: string): string[] {
  return Array.from(
    html.matchAll(/<link\b[^>]*\brel="(?:icon|apple-touch-icon)"[^>]*\bhref="([^"]+)"/g),
    (match) => match[1] ?? "",
  );
}

describe("HASHED_ICONS", () => {
  it.each([
    ["the web app manifest", webManifestIconUrls(JSON.parse(read("public/manifest.webmanifest")))],
    ["the home page", linkedIcons(read("pages/index.html"))],
    ["the game page", linkedIcons(read("pages/play/index.html"))],
    ["the data page", linkedIcons(read("pages/data/index.html"))],
  ])("lists every icon %s names", (_name, icons) => {
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.filter((icon) => !HASHED_ICONS.includes(icon))).toEqual([]);
  });
});
