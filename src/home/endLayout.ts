import { type FontMetrics, inkRowsFromCapTop } from "../ui/fontMetrics";

// The end screen's geometry, with every text at 2x.
const PANEL = { height: 300, width: 312, x: 24, y: 112 };
const RIBBON = { x: 144, y: 102 };

export const END_LAYOUT = {
  badges: { height: 92, width: 344, x: 8, y: 416 },
  breakdown: { amountRight: 196, label: 40, pitch: 16, top: PANEL.y + 42 },
  // 44 game pixels tall: 48 CSS pixels on a 390px-wide phone.
  button: { height: 44, width: 264, x: 48, y: 512 },
  logo: { x: 116, y: 8 },
  panel: PANEL,
  // An owner's row: the face in its well, and a speech bubble with the owner's name at nameY
  // and the closing line's first capitals at textY, from the row's top. The bubble ends
  // padBottom under the line's lowest ink, and the next row starts gap under it.
  quips: {
    bubble: { padBottom: 4, width: 244, x: 80 },
    face: { x: 37, y: 1 },
    gap: 2,
    nameY: 5,
    tail: { x: 75, y: 15 },
    textX: 86,
    textY: 22,
    well: { size: 34, x: 36, y: 0 },
  },
  // The return home, under the logo and above the panel: the walker and pack walk up the
  // front path from behind the panel's top edge to the house's step while the owners wave
  // either side. The house, lawn, path and step are part of screen-end; without it a tan path
  // and step cross a strip of lawn. Spots are where feet end up, in pack order, 34 apart so
  // every 40px dog and 40x60 person shows.
  returnHome: {
    dogs: [
      { x: 146, y: 106 },
      { x: 214, y: 105 },
      { x: 248, y: 108 },
    ],
    lawn: { height: 16, width: 360, x: 0, y: 96 },
    owners: [
      { x: 112, y: 110 },
      { x: 282, y: 110 },
      { x: 78, y: 110 },
    ],
    path: { height: 12, width: 24, x: 168, y: 100 },
    step: { height: 4, width: 32, x: 164, y: 96 },
    walker: { x: 180, y: 110 },
  },
  ribbon: RIBBON,
  // fx-new-best's 96x48 frame sits 12 left of and 14 above the ribbon.
  ribbonBurst: { height: 48, width: 96, x: RIBBON.x - 12, y: RIBBON.y - 14 },
  // The side column: its labels from x, the zone pips and the bank, the bank's amount bankDx
  // right of the money icon's left edge; the zone count ends at right.
  side: {
    bankDx: 20,
    bankY: PANEL.y + 82,
    iconY: PANEL.y + 100,
    pipPitch: 21,
    pipsY: PANEL.y + 60,
    right: 320,
    x: 208,
  },
  titleY: PANEL.y + 18,
} as const;

// Every text on the end screen is body or title at 2x, or smaller where it would not fit.
export const END_TEXT_SCALE = 2;

// Each badge's name fits on one line under it.
export const END_BADGE_NAME_LINES = 1;

// How wide an owner's name and closing line may be: from the text column to 6px inside the
// bubble's right edge.
export const QUIP_TEXT_ROOM =
  END_LAYOUT.quips.bubble.x + END_LAYOUT.quips.bubble.width - 6 - END_LAYOUT.quips.textX;

// How wide the side column's labels may be: from the column to the right edge its zone count
// keeps to.
export const SIDE_LABEL_ROOM = END_LAYOUT.side.right - END_LAYOUT.side.x;

// A breakdown label keeps this far left of its amount.
const AMOUNT_GAP = 8;

// How wide a breakdown label may be beside an amount whose ink is amountWidth wide.
export function breakdownLabelRoom(amountWidth: number): number {
  const { amountRight, label } = END_LAYOUT.breakdown;
  return amountRight - amountWidth - AMOUNT_GAP - label;
}

// An owner's bubble, from the row's top, with its closing line on lines lines of the body
// font at 2x: down to the last line's lowest ink, and padBottom more.
function quipBubbleHeight(body: FontMetrics, lines: number): number {
  const { bubble, textY } = END_LAYOUT.quips;
  const lineHeight = body.lineHeight * END_TEXT_SCALE;
  const ink = inkRowsFromCapTop(body) * END_TEXT_SCALE;
  return textY + (Math.max(1, lines) - 1) * lineHeight + ink + bubble.padBottom;
}

// The breakdown's rule sits 2px under its last line and the 2x total 8px under it; the side
// column ends with the 16px money icon. The owners' rows start QUIPS_GAP under whichever ends
// lower, the tan rule 8px over them, and the panel ends 8px under the last bubble.
const QUIPS_GAP = 14;
const PANEL_FOOT = 8;

interface EndPanelLayout {
  panel: typeof PANEL;
  // Each owner's row: its top and its bubble's height.
  rows: { height: number; top: number }[];
}

// The panel and the owners' rows, each row's closing line on the lines quipLines gives it.
export function endPanelLayout(
  body: FontMetrics,
  breakdownLines: number,
  quipLines: readonly number[],
): EndPanelLayout {
  const { breakdown, quips, side } = END_LAYOUT;
  const totalBottom = breakdown.top + breakdownLines * breakdown.pitch + 8 + 10;
  let top = Math.max(totalBottom, side.iconY + 16) + QUIPS_GAP;
  const rows = (quipLines.length === 0 ? [1] : quipLines).map((lines) => {
    const row = { height: quipBubbleHeight(body, lines), top };
    top += row.height + quips.gap;
    return row;
  });
  const last = rows.at(-1);
  const rowsBottom = last === undefined ? top : last.top + last.height;
  return { panel: { ...PANEL, height: rowsBottom + PANEL_FOOT - PANEL.y }, rows };
}

// Whether a panel ends within PANEL's height and above the badges.
export function endPanelFits(panel: typeof PANEL): boolean {
  return panel.height <= PANEL.height && panel.y + panel.height <= END_LAYOUT.badges.y;
}

// The lines each owner's row gets: the lines it wants, from the top row down, while the panel
// still fits with every row after it on one line; one line once it would not.
export function grantedQuipLines(
  body: FontMetrics,
  breakdownLines: number,
  wanted: readonly number[],
): number[] {
  return wanted.reduce<number[]>((granted, lines) => {
    const rest = wanted.slice(granted.length + 1).map(() => 1);
    const tried = endPanelLayout(body, breakdownLines, [...granted, lines, ...rest]);
    return [...granted, endPanelFits(tried.panel) ? lines : 1];
  }, []);
}
