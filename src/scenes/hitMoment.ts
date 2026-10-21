import type { GameObjects, Scene } from "phaser";

import { kebabCase } from "../assets/spriteKeys";
import type { Encounter, EncounterId } from "../data/types";
import { burstWordPlace, COMIC_WORDS } from "../layout/comicWords";
import type { Point, Rect } from "../layout/rect";
import { letterEffect, loadedComicWordWidth } from "./comicWord";
import { addDisplayText } from "./displayText";
import { PALETTE } from "./palette";
import { playEffect } from "./sprites";
import { addNineSlice, tagFrame } from "./uiKit";

// An encounter hit's moment, played over the hit stop before its card: a burst over the pack
// lettered with the obstacle's word, a flash down both edges of the field, the encounter's
// label on a plate above the pack, and the caught dogs shaking off. A lucky find's moment has
// no word, no flash and no shake. Reduced motion keeps the flash (one still frame, faded out),
// the label (set in place) and the burst (its first frame, held), and drops the word and the
// shake.
interface HitMoment {
  // The caught dogs' sprites.
  caught: readonly GameObjects.Sprite[];
  // The burst's centre.
  centre: { x: number; y: number };
  // The burst's depth; the flash and the label draw over it.
  depth: number;
  encounter: EncounterId;
  kind: Encounter["kind"];
  // The flash runs down this rect's left and right edges.
  field: Rect;
  label: string;
  // The plate's centre x.
  labelX: number;
  // How long the hit stop lasts: everything is gone before the card opens.
  seconds: number;
  still: boolean;
  // The comic word over the burst; null for none.
  word: string | null;
}

type FlashColour = "amber" | "green" | "mauve" | "orange" | "pink" | "sky" | "white";

const FLASH_COLOURS: Readonly<Partial<Record<EncounterId, FlashColour>>> = {
  otherDog: "pink",
  puddle: "sky",
  skunk: "mauve",
  squirrel: "orange",
  thief: "amber",
};
const FLASH = { frameMs: 70, frames: 4, stillFadeMs: 280, width: 16 };
// The flash drawn while a colour's own strip is missing.
const FLASH_FALLBACKS: Readonly<Record<string, string>> = {
  "ui-hit-flash-mauve": "ui-hit-flash-green",
};
const BURST = { fallback: "fx-bump", gap: 8, size: 64, tag: "play" };
const PLATE = { height: 32, key: "ui-hit-label", width: 176 } as const;
// The label's line starts this far below the plate's top; font-title's capitals start 4px
// into the line.
const LABEL = { capTop: 4, dropIn: 8, dropMs: 120, fadeMs: 150, lineTop: 3, scale: 2 };
const SHAKE = { angle: 12, delayMs: 120, swingMs: 60, swings: 4 };
// The moment ends this long before the stop, so nothing is left on screen under the card.
const END_MARGIN_MS = 100;

// The encounter's hit label, or its name for an encounter with none.
export function hitLabelOf(encounter: Encounter): string {
  return ("hitLabel" in encounter ? encounter.hitLabel : undefined) ?? encounter.name.toUpperCase();
}

// The art of a hit moment: an obstacle's burst is fx-hit-<encounter> with an edge flash in its
// colour and the normal plate; a lucky find's is fx-<encounter>, with no flash and the lucky
// plate.
interface HitLook {
  readonly burst: string;
  readonly flash: string | null;
  readonly plate: "lucky" | "normal";
}

export function hitLook(kind: Encounter["kind"], encounter: EncounterId): HitLook {
  const art = kebabCase(encounter);
  if (kind === "lucky") {
    return { burst: `fx-${art}`, flash: null, plate: "lucky" };
  }
  const colour = FLASH_COLOURS[encounter] ?? "amber";
  return { burst: `fx-hit-${art}`, flash: `ui-hit-flash-${colour}`, plate: "normal" };
}

// The look's flash, or its fallback colour's when its art is missing.
export function hitFlashKey(scene: Scene, flash: string): string {
  return scene.textures.exists(flash) ? flash : (FLASH_FALLBACKS[flash] ?? flash);
}

// The look's burst, or fx-bump when its art is missing.
export function hitBurstKey(scene: Scene, look: HitLook): string {
  return scene.textures.exists(look.burst) ? look.burst : BURST.fallback;
}

export function playHitMoment(scene: Scene, moment: HitMoment): void {
  const totalMs = Math.max(0, moment.seconds * 1000 - END_MARGIN_MS);
  const look = hitLook(moment.kind, moment.encounter);
  playBurst(scene, moment, look, totalMs);
  if (look.flash !== null) {
    playEdgeFlash(scene, moment, hitFlashKey(scene, look.flash));
  }
  showLabel(scene, moment, look.plate, totalMs);
  if (!moment.still && moment.kind === "obstacle") {
    shakeOff(scene, moment.caught);
  }
}

// A minor obstacle's hit label, on the normal plate over the bump's stop, as an encounter
// hit's label shows.
export function playMinorHitLabel(
  scene: Scene,
  moment: Pick<HitMoment, "centre" | "depth" | "label" | "labelX" | "seconds" | "still">,
): void {
  const totalMs = Math.max(0, moment.seconds * 1000 - END_MARGIN_MS);
  showLabel(scene, moment, "normal", totalMs);
}

// A moving burst carries the word on its own art, not on fx-bump standing in for it.
function playBurst(scene: Scene, moment: HitMoment, look: HitLook, totalMs: number): void {
  const key = hitBurstKey(scene, look);
  if (!moment.still) {
    const burst = playEffect(scene, key, BURST.tag, moment.centre, moment.depth);
    const place = key === look.burst ? burstWordOn(scene, moment) : undefined;
    if (burst !== undefined && place !== undefined && moment.word !== null) {
      letterEffect(burst, place, COMIC_WORDS.burst.frames, moment.word);
    }
    return;
  }
  const frame = tagFrame(scene, key, BURST.tag);
  if (frame === undefined) {
    return;
  }
  const burst = scene.add
    .image(Math.round(moment.centre.x), Math.round(moment.centre.y), key, frame)
    .setDepth(moment.depth);
  scene.time.delayedCall(totalMs, () => burst.destroy());
}

// The word's place on the encounter's burst frame; undefined with no word, no star row, or a
// word font-comic cannot draw.
function burstWordOn(scene: Scene, moment: HitMoment): Point | undefined {
  const starRow = COMIC_WORDS.burst.starRows[moment.encounter];
  const width = moment.word === null ? undefined : loadedComicWordWidth(scene, moment.word);
  return starRow === undefined || width === undefined ? undefined : burstWordPlace(width, starRow);
}

// The flash down both edges of the field, over the depth: the strip repeats every 4 rows, so
// it tiles down each edge; the right one is mirrored. Reduced motion fades its first frame.
export function playEdgeFlash(
  scene: Scene,
  moment: Pick<HitMoment, "depth" | "field" | "still">,
  key: string,
): void {
  const first = tagFrame(scene, key, "play");
  if (first === undefined) {
    return;
  }
  const { field } = moment;
  const strips = [field.x, field.x + field.width - FLASH.width].map((x, i) =>
    scene.add
      .tileSprite(x, field.y, FLASH.width, field.height, key, first)
      .setOrigin(0)
      .setFlipX(i === 1)
      .setDepth(moment.depth + 1),
  );
  const done = () => strips.forEach((strip) => strip.destroy());
  if (moment.still) {
    scene.tweens.add({ alpha: 0, duration: FLASH.stillFadeMs, onComplete: done, targets: strips });
    return;
  }
  for (let index = 1; index < FLASH.frames; index++) {
    scene.time.delayedCall(index * FLASH.frameMs, () => {
      const frame = tagFrame(scene, key, "play", index);
      if (frame !== undefined) {
        strips.forEach((strip) => strip.setFrame(frame));
      }
    });
  }
  scene.time.delayedCall(FLASH.frames * FLASH.frameMs, done);
}

// The plate sits centred on labelX, its bottom a gap above the burst.
function showLabel(
  scene: Scene,
  moment: Pick<HitMoment, "centre" | "depth" | "label" | "labelX" | "still">,
  plate: string,
  totalMs: number,
): void {
  const top = Math.round(moment.centre.y - BURST.size / 2 - BURST.gap - PLATE.height);
  const left = Math.round(moment.labelX - PLATE.width / 2);
  const label = scene.add.container(left, top).setDepth(moment.depth + 2);
  const slice = addNineSlice(
    scene,
    PLATE.key,
    { height: PLATE.height, width: PLATE.width, x: 0, y: 0 },
    plate,
  );
  if (slice !== undefined) {
    label.add(slice);
  }
  label.add(
    addDisplayText(
      scene,
      PLATE.width / 2,
      LABEL.lineTop + LABEL.capTop * LABEL.scale,
      moment.label,
      {
        color: PALETTE.white,
        font: "title",
        originX: 0.5,
        scale: LABEL.scale,
      },
    ),
  );
  if (!moment.still) {
    label.setY(top - LABEL.dropIn).setAlpha(0);
    scene.tweens.add({
      alpha: 1,
      duration: LABEL.dropMs,
      ease: "Back.easeOut",
      targets: label,
      y: top,
    });
  }
  scene.tweens.add({
    alpha: 0,
    delay: Math.max(0, totalMs - LABEL.fadeMs),
    duration: Math.min(totalMs, LABEL.fadeMs),
    onComplete: () => label.destroy(),
    targets: label,
  });
}

// Each caught dog swings side to side about its feet and comes to rest upright.
function shakeOff(scene: Scene, caught: readonly GameObjects.Sprite[]): void {
  if (caught.length === 0) {
    return;
  }
  scene.tweens.add({
    angle: { from: -SHAKE.angle, to: SHAKE.angle },
    delay: SHAKE.delayMs,
    duration: SHAKE.swingMs,
    ease: "Sine.easeInOut",
    onComplete: () => caught.forEach((dog) => dog.setAngle(0)),
    repeat: SHAKE.swings - 1,
    targets: caught,
    yoyo: true,
  });
}
