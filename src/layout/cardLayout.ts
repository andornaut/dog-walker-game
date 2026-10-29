import type { Rect } from "@andornaut/game-kit/rect";
import {
  type FontMetrics,
  inkRowsFromCapTop,
  inkRowsOfLines,
} from "@andornaut/game-kit/text/bitmapFont";
import { type TextFitStyle } from "@andornaut/game-kit/text/textFit";

import { CARD_HEADER, cardRowRects, type CardRowSpec } from "../ui/cardRow";
import { PILL_IMAGE_GAP, pillRiseOverCaps } from "../ui/namePills";
import { TEXT_SCALE } from "../ui/textFit";
import { CARD_CHARMS_HEIGHT } from "./buffLayout";

// The choice cards: the card-frame sprite's parts in card pixels, the row of cards centred
// on the road, and the enlarged card a hold opens, card-frame-large, centred in the dimmed band
// and road. A band's label is body text at 1x, at most room wide. The frame outlines the
// illustration's window art.outline rows deep, which counts as the image. A card's effect, at 2x,
// starts under the art and ends effect.plaqueGap rows over the plaque, or over the ui-fires
// marker's top ink (fires.inkTop rows into it) on an option that would fire an owner, which
// says so at the foot of the effect, its lowest ink at the effect's bottom, the effect ending
// warningGap over it; the marker, fires.size square at its scale, sits over the plaque's left
// rivet at fires. A path card's difficulty paws, paws.height tall, sit at paws.y, the effect
// under them. Every pill keeps pillGap rows clear of the lowest ink of the image over it: the
// art's outline, or the paws. A plaque's text keeps plaquePadX inside the plaque or its part
// right of the marker.
export const CARD_LAYOUT = {
  art: { height: 56, outline: 1, width: 75, x: 18, y: 16 },
  badge: { height: 13, width: 71, x: 20, y: 136 },
  band: { height: 11, room: 106, y: 2 },
  effect: { plaqueGap: 1, width: 100, x: 6 },
  fires: { inkTop: 1, size: 16, x: 18, y: 134 },
  // A fork card's Head home button, centred under the paths, gap rows below their charms.
  forkHome: { gap: 6, height: 44, width: 160 },
  height: 153,
  // The enlarged card's body, the frame's rows that grow with it: a firing warning in the title
  // font at 1x, warningGap over the changes, which take the rest of the body and bodyGap rows
  // under their lowest ink; with no warning, the changes start under the art as a card's effect
  // does.
  large: {
    art: { outline: 2, x: 8, y: 32 },
    badge: { height: 26, width: 142, x: 12, y: 242 },
    band: { height: 18, room: 154, y: 4 },
    body: { height: 82, width: 142, x: 12, y: 152 },
    bodyGap: 4,
    fires: { x: 8, y: 238 },
    height: 280,
    warningGap: 4,
    width: 166,
  },
  paws: { height: 10, y: 76 },
  pillGap: PILL_IMAGE_GAP,
  plaquePadX: 2,
  row: { gap: 6 },
  warningGap: 2,
  width: 112,
} as const;

// How many lines of a font at scale fit height: the first line's ink, then a line each.
function linesInHeight(metrics: FontMetrics, scale: number, height: number): number {
  const ink = inkRowsFromCapTop(metrics) * scale;
  return height < ink ? 0 : Math.floor((height - ink) / (metrics.lineHeight * scale)) + 1;
}

// Body text in a box height tall: at 2x on the lines that fit it, at least one.
export function boxStyle(body: FontMetrics, height: number): TextFitStyle {
  return { lines: Math.max(1, linesInHeight(body, TEXT_SCALE, height)), scale: TEXT_SCALE };
}

// An option's firing warning: the body font at 1x on up to two lines across the effect, and the
// title font at 1x on up to two lines across the enlarged card's body.
export const FIRES_FIT = {
  large: { room: CARD_LAYOUT.large.body.width, style: { lines: 2, scale: 1 } },
  small: { room: CARD_LAYOUT.effect.width, style: { lines: 2, scale: 1 } },
} as const satisfies Record<string, { room: number; style: TextFitStyle }>;

// The row where 2x body text under an image, whose lowest ink is on the row over row foot,
// puts its first line's capitals, its pills pillGap rows clear of the image.
function capsUnder(body: FontMetrics, foot: number): number {
  return foot + CARD_LAYOUT.pillGap + pillRiseOverCaps(body, TEXT_SCALE);
}

// A card's effect area, in card pixels, on a card that fires an owner or not: from the
// capitals under the art and its outline to plaqueGap rows over the plaque, or over the fires
// marker's top ink where it rises above the plaque.
export function cardEffectArea(body: FontMetrics, fires: boolean): Rect {
  const { art, badge, effect, fires: marker } = CARD_LAYOUT;
  const y = capsUnder(body, art.y + art.height + art.outline);
  const foot = (fires ? Math.min(badge.y, marker.y + marker.inkTop) : badge.y) - effect.plaqueGap;
  return { height: foot - y, width: effect.width, x: effect.x, y };
}

// A card's effect box, in card pixels: its top and height, under a path card's paws and over a
// firing warning fireLines lines long, whose capitals start at warningY, on a card that fires
// an owner or not.
export function cardEffectBox(
  body: FontMetrics,
  parts: { fireLines: number; fires: boolean; path: boolean },
): { height: number; warningY: number; y: number } {
  const { paws, warningGap } = CARD_LAYOUT;
  const area = cardEffectArea(body, parts.fires);
  const y = parts.path ? capsUnder(body, paws.y + paws.height) : area.y;
  const foot = area.y + area.height;
  const warningY = foot - (parts.fireLines > 0 ? inkRowsOfLines(body, parts.fireLines) : 0);
  const bottom = parts.fireLines > 0 ? warningY - warningGap : foot;
  return { height: bottom - y, warningY, y };
}

// The enlarged card's body: the changes' top, from the body's, under a firing warning
// fireLines lines long in title or else under the art at 2x and its outline, and the height
// they may take.
export function largeBodyBox(
  fonts: { body: FontMetrics; title: FontMetrics },
  fireLines: number,
): { height: number; top: number } {
  const { art, large } = CARD_LAYOUT;
  const artFoot = large.art.y + 2 * art.height + large.art.outline;
  const top =
    fireLines > 0
      ? inkRowsOfLines(fonts.title, fireLines) + large.warningGap
      : Math.max(0, capsUnder(fonts.body, artFoot) - large.body.y);
  return { height: large.body.height - top, top };
}

// How wide a plaque's text may be: the plaque from left, width wide, or its part right of a
// fires marker ending at markerRight, less plaquePadX each side.
export function plaqueRoom(left: number, width: number, markerRight: number | undefined): number {
  return left + width - (markerRight ?? left) - 2 * CARD_LAYOUT.plaquePadX;
}

function cardRowSpec(maxCount: number): CardRowSpec {
  return {
    cardHeight: CARD_LAYOUT.height,
    cardWidth: CARD_LAYOUT.width,
    gap: CARD_LAYOUT.row.gap,
    maxCount,
  };
}

// The enlarged card's height for body content contentHeight tall, bodyGap under it: its body's
// rows, which card-frame-large draws alike, shrink to the content or grow past the frame's.
export function largeCardHeight(contentHeight: number): number {
  const { body, bodyGap, height } = CARD_LAYOUT.large;
  return height - body.height + Math.ceil(contentHeight) + bodyGap;
}

// The enlarged card's changes in a body box height tall: body text at 2x on the lines the box
// holds once the card grows as far as area holds it and its charms.
export function largeBodyStyle(body: FontMetrics, height: number, area: Rect): TextFitStyle {
  const { large } = CARD_LAYOUT;
  const growth = area.height - (large.height + CARD_CHARMS_HEIGHT);
  return boxStyle(body, height + growth);
}

// The enlarged card's rect, height tall, centred in area on whole pixels with its charms'
// rows under it, reserved whether or not the option has a charm.
export function largeCardRect(area: Rect, height: number = CARD_LAYOUT.large.height): Rect {
  const { width } = CARD_LAYOUT.large;
  return {
    height,
    width,
    x: area.x + Math.floor((area.width - width) / 2),
    y: area.y + Math.floor((area.height - (height + CARD_CHARMS_HEIGHT)) / 2),
  };
}

// The card row's block: its header's title titleRise over the cards, the cards, then their
// charms' rows, reserved whether or not a card has a charm, so the row keeps its place.
export const CARD_ROW_BLOCK_HEIGHT =
  CARD_HEADER.titleRise + CARD_LAYOUT.height + CARD_CHARMS_HEIGHT;

// The cards' top in walkView: the block sits with the rows over it and under it 1:2.
export function cardRowTop(walkView: Rect): number {
  const free = walkView.height - CARD_ROW_BLOCK_HEIGHT;
  return walkView.y + Math.round(free / 3) + CARD_HEADER.titleRise;
}

// A row of count cards, maxCount at most, centred across walkView with their top at
// cardRowTop.
export function cardRowIn(walkView: Rect, maxCount: number, count: number): Rect[] {
  const area = { ...walkView, height: CARD_LAYOUT.height, y: cardRowTop(walkView) };
  return cardRowRects(cardRowSpec(maxCount), count, area);
}

// The cards' rects for each count from 1 to maxCount in walkView.
export function cardRows(maxCount: number, walkView: Rect): Rect[][] {
  return Array.from({ length: maxCount }, (_, i) => cardRowIn(walkView, maxCount, i + 1));
}

// A fork card's Head home button, centred on centreX, gap rows under its paths' charms' rows.
export function forkHomeRect(cards: Rect, centreX: number): Rect {
  const { gap, height, width } = CARD_LAYOUT.forkHome;
  return {
    height,
    width,
    x: Math.round(centreX - width / 2),
    y: cards.y + cards.height + CARD_CHARMS_HEIGHT + gap,
  };
}
