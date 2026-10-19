import { type GameObjects, type Loader, Scene } from "phaser";

import { animationSpecs, type AsepriteSheet } from "../assets/asepriteAnimations";
import { type AssetManifest, assetUrl, parseManifest } from "../assets/manifest";
import { dogFaceKey, dogSpriteKey, encounterSpriteKey, ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId, EncounterId } from "../data/types";
import { loadManifestImages, MANIFEST_CACHE_KEY } from "./manifestImages";
import { PALETTE } from "./palette";
import { registerFallbackPixelFont } from "./pixelText";
import { SCENE_KEYS } from "./sceneKeys";
import { ensurePlaceholder, measureSprite } from "./sprites";

const ART_URL = assetUrl(import.meta.env.BASE_URL, "art");
const BAR = { color: PALETTE.amber, height: 6, track: PALETTE.plum, width: 200 };

type Size = { color: number; height: number; width: number };
const box = (width: number, height: number, color: number): Size => ({ color, height, width });

// Every sprite the scenes draw, with the box drawn in its place if it is missing.
function placeholderSizes(): Map<string, Size> {
  const sizes = new Map<string, Size>([
    ["tip", box(16, 16, PALETTE.amber)],
    ["treat", box(16, 16, PALETTE.tan)],
    ["walker", box(32, 48, PALETTE.blue)],
  ]);
  for (const dog of Object.keys(gameData.dogs) as DogId[]) {
    sizes.set(dogSpriteKey(dog), box(32, 32, PALETTE.slate));
    sizes.set(dogFaceKey(dog), box(32, 32, PALETTE.slate));
    sizes.set(ownerFaceKey(dog), box(32, 32, PALETTE.brown));
  }
  const tall: readonly EncounterId[] = ["biscuitNeighbour", "photoOp", "thief"];
  for (const encounter of Object.keys(gameData.encounters) as EncounterId[]) {
    const height = encounter === "puddle" ? 16 : tall.includes(encounter) ? 48 : 32;
    const color = gameData.encounters[encounter].kind === "lucky" ? PALETTE.green : PALETTE.mauve;
    sizes.set(encounterSpriteKey(encounter), box(32, height, color));
  }
  return sizes;
}

// Loads the art manifest and everything in it, then registers each sprite's animations.
// A missing or broken asset is logged and replaced by a placeholder box, never fatal.
export class BootScene extends Scene {
  private manifest: AssetManifest = { fonts: [], images: [], sounds: [], sprites: [] };
  private progressBar: GameObjects.Rectangle | undefined;

  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.drawProgress(0);
    this.load.on("progress", (value: number) => this.drawProgress(value));
    this.load.on("loaderror", (file: Loader.File) => {
      console.warn(`Asset failed to load, using a placeholder: ${file.key} (${file.url})`);
    });
    loadManifestImages(this);
  }

  create(): void {
    try {
      this.manifest = parseManifest(this.cache.json.get(MANIFEST_CACHE_KEY));
    } catch (error) {
      console.error("The art manifest is invalid; drawing placeholders instead.", error);
    }
    const { fonts, sprites } = this.manifest;
    for (const { json, key, png } of sprites) {
      this.load.aseprite(key, assetUrl(ART_URL, png), assetUrl(ART_URL, json));
    }
    for (const { fnt, key, png } of fonts) {
      this.load.bitmapFont(key, assetUrl(ART_URL, png), assetUrl(ART_URL, fnt));
    }
    this.load.once("complete", () => this.finish());
    this.load.start();
  }

  private finish(): void {
    for (const { key } of this.manifest.sprites) {
      if (!this.textures.exists(key)) {
        continue;
      }
      try {
        const sheet = this.cache.json.get(key) as AsepriteSheet;
        for (const spec of animationSpecs(key, sheet)) {
          const frames = spec.frames.map(({ duration, frame }) => ({ duration, frame, key }));
          const duration = frames.reduce((sum, frame) => sum + frame.duration, 0);
          this.anims.create({ duration, frames, key: spec.key, repeat: -1 });
        }
        measureSprite(this, key);
      } catch (error) {
        console.warn(`Sprite ${key} has no usable animations.`, error);
      }
    }
    for (const [key, size] of placeholderSizes()) {
      ensurePlaceholder(this, key, size);
    }
    registerFallbackPixelFont(this);
    this.scene.start(SCENE_KEYS.start);
  }

  private drawProgress(fraction: number): void {
    if (this.progressBar === undefined) {
      const x = Math.round((SCREEN_CONFIG.width - BAR.width) / 2);
      const y = Math.round((SCREEN_CONFIG.height - BAR.height) / 2);
      this.add.rectangle(x, y, BAR.width, BAR.height, BAR.track).setOrigin(0);
      this.progressBar = this.add.rectangle(x, y, 0, BAR.height, BAR.color).setOrigin(0);
    }
    this.progressBar.width = Math.round(BAR.width * fraction);
  }
}
