import { describe, expect, it } from "vitest";

import { isHashedAssetUrl } from "../pwa/cachePolicy";
import { hashedArtFileName } from "../tools/atlas/hashedArt";
import {
  cspHash,
  headersFile,
  inlineBlocks,
  navWithoutStylesheet,
  pageRules,
  pathMatches,
  renderPolicy,
  servedPath,
  unhashedAssets,
} from "./securityHeaders";
import { FILE_RULES, PAGE_RULES, type PageRule } from "./securityPolicy";

describe("cspHash", () => {
  it("hashes the CSP specification's example, as a browser does", async () => {
    expect(await cspHash("alert('Hello, world.');")).toBe(
      "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='",
    );
  });
});

describe("inlineBlocks", () => {
  it("returns each inline script and style's exact text and skips scripts with a src", () => {
    const html = `<style>a{}</style>
      <script src="/nav.js" defer></script>
      <script type="module" crossorigin src="/assets/play.js"></script>
      <script>
  run();
</script>
      <STYLE media="screen">\n b {}\n</STYLE>`;
    expect(inlineBlocks(html)).toEqual({
      scripts: ["\n  run();\n"],
      styles: ["a{}", "\n b {}\n"],
    });
    expect(inlineBlocks(`<script data-src="x">go()</script>`).scripts).toEqual(["go()"]);
  });
});

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

describe("servedPath", () => {
  // index.html at its directory, other pages without .html.
  it("serves index.html at its directory and other pages without .html", () => {
    const files = ["index.html", "play/index.html", "art/notes/example.html"];
    expect(files.map(servedPath)).toEqual(["/", "/play/", "/art/notes/example"]);
  });
});

describe("pathMatches", () => {
  // Without a splat a pattern matches exactly; a splat matches any run, including none;
  // regular expression characters are literal.
  const cases: [string, string, boolean][] = [
    ["/", "/", true],
    ["/", "/play/", false],
    ["/play/*", "/play/", true],
    ["/art/*", "/art/notes/example", true],
    ["/art/*", "/artwork", false],
    ["/a.b", "/a.b", true],
    ["/a.b", "/axb", false],
  ];

  it("matches exactly without a splat, any run with one, and regex characters literally", () => {
    const wrong = cases.filter(
      ([pattern, path, expected]) => pathMatches(pattern, path) !== expected,
    );
    expect(wrong).toEqual([]);
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
      expect("Cache-Control" in headersAt(path), path).toBe(isHashedAssetUrl(path));
    }
  });
});

describe("unhashedAssets", () => {
  it("lists the files under assets/ whose names carry no 8-character hash", () => {
    expect(
      unhashedAssets([
        "assets/play-Bq3x_9-Z.js",
        "assets/main-0aZ9bQ1c.css",
        "assets/logo.png",
        "assets/chunk-abc.js",
        "sw.js",
        "art/atlas/run-0.png",
        "play/index.html",
      ]),
    ).toEqual(["assets/logo.png", "assets/chunk-abc.js"]);
  });
});

describe("renderPolicy", () => {
  it("merges layers into directives in the fixed order, each source once, leaving out empty ones", () => {
    const policy = renderPolicy(
      { "default-src": ["'self'"], "style-src": ["'self'"] },
      { "frame-ancestors": ["'none'"], "style-src": ["https://fonts.example", "'self'"] },
    );
    expect(policy).toBe(
      "default-src 'self'; style-src 'self' https://fonts.example; frame-ancestors 'none'",
    );
    expect(renderPolicy({ "script-src": [] }, { "object-src": ["'none'"] })).toBe(
      "object-src 'none'",
    );
  });
});

describe("pageRules", () => {
  const base = { "script-src": ["'self'"], "style-src": ["'self'"] };
  const rules: PageRule[] = [
    { comment: "Home.", directives: { "font-src": ["https://fonts.example"] }, path: "/" },
    { comment: "Art.", directives: {}, path: "/art/*" },
    { comment: "Data.", directives: {}, path: "/data/*" },
  ];
  const policyOf = (emitted: ReturnType<typeof pageRules>, path: string) =>
    emitted.find((rule) => rule.path === path)?.headers[0]?.[1];

  it("gives each rule the hashes of its own pages only, sorted and once each", () => {
    const emitted = pageRules(
      base,
      rules,
      new Map([
        ["/", { scriptHashes: ["'sha256-h'"], styleHashes: ["'sha256-s'"] }],
        ["/art/", { scriptHashes: ["'sha256-b'"], styleHashes: ["'sha256-n'"] }],
        ["/art/notes/x", { scriptHashes: ["'sha256-a'"], styleHashes: ["'sha256-n'"] }],
      ]),
    );
    expect(emitted.map((rule) => [rule.comment, rule.path])).toEqual([
      ["Home.", "/"],
      ["Art.", "/art/*"],
      ["Data.", "/data/*"],
    ]);
    expect(policyOf(emitted, "/")).toBe(
      "script-src 'self' 'sha256-h'; style-src 'self' 'sha256-s'; font-src https://fonts.example",
    );
    expect(policyOf(emitted, "/art/*")).toBe(
      "script-src 'self' 'sha256-a' 'sha256-b'; style-src 'self' 'sha256-n'",
    );
    expect(policyOf(emitted, "/data/*")).toBe("script-src 'self'; style-src 'self'");
  });

  // A page with no policy cannot ship, and the browser would enforce both of two.
  it("throws for a page that no rule or two rules cover", () => {
    const pages = new Map([["/new/", { scriptHashes: [], styleHashes: [] }]]);
    expect(() => pageRules(base, rules, pages)).toThrow("/new/ must match exactly one page rule");
    const overlapping = [...rules, { comment: "All.", directives: {}, path: "/*" }];
    const data = new Map([["/data/", { scriptHashes: [], styleHashes: [] }]]);
    expect(() => pageRules(base, overlapping, data)).toThrow("matches /data/*, /*");
  });

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

describe("headersFile", () => {
  it("writes the heading, then each rule's comment, path and indented headers", () => {
    const text = headersFile("Generated.", [
      { comment: "All.", headers: [["A", "1"]], path: "/*" },
      {
        comment: "Home.",
        headers: [
          ["B", "2"],
          ["C", "3"],
        ],
        path: "/",
      },
    ]);
    expect(text).toBe("# Generated.\n\n# All.\n/*\n  A: 1\n\n# Home.\n/\n  B: 2\n  C: 3\n");
  });
});
