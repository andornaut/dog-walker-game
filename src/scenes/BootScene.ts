import { type GameObjects, type Loader, Scene, Sound } from "phaser";

import { itemAt } from "../arrays";
import { animationSpecs, type AsepriteSheet } from "../assets/asepriteAnimations";
import { type AssetManifest, assetUrl, parseManifest, type SpriteAsset } from "../assets/manifest";
import { dogFaceKey, dogSpriteKey, encounterSpriteKey, ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import type { DogId, EncounterId } from "../data/types";
import { devRunLoadout, namesRunSetup } from "../dev/devStart";
import { pageRunSetup } from "../dev/pageRunSetup";
import {
  bootProgress,
  LOADING_ART,
  LOADING_TRACK,
  loadingBarWidth,
  loadingWalkerAt,
  stepFraction,
} from "../layout/loadingScreen";
import { browserSoundFormat, startWakeLock, unlockAudioOnFirstGesture } from "../pwa";
import { addFilledRect } from "./draw";
import { onLoadProgress } from "./loadProgress";
import {
  addAtlasTextures,
  atlasPageBytes,
  loadManifest,
  MANIFEST_CACHE_KEY,
  queueManifestArt,
} from "./manifestArt";
import { PALETTE } from "./palette";
import { registerFallbackPixelFont } from "./pixelText";
import {
  currentSettings,
  openProfile,
  profileSave,
  setRunOverride,
  walkerSpriteKey,
} from "./profileStore";
import type { RunSceneData } from "./RunScene";
import { SCENE_KEYS } from "./sceneKeys";
import { ensurePlaceholder, measureSprite, playTag } from "./sprites";

const ART_URL = assetUrl(import.meta.env.BASE_URL, "art");
// Processing yields to the next frame once a batch has run this long.
const FRAME_BUDGET_MS = 8;

type Size = { color: number; height: number; width: number };
const box = (width: number, height: number, color: number): Size => ({ color, height, width });

// Every sprite the scenes draw, with the box drawn in its place if it is missing.
function placeholderSizes(): Map<string, Size> {
  const sizes = new Map<string, Size>([
    ["tip", box(16, 16, PALETTE.amber)],
    ["treat", box(16, 16, PALETTE.tan)],
    [gameData.walkers[gameData.defaultWalker].spriteKey, box(32, 48, PALETTE.blue)],
  ]);
  for (const dog of Object.keys(gameData.dogs) as DogId[]) {
    sizes.set(dogSpriteKey(gameData, dog), box(32, 32, PALETTE.slate));
    sizes.set(dogFaceKey(gameData, dog), box(32, 32, PALETTE.slate));
    sizes.set(ownerFaceKey(gameData, dog), box(32, 32, PALETTE.brown));
  }
  const tall: readonly EncounterId[] = ["biscuitNeighbour", "lemonade", "photoOp", "thief"];
  for (const encounter of Object.keys(gameData.encounters) as EncounterId[]) {
    const height = encounter === "puddle" ? 16 : tall.includes(encounter) ? 48 : 32;
    const color = gameData.encounters[encounter].kind === "lucky" ? PALETTE.green : PALETTE.mauve;
    sizes.set(encounterSpriteKey(encounter), box(32, height, color));
  }
  return sizes;
}

// Loads the art manifest and the loading screen's art, shows the loading screen while
// everything else in the manifest loads, then registers each sprite's animations and metrics
// in batches, a frame apart, so the bar and the walker keep moving. A missing or broken asset
// is logged and replaced by a placeholder box, never fatal. Then starts the home screen.
export class BootScene extends Scene {
  private bar: GameObjects.Rectangle | undefined;
  private manifest: AssetManifest = { fonts: [], images: [], sounds: [], sprites: [] };
  private walker: GameObjects.Sprite | undefined;

  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.load.on("loaderror", (file: Loader.File) => {
      console.warn(`Asset failed to load, using a placeholder: ${file.key} (${file.url})`);
    });
    loadManifest(this, (manifest) => this.queueLoadingArt(manifest));
  }

  create(): void {
    if (this.sound instanceof Sound.WebAudioSoundManager) {
      unlockAudioOnFirstGesture(window, this.sound.context);
    }
    try {
      this.manifest = parseManifest(this.cache.json.get(MANIFEST_CACHE_KEY));
    } catch (error) {
      console.error("The art manifest is invalid; drawing placeholders instead.", error);
    }
    // Opened now so the loading walker follows the saved reduced motion setting.
    const profileOpened = openProfile(this).then((load) => {
      if (load.status === "corrupt" || load.status === "unavailable") {
        console.warn(`The save is ${load.status}, so play starts fresh: ${load.reason}`);
      }
      this.setWalkerMotion(currentSettings(this).reducedMotion);
    });
    addAtlasTextures(this);
    this.showLoadingScreen();

    const { fonts, sounds } = this.manifest;
    queueManifestArt(this, this.manifest);
    for (const { fnt, key, png } of fonts) {
      this.load.bitmapFont(key, assetUrl(ART_URL, png), assetUrl(ART_URL, fnt));
    }
    // One file per sound, in the format the service worker precaches.
    const soundFormat = browserSoundFormat();
    if (soundFormat !== undefined) {
      for (const sound of sounds) {
        this.load.audio(sound.key, assetUrl(ART_URL, sound[soundFormat]));
      }
    } else if (sounds.length > 0) {
      console.warn("This browser plays neither Ogg nor AAC, so the game is silent.");
    }
    onLoadProgress(this, atlasPageBytes(this), (fraction) =>
      this.showProgress(bootProgress("network", fraction)),
    );
    this.load.once("complete", () =>
      this.processAssets(() => void profileOpened.then(() => this.startFirstScene())),
    );
    this.load.start();
  }

  // The loading screen's art, its atlas page or its own three files, ahead of everything else.
  private queueLoadingArt(manifest: AssetManifest): void {
    const loadingKeys: ReadonlySet<string> = new Set(Object.values(LOADING_ART));
    queueManifestArt(this, manifest, (key) => loadingKeys.has(key));
  }

  // Each missing piece of art is drawn plain: the track in plum and an amber bar along it.
  private showLoadingScreen(): void {
    if (this.textures.exists(LOADING_ART.screen)) {
      this.add.image(0, 0, LOADING_ART.screen).setOrigin(0);
    }
    const { height, x, y } = LOADING_TRACK;
    if (this.textures.exists(LOADING_ART.track)) {
      this.add.image(x, y, LOADING_ART.track).setOrigin(0);
    } else {
      addFilledRect(this, PALETTE.plum, LOADING_TRACK);
    }
    const walker = this.manifest.sprites.find(({ key }) => key === LOADING_ART.walker);
    if (walker !== undefined && this.textures.exists(walker.key)) {
      this.registerSprite(walker);
      const at = loadingWalkerAt(0);
      this.walker = this.add.sprite(at.x, at.y, walker.key).setOrigin(0);
      this.setWalkerMotion(currentSettings(this).reducedMotion);
    } else {
      this.bar = addFilledRect(this, PALETTE.amber, { height, width: 0, x, y });
    }
  }

  private setWalkerMotion(reduced: boolean): void {
    if (this.walker !== undefined) {
      playTag(this.walker, LOADING_ART.walker, "walk", reduced);
    }
  }

  private showProgress(progress: number): void {
    const at = loadingWalkerAt(progress);
    this.walker?.setPosition(at.x, at.y);
    this.bar?.setSize(loadingBarWidth(progress), LOADING_TRACK.height);
  }

  // Runs each step in turn, yielding to the next frame once a frame's budget is spent, then
  // calls done.
  private processAssets(done: () => void): void {
    const steps: (() => void)[] = [() => addAtlasTextures(this)];
    for (const sprite of this.manifest.sprites) {
      if (sprite.key !== LOADING_ART.walker) {
        steps.push(() => this.registerSprite(sprite));
      }
    }
    for (const [key, size] of placeholderSizes()) {
      steps.push(() => ensurePlaceholder(this, key, size));
    }
    steps.push(() => registerFallbackPixelFont(this));
    let next = 0;
    const runBatch = () => {
      const started = performance.now();
      while (next < steps.length && performance.now() - started < FRAME_BUDGET_MS) {
        itemAt(steps, next)();
        next += 1;
      }
      this.showProgress(bootProgress("processing", stepFraction(steps.length, next)));
      if (next < steps.length) {
        this.time.delayedCall(0, runBatch);
      } else {
        done();
      }
    };
    runBatch();
  }

  private registerSprite({ anchor, key }: SpriteAsset): void {
    if (!this.textures.exists(key)) {
      return;
    }
    try {
      const sheet = this.cache.json.get(key) as AsepriteSheet;
      for (const spec of animationSpecs(key, sheet)) {
        const frames = spec.frames.map(({ duration, frame }) => ({ duration, frame, key }));
        const duration = frames.reduce((sum, frame) => sum + frame.duration, 0);
        this.anims.create({ duration, frames, key: spec.key, repeat: -1 });
      }
      measureSprite(this, key, anchor);
    } catch (error) {
      console.warn(`Sprite ${key} has no usable animations.`, error);
    }
  }

  // A dev link that names a run starts it straight away; otherwise the home screen shows.
  private startFirstScene(): void {
    if (!namesRunSetup(globalThis.location.search)) {
      this.scene.start(SCENE_KEYS.start);
      return;
    }
    const { lastLoadout, owned, walker } = profileSave(this);
    const loadout = devRunLoadout(lastLoadout, itemAt(owned.dogs, 0), pageRunSetup().setup);
    setRunOverride(this, loadout);
    const data: RunSceneData = { loadout, walkerSprite: walkerSpriteKey(this, walker) };
    startWakeLock();
    this.scene.start(SCENE_KEYS.run, data);
  }
}
