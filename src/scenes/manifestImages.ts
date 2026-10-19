import type { Scene } from "phaser";

import { type AssetManifest, assetUrl, parseManifest } from "../assets/manifest";

const ART_BASE_URL = `${import.meta.env.BASE_URL}art`;
export const MANIFEST_CACHE_KEY = "art-manifest";

// Call from preload. The manifest loads first and queue adds its files to the same load, so
// create runs once they are in. An invalid manifest queues nothing: create reports it.
export function loadManifest(scene: Scene, queue: (manifest: AssetManifest) => void): void {
  const queueFrom = (manifestJson: unknown) => {
    try {
      queue(parseManifest(manifestJson));
    } catch {
      // Reported by create, which parses the manifest again.
    }
  };
  if (scene.cache.json.exists(MANIFEST_CACHE_KEY)) {
    queueFrom(scene.cache.json.get(MANIFEST_CACHE_KEY));
    return;
  }
  scene.load.once(
    `filecomplete-json-${MANIFEST_CACHE_KEY}`,
    (_key: string, _type: string, manifestJson: unknown) => queueFrom(manifestJson),
  );
  scene.load.json(MANIFEST_CACHE_KEY, assetUrl(ART_BASE_URL, "manifest.json"));
}

// Queues each image not loaded yet. An image that fails to load leaves its key missing,
// which a scene draws as a placeholder box.
export function queueManifestImages(scene: Scene, images: AssetManifest["images"]): void {
  for (const { key, png } of images) {
    if (!scene.textures.exists(key)) {
      scene.load.image(key, assetUrl(ART_BASE_URL, png));
    }
  }
}
