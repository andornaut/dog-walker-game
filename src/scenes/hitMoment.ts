import type { GameObjects, Scene } from "phaser";

import { kebabCase } from "../assets/spriteKeys";
import type { Encounter, EncounterId } from "../data/types";
import type { Rect } from "../layout/rect";
import { hitLabel } from "../rules/encounters";
import { PALETTE } from "./palette";
import { addPixelText } from "./pixelText";
import { firstTag, playEffect } from "./sprites";
import { tagFrame } from "./uiKit";

// An encounter hit's moment, played over the hit stop before its card: a burst over the pack,
// a flash down both edges of the field, the encounter's label on a plate above the pack, and
// the caught dogs shaking off. A lucky find's moment has no flash and no shake. Reduced motion
// keeps the flash (one still frame, faded out), the label (set in place) and the burst (its
// first frame, held), and drops the shake.
export interface HitMoment {
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
}

type FlashColour = "amber" | "green" | "orange" | "pink" | "sky" | "white";

const FLASH_COLOURS: Readonly<Partial<Record<EncounterId, FlashColour>>> = {
  cafe: "amber",
  goose: "white",
  otherDog: "pink",
  petunias: "pink",
  picnic: "orange",
  puddle: "sky",
  skunk: "green",
  squirrel: "orange",
  thief: "amber",
  trash: "green",
};
const FLASH = { frameMs: 70, frames: 4, stillFadeMs: 280, width: 16 };
// A moving burst plays its word tag (the sound word on the impact star) when the art has one.
const BURST = { fallback: "fx-bump", gap: 8, size: 64, tag: "play", wordTag: "play-word" };
const PLATE = { corner: 8, height: 32, key: "ui-hit-label", width: 176 };
// The label's line starts this far below the plate's top; font-title's capitals start 4px
// into the line.
const LABEL = { capTop: 4, dropIn: 8, dropMs: 120, fadeMs: 150, lineTop: 3, scale: 2 };
const SHAKE = { angle: 12, delayMs: 120, swingMs: 60, swings: 4 };
// The moment ends this long before the stop, so nothing is left on screen under the card.
const END_MARGIN_MS = 100;

// The encounter's own label, or its name for an encounter with none.
export function hitLabelOf(encounter: Encounter): string {
  return hitLabel(encounter) ?? encounter.name.toUpperCase();
}

// The art of a hit moment: an obstacle's burst is fx-hit-<encounter> with an edge flash in its
// colour and the normal plate; a lucky find's is fx-<encounter>, with no flash and the lucky
// plate.
export interface HitLook {
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

// The look's burst, or fx-bump when its art is missing.
export function hitBurstKey(scene: Scene, look: HitLook): string {
  return scene.textures.exists(look.burst) ? look.burst : BURST.fallback;
}

export function playHitMoment(scene: Scene, moment: HitMoment): void {
  const totalMs = Math.max(0, moment.seconds * 1000 - END_MARGIN_MS);
  const look = hitLook(moment.kind, moment.encounter);
  playBurst(scene, moment, hitBurstKey(scene, look), totalMs);
  if (look.flash !== null) {
    playFlash(scene, moment, look.flash);
  }
  showLabel(scene, moment, look.plate, totalMs);
  if (!moment.still && moment.kind === "obstacle") {
    shakeOff(scene, moment.caught);
  }
}

function playBurst(scene: Scene, moment: HitMoment, key: string, totalMs: number): void {
  if (!moment.still) {
    const tag = firstTag(scene, key, [BURST.wordTag, BURST.tag]) ?? BURST.tag;
    playEffect(scene, key, tag, moment.centre, moment.depth);
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
function playFlash(scene: Scene, moment: HitMoment, key: string): void {
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
function showLabel(scene: Scene, moment: HitMoment, plate: string, totalMs: number): void {
  const top = Math.round(moment.centre.y - BURST.size / 2 - BURST.gap - PLATE.height);
  const left = Math.round(moment.labelX - PLATE.width / 2);
  const label = scene.add.container(left, top).setDepth(moment.depth + 2);
  const frame = tagFrame(scene, PLATE.key, plate);
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
