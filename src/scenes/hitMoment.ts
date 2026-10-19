import type { GameObjects, Scene } from "phaser";

import { kebabCase } from "../assets/spriteKeys";
import type { Encounter, EncounterId } from "../data/types";
import type { Rect } from "../layout/rect";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { playEffect } from "./sprites";
import { tagFrame } from "./uiKit";

// An encounter hit's moment, played over the hit stop before its card: a burst over the pack,
// a flash down both edges of the field, the encounter's label on a plate above the pack, and
// the caught dogs shaking off. Reduced motion keeps the flash (one still frame, faded out),
// the label (set in place) and the burst (its first frame, held), and drops the shake.
export interface HitMoment {
  // The caught dogs' sprites.
  caught: readonly GameObjects.Sprite[];
  // The burst's centre.
  centre: { x: number; y: number };
  // The burst's depth; the flash and the label draw over it.
  depth: number;
  encounter: EncounterId;
  // The flash runs down this rect's left and right edges.
  field: Rect;
  label: string;
  // The plate's centre x.
  labelX: number;
  // How long the hit stop lasts: everything is gone before the card opens.
  seconds: number;
  still: boolean;
}

type FlashColour = "amber" | "green" | "orange" | "pink" | "sky";

const FLASH_COLOURS: Readonly<Partial<Record<EncounterId, FlashColour>>> = {
  otherDog: "pink",
  puddle: "sky",
  skunk: "green",
  squirrel: "orange",
  thief: "amber",
};
const FLASH = { frameMs: 70, frames: 4, stillFadeMs: 280, width: 16 };
const BURST = { fallback: "fx-bump", gap: 8, size: 64, tag: "play" };
const PLATE = { corner: 8, height: 32, key: "ui-hit-label", tag: "normal", width: 176 };
// The label's line starts this far below the plate's top; font-title's capitals start 4px
// into the line.
const LABEL = { capTop: 4, dropIn: 8, dropMs: 120, fadeMs: 150, lineTop: 3, scale: 2 };
const SHAKE = { angle: 12, delayMs: 120, swingMs: 60, swings: 4 };
// The moment ends this long before the stop, so nothing is left on screen under the card.
const END_MARGIN_MS = 100;

// An obstacle's own label, or its name for an encounter with none.
export function hitLabelOf(encounter: Encounter): string {
  return encounter.kind === "obstacle" ? encounter.hitLabel : encounter.name.toUpperCase();
}

export function hitFlashKey(encounter: EncounterId): string {
  return `ui-hit-flash-${FLASH_COLOURS[encounter] ?? "amber"}`;
}

export function hitBurstKey(scene: Scene, encounter: EncounterId): string {
  const key = `fx-hit-${kebabCase(encounter)}`;
  return scene.textures.exists(key) ? key : BURST.fallback;
}

export function playHitMoment(scene: Scene, moment: HitMoment): void {
  const totalMs = Math.max(0, moment.seconds * 1000 - END_MARGIN_MS);
  playBurst(scene, moment, totalMs);
  playFlash(scene, moment);
  showLabel(scene, moment, totalMs);
  if (!moment.still) {
    shakeOff(scene, moment.caught);
  }
}

function playBurst(scene: Scene, moment: HitMoment, totalMs: number): void {
  const key = hitBurstKey(scene, moment.encounter);
  if (!moment.still) {
    playEffect(scene, key, BURST.tag, moment.centre, moment.depth);
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

// The strip repeats every 4 rows, so it tiles down each edge; the right one is mirrored.
function playFlash(scene: Scene, moment: HitMoment): void {
  const key = hitFlashKey(moment.encounter);
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
function showLabel(scene: Scene, moment: HitMoment, totalMs: number): void {
  const top = Math.round(moment.centre.y - BURST.size / 2 - BURST.gap - PLATE.height);
  const left = Math.round(moment.labelX - PLATE.width / 2);
  const label = scene.add.container(left, top).setDepth(moment.depth + 2);
  const frame = tagFrame(scene, PLATE.key, PLATE.tag);
  if (frame !== undefined) {
    const { corner } = PLATE;
    label.add(
      scene.add
        .nineslice(
          0,
          0,
          PLATE.key,
          frame,
          PLATE.width,
          PLATE.height,
          corner,
          corner,
          corner,
          corner,
        )
        .setOrigin(0),
    );
  }
  label.add(
    addPixelText(scene, PLATE.width / 2, LABEL.lineTop + LABEL.capTop * LABEL.scale, moment.label, {
      color: PALETTE.white,
      font: "title",
      originX: 0.5,
      scale: LABEL.scale,
    }),
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
