import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data";
import { effectIconFallback, type EffectItem, walkBarIconKey } from "../hud/effectIcons";
import type { LabelAnchor } from "../hud/feedback";
import { BUFF_POP, CHARM, sparkleAt } from "../layout/buffLayout";
import { insetRect, type Point, type Rect } from "../lib/rect";
import { addFilledRect, drawRing } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import { addPixelText } from "../ui/phaser/pixelText";
import { floatLabel } from "./packFeedback";
import { playEffect } from "./sprites";
import type { TimedGroup } from "./timedGroup";
import { fadeAway } from "./uiKit";

// A buff's charm and the value it made, as cards, the road and the walk bar draw them.

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
          colour: PALETTE.cream,
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

// The value a buff made, as floatLabel draws a label: font-title at TEXT_SCALE in forest on
// a floating chip, held until BUFF_POP's fadeAtMs, shownAtMs into its moment, then fading out,
// rising unless motion is reduced.
export function floatValue(
  scene: Scene,
  moment: { depth: number; shownAtMs: number; still: boolean },
  anchor: LabelAnchor,
  text: string,
): void {
  const { fadeAtMs, fadeMs, rise } = BUFF_POP;
  const holdMs = Math.max(0, fadeAtMs - moment.shownAtMs);
  floatLabel(scene, moment, anchor, text, PALETTE.forest, { holdMs, ms: holdMs + fadeMs, rise });
}
