import { type GameObjects, type Loader, Scene, Sound } from "phaser";

import { animationSpecs, type AsepriteSheet } from "../assets/asepriteAnimations";
import { loadsFirst } from "../assets/atlas/atlasLayout";
import { type AssetManifest, parseManifest, type SpriteAsset } from "../assets/manifest";
import {
  addAtlasTextures,
  artUrl,
  atlasPageBytes,
  loadManifest,
  MANIFEST_CACHE_KEY,
  queueManifestArt,
} from "../assets/phaser/manifestArt";
import {
  DOG_FRAME_SIDES,
  dogFaceKey,
  dogSpriteKey,
  encounterSpriteKey,
  ownerCardFaceKey,
  ownerFaceKey,
  ROAD_SPRITE_SIZE,
} from "../assets/spriteKeys";
import { HOME_CUES, SOUND_KEYS } from "../audio/sound";
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
import { itemAt } from "../lib/arrays";
import { browserSoundFormat, startWakeLock, unlockAudioOnFirstGesture } from "../pwa";
import { addFilledRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { registerFallbackPixelFont } from "../ui/phaser/pixelText";
import { markArtReady } from "./artReady";
import { onLoadProgress } from "./loadProgress";
import { currentSettings, openProfile, profileSave, walkerInUse } from "./profileStore";
import { nextRunStart } from "./run/runRecorder";
import { runSceneData } from "./run/runStart";
import { SCENE_KEYS } from "./sceneKeys";
import { ensurePlaceholder, measureSprite, playTag } from "./sprites";

// Processing yields to the next frame once a batch has run this long: less once the home
// screen shows, which then shares the frame.
const FRAME_BUDGET_MS = 8;
const BEHIND_FRAME_BUDGET_MS = 4;

const HOME_SOUND_KEYS: ReadonlySet<string> = new Set(HOME_CUES.map((cue) => SOUND_KEYS[cue]));
const loadsSoundFirst = (key: string): boolean => HOME_SOUND_KEYS.has(key);
const always = () => true;

type Size = { color: number; height: number; width: number };
const box = (width: number, height: number, color: number): Size => ({ color, height, width });

// Every sprite the scenes draw, with the box drawn in its place if it is missing.
function placeholderSizes(): Map<string, Size> {
  const side = ROAD_SPRITE_SIZE;
  const short = side / 2;
  const tallest = side * 1.5;
  const sizes = new Map<string, Size>([
    ["tip", box(short, short, PALETTE.amber)],
    ["treat", box(short, short, PALETTE.tan)],
    [gameData.walkers[gameData.defaultWalker].spriteKey, box(side, tallest, PALETTE.blue)],
  ]);
  for (const dog of Object.keys(gameData.dogs) as DogId[]) {
    const dogSide = DOG_FRAME_SIDES[gameData.dogs[dog].size];
    sizes.set(dogSpriteKey(gameData, dog), box(dogSide, dogSide, PALETTE.slate));
    sizes.set(dogFaceKey(gameData, dog), box(32, 32, PALETTE.slate));
    sizes.set(ownerFaceKey(gameData, dog), box(32, 32, PALETTE.brown));
    sizes.set(ownerCardFaceKey(gameData, dog), box(20, 20, PALETTE.brown));
  }
  const tall: readonly EncounterId[] = [
    "droppedCone",
    "pettingNeighbor",
    "promoTeam",
    "thief",
    "weddingShoot",
  ];
  for (const encounter of Object.keys(gameData.encounters) as EncounterId[]) {
    const height = encounter === "puddle" ? short : tall.includes(encounter) ? tallest : side;
    const color = gameData.encounters[encounter].kind === "lucky" ? PALETTE.green : PALETTE.mauve;
    sizes.set(encounterSpriteKey(encounter), box(side, height, color));
  }
  return sizes;
}

// Loads the art manifest and the loading screen's art, shows the loading screen while what the
// home screen and its menus need loads (the loadsFirst art, the fonts and the home cues'
// sounds), then registers each of those sprites' animations and metrics in batches, a frame
// apart, so the bar and the walker keep moving. A missing or broken asset is logged and
// replaced by a placeholder box, never fatal. Then shows the home screen, and keeps running
// behind it to load and register the rest the same way, then marks the art ready and stops. A
// dev link that names a run loads everything before it starts the walk.
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
      if (load.status === "corrupt" || load.status === "newer" || load.status === "unavailable") {
        console.warn(`The save is ${load.status}, so play starts fresh: ${load.reason}`);
      }
      this.setWalkerMotion(currentSettings(this).reducedMotion);
    });
    addAtlasTextures(this);
    this.showLoadingScreen();

    const walkNow = namesRunSetup(globalThis.location.search);
    const first = walkNow ? always : loadsFirst;
    queueManifestArt(this, this.manifest, first);
    for (const { fnt, key, png } of this.manifest.fonts) {
      this.load.bitmapFont(key, artUrl(png), artUrl(fnt));
    }
    if (this.manifest.sounds.length > 0 && browserSoundFormat() === undefined) {
      console.warn("This browser plays neither Ogg nor AAC, so the game is silent.");
    }
    this.queueSounds(walkNow ? always : loadsSoundFirst);
    onLoadProgress(this, atlasPageBytes(this), (fraction) =>
      this.showProgress(bootProgress("network", fraction)),
    );
    this.load.once("complete", () =>
      this.processAssets(first, FRAME_BUDGET_MS, () => {
        registerFallbackPixelFont(this);
        void profileOpened.then(() => (walkNow ? this.startWalk() : this.showHome()));
      }),
    );
    this.load.start();
  }

  // One file per sound that include accepts, in the format the service worker precaches.
  private queueSounds(include: (key: string) => boolean): void {
    const soundFormat = browserSoundFormat();
    if (soundFormat === undefined) {
      return;
    }
    for (const sound of this.manifest.sounds.filter(({ key }) => include(key))) {
      this.load.audio(sound.key, artUrl(sound[soundFormat]));
    }
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

  // Registers the loaded sprites that include accepts and draws a placeholder for each such key
  // that is missing, one step at a time, yielding to the next frame once budgetMs is spent,
  // then calls done.
  private processAssets(
    include: (key: string) => boolean,
    budgetMs: number,
    done: () => void,
  ): void {
    const steps: (() => void)[] = [() => addAtlasTextures(this)];
    for (const sprite of this.manifest.sprites) {
      if (sprite.key !== LOADING_ART.walker && include(sprite.key)) {
        steps.push(() => this.registerSprite(sprite));
      }
    }
    for (const [key, size] of placeholderSizes()) {
      if (include(key)) {
        steps.push(() => ensurePlaceholder(this, key, size));
      }
    }
    let next = 0;
    const runBatch = () => {
      const started = performance.now();
      while (next < steps.length && performance.now() - started < budgetMs) {
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

  // Shows the home screen over this scene, clears the loading screen, then loads and registers
  // the rest behind it.
  private showHome(): void {
    this.scene.launch(SCENE_KEYS.start);
    for (const child of [...this.children.list]) {
      child.destroy();
    }
    [this.bar, this.walker] = [undefined, undefined];
    const rest = (key: string) => !loadsFirst(key);
    queueManifestArt(this, this.manifest, rest);
    this.queueSounds((key) => !loadsSoundFirst(key));
    this.load.once("complete", () =>
      this.processAssets(rest, BEHIND_FRAME_BUDGET_MS, () => {
        markArtReady(this);
        this.scene.stop();
      }),
    );
    this.load.start();
  }

  // Starts the walk a dev link names, with everything loaded.
  private startWalk(): void {
    markArtReady(this);
    const { lastLoadout, owned } = profileSave(this);
    const walker = walkerInUse(profileSave(this));
    const loadout = devRunLoadout(lastLoadout, walker, itemAt(owned.dogs, 0), pageRunSetup().setup);
    const pick = { dogSlots: owned.dogSlots.length, loadout };
    startWakeLock();
    this.scene.start(SCENE_KEYS.run, runSceneData(nextRunStart(), pick));
  }
}
