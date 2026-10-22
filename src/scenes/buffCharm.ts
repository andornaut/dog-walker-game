import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data";
import type { Struck } from "../hud/buffMarks";
import { effectIconFallback, type EffectItem, walkBarIconKey } from "../hud/effectIcons";
import type { LabelAnchor } from "../hud/feedback";
import { BUFF_POP, CHARM, sparkleAt, strikeGeometry } from "../layout/buffLayout";
import { insetRect, type Point, type Rect } from "../lib/rect";
import { addFilledRect, drawRing, fillRect } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addPixelText, type FontRole, inkSpan, pixelFontMetrics } from "../ui/phaser/pixelText";
import { CHIP_PAD, floatChip, TITLE_SCALE } from "./packFeedback";
import { playEffect } from "./sprites";
import type { TimedGroup } from "./timedGroup";
import { fadeAway } from "./uiKit";

// A buff's charm and the value it struck, as cards, the road and the walk bar draw them.

const SPARKLE = { key: "fx-sparkle", tag: "play" } as const;
const WELL_KEY = "ui-effect-well";

// The charm at at, drawn at scale: ui-effect-well (an ink square while it is missing) holding
// the buff's 20x20 icon (its name's first letter while that is missing), lit with a 1px amber
// ring around it.
export function addCharm(
  scene: Scene,
  item: EffectItem,
  at: Point,
  style: { lit: boolean; scale?: number },
): GameObjects.Container {
  const { icon, ring, size } = CHARM;
  const iconKey = walkBarIconKey(item);
  const parts: GameObjects.GameObject[] = [
    scene.textures.exists(WELL_KEY)
      ? scene.add.image(0, 0, WELL_KEY).setOrigin(0)
      : addFilledRect(scene, PALETTE.ink, { height: size, width: size, x: 0, y: 0 }),
    scene.textures.exists(iconKey)
      ? scene.add.image(icon, icon, iconKey).setOrigin(0)
      : addPixelText(scene, size / 2, size / 2 - 2, effectIconFallback(gameData, item), {
          color: PALETTE.cream,
          originX: 0.5,
        }),
  ];
  if (style.lit) {
    const g = scene.add.graphics();
    drawRing(g, PALETTE.amber, insetRect(-ring, { height: size, width: size, x: 0, y: 0 }), ring);
    parts.push(g);
  }
  return scene.add.container(at.x, at.y, parts).setScale(style.scale ?? 1);
}

// fx-sparkle over a charm or a well whose top-left is at, drawn at scale.
function sparkleCharm(
  scene: Scene,
  at: Point,
  depth: number,
  scale = 1,
): GameObjects.Sprite | undefined {
  return playEffect(scene, SPARKLE.key, SPARKLE.tag, sparkleAt(at, scale), depth);
}

// A buff's pop, shownAtMs into its moment: its charm appears lit at rect's top-left with
// fx-sparkle at its top-right, then at the moment's fadeAtMs fades out, rising unless motion is
// reduced.
export function popCharm(
  scene: Scene,
  moment: { depth: number; shownAtMs: number; still: boolean },
  item: EffectItem,
  rect: Point,
): void {
  const charm = addCharm(scene, item, rect, { lit: true }).setDepth(moment.depth);
  sparkleCharm(scene, rect, moment.depth + 1);
  const { fadeAtMs, fadeMs, rise } = BUFF_POP;
  fadeAway(scene, [charm], {
    delayMs: Math.max(0, fadeAtMs - moment.shownAtMs),
    ms: fadeMs,
    rise: moment.still ? 0 : rise,
  });
}

// The walk bar's well glinting with a pop: its amber ring blinks twice, and fx-sparkle plays at
// its top-right, held with group.
export function glintWell(scene: Scene, group: TimedGroup, well: Rect, depth: number): void {
  const g = scene.add.graphics().setDepth(depth);
  drawRing(g, PALETTE.amber, insetRect(-CHARM.ring, well), CHARM.ring);
  const { blinkMs, blinks } = BUFF_POP;
  group.every(scene, blinkMs, 2 * blinks - 2, () => g.setVisible(!g.visible));
  group.after(scene, blinkMs * (2 * blinks - 1), () => g.destroy());
  const sparkle = sparkleCharm(scene, well, depth + 1);
  if (sparkle !== undefined) {
    group.animate(sparkle);
  }
}

// A struck value from at, the top-left of its capitals: the old value in plum under a 1px red
// line across its capitals' middle, then the new value in forest after it (or color). Returns
// the parts and the ink's left and right edges.
export function addStruck(
  scene: Scene,
  struck: Struck,
  at: Point,
  style: { after?: number; font: FontRole; scale: number },
): { left: number; parts: GameObjects.GameObject[]; right: number } {
  const { font, scale } = style;
  const parts: GameObjects.GameObject[] = [];
  let x = at.x;
  let left: number | undefined;
  if (struck.before !== null) {
    const old = addPixelText(scene, x, at.y, struck.before, { color: PALETTE.plum, font, scale });
    const ink = inkSpan(old);
    const span = { capTop: at.y, left: old.x + ink.left, right: old.x + ink.right };
    const { afterX, line } = strikeGeometry(pixelFontMetrics(scene, font), scale, span);
    const g = scene.add.graphics();
    fillRect(g, PALETTE.red, line);
    parts.push(old, g);
    left = span.left;
    x = afterX;
  }
  const next = addPixelText(scene, x, at.y, struck.after, {
    color: style.after ?? PALETTE.forest,
    font,
    scale,
  });
  const ink = inkSpan(next);
  next.setX(next.x + (x - (next.x + ink.left)));
  parts.push(next);
  return { left: left ?? x, parts, right: next.x + ink.right };
}

// How wide a struck value inks, measured off screen.
export function struckWidth(
  scene: Scene,
  struck: Struck,
  style: { font: FontRole; scale: number },
): number {
  const probe = addStruck(scene, struck, { x: 0, y: 0 }, style);
  probe.parts.forEach((part) => part.destroy());
  return probe.right - probe.left;
}

// A struck value on a floating chip, fading out from fadeAtMs and rising unless motion is
// reduced.
export function floatStruck(
  scene: Scene,
  moment: { depth: number; shownAtMs: number; still: boolean },
  anchor: LabelAnchor,
  struck: Struck,
): void {
  const at = { x: CHIP_PAD, y: CHIP_PAD };
  const drawn = addStruck(scene, struck, at, { font: "title", scale: TITLE_SCALE });
  drawn.parts.forEach((part) => {
    const shown = part as GameObjects.GameObject & { x: number };
    shown.x -= drawn.left - CHIP_PAD;
  });
  const width = drawn.right - drawn.left + 2 * CHIP_PAD;
  const { fadeAtMs, fadeMs, rise } = BUFF_POP;
  floatChip(
    scene,
    moment.depth,
    anchor,
    { above: 0, parts: drawn.parts, width },
    {
      delayMs: Math.max(0, fadeAtMs - moment.shownAtMs),
      ms: fadeMs,
      rise: moment.still ? 0 : rise,
    },
  );
}
