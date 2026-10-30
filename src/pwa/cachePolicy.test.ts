import { contentHash } from "@andornaut/game-kit/build/contentHash";
import {
  cacheNameFor,
  precacheFetchOptions,
  strategyFor,
} from "@andornaut/game-kit/pwa/cachePolicy";
import { describe, expect, it } from "vitest";

import { hashedArtFileName } from "../tools/atlas/hashedArt";
import { CACHE_POLICY } from "./cachePolicy";

// The kit tests the strategies; these test the game's policy on its own files.
const precached = new Set([
  "/controls.css",
  "/play/",
  "/nav.css",
  "/nav.js",
  "/art/manifest.json",
  "/art/sprites/dog.png",
]);
const fetchOf = (pathname: string) =>
  strategyFor(CACHE_POLICY, precached, { isNavigation: false, pathname });

describe("the game's cache policy", () => {
  it.each([
    ["the shared controls stylesheet", "/controls.css", "network-first"],
    ["the art manifest", "/art/manifest.json", "network-first"],
    ["the web app manifest", "/manifest.webmanifest", "network-first"],
    ["hashed build output, precached or not", "/assets/play-abc.js", "cache-first"],
    ["the precached site nav script", "/nav.js", "network-first"],
    ["the precached site nav stylesheet", "/nav.css", "network-first"],
    ["another precached file", "/art/sprites/dog.png", "cache-first"],
    ["a file outside the precache", "/art/notes/index.json", "network-only"],
    ["the service worker", "/sw.js", "network-only"],
  ])("fetches %s by its strategy", (_name, pathname, expected) => {
    expect(fetchOf(pathname)).toBe(expected);
  });

  it("names its caches for this game", () => {
    expect(cacheNameFor(CACHE_POLICY, "v1")).toBe("dog-walker-v1");
  });
});

describe("the game's art", () => {
  // Hashed as a build names each file: its URL changes with its content.
  const hashedUrl = (path: string) =>
    `/${hashedArtFileName(path, contentHash(new TextEncoder().encode(path)))}`;
  const hashed = [
    "manifest.json",
    "atlas-manifest.json",
    "atlas/run-0.png",
    "fonts/font-body.fnt",
    "fonts/font-body.png",
    "sounds/sfx-tip.ogg",
  ].map(hashedUrl);

  // An immutable name: a new deploy's code names new files, which no older cache holds, so
  // the worker and the precache's fetch both take any copy they have.
  it.each(hashed)(
    "serves %s cache-first, precached or not, and lets the HTTP cache answer its precache fetch",
    (pathname) => {
      expect(fetchOf(pathname)).toBe("cache-first");
      expect(strategyFor(CACHE_POLICY, new Set(), { isNavigation: false, pathname })).toBe(
        "cache-first",
      );
      expect(precacheFetchOptions(CACHE_POLICY, pathname)).toEqual({ cache: "default" });
    },
  );

  it.each([
    ["/art/manifest.json", "network-first"],
    ["/art/sprites/dog.png", "cache-first"],
    ["/art/fonts/font-body.fnt", "network-only"],
    ["/art/atlas/run-0.png", "network-only"],
  ] as const)("serves the unhashed %s as it serves any other file: %s", (pathname, strategy) => {
    expect(fetchOf(pathname)).toBe(strategy);
  });
});
