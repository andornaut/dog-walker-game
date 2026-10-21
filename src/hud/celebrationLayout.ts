import { ROAD_SPRITE_SIZE } from "../assets/spriteKeys";

const CENTER_X = 180;
const WALKER_SCALE = 2;
// A walker's frame at 1x: ROAD_SPRITE_SIZE wide and half again as tall.
const WALKER_FRAME = { height: ROAD_SPRITE_SIZE * 1.5, width: ROAD_SPRITE_SIZE };
// ui-celebrate-burst's width; its top sits BURST_DROP rows below the walker's frame top.
const BURST_WIDTH = 148;
const BURST_DROP = 6;
// The big line's top over the small line's.
const TITLE_OVER_SUBTITLE = 32;

// A version's headline from its feet line: the walker's frame at WALKER_SCALE, centred on
// CENTER_X, standing on feetY; the burst behind it; and the small line's top subtitleGap rows
// above the walker's frame top, so the head clears it, with the big line above that.
function headline(feetY: number, subtitleGap: number) {
  const walker = {
    x: CENTER_X - (WALKER_FRAME.width * WALKER_SCALE) / 2,
    y: feetY - WALKER_FRAME.height * WALKER_SCALE,
  };
  const subtitleY = walker.y - subtitleGap;
  return {
    burst: { x: CENTER_X - BURST_WIDTH / 2, y: walker.y + BURST_DROP },
    feetY,
    subtitleY,
    titleY: subtitleY - TITLE_OVER_SUBTITLE,
    walker,
  };
}

// The zone celebration's geometry, in screen pixels, as art's style guide sets it out: over
// the dimmed road view, everything centred on centerX. A text y is the top of its font line.
export const CELEBRATION_LAYOUT = {
  centerX: CENTER_X,
  // About bits fx-confetti-bit fall from row fromY to row toY over fallMs, spread across x
  // fromX to toX, each swaying sideways by sway pixels every swayMs.
  confetti: {
    bits: 60,
    fallMs: 2000,
    fromX: 6,
    fromY: 150,
    sway: 4,
    swayMs: 320,
    toX: 348,
    toY: 458,
  },
  dim: { height: 316, width: 360, x: 0, y: 150 },
  // The burst's top-left; the walker, drawn at walkerScale, stands with its frame's bottom
  // centre on the feet line, its frame's top-left at walker.
  newWalker: {
    ...headline(326, 10),
    bubble: { height: 76, width: 312, x: 24, y: 332 },
    button: { height: 44, width: 264, x: 48, y: 416 },
    // The walker's line, wrapped, one line top per line.
    greeting: { lineTops: [336, 354], maxWidth: 296 },
    // The pace and style row: each icon, iconGap, its word; itemGap between the rest.
    info: { iconGap: 4, iconY: 383, itemGap: 10, y: 382 },
    // Tan dots every step pixels along a row of the bubble.
    rule: { fromX: 36, step: 3, toX: 323, y: 375 },
    // ui-quip-tail-up, its bottom row over the bubble's top rim.
    tail: { x: 176, y: 327 },
  },
  // A new walker's centre hops in from fromX, and fx-confetti bursts at burstY as they land.
  runIn: { burstY: 266, durationMs: 600, fromX: 400 },
  // The big line is font-display at this scale; the small line is font-display-cream at 1x.
  titleScale: 2,
  walkerScale: WALKER_SCALE,
  zoneDone: {
    ...headline(370, 14),
    earningsY: 387,
    plate: { height: 32, width: 280, x: 40, y: 380 },
  },
} as const;
