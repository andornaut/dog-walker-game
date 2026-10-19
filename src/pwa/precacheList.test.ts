import { describe, expect, it } from "vitest";

import {
  artManifestUrls,
  artReferencedUrls,
  artSoundUrls,
  atlasUrls,
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

const withSounds = {
  fonts: [],
  images: [],
  sounds: [
    { key: "music-walk", m4a: "sounds/music-walk.m4a", ogg: "sounds/music-walk.ogg" },
    { key: "sfx-tip", m4a: "sounds/sfx-tip.m4a", ogg: "sounds/sfx-tip.ogg" },
  ],
  sprites: [],
};

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

  it("leaves out the files of atlased images and sprites", () => {
    const manifest = {
      fonts: [],
      images: [
        { key: "card-skip", png: "images/card-skip.png" },
        { key: "logo", png: "images/logo.png" },
      ],
      sprites: [{ json: "sprites/dog.json", key: "dog-koda", png: "sprites/dog.png" }],
    };
    expect(artManifestUrls("/art", manifest, new Set(["card-skip", "dog-koda"]))).toEqual([
      "/art/images/logo.png",
    ]);
  });

  it("leaves out the sounds, which the worker stores in one format", () => {
    expect(artManifestUrls("/art", withSounds)).toEqual([]);
  });

  it("rejects a malformed manifest, as the game does", () => {
    expect(() => artManifestUrls("/art", { fonts: [], images: [] })).toThrow("manifest.sprites");
  });
});

describe("atlasUrls", () => {
  it("lists the atlas manifest and its pages, and the keys it covers", () => {
    const frame = { h: 8, name: "__BASE", w: 8, x: 1, y: 1 };
    const atlas = {
      pages: [
        { bytes: 10, group: "boot", height: 16, png: "atlas/boot-0.png", width: 16 },
        { bytes: 20, group: "ui", height: 16, png: "atlas/ui-0.png", width: 16 },
      ],
      textures: [
        { frames: [frame], key: "screen-loading", page: 0 },
        { frames: [frame], key: "logo", page: 1 },
      ],
    };
    expect(atlasUrls("/art", atlas)).toEqual({
      keys: new Set(["screen-loading", "logo"]),
      urls: ["/art/atlas-manifest.json", "/art/atlas/boot-0.png", "/art/atlas/ui-0.png"],
    });
  });

  it("rejects a malformed atlas manifest", () => {
    expect(() => atlasUrls("/art", { pages: [] })).toThrow("atlas manifest.textures");
  });
});

describe("artSoundUrls", () => {
  it("lists every sound's file in each format under the art base URL", () => {
    expect(artSoundUrls("/art", withSounds)).toEqual({
      m4a: ["/art/sounds/music-walk.m4a", "/art/sounds/sfx-tip.m4a"],
      ogg: ["/art/sounds/music-walk.ogg", "/art/sounds/sfx-tip.ogg"],
    });
  });

  it("lists no files for a manifest without sounds", () => {
    expect(artSoundUrls("/art", { fonts: [], images: [], sprites: [] })).toEqual({
      m4a: [],
      ogg: [],
    });
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
