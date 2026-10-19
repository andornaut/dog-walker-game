import type { Scene } from "phaser";

import { assetUrl, parseManifest } from "../assets/manifest";

const ART_BASE_URL = `${import.meta.env.BASE_URL}art`;
export const MANIFEST_CACHE_KEY = "art-manifest";

// Call from preload. The manifest loads first and its images join the same load, so create
// runs once they are in. An image that fails to load leaves its key missing, which a scene
// draws as a placeholder box.
export function loadManifestImages(scene: Scene): void {
  const queueImages = (manifestJson: unknown) => {
    for (const { key, png } of parseManifest(manifestJson).images) {
      if (!scene.textures.exists(key)) {
        scene.load.image(key, assetUrl(ART_BASE_URL, png));
      }
    }
  };
  if (scene.cache.json.exists(MANIFEST_CACHE_KEY)) {
    queueImages(scene.cache.json.get(MANIFEST_CACHE_KEY));
    return;
  }
  scene.load.once(
    `filecomplete-json-${MANIFEST_CACHE_KEY}`,
    (_key: string, _type: string, manifestJson: unknown) => queueImages(manifestJson),
  );
  scene.load.json(MANIFEST_CACHE_KEY, assetUrl(ART_BASE_URL, "manifest.json"));
}
