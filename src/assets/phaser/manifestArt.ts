import { itemAt } from "@andornaut/game-kit/arrays";
import type { Loader, Scene, Textures } from "phaser";
import artFiles from "virtual:art-files";

import { artFileUrl } from "../artUrl";
import { filtersLinear, steppedBases } from "../atlasGroups";
import {
  asepriteSheetOf,
  ATLAS_MANIFEST_PATH,
  type AtlasFrame,
  type AtlasManifest,
  atlasPageKey,
  type AtlasTexture,
  BASE_FRAME,
  parseAtlasManifest,
} from "../atlasManifest";
import { type AssetManifest, parseManifest } from "../manifest";

// The URL of an art file by its path under /art/: in a build, its content-hashed copy, so the
// code loads its own build's art whatever the service worker or the browser has cached.
export function artUrl(path: string): string {
  return artFileUrl(import.meta.env.BASE_URL, artFiles, path);
}

export const MANIFEST_CACHE_KEY = "art-manifest";
const ATLAS_CACHE_KEY = "art-atlas-manifest";

// Call from preload. The manifests load first and queue adds their files to the same load, so
// create runs once they are in. An invalid manifest queues nothing: create reports it. A build
// also loads the atlas manifest, in parallel; the dev server has none, so art loads from its
// own files there and every edit shows on reload.
export function loadManifest(scene: Scene, queue: (manifest: AssetManifest) => void): void {
  const paths = new Map([[MANIFEST_CACHE_KEY, "manifest.json"]]);
  if (import.meta.env.PROD) {
    paths.set(ATLAS_CACHE_KEY, ATLAS_MANIFEST_PATH);
  }
  const pending = new Set([...paths.keys()].filter((key) => !scene.cache.json.exists(key)));
  const settle = (key: string) => {
    pending.delete(key);
    if (pending.size > 0) {
      return;
    }
    try {
      queue(parseManifest(scene.cache.json.get(MANIFEST_CACHE_KEY)));
    } catch {
      // Reported by create, which parses the manifest again.
    }
  };
  if (pending.size === 0) {
    settle(MANIFEST_CACHE_KEY);
    return;
  }
  scene.load.on("loaderror", (file: Loader.File) => {
    if (pending.has(file.key)) {
      settle(file.key);
    }
  });
  for (const [key, path] of paths) {
    if (pending.has(key)) {
      scene.load.once(`filecomplete-json-${key}`, () => settle(key));
      scene.load.json(key, artUrl(path));
    }
  }
}

// Parsed once per game, keyed by its JSON cache.
const parsedAtlases = new WeakMap<object, AtlasManifest>();

// The build's atlas manifest, or undefined in dev or when it failed to load or parse, which
// leaves every key to load from its own files.
function atlasManifest(scene: Scene): AtlasManifest | undefined {
  const cache = scene.cache.json;
  if (!cache.exists(ATLAS_CACHE_KEY)) {
    return undefined;
  }
  let parsed = parsedAtlases.get(cache);
  if (parsed === undefined) {
    try {
      parsed = parseAtlasManifest(cache.get(ATLAS_CACHE_KEY));
    } catch (error) {
      console.error("The atlas manifest is invalid; loading each image on its own.", error);
      cache.remove(ATLAS_CACHE_KEY);
      return undefined;
    }
    parsedAtlases.set(cache, parsed);
  }
  return parsed;
}

// Each atlas page's expected size in bytes, by its texture key, to weight it on the loading bar.
export function atlasPageBytes(scene: Scene): Map<string, number> {
  const pages = atlasManifest(scene)?.pages ?? [];
  return new Map(pages.map(({ bytes }, page) => [atlasPageKey(page), bytes]));
}

// Queues an atlas page's file, unless its texture is loaded.
function queuePage(scene: Scene, atlas: AtlasManifest, page: number): void {
  const key = atlasPageKey(page);
  if (!scene.textures.exists(key)) {
    scene.load.image(key, artUrl(itemAt(atlas.pages, page).file));
  }
}

// Each atlased texture of the build's atlas manifest, by key.
function atlasedTextures(atlas: AtlasManifest | undefined): Map<string, AtlasTexture> {
  return new Map(atlas?.textures.map((texture) => [texture.key, texture]));
}

// Queues the manifest's images and sprites that are not loaded yet, and that include accepts:
// the atlas page each is on, or else its own files. An image or sprite that fails to load
// leaves its key missing, which a scene draws as a placeholder box.
export function queueManifestArt(
  scene: Scene,
  { images, sprites }: AssetManifest,
  include: (key: string) => boolean = () => true,
): void {
  const atlas = atlasManifest(scene);
  const atlased = atlasedTextures(atlas);
  const wanted = ({ key }: { key: string }) => include(key) && !scene.textures.exists(key);
  for (const { key, png } of images.filter(wanted)) {
    const texture = atlased.get(key);
    if (atlas === undefined || texture === undefined) {
      scene.load.image(key, artUrl(png));
    } else {
      queuePage(scene, atlas, texture.page);
    }
  }
  for (const { json, key, png } of sprites.filter(wanted)) {
    const texture = atlased.get(key);
    if (atlas === undefined || texture === undefined) {
      scene.load.aseprite(key, artUrl(png), artUrl(json));
    } else {
      queuePage(scene, atlas, texture.page);
    }
  }
}

// The XML cache key an atlased font's .fnt loads under.
const fontXmlKey = (key: string): string => `${key}:fnt`;

// Queues the manifest's fonts that are not loaded yet: an atlased font's .fnt and the atlas page
// its PNG is on, which addAtlasFonts makes the font from, or else its own two files.
export function queueFonts(scene: Scene, { fonts }: AssetManifest): void {
  const atlas = atlasManifest(scene);
  const atlased = atlasedTextures(atlas);
  for (const { fnt, key, png } of fonts) {
    if (scene.cache.bitmapFont.exists(key)) {
      continue;
    }
    const texture = atlased.get(key);
    if (atlas === undefined || texture === undefined) {
      scene.load.bitmapFont(key, artUrl(png), artUrl(fnt));
    } else {
      queuePage(scene, atlas, texture.page);
      scene.load.xml(fontXmlKey(key), artUrl(fnt));
    }
  }
}

// Phaser's BitmapText.ParseFromAtlas, passed in so this module imports Phaser's types only.
type ParseFromAtlas = (
  scene: Scene,
  fontName: string,
  textureKey: string,
  frameKey: string,
  xmlKey: string,
) => boolean;

// Makes each atlased font whose .fnt and texture have loaded and that is not made yet, from the
// .fnt and the font PNG's frame on its atlas page. Its glyphs, kerning and line height are the
// .fnt's, as the font's own files give them, and draw the same pixels from the page.
export function addAtlasFonts(
  scene: Scene,
  parseFromAtlas: ParseFromAtlas,
  { fonts }: AssetManifest,
): void {
  for (const { key } of fonts) {
    const xml = fontXmlKey(key);
    if (
      !scene.cache.bitmapFont.exists(key) &&
      scene.cache.xml.exists(xml) &&
      scene.textures.exists(key)
    ) {
      parseFromAtlas(scene, key, key, BASE_FRAME, xml);
    }
  }
}

// Adds a frame to a texture whose source is an atlas page, at its rect there. A trimmed frame
// draws its rect at its offset in the whole frame, and has the whole frame's size, so origins,
// flips and crops measure the whole frame as they do untrimmed.
export function addAtlasFrame(
  texture: Textures.Texture,
  name: string,
  { h, trim, w, x, y }: AtlasFrame,
): void {
  const frame = texture.add(name, 0, x, y, w, h);
  if (trim !== undefined) {
    frame?.setTrim(trim.w, trim.h, trim.x, trim.y, w, h);
  }
}

// A texture keyed as the art manifest keys it, whose frames are rects of a loaded atlas page.
// It shares the page's source, so the page uploads to the GPU once, and code that names the
// key and its frames works as it does with the key's own files. A sprite also gets its
// Aseprite sheet in the JSON cache, where Phaser's Aseprite loader would put it.
function addAtlasTexture(scene: Scene, atlased: AtlasTexture): void {
  const { frames, key, page } = atlased;
  const texture = scene.textures.create(key, []);
  if (texture === null) {
    return;
  }
  texture.source.push(itemAt(scene.textures.get(atlasPageKey(page)).source, 0));
  if (atlased.tags !== undefined) {
    // An Aseprite sheet's base frame is its whole PNG. No code draws it, so the first frame
    // stands in.
    addAtlasFrame(texture, BASE_FRAME, itemAt(frames, 0));
    if (!scene.cache.json.exists(key)) {
      scene.cache.json.add(key, asepriteSheetOf(atlased));
    }
  }
  for (const frame of frames) {
    addAtlasFrame(texture, frame.name, frame);
  }
}

// Phaser's Textures.FilterMode.LINEAR, named here so this module imports Phaser's types only.
const LINEAR_FILTER = 0 as Textures.FilterMode.LINEAR;

// Filters each loaded texture that filtersLinear names linearly, so road art drawn between its
// depth steps shrinks smoothly rather than dropping whole rows and columns of pixels. An
// atlased key shares its page's source, which holds only such art, so the first key filters the
// page and the rest find it done; the dev server's keys each have their own. Every other
// texture keeps the nearest filtering pixelArt gives it.
export function smoothDepthArt(scene: Scene, { images, sprites }: AssetManifest): void {
  const keys = [...images, ...sprites].map(({ key }) => key);
  const stepped = steppedBases(keys);
  for (const key of keys) {
    if (!filtersLinear(stepped, key) || !scene.textures.exists(key)) {
      continue;
    }
    const texture = scene.textures.get(key);
    if (texture.source.some(({ scaleMode }) => scaleMode !== LINEAR_FILTER)) {
      texture.setFilter(LINEAR_FILTER);
    }
  }
}

// Adds a texture for each atlased key whose page has loaded and that has none yet.
export function addAtlasTextures(scene: Scene): void {
  for (const texture of atlasManifest(scene)?.textures ?? []) {
    if (!scene.textures.exists(texture.key) && scene.textures.exists(atlasPageKey(texture.page))) {
      addAtlasTexture(scene, texture);
    }
  }
}
