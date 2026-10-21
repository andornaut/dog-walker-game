import type { Loader, Scene, Textures } from "phaser";

import { itemAt } from "../../lib/arrays";
import {
  asepriteSheetOf,
  ATLAS_MANIFEST_PATH,
  type AtlasFrame,
  type AtlasManifest,
  atlasPageKey,
  type AtlasTexture,
  BASE_FRAME,
  parseAtlasManifest,
} from "../atlas/atlasManifest";
import { type AssetManifest, assetUrl, parseManifest } from "../manifest";

// The URL the art manifests and files load from.
export const ART_BASE_URL = assetUrl(import.meta.env.BASE_URL, "art");
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
      scene.load.json(key, assetUrl(ART_BASE_URL, path));
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

// Queues the manifest's images and sprites that are not loaded yet, and that include accepts:
// the atlas page each is on, or else its own files. An image or sprite that fails to load
// leaves its key missing, which a scene draws as a placeholder box.
export function queueManifestArt(
  scene: Scene,
  { images, sprites }: AssetManifest,
  include: (key: string) => boolean = () => true,
): void {
  const atlas = atlasManifest(scene);
  const atlased = new Map(atlas?.textures.map((texture) => [texture.key, texture]));
  const wanted = ({ key }: { key: string }) => include(key) && !scene.textures.exists(key);
  const queuePage = (page: number) => {
    const key = atlasPageKey(page);
    if (atlas !== undefined && !scene.textures.exists(key)) {
      scene.load.image(key, assetUrl(ART_BASE_URL, itemAt(atlas.pages, page).png));
    }
  };
  for (const { key, png } of images.filter(wanted)) {
    const texture = atlased.get(key);
    if (texture === undefined) {
      scene.load.image(key, assetUrl(ART_BASE_URL, png));
    } else {
      queuePage(texture.page);
    }
  }
  for (const { json, key, png } of sprites.filter(wanted)) {
    const texture = atlased.get(key);
    if (texture === undefined) {
      scene.load.aseprite(key, assetUrl(ART_BASE_URL, png), assetUrl(ART_BASE_URL, json));
    } else {
      queuePage(texture.page);
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

// Adds a texture for each atlased key whose page has loaded and that has none yet.
export function addAtlasTextures(scene: Scene): void {
  for (const texture of atlasManifest(scene)?.textures ?? []) {
    if (!scene.textures.exists(texture.key) && scene.textures.exists(atlasPageKey(texture.page))) {
      addAtlasTexture(scene, texture);
    }
  }
}
