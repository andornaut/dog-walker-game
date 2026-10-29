import { pageRules, pathMatches, servedPath } from "@andornaut/game-kit/headers/securityHeaders";
import { isHashedAssetUrl } from "@andornaut/game-kit/pwa/cachePolicy";
import { describe, expect, it } from "vitest";

import { CACHE_POLICY } from "../pwa/cachePolicy";
import { hashedArtFileName } from "../tools/atlas/hashedArt";
import { FILE_RULES, navWithoutStylesheet, PAGE_RULES } from "./securityPolicy";

describe("navWithoutStylesheet", () => {
  const pages: [string, string, boolean][] = [
    ["nav.js without nav.css", `<script src="/nav.js" defer></script>`, true],
    [
      "nav.js with nav.css",
      `<link rel="stylesheet" href="/nav.css" />
        <script src="/nav.js" defer></script>`,
      false,
    ],
    ["no nav", `<script src="/main.js"></script>`, false],
    ["a script whose name only ends in nav.js", `<script src="/sidenav.js"></script>`, false],
  ];

  it("flags only a page with nav.js and no nav.css", () => {
    const wrong = pages.filter(([, html, expected]) => navWithoutStylesheet(html) !== expected);
    expect(wrong.map(([name]) => name)).toEqual([]);
  });
});

describe("FILE_RULES", () => {
  // The headers the file rules set on a path, as Cloudflare applies them.
  const headersAt = (path: string) =>
    Object.fromEntries(
      FILE_RULES.filter((rule) => pathMatches(rule.path, path)).flatMap(({ headers }) => headers),
    );
  const immutable = { "Cache-Control": "public, max-age=31536000, immutable" };
  const xml = { "Content-Type": "text/xml; charset=utf-8" };

  const hashedArt = (path: string) => `/${hashedArtFileName(path, "Bq3x_9-Z")}`;

  const expected: [string, Record<string, string>][] = [
    ["/assets/play-Bq3x_9-Z.js", immutable],
    ["/assets/main-0aZ9bQ1c.css", immutable],
    [hashedArt("atlas/run-0.png"), immutable],
    [hashedArt("fonts/font-body.fnt"), { ...immutable, ...xml }],
    [hashedArt("sounds/sfx-tip.ogg"), immutable],
    ["/art/fonts/font-body.fnt", xml],
    ["/art/fonts/font-body.png", {}],
    ["/art/manifest.json", {}],
    ["/play/", {}],
    ["/sw.js", {}],
  ];

  it("caches hashed build output for a year and serves font descriptors as XML", () => {
    for (const [path, headers] of expected) {
      expect(headersAt(path), path).toEqual(headers);
    }
  });

  // The service worker serves the same files cache-first, so the two must agree on which.
  it("caches a file for a year only if the service worker treats it as hashed", () => {
    for (const path of [
      "/assets/play-Bq3x_9-Z.js",
      hashedArt("atlas/run-0.png"),
      "/art/atlas/run-0.png",
      "/sw.js",
    ]) {
      expect("Cache-Control" in headersAt(path), path).toBe(isHashedAssetUrl(CACHE_POLICY, path));
    }
  });
});

describe("PAGE_RULES", () => {
  it("covers each of the site's pages with exactly one rule", () => {
    const files = ["index.html", "play/index.html", "data/index.html", "art/index.html"];
    const pages = new Map(
      [...files, "art/notes/example.html"].map((file) => [
        servedPath(file),
        { scriptHashes: [], styleHashes: [] },
      ]),
    );
    expect(() => pageRules({}, PAGE_RULES, pages)).not.toThrow();
  });
});
