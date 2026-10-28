import { ROAD_SPRITE_SIZE } from "../assets/spriteKeys";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import type { FontMetrics } from "../ui/fontMetrics";
import { type TextFitStyle, textFitStylesOnLines } from "../ui/textFit";

const SCREEN_WIDTH = SCREEN_CONFIG.width;
const CENTRE_X = SCREEN_WIDTH / 2;
// The bubble's and the title's inset from either screen edge.
const SIDE = 24;
const TITLE_SCALE = 2;
const WALKER_SCALE = 2;
// A walker's frame at 1x: ROAD_SPRITE_SIZE wide and half again as tall.
const WALKER_FRAME = { height: ROAD_SPRITE_SIZE * 1.5, width: ROAD_SPRITE_SIZE };
// ui-celebrate-burst's width; its top sits BURST_DROP rows below the walker's frame top.
const BURST_WIDTH = 148;
const BURST_DROP = 6;
// The big line's top over the small line's, so the big line's outline clears the small one's.
const TITLE_OVER_SUBTITLE = 38;

// The celebration moves with the road, its rows set from the road's top row: the dim from 72
// rows over it, and each version's walker's feet line under it, with the new walker's bubble
// 6 rows under its feet line and the parts in the bubble from the bubble's top.
const ROAD_TOP = SCREEN_LAYOUT.roadView.y;
const DIM = { height: 316, width: SCREEN_WIDTH, x: 0, y: ROAD_TOP - 72 };
const NEW_WALKER_FEET = ROAD_TOP + 104;
const BUBBLE_TOP = NEW_WALKER_FEET + 6;
const ZONE_DONE_FEET = ROAD_TOP + 148;
const PLATE_TOP = ZONE_DONE_FEET + 10;
// Each version's button, 8 rows under its bubble or plate.
const BUTTON = { height: 44, width: 264, x: 48 };

// A version's headline from its feet line: the walker's frame at WALKER_SCALE, centred on
// CENTRE_X, standing on feetY; the burst behind it; and the small line's top subtitleGap rows
// above the walker's frame top, so the head clears it, with the big line above that.
function headline(feetY: number, subtitleGap: number) {
  const walker = {
    x: CENTRE_X - (WALKER_FRAME.width * WALKER_SCALE) / 2,
    y: feetY - WALKER_FRAME.height * WALKER_SCALE,
  };
  const subtitleY = walker.y - subtitleGap;
  return {
    burst: { x: CENTRE_X - BURST_WIDTH / 2, y: walker.y + BURST_DROP },
    feetY,
    subtitleY,
    titleY: subtitleY - TITLE_OVER_SUBTITLE,
    walker,
  };
}

// The zone celebration's geometry, in screen pixels, as art's style guide sets it out: over
// the dimmed road view, everything centred on centreX. A text y is the top of its font line.
export const CELEBRATION_LAYOUT = {
  centreX: CENTRE_X,
  // About bits fx-confetti-bit fall from row fromY to row toY over fallMs, spread across x
  // fromX to toX, each swaying sideways by sway pixels every swayMs.
  confetti: {
    bits: 60,
    fallMs: 2000,
    fromX: 6,
    fromY: DIM.y,
    sway: 4,
    swayMs: 320,
    toX: 348,
    toY: DIM.y + 308,
  },
  dim: DIM,
  // The burst's top-left; the walker, drawn at walkerScale, stands with its frame's bottom
  // centre on the feet line, its frame's top-left at walker.
  newWalker: {
    ...headline(NEW_WALKER_FEET, 10),
    bubble: { height: 76, width: SCREEN_WIDTH - SIDE * 2, x: SIDE, y: BUBBLE_TOP },
    button: { ...BUTTON, y: BUBBLE_TOP + 84 },
    // The walker's line, its first line's top at top, wrapped within maxWidth onto up to lines
    // lines a line of the body font apart, by GREETING_FIT.
    greeting: { lines: 2, maxWidth: 296, top: BUBBLE_TOP + 4 },
    // The agility and perk row: an icon, iconGap, its word; itemGap between the rest.
    info: { iconGap: 4, iconY: BUBBLE_TOP + 51, itemGap: 10, y: BUBBLE_TOP + 50 },
    // Tan dots every step pixels along a row of the bubble.
    rule: { fromX: 36, step: 3, toX: 323, y: BUBBLE_TOP + 43 },
    // ui-quip-tail-up, its bottom row over the bubble's top rim.
    tail: { x: 176, y: BUBBLE_TOP - 5 },
  },
  // A new walker's centre hops in from fromX, and fx-confetti bursts at burstY as they land.
  runIn: { burstY: ROAD_TOP + 44, durationMs: 600, fromX: 400 },
  // The big line is font-display at titleScale, or at the first of titleStyles whose ink fits
  // titleRoom: each whole scale down to 1, glyphs at the font's own spacing. The small line is
  // font-display-cream at 1x.
  titleRoom: SCREEN_WIDTH - SIDE * 2,
  titleScale: TITLE_SCALE,
  titleStyles: Array.from({ length: TITLE_SCALE }, (_, i): TextFitStyle => ({
    letterSpacing: 0,
    scale: TITLE_SCALE - i,
  })),
  walkerScale: WALKER_SCALE,
  zoneDone: {
    ...headline(ZONE_DONE_FEET, 14),
    button: { ...BUTTON, y: PLATE_TOP + 40 },
    earningsY: PLATE_TOP + 7,
    plate: { height: 32, width: 280, x: 40, y: PLATE_TOP },
  },
} as const;

// The walker's greeting: on up to its lines at 2x, with its glyphs closer, or at 1x.
export const GREETING_FIT = {
  room: CELEBRATION_LAYOUT.newWalker.greeting.maxWidth,
  styles: textFitStylesOnLines(CELEBRATION_LAYOUT.newWalker.greeting.lines),
} as const;

// The top of each of the greeting's lines lines at scale, a line of the body font apart.
export function greetingLineTops(body: FontMetrics, scale: number, lines: number): number[] {
  const { top } = CELEBRATION_LAYOUT.newWalker.greeting;
  return Array.from({ length: lines }, (_, i) => top + i * body.lineHeight * scale);
}
