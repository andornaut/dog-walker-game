import { describe, expect, it } from "vitest";

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
  it.each([
    { expected: "network-first", name: "the game page", pathname: "/play/" },
    { expected: "network-first", name: "the game page's other path", pathname: "/play/index.html" },
    { expected: "network-only", name: "the home page, left to the browser", pathname: "/" },
    { expected: "network-only", name: "another page, left to the browser", pathname: "/art/" },
  ])("navigates to $name $expected", ({ expected, pathname }) => {
    expect(navigationTo(pathname)).toBe(expected);
  });

  it.each([
    { expected: "network-first", name: "the art manifest", pathname: "/art/manifest.json" },
    { expected: "network-first", name: "the web app manifest", pathname: "/manifest.webmanifest" },
    {
      expected: "cache-first",
      name: "hashed build output, precached or not",
      pathname: "/assets/play-abc.js",
    },
    { expected: "network-first", name: "the precached site nav script", pathname: "/nav.js" },
    { expected: "network-first", name: "the precached site nav stylesheet", pathname: "/nav.css" },
    { expected: "cache-first", name: "another precached file", pathname: "/art/sprites/dog.png" },
    {
      expected: "network-only",
      name: "a file outside the precache",
      pathname: "/art/mocks/index.json",
    },
    { expected: "network-only", name: "the service worker", pathname: "/sw.js" },
  ])("fetches $name $expected", ({ expected, pathname }) => {
    expect(fetchOf(pathname)).toBe(expected);
  });
});

describe("precacheFetchOptions", () => {
  // The HTTP cache answers for hashed build output; the server revalidates the rest.
  it.each([
    ["/assets/play-abc.js", "default"],
    ["/assets/play-abc.css", "default"],
    ["/play/", "no-cache"],
    ["/art/manifest.json", "no-cache"],
    ["/manifest.webmanifest", "no-cache"],
    ["/art/sprites/dog.png", "no-cache"],
    ["/icons/icon-192.png", "no-cache"],
    ["/nav.js", "no-cache"],
  ])("fetches %s with cache %s", (pathname, cache) => {
    expect(precacheFetchOptions(pathname)).toEqual({ cache });
  });
});

describe("cacheKeyFor", () => {
  it.each([
    ["/play/index.html", "/play/"],
    ["/play/", "/play/"],
    ["/art/sprites/dog.png", "/art/sprites/dog.png"],
  ])("files %s under %s", (pathname, key) => {
    expect(cacheKeyFor(pathname)).toBe(key);
  });
});

describe("the sound files", () => {
  const manifest: PrecacheManifest = {
    sounds: { m4a: ["/art/sounds/a.m4a"], ogg: ["/art/sounds/a.ogg"] },
    urls: ["/play/", "/art/sprites/dog.png"],
    version: "v1",
  };

  // The format the page named and no other; no sounds for a missing or unknown format.
  it.each([
    ["ogg", ["/art/sounds/a.ogg"]],
    ["m4a", ["/art/sounds/a.m4a"]],
    [null, []],
    ["mp3", []],
    ["toString", []],
  ])("installs for the format %s the sounds %j", (format, sounds) => {
    expect(installUrls(manifest, format)).toEqual([...manifest.urls, ...sounds]);
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

describe("staleCacheNames", () => {
  it("names this game's other versions and nothing else", () => {
    const current = cacheNameFor("new");
    const names = [cacheNameFor("old"), current, "someone-else", cacheNameFor("older")];
    expect(staleCacheNames(current, names)).toEqual([cacheNameFor("old"), cacheNameFor("older")]);
  });
});
