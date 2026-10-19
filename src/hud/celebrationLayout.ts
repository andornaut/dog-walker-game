// The zone celebration's geometry, in screen pixels, as art's style guide sets it out: over
// the dimmed road view, everything centred on centerX. A text y is the top of its font line.
export const CELEBRATION_LAYOUT = {
  centerX: 180,
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
  // centre on the feet line.
  newWalker: {
    bubble: { height: 76, width: 312, x: 24, y: 332 },
    burst: { x: 106, y: 202 },
    button: { height: 44, width: 264, x: 48, y: 416 },
    feetY: 326,
    // The walker's line, wrapped, one line top per line.
    greeting: { lineTops: [336, 354], maxWidth: 296 },
    // The pace and style row: each icon, iconGap, its word; itemGap between the rest.
    info: { iconGap: 4, iconY: 383, itemGap: 10, y: 382 },
    // Tan dots every step pixels along a row of the bubble.
    rule: { fromX: 36, step: 3, toX: 323, y: 375 },
    subtitleY: 184,
    // ui-quip-tail-up, its bottom row over the bubble's top rim.
    tail: { x: 176, y: 327 },
    titleY: 152,
  },
  // A new walker's centre hops in from fromX, and fx-confetti bursts at burstY as they land.
  runIn: { burstY: 266, durationMs: 600, fromX: 400 },
  // The big line is font-display at this scale; the small line is font-display-cream at 1x.
  titleScale: 2,
  walkerScale: 2,
  zoneDone: {
    burst: { x: 106, y: 246 },
    earningsY: 387,
    feetY: 370,
    plate: { height: 32, width: 280, x: 40, y: 380 },
    subtitleY: 224,
    titleY: 192,
  },
} as const;
