import type { GameObjects, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_LAYOUT } from "../data/screen";
import type { AchievementId, DogId } from "../data/types";
import {
  BADGE_STRIP,
  BADGE_TEXT_COLOURS,
  badgeNameTops,
  type BadgeRowNames,
  badgeRowNames,
  type BadgeView,
  celebrationTitle,
  earnedBadges,
  panelBadgeStrip,
} from "../home/badgesView";
import { MENU_TEXT_FIELDS } from "../home/menuText";
import { DETAIL_TEXT_WIDTH, detailLineY, detailPanel, STATS_LAYOUT } from "../home/statsLayout";
import { fillLine } from "../lib/lines";
import type { Rect } from "../lib/rect";
import { closeControl } from "../ui/closeControl";
import { addDim } from "../ui/phaser/draw";
import { PALETTE } from "../ui/phaser/palette";
import {
  addPixelText,
  labelInkWidth,
  pixelFontMetrics,
  type PixelTextStyle,
  withProbe,
  wrapPixelText,
} from "../ui/phaser/pixelText";
import { TEXT_SCALE } from "../ui/textFit";
import { playTag, playTagOnce } from "./sprites";
import { addBodyText, addCloseButton, addPanel, BODY_TEXT, tagFrame } from "./uiKit";

export const BADGE_SIZE = BADGE_STRIP.badgeSize;
const BURST_TAG = "play";
const POP = { delayMs: 140, durationMs: 320 } as const;

type Placed = GameObjects.Graphics | GameObjects.Image;

// A badge's earned or locked frame centred on a point, or a box in its state's colour while the
// art is missing.
export function addBadge(
  scene: Scene,
  art: string,
  earned: boolean,
  centreX: number,
  centreY: number,
): Placed {
  const frame = tagFrame(scene, art, earned ? "earned" : "locked");
  if (frame !== undefined) {
    return scene.add.image(Math.round(centreX), Math.round(centreY), art, frame);
  }
  const half = BADGE_SIZE / 2;
  return scene.add
    .graphics({ x: Math.round(centreX), y: Math.round(centreY) })
    .fillStyle(earned ? PALETTE.amber : PALETTE.grey)
    .fillRect(-half, -half, BADGE_SIZE, BADGE_SIZE);
}

// A one-shot effect's play tag centred on a point: it plays once and is removed, or with
// reduced motion holds one still frame.
interface Burst {
  readonly key: string;
  readonly stillFrame: number;
}

const CONFETTI: Burst = { key: "fx-confetti", stillFrame: 4 };
export const NEW_BEST_BURST: Burst = { key: "fx-new-best", stillFrame: 3 };

export function addBurst(
  scene: Scene,
  reduced: boolean,
  burst: Burst,
  scale: number,
  centreX: number,
  centreY: number,
): GameObjects.Sprite | undefined {
  if (!scene.textures.exists(burst.key)) {
    return undefined;
  }
  const sprite = scene.add
    .sprite(Math.round(centreX), Math.round(centreY), burst.key)
    .setScale(scale);
  if (reduced) {
    const frame = tagFrame(scene, burst.key, BURST_TAG, burst.stillFrame);
    if (frame !== undefined) {
      sprite.setFrame(frame);
    }
    return sprite;
  }
  playTagOnce(sprite, burst.key, BURST_TAG, () => sprite.destroy());
  return sprite;
}

// fx-confetti behind a badge drawn at scale.
export function addConfetti(
  scene: Scene,
  reduced: boolean,
  scale: number,
  centreX: number,
  centreY: number,
): GameObjects.Sprite | undefined {
  return addBurst(scene, reduced, CONFETTI, scale, centreX, centreY);
}

// Badges just earned, side by side in a panel with confetti behind each: they pop in one after
// another, or with reduced motion are simply there over a still frame of confetti. Every name
// under its badge is set in one style for the row (badgeRowNames), centred on its slot.
// Returns the badges in their slots' order.
export function addBadgeCelebration(
  scene: Scene,
  reduced: boolean,
  rect: Rect,
  ids: readonly AchievementId[],
): BadgeView[] {
  addPanel(scene, rect);
  const centre = rect.x + rect.width / 2;
  addPixelText(scene, centre, rect.y + BADGE_STRIP.titleY, celebrationTitle(gameData, ids.length), {
    colour: PALETTE.plum,
    font: "title",
    originX: 0.5,
    scale: TEXT_SCALE,
  });
  const badges = earnedBadges(gameData, ids);
  const strip = panelBadgeStrip(rect, badges.length);
  const badgeY = rect.y + BADGE_STRIP.badgeTop + BADGE_SIZE / 2;
  const style = { colour: PALETTE.plum, originX: 0.5, scale: TEXT_SCALE };
  const slotWidth = strip.slots[0]?.width ?? 0;
  const named = badges.map(({ name }) => name);
  const names = strip.named ? rowNames(scene, style, slotWidth, named) : undefined;
  badges.forEach((badge, i) => {
    const slot = strip.slots[i];
    if (slot === undefined) {
      return;
    }
    const delay = i * POP.delayMs;
    const burst = () => addConfetti(scene, reduced, 1, slot.centreX, badgeY);
    const image = addBadge(scene, badge.art, true, slot.centreX, badgeY);
    if (names !== undefined) {
      const { scale } = names.style;
      const lines = names.lines[i] ?? [];
      const tops = badgeNameTops(lines.length, rect.y);
      lines.forEach((line, n) => {
        addPixelText(scene, slot.centreX, tops[n] ?? 0, line, { ...style, scale }).setDepth(1);
      });
    }
    if (reduced) {
      burst();
      image.setDepth(1);
      return;
    }
    image.setScale(0).setDepth(1);
    scene.time.delayedCall(delay, burst);
    scene.tweens.add({
      delay,
      duration: POP.durationMs,
      ease: "Back.easeOut",
      scale: 1,
      targets: image,
    });
  });
  return badges;
}

const DETAIL: Rect = STATS_LAYOUT.detail;
const DETAIL_TEXT = STATS_LAYOUT.detailText;
// The badge and its confetti are drawn at 2x, so the burst shows around the bigger badge.
const DETAIL_BADGE_SCALE = 2;

// A badge's card, the one every screen opens on a badge, in parent over a dimmed screen: the
// badge at 2x with its name, status, goal and line, and the close control in its corner. An
// earned badge bursts with confetti when burst is set, or with reduced motion shows a still
// frame of it. Returns the card's rect.
export function addBadgeDetail(
  scene: Scene,
  parent: GameObjects.Container,
  reduced: boolean,
  burst: boolean,
  badge: BadgeView,
): Rect {
  const words = gameData.menuText.stats;
  const wrap = (text: string) => wrapPixelText(scene, BODY_TEXT, DETAIL_TEXT_WIDTH, text);
  const goal = wrap(badge.goal);
  const line = wrap(
    fillLine(MENU_TEXT_FIELDS.stats, words, "badgeLine", { line: badge.badgeLine }),
  );
  const body = pixelFontMetrics(scene, "body");
  const panel = detailPanel(body, goal.length, line.length);
  parent.add([addDim(scene, SCREEN_LAYOUT.screen), addPanel(scene, panel)]);
  addCloseButton(scene, parent, closeControl(panel), false);
  const centre = DETAIL.x + DETAIL.width / 2;
  const badgeY = DETAIL.y + DETAIL_TEXT.badgeY;
  if (badge.earned && (burst || reduced)) {
    const confetti = addConfetti(scene, reduced, DETAIL_BADGE_SCALE, centre, badgeY);
    if (confetti !== undefined) {
      parent.add(confetti);
    }
  }
  parent.add(addBadge(scene, badge.art, badge.earned, centre, badgeY).setScale(DETAIL_BADGE_SCALE));
  // An earned badge's card: a plum name and goal, a forest status, a dark brown line.
  const locked = BADGE_TEXT_COLOURS.locked;
  const colours = badge.earned
    ? { goal: PALETTE.plum, line: PALETTE.darkBrown, name: PALETTE.plum, status: PALETTE.forest }
    : {
        goal: PALETTE[locked.goal],
        line: PALETTE[locked.goal],
        name: PALETTE[locked.name],
        status: PALETTE[locked.goal],
      };
  const text = (y: number, value: string, style: Partial<PixelTextStyle>) =>
    addBodyText(scene, parent, { x: centre, y: DETAIL.y + y }, value, { originX: 0.5, ...style });
  text(DETAIL_TEXT.nameY, badge.name, { colour: colours.name, font: "title" });
  const status = badge.earned ? words.badgeEarned : words.badgeLocked;
  text(DETAIL_TEXT.statusY, status, { colour: colours.status });
  // The goal and line centred under the name, each line of them centred on the card.
  text(DETAIL_TEXT.goalY, goal.join("\n"), { align: "centre", colour: colours.goal });
  const lineY = detailLineY(body, goal.length);
  text(lineY, line.join("\n"), { align: "centre", colour: colours.line });
  return panel;
}

// A strip's names set as badgeRowNames gives them, measured on the font they are drawn in.
function rowNames(
  scene: Scene,
  style: PixelTextStyle,
  slotWidth: number,
  names: readonly string[],
): BadgeRowNames {
  return withProbe(scene, style, (probe) => badgeRowNames(labelInkWidth(probe), slotWidth, names));
}

// The owners cheering: their happy faces, hopping now and then unless motion is reduced.
export function addCheeringFace(
  scene: Scene,
  reduced: boolean,
  dog: DogId,
  x: number,
  y: number,
): GameObjects.Sprite {
  const key = ownerFaceKey(gameData, dog);
  const face = scene.add.sprite(x, y, key).setOrigin(0);
  playTag(face, key, "happy", reduced);
  if (!reduced) {
    scene.tweens.add({
      duration: 180,
      ease: "Sine.easeOut",
      hold: 60,
      repeat: -1,
      repeatDelay: 600,
      targets: face,
      y: y - 4,
      yoyo: true,
    });
  }
  return face;
}
