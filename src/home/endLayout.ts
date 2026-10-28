import { WIDE_BUTTON } from "../layout/screenLayout";
import { type FontMetrics, inkRowsFromCapTop, inkRowsOfLines } from "../ui/fontMetrics";
import { TEXT_SCALE } from "../ui/textFit";

// The end screen's geometry, with every text at 2x.
const PANEL = { height: 304, width: 312, x: 24, y: 112 };
const RIBBON = { x: 144, y: 102 };

export const END_LAYOUT = {
  badges: { height: 92, width: 344, x: 8, y: 416 },
  breakdown: { amountRight: 196, label: 40, pitch: 18, top: PANEL.y + 42 },
  button: { ...WIDE_BUTTON, y: 512 },
  logo: { x: 107, y: 2 },
  panel: PANEL,
  // An owner's row, mirroring the home screen's bubble: a speech bubble from x with its tail
  // at the right pointing at the face in its well, and the owner's name in rust at 1x under
  // the well, its capitals nameY under the row's top, centred on the well. A fired row's
  // bubble has "{owner} fired you" at headerY and the closing line's first capitals at
  // textY; a happy row's has only the line, centred down the bubble. The bubble ends
  // padBottom under a line at textY's lowest ink, and the row is at least as tall as the
  // name's lowest ink; the next row starts gap under it. A 1px tan rule width wide from x
  // runs above over the first row.
  quips: {
    bubble: { padBottom: 4, width: 244, x: 36 },
    face: { x: 291, y: 1 },
    gap: 2,
    headerY: 5,
    nameY: 37,
    rule: { above: 8, width: 288, x: 36 },
    tail: { x: 279, y: 15 },
    textX: 42,
    textY: 22,
    well: { size: 34, x: 290, y: 0 },
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
  // The side column: its labels from x, the zone pips, then TOTAL in the title font with its
  // capitals at totalY and the walk's total beside it in the body font, their capitals ending on
  // one row; the zone count and the total end at right. The column ends totalHeight under
  // totalY, under the lowest ink of both.
  side: {
    pipPitch: 21,
    pipsY: PANEL.y + 60,
    right: 320,
    totalHeight: 12,
    totalY: PANEL.y + 82,
    x: 208,
  },
  titleY: PANEL.y + 18,
} as const;

// How wide a fired row's header and a closing line may be: from the text column to 6px inside
// the bubble's right edge.
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

// How wide the side column's TOTAL may be beside the walk's total, whose ink is amountWidth
// wide.
export function sideTotalLabelRoom(amountWidth: number): number {
  const { right, x } = END_LAYOUT.side;
  return right - amountWidth - AMOUNT_GAP - x;
}

// The capitals' top of the walk's total in the 2x body font, so its capitals end on the row
// TOTAL's end in the 2x title font, whose capitals start at side.totalY.
export function sideTotalAmountY(body: FontMetrics, title: FontMetrics): number {
  return END_LAYOUT.side.totalY + (title.capHeight - body.capHeight) * TEXT_SCALE;
}

// An owner's row: whether the owner fired you, and how many lines its closing line takes.
export interface QuipRow {
  readonly fired: boolean;
  readonly lines: number;
}

// From a line's capitals to its last line's lowest ink, on lines lines of the body font at 2x.
function quipTextHeight(body: FontMetrics, lines: number): number {
  return inkRowsOfLines(body, lines) * TEXT_SCALE;
}

// An owner's row's height, and its bubble's: down to the closing line's lowest ink under the
// header's place and padBottom more, and at least down to the lowest ink of the name under the
// well.
export function quipRowHeight(body: FontMetrics, row: QuipRow): number {
  const { bubble, nameY, textY } = END_LAYOUT.quips;
  const text = textY + quipTextHeight(body, row.lines) + bubble.padBottom;
  return Math.max(text, nameY + inkRowsFromCapTop(body));
}

// The closing line's first capitals, from the row's top: under a fired row's header, or
// centred down a happy row's bubble.
export function quipTextY(body: FontMetrics, row: QuipRow, height: number): number {
  return row.fired
    ? END_LAYOUT.quips.textY
    : Math.floor((height - quipTextHeight(body, row.lines)) / 2);
}

// The breakdown ends a pitch under its last line's top; the side column ends under its total.
// The owners' rows start QUIPS_GAP under whichever ends lower, the tan rule 8px over them, and
// the panel ends 8px under the last bubble.
const QUIPS_GAP = 10;
const PANEL_FOOT = 8;

interface EndPanelLayout {
  panel: typeof PANEL;
  // Each owner's row: its top and its bubble's height.
  rows: { height: number; top: number }[];
}

// The panel and the owners' rows, each row's closing line on the lines it is given.
export function endPanelLayout(
  body: FontMetrics,
  breakdownLines: number,
  quipRows: readonly QuipRow[],
): EndPanelLayout {
  const { breakdown, quips, side } = END_LAYOUT;
  const listBottom = breakdown.top + breakdownLines * breakdown.pitch;
  let top = Math.max(listBottom, side.totalY + side.totalHeight) + QUIPS_GAP;
  const shown = quipRows.length === 0 ? [{ fired: false, lines: 1 }] : quipRows;
  const rows = shown.map((quip) => {
    const row = { height: quipRowHeight(body, quip), top };
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
  wanted: readonly QuipRow[],
): number[] {
  return wanted.reduce<number[]>((granted, row, i) => {
    const above = granted.map((lines, j) => ({ fired: wanted[j]?.fired ?? false, lines }));
    const rest = wanted.slice(i + 1).map(({ fired }) => ({ fired, lines: 1 }));
    const tried = endPanelLayout(body, breakdownLines, [...above, row, ...rest]);
    return [...granted, endPanelFits(tried.panel) ? row.lines : 1];
  }, []);
}

// Where the owner's name under the well starts, inkWidth wide at 1x: centred on the well.
export function quipNameX(inkWidth: number): number {
  const { well } = END_LAYOUT.quips;
  return Math.round(well.x + well.size / 2 - inkWidth / 2);
}
