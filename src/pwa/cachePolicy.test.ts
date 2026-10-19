import { describe, expect, it } from "vitest";

import { cacheKeyFor, cacheNameFor, staleCacheNames, strategyFor } from "./cachePolicy";

const precached = new Set(["/play/", "/nav.js", "/art/manifest.json", "/art/sprites/dog.png"]);
const fetchOf = (pathname: string) => strategyFor(precached, { isNavigation: false, pathname });
const navigationTo = (pathname: string) => strategyFor(precached, { isNavigation: true, pathname });

describe("strategyFor", () => {
  it("loads the game page from the network first, under either of its paths", () => {
    expect(navigationTo("/play/")).toBe("network-first");
    expect(navigationTo("/play/index.html")).toBe("network-first");
  });

  it("leaves other pages to the browser", () => {
    expect(navigationTo("/")).toBe("network-only");
    expect(navigationTo("/art/")).toBe("network-only");
  });

  it("revalidates the art manifest and the web app manifest", () => {
    expect(fetchOf("/art/manifest.json")).toBe("network-first");
    expect(fetchOf("/manifest.webmanifest")).toBe("network-first");
  });

  it("serves hashed build output from the cache, precached or not", () => {
    expect(fetchOf("/assets/play-abc.js")).toBe("cache-first");
  });

  it("serves other precached files from the cache", () => {
    expect(fetchOf("/art/sprites/dog.png")).toBe("cache-first");
    expect(fetchOf("/nav.js")).toBe("cache-first");
  });

  it("leaves files outside the precache to the browser", () => {
    expect(fetchOf("/art/mocks/index.json")).toBe("network-only");
    expect(fetchOf("/sw.js")).toBe("network-only");
  });
});

describe("cacheKeyFor", () => {
  it("files /dir/index.html under /dir/", () => {
    expect(cacheKeyFor("/play/index.html")).toBe("/play/");
    expect(cacheKeyFor("/play/")).toBe("/play/");
    expect(cacheKeyFor("/art/sprites/dog.png")).toBe("/art/sprites/dog.png");
  });
});

describe("staleCacheNames", () => {
  it("names this game's other versions and nothing else", () => {
    const current = cacheNameFor("new");
    const names = [cacheNameFor("old"), current, "someone-else", cacheNameFor("older")];
    expect(staleCacheNames(current, names)).toEqual([cacheNameFor("old"), cacheNameFor("older")]);
  });
});
