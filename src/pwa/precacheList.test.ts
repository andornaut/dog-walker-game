import { describe, expect, it } from "vitest";

import {
  artManifestUrls,
  artReferencedUrls,
  bundleDependencies,
  type BundleFile,
  precacheFingerprint,
  resolveRelativePath,
  rootRelativeUrls,
  webManifestIconUrls,
} from "./precacheList";

describe("rootRelativeUrls", () => {
  it("lists src and href values that start at the site root, once each", () => {
    const html = `
      <link rel="icon" href="/art/favicon.png" />
      <link rel="manifest" href="/manifest.webmanifest" />
      <script src="/nav.js" defer></script>
      <script type="module" crossorigin src="/assets/play-abc.js"></script>
      <link rel="stylesheet" crossorigin href="/assets/play-abc.css">
      <script src="/nav.js"></script>`;
    expect(rootRelativeUrls(html)).toEqual([
      "/art/favicon.png",
      "/manifest.webmanifest",
      "/nav.js",
      "/assets/play-abc.js",
      "/assets/play-abc.css",
    ]);
  });

  it("leaves out other origins, relative paths and the bare root", () => {
    const html = `<a href="/"></a><link href="https://fonts.example/a.css">
      <script src="//cdn.example/x.js"></script><img src="local.png">`;
    expect(rootRelativeUrls(html)).toEqual([]);
  });
});

describe("bundleDependencies", () => {
  const css = (...names: string[]) => ({
    importedAssets: new Set<string>(),
    importedCss: new Set(names),
  });
  const bundle: Record<string, BundleFile> = {
    "assets/data.js": { imports: ["assets/shared.js"], type: "chunk" },
    "assets/lazy.js": { type: "chunk" },
    "assets/play.css": { type: "asset" },
    "assets/play.js": {
      dynamicImports: ["assets/lazy.js"],
      imports: ["assets/shared.js"],
      type: "chunk",
      viteMetadata: css("assets/play.css"),
    },
    "assets/shared.js": { imports: ["assets/play.js"], type: "chunk" },
  };

  it("follows static imports, dynamic imports and imported CSS, through cycles", () => {
    expect(bundleDependencies(bundle, ["assets/play.js"])).toEqual([
      "assets/lazy.js",
      "assets/play.css",
      "assets/play.js",
      "assets/shared.js",
    ]);
  });

  it("leaves out files only another entry loads", () => {
    expect(bundleDependencies(bundle, ["assets/play.js"])).not.toContain("assets/data.js");
  });

  it("skips names that are not in the bundle", () => {
    expect(bundleDependencies(bundle, ["assets/missing.js"])).toEqual([]);
  });
});

describe("resolveRelativePath", () => {
  it("resolves against the file's directory", () => {
    expect(resolveRelativePath("/art/sprites/dog.json", "dog.png")).toBe("/art/sprites/dog.png");
  });

  it("handles . and .. segments", () => {
    expect(resolveRelativePath("/art/fonts/a.fnt", "../images/./b.png")).toBe("/art/images/b.png");
  });
});

describe("artManifestUrls", () => {
  it("lists every file of every entry under the art base URL", () => {
    const manifest = {
      fonts: [{ fnt: "fonts/body.fnt", key: "font-body", png: "fonts/body.png" }],
      images: [{ key: "card-skip", png: "images/card-skip.png" }],
      sprites: [{ json: "sprites/dog.json", key: "dog-koda", png: "sprites/dog.png" }],
    };
    expect(artManifestUrls("/art", manifest)).toEqual([
      "/art/fonts/body.png",
      "/art/fonts/body.fnt",
      "/art/images/card-skip.png",
      "/art/sprites/dog.png",
      "/art/sprites/dog.json",
    ]);
  });

  it("lists both audio files of every sound", () => {
    const manifest = {
      fonts: [],
      images: [],
      sounds: [{ key: "sfx-tip", m4a: "sounds/sfx-tip.m4a", ogg: "sounds/sfx-tip.ogg" }],
      sprites: [],
    };
    expect(artManifestUrls("/art", manifest)).toEqual([
      "/art/sounds/sfx-tip.ogg",
      "/art/sounds/sfx-tip.m4a",
    ]);
  });

  it("rejects a malformed manifest, as the game does", () => {
    expect(() => artManifestUrls("/art", { fonts: [], images: [] })).toThrow("manifest.sprites");
  });
});

describe("artReferencedUrls", () => {
  it("reads a BMFont's page images", () => {
    const fnt =
      '<font><pages><page id="0" file="body.png"/><page id="1" file="body-2.png"/></pages>';
    expect(artReferencedUrls("/art/fonts/body.fnt", fnt)).toEqual([
      "/art/fonts/body.png",
      "/art/fonts/body-2.png",
    ]);
  });

  it("reads an Aseprite sheet's meta.image", () => {
    const json = JSON.stringify({ frames: {}, meta: { image: "dog-koda.png" } });
    expect(artReferencedUrls("/art/sprites/dog-koda.json", json)).toEqual([
      "/art/sprites/dog-koda.png",
    ]);
  });

  it("finds nothing in a sheet without meta.image or in an image", () => {
    expect(artReferencedUrls("/art/sprites/x.json", "{}")).toEqual([]);
    expect(artReferencedUrls("/art/sprites/x.png", "")).toEqual([]);
  });
});

describe("webManifestIconUrls", () => {
  it("lists root-relative icon sources", () => {
    const manifest = { icons: [{ src: "/icons/a.png" }, { src: "https://x.example/b.png" }, {}] };
    expect(webManifestIconUrls(manifest)).toEqual(["/icons/a.png"]);
  });

  it("finds nothing without an icons list", () => {
    expect(webManifestIconUrls({})).toEqual([]);
    expect(webManifestIconUrls(null)).toEqual([]);
  });
});

describe("precacheFingerprint", () => {
  it("is independent of insertion order", () => {
    const first = new Map([
      ["/play/", "aa"],
      ["/nav.js", "bb"],
    ]);
    const second = new Map([
      ["/nav.js", "bb"],
      ["/play/", "aa"],
    ]);
    expect(precacheFingerprint(first)).toBe(precacheFingerprint(second));
  });

  it("changes when an unhashed file's content changes", () => {
    const before = precacheFingerprint(new Map([["/art/dog.png", "aa"]]));
    expect(precacheFingerprint(new Map([["/art/dog.png", "bb"]]))).not.toBe(before);
  });

  it("follows a hashed asset by its name alone", () => {
    const before = precacheFingerprint(new Map([["/assets/play-abc.js", "aa"]]));
    expect(precacheFingerprint(new Map([["/assets/play-abc.js", "bb"]]))).toBe(before);
    expect(precacheFingerprint(new Map([["/assets/play-def.js", "aa"]]))).not.toBe(before);
  });
});
