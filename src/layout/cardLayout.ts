import type { Rect } from "../lib/rect";
import { cardRowRects, type CardRowSpec } from "../ui/cardRow";
import { type FontMetrics, inkRowsFromCapTop, inkRowsOfLines } from "../ui/fontMetrics";
import type { TextFitStyle } from "../ui/textFit";

// The choice cards: the card-frame sprite's parts in card pixels, the row of cards centred
// on the road, and the enlarged card a hold opens, card-frame-large, centred in the dimmed band
// and road. A band's label keeps room wide at 1x. An option that would fire an owner says so at
// the foot of the effect, warningGap over the plaque, its lowest ink at the effect's bottom,
// the effect ending warningGap over it; the ui-fires marker, fires.size square at its scale,
// sits over the plaque's left rivet at fires. A path card's difficulty paws, paws.height tall,
// sit at the effect's top, the effect paws.gap under them. A plaque's text keeps
// plaquePadX inside the plaque or its part right of the marker.
export const CARD_LAYOUT = {
  art: { height: 56, width: 75, x: 4, y: 16 },
  badge: { height: 13, width: 71, x: 6, y: 121 },
  band: { height: 11, room: 77, y: 2 },
  effect: { height: 42, width: 71, x: 6, y: 76 },
  fires: { size: 16, x: 4, y: 119 },
  height: 140,
  // The enlarged card's body: a firing warning in the title font at 1x, warningGap over the
  // changes, which take the rest of the body.
  large: {
    art: { x: 8, y: 32 },
    badge: { height: 26, width: 142, x: 12, y: 242 },
    band: { height: 18, room: 154, y: 4 },
    body: { height: 82, width: 142, x: 12, y: 152 },
    fires: { x: 8, y: 238 },
    height: 280,
    warningGap: 4,
    width: 166,
  },
  paws: { gap: 4, height: 10 },
  plaquePadX: 2,
  row: { gap: 8 },
  warningGap: 2,
  width: 83,
} as const;

// How many lines of a font at scale fit height: the first line's ink, then a line each.
function linesInHeight(metrics: FontMetrics, scale: number, height: number): number {
  const ink = inkRowsFromCapTop(metrics) * scale;
  return height < ink ? 0 : Math.floor((height - ink) / (metrics.lineHeight * scale)) + 1;
}

// Body text in a box height tall: at 2x on the lines that fit it, else at 1x.
export function boxStyles(body: FontMetrics, height: number): TextFitStyle[] {
  return [2, 1].flatMap((scale) => {
    const lines = linesInHeight(body, scale, height);
    return lines === 0 ? [] : [{ letterSpacing: 0, lines, scale }];
  });
}

// An option's firing warning: the body font at 1x on up to two lines across the effect, and the
// title font at 1x on up to two lines across the enlarged card's body.
export const FIRES_FIT = {
  large: {
    room: CARD_LAYOUT.large.body.width,
    styles: [{ letterSpacing: 0, lines: 2, scale: 1 }],
  },
  small: { room: CARD_LAYOUT.effect.width, styles: [{ letterSpacing: 0, lines: 2, scale: 1 }] },
} as const satisfies Record<string, { room: number; styles: readonly TextFitStyle[] }>;

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

export function cardRowSpec(maxCount: number): CardRowSpec {
  return {
    cardHeight: CARD_LAYOUT.height,
    cardWidth: CARD_LAYOUT.width,
    gap: CARD_LAYOUT.row.gap,
    maxCount,
  };
}

// The enlarged card's height for body content contentHeight tall: its body's rows, which
// card-frame-large draws alike, shrink to the content, and never grow past the frame's.
export function largeCardHeight(contentHeight: number): number {
  const { body, height } = CARD_LAYOUT.large;
  return height - Math.max(0, body.height - Math.ceil(contentHeight));
}

// The enlarged card's rect, height tall, centred in area on whole pixels.
export function largeCardRect(area: Rect, height: number = CARD_LAYOUT.large.height): Rect {
  const { width } = CARD_LAYOUT.large;
  return {
    height,
    width,
    x: area.x + Math.floor((area.width - width) / 2),
    y: area.y + Math.floor((area.height - height) / 2),
  };
}

// The cards' rects for each count from 1 to maxCount, centred on the road.
export function cardRows(maxCount: number, road: Rect): Rect[][] {
  return Array.from({ length: maxCount }, (_, i) =>
    cardRowRects(cardRowSpec(maxCount), i + 1, road),
  );
}
