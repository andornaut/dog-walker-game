import { insetRect, type Point, type Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import { gameData } from "../data";
import type { CardCharm } from "../hud/buffMarks";
import { effectIconFallback, type EffectItem, walkBarIconKey } from "../hud/effectIcons";
import type { LabelAnchor } from "../hud/feedback";
import { BUFF_POP, cardCharmWidth, CHARM, sparkleAt } from "../layout/buffLayout";
import { PALETTE } from "../ui/palette";
import { addFilledRect, drawRing } from "../ui/phaser/draw";
import { addPixelText, inkSpan } from "../ui/phaser/pixelText";
import { floatLabel } from "./packFeedback";
import { playEffect } from "./sprites";
import type { TimedGroup } from "./timedGroup";
import { addNineSlice, fadeAway } from "./uiKit";

// A buff's charm and the value it made, as cards, the road and the walk bar draw them.

const SPARKLE = { key: "fx-sparkle", tag: "play" } as const;
const WELL_KEY = "ui-effect-well";

// The charm at at: ui-effect-well (an ink square while it is missing) holding
// the buff's 20x20 icon (its name's first letter while that is missing), lit with a 1px amber
// ring around it.
export function addCharm(
  scene: Scene,
  item: EffectItem,
  at: Point,
  style: { lit: boolean },
): GameObjects.Container {
  const { ring, size } = CHARM;
  const parts: GameObjects.GameObject[] = [
    scene.textures.exists(WELL_KEY)
      ? scene.add.image(0, 0, WELL_KEY).setOrigin(0)
      : addFilledRect(scene, PALETTE.ink, { height: size, width: size, x: 0, y: 0 }),
    addCharmIcon(scene, item),
  ];
  if (style.lit) {
    const g = scene.add.graphics();
    drawRing(g, PALETTE.amber, insetRect(-ring, { height: size, width: size, x: 0, y: 0 }), ring);
    parts.push(g);
  }
  return scene.add.container(at.x, at.y, parts);
}

// The buff's icon in the well's place at 0,0: its 20x20 icon (its name's first letter while that
// is missing).
function addCharmIcon(scene: Scene, item: EffectItem): GameObjects.GameObject {
  const { icon, size } = CHARM;
  const iconKey = walkBarIconKey(item);
  return scene.textures.exists(iconKey)
    ? scene.add.image(icon, icon, iconKey).setOrigin(0)
    : addPixelText(scene, size / 2, size / 2 - 2, effectIconFallback(gameData, item), {
        colour: PALETTE.cream,
        originX: 0.5,
      });
}

// A card option's charm, its plate's top-left at 0,0 until placed: ui-effect-well
// widened into a plate (an ink rect while it is missing) with the buff's icon at its left, the
// item's name in cream over what it did in amber, and a 1px amber ring around it. Returns the
// charm and its plate's width in plate pixels.
export function addCardCharm(
  scene: Scene,
  charm: CardCharm,
): { container: GameObjects.Container; width: number } {
  const { effectY, nameY, textX } = CHARM.card;
  const { ring, size } = CHARM;
  const x = size + textX;
  const lines = [
    addPixelText(scene, x, nameY, charm.name, { colour: PALETTE.cream }),
    ...(charm.effect === null
      ? []
      : [addPixelText(scene, x, effectY, charm.effect, { colour: PALETTE.amber, font: "title" })]),
  ];
  const ink = Math.max(...lines.map((line) => line.x - x + inkSpan(line).right));
  const width = cardCharmWidth(ink);
  const plate = { height: size, width, x: 0, y: 0 };
  const g = scene.add.graphics();
  drawRing(g, PALETTE.amber, insetRect(-ring, plate), ring);
  const parts: GameObjects.GameObject[] = [
    addNineSlice(scene, WELL_KEY, plate) ?? addFilledRect(scene, PALETTE.ink, plate),
    addCharmIcon(scene, charm.item),
    ...lines,
    g,
  ];
  return { container: scene.add.container(0, 0, parts), width };
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
