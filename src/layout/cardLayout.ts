import type { Rect } from "@andornaut/game-kit/rect";
import {
  type FontMetrics,
  inkRowsFromCapTop,
  inkRowsOfLines,
} from "@andornaut/game-kit/text/bitmapFont";
import { type TextFitStyle } from "@andornaut/game-kit/text/textFit";

import { CARD_HEADER, cardRowRects, type CardRowSpec } from "../ui/cardRow";
import { TEXT_SCALE } from "../ui/textFit";
import { CARD_CHARMS_HEIGHT } from "./buffLayout";

// The choice cards: the card-frame sprite's parts in card pixels, the row of cards centred
// on the road, and the enlarged card a hold opens, card-frame-large, centred in the dimmed band
// and road. A band's label is body text at 1x, at most room wide. An option
// that would fire an owner says so at the foot of the effect, warningGap over the plaque, its
// lowest ink at the effect's bottom, the effect ending warningGap over it; the ui-fires marker,
// fires.size square at its scale, sits over the plaque's left rivet at fires. A path card's
// difficulty paws, paws.height tall, sit at the effect's top, the effect paws.gap under them.
// A plaque's text keeps plaquePadX inside the plaque or its part right of the marker.
export const CARD_LAYOUT = {
  art: { height: 56, width: 75, x: 18, y: 16 },
  badge: { height: 13, width: 71, x: 20, y: 134 },
  band: { height: 11, room: 106, y: 2 },
  effect: { height: 55, width: 100, x: 6, y: 76 },
  fires: { size: 16, x: 18, y: 132 },
  // A fork card's Head home button, centred under the paths, gap rows below their charms.
  forkHome: { gap: 6, height: 44, width: 160 },
  height: 153,
  // The enlarged card's body: a firing warning in the title font at 1x, warningGap over the
  // changes, which take the rest of the body and bodyGap rows under their lowest ink.
  large: {
    art: { x: 8, y: 32 },
    badge: { height: 26, width: 142, x: 12, y: 242 },
    band: { height: 18, room: 154, y: 4 },
    body: { height: 82, width: 142, x: 12, y: 152 },
    bodyGap: 4,
    fires: { x: 8, y: 238 },
    height: 280,
    warningGap: 4,
    width: 166,
  },
  paws: { gap: 4, height: 10 },
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

// A card's effect box, in card pixels: its top and height, under a path card's paws and over a
// firing warning fireLines lines long, whose capitals start at warningY.
export function cardEffectBox(
  body: FontMetrics,
  parts: { fireLines: number; path: boolean },
): { height: number; warningY: number; y: number } {
  const { effect, paws, warningGap } = CARD_LAYOUT;
  const y = effect.y + (parts.path ? paws.height + paws.gap : 0);
  const foot = effect.y + effect.height;
  const warningY = foot - (parts.fireLines > 0 ? inkRowsOfLines(body, parts.fireLines) : 0);
  const bottom = parts.fireLines > 0 ? warningY - warningGap : foot;
  return { height: bottom - y, warningY, y };
}

// The enlarged card's body: the changes' top, under a firing warning fireLines lines long in
// title, and the height they may take.
export function largeBodyBox(
  title: FontMetrics,
  fireLines: number,
): { height: number; top: number } {
  const { body, warningGap } = CARD_LAYOUT.large;
  const top = fireLines > 0 ? inkRowsOfLines(title, fireLines) + warningGap : 0;
  return { height: body.height - top, top };
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
