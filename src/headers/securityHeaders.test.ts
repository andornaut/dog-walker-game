import { describe, expect, it } from "vitest";

import { isHashedAssetUrl } from "../pwa/cachePolicy";
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
  it.each([
    [
      "the CSP specification's example",
      "alert('Hello, world.');",
      "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='",
    ],
    ["the empty string", "", "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='"],
  ])("hashes %s", async (_, text, hash) => {
    expect(await cspHash(text)).toBe(hash);
  });

  it("hashes the UTF-8 bytes, so non-ASCII text matches the browser's hash", async () => {
    expect(await cspHash("é")).not.toBe(await cspHash("e"));
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
  });

  it("does not take data-src for a src", () => {
    expect(inlineBlocks(`<script data-src="x">go()</script>`).scripts).toEqual(["go()"]);
  });
});

describe("navWithoutStylesheet", () => {
  it.each([
    ["nav.js without nav.css", `<script src="/nav.js" defer></script>`, true],
    [
      "nav.js with nav.css",
      `<link rel="stylesheet" href="/nav.css" />
        <script src="/nav.js" defer></script>`,
      false,
    ],
    ["no nav", `<script src="/main.js"></script>`, false],
    ["a script whose name only ends in nav.js", `<script src="/sidenav.js"></script>`, false],
  ])("flags a page with %s: %s", (_, html, expected) => {
    expect(navWithoutStylesheet(html)).toBe(expected);
  });
});

describe("servedPath", () => {
  // index.html at its directory, other pages without .html.
  it.each([
    ["index.html", "/"],
    ["play/index.html", "/play/"],
    ["art/mocks/example.html", "/art/mocks/example"],
  ])("serves %s at %s", (file, path) => {
    expect(servedPath(file)).toBe(path);
  });
});

describe("pathMatches", () => {
  // Without a splat a pattern matches exactly; a splat matches any run, including none;
  // regular expression characters are literal.
  it.each([
    ["/", "/", true],
    ["/", "/play/", false],
    ["/play/*", "/play/", true],
    ["/art/*", "/art/mocks/example", true],
    ["/art/*", "/artwork", false],
    ["/a.b", "/a.b", true],
    ["/a.b", "/axb", false],
  ])("%s matches %s: %s", (pattern, path, expected) => {
    expect(pathMatches(pattern, path)).toBe(expected);
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

  it.each([
    ["/assets/play-Bq3x_9-Z.js", immutable],
    ["/assets/main-0aZ9bQ1c.css", immutable],
    ["/art/fonts/font-body.fnt", xml],
    ["/art/fonts/font-body.png", {}],
    ["/art/manifest.json", {}],
    ["/play/", {}],
    ["/sw.js", {}],
  ])("gives %s %j", (path, headers) => {
    expect(headersAt(path)).toEqual(headers);
  });

  // The service worker serves the same files cache-first, so the two must agree on which.
  it.each(["/assets/play-Bq3x_9-Z.js", "/art/atlas/run-0.png", "/sw.js"])(
    "caches %s for a year only if the service worker treats it as hashed",
    (path) => {
      expect("Cache-Control" in headersAt(path)).toBe(isHashedAssetUrl(path));
    },
  );
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
  it("merges layers into directives in the fixed order, each source once", () => {
    const policy = renderPolicy(
      { "default-src": ["'self'"], "style-src": ["'self'"] },
      { "frame-ancestors": ["'none'"], "style-src": ["https://fonts.example", "'self'"] },
    );
    expect(policy).toBe(
      "default-src 'self'; style-src 'self' https://fonts.example; frame-ancestors 'none'",
    );
  });

  it("leaves out a directive with no sources", () => {
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
        ["/art/mocks/x", { scriptHashes: ["'sha256-a'"], styleHashes: ["'sha256-n'"] }],
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

  it("throws for a page that no rule covers, so it cannot ship without a policy", () => {
    const pages = new Map([["/new/", { scriptHashes: [], styleHashes: [] }]]);
    expect(() => pageRules(base, rules, pages)).toThrow("/new/ must match exactly one page rule");
  });

  it("throws for a page two rules cover, since the browser would enforce both", () => {
    const overlapping = [...rules, { comment: "All.", directives: {}, path: "/*" }];
    const pages = new Map([["/data/", { scriptHashes: [], styleHashes: [] }]]);
    expect(() => pageRules(base, overlapping, pages)).toThrow("matches /data/*, /*");
  });

  it("covers each of the site's pages with exactly one rule", () => {
    const files = ["index.html", "play/index.html", "data/index.html", "art/index.html"];
    const pages = new Map(
      [...files, "art/mocks/example.html"].map((file) => [
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
