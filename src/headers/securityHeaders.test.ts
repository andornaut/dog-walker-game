import { describe, expect, it } from "vitest";

import {
  cspHash,
  headersFile,
  inlineBlocks,
  navWithoutStylesheet,
  pageRules,
  pathMatches,
  renderPolicy,
  servedPath,
} from "./securityHeaders";
import { PAGE_RULES, type PageRule } from "./securityPolicy";

describe("cspHash", () => {
  it("matches the CSP specification's example hash", async () => {
    expect(await cspHash("alert('Hello, world.');")).toBe(
      "'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='",
    );
  });

  it("hashes the UTF-8 bytes, so non-ASCII text matches the browser's hash", async () => {
    expect(await cspHash("é")).not.toBe(await cspHash("e"));
    expect(await cspHash("")).toBe("'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='");
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
  it("flags a page that loads nav.js without linking nav.css", () => {
    expect(navWithoutStylesheet(`<script src="/nav.js" defer></script>`)).toBe(true);
    expect(
      navWithoutStylesheet(`<link rel="stylesheet" href="/nav.css" />
        <script src="/nav.js" defer></script>`),
    ).toBe(false);
  });

  it("ignores a page without the nav and a script whose name only ends in nav.js", () => {
    expect(navWithoutStylesheet(`<script src="/main.js"></script>`)).toBe(false);
    expect(navWithoutStylesheet(`<script src="/sidenav.js"></script>`)).toBe(false);
  });
});

describe("servedPath", () => {
  it("serves index.html at its directory and other pages without .html", () => {
    expect(servedPath("index.html")).toBe("/");
    expect(servedPath("play/index.html")).toBe("/play/");
    expect(servedPath("art/mocks/help-screen.html")).toBe("/art/mocks/help-screen");
  });
});

describe("pathMatches", () => {
  it("matches a pattern without a splat exactly", () => {
    expect(pathMatches("/", "/")).toBe(true);
    expect(pathMatches("/", "/play/")).toBe(false);
  });

  it("lets a splat match any run of characters, including none", () => {
    expect(pathMatches("/play/*", "/play/")).toBe(true);
    expect(pathMatches("/art/*", "/art/mocks/start-screen")).toBe(true);
    expect(pathMatches("/art/*", "/artwork")).toBe(false);
  });

  it("treats regular expression characters in a pattern literally", () => {
    expect(pathMatches("/a.b", "/a.b")).toBe(true);
    expect(pathMatches("/a.b", "/axb")).toBe(false);
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
      [...files, "art/mocks/start-screen.html"].map((file) => [
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
