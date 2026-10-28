import { describe, expect, it } from "vitest";

import { contentHash, hashedArtFileName } from "../tools/atlas/hashedArt";
import {
  cachedUrlsOf,
  cacheKeyFor,
  cacheNameFor,
  installUrls,
  precacheFetchOptions,
  staleCacheNames,
  strategyFor,
} from "./cachePolicy";
import type { PrecacheManifest } from "./precacheList";

const precached = new Set([
  "/play/",
  "/nav.css",
  "/nav.js",
  "/art/manifest.json",
  "/art/sprites/dog.png",
]);
const fetchOf = (pathname: string) => strategyFor(precached, { isNavigation: false, pathname });
const navigationTo = (pathname: string) => strategyFor(precached, { isNavigation: true, pathname });

describe("strategyFor", () => {
  it("navigates by the strategy for each page", () => {
    for (const { expected, pathname } of [
      { expected: "network-first", name: "the game page", pathname: "/play/" },
      {
        expected: "network-first",
        name: "the game page's other path",
        pathname: "/play/index.html",
      },
      { expected: "network-only", name: "the home page, left to the browser", pathname: "/" },
      { expected: "network-only", name: "another page, left to the browser", pathname: "/art/" },
    ]) {
      expect(navigationTo(pathname)).toBe(expected);
    }
  });

  it("fetches each file by its strategy", () => {
    for (const { expected, pathname } of [
      { expected: "network-first", name: "the art manifest", pathname: "/art/manifest.json" },
      {
        expected: "network-first",
        name: "the web app manifest",
        pathname: "/manifest.webmanifest",
      },
      {
        expected: "cache-first",
        name: "hashed build output, precached or not",
        pathname: "/assets/play-abc.js",
      },
      { expected: "network-first", name: "the precached site nav script", pathname: "/nav.js" },
      {
        expected: "network-first",
        name: "the precached site nav stylesheet",
        pathname: "/nav.css",
      },
      { expected: "cache-first", name: "another precached file", pathname: "/art/sprites/dog.png" },
      {
        expected: "network-only",
        name: "a file outside the precache",
        pathname: "/art/notes/index.json",
      },
      { expected: "network-only", name: "the service worker", pathname: "/sw.js" },
    ]) {
      expect(fetchOf(pathname)).toBe(expected);
    }
  });
});

describe("precacheFetchOptions", () => {
  // The HTTP cache answers for hashed build output; the server revalidates the rest.
  it("fetches each precached file with its cache mode", () => {
    for (const [pathname, cache] of [
      ["/assets/play-abc.js", "default"],
      ["/assets/play-abc.css", "default"],
      ["/play/", "no-cache"],
      ["/art/manifest.json", "no-cache"],
      ["/manifest.webmanifest", "no-cache"],
      ["/art/sprites/dog.png", "no-cache"],
      ["/icons/icon-192.png", "no-cache"],
      ["/nav.js", "no-cache"],
    ] as const) {
      expect(precacheFetchOptions(pathname)).toEqual({ cache });
    }
  });
});

describe("cacheKeyFor", () => {
  it("files each URL under its cache key", () => {
    for (const [pathname, key] of [
      ["/play/index.html", "/play/"],
      ["/play/", "/play/"],
      ["/art/sprites/dog.png", "/art/sprites/dog.png"],
    ] as const) {
      expect(cacheKeyFor(pathname)).toBe(key);
    }
  });
});

describe("the sound files", () => {
  const manifest: PrecacheManifest = {
    sounds: { m4a: ["/art/sounds/a.m4a"], ogg: ["/art/sounds/a.ogg"] },
    urls: ["/play/", "/art/sprites/dog.png"],
    version: "v1",
  };

  // The format the page named and no other; no sounds for a missing or unknown format.
  it("installs the sounds for each format", () => {
    for (const [format, sounds] of [
      ["ogg", ["/art/sounds/a.ogg"]],
      ["m4a", ["/art/sounds/a.m4a"]],
      [null, []],
      ["mp3", []],
      ["toString", []],
    ] as const) {
      expect(installUrls(manifest, format)).toEqual([...manifest.urls, ...sounds]);
    }
  });

  it("serves either format from the cache, storing one the install left out", () => {
    const cached = cachedUrlsOf(manifest);
    expect(strategyFor(cached, { isNavigation: false, pathname: "/art/sounds/a.ogg" })).toBe(
      "cache-first",
    );
    expect(strategyFor(cached, { isNavigation: false, pathname: "/art/sounds/a.m4a" })).toBe(
      "cache-first",
    );
    expect(strategyFor(cached, { isNavigation: true, pathname: "/play/" })).toBe("network-first");
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
      expect(strategyFor(new Set(), { isNavigation: false, pathname })).toBe("cache-first");
      expect(precacheFetchOptions(pathname)).toEqual({ cache: "default" });
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

describe("staleCacheNames", () => {
  it("names this game's other versions and nothing else", () => {
    const current = cacheNameFor("new");
    const names = [cacheNameFor("old"), current, "someone-else", cacheNameFor("older")];
    expect(staleCacheNames(current, names)).toEqual([cacheNameFor("old"), cacheNameFor("older")]);
  });
});
