import type { Rect } from "@andornaut/game-kit/rect";

import { WIDE_BUTTON } from "../layout/screenLayout";
import { type FontMetrics, helpCapDy, inkRowsFromCapTop, inkRowsOfLines } from "../ui/fontMetrics";
import { TEXT_SCALE } from "../ui/textFit";
import { badgeStripMinHeight, badgeStripRows } from "./badgesView";

// The end screen's geometry, with every text at 2x.
const PANEL = { height: 304, width: 312, x: 24, y: 112 };
const RIBBON = { x: 144, y: 102 };

export const END_LAYOUT = {
  badges: { height: 92, width: 344, x: 8, y: 419 },
  breakdown: { amountRight: 196, label: 40, pitch: 18, top: PANEL.y + 42 },
  button: { ...WIDE_BUTTON, y: 512 },
  logo: { x: 107, y: 2 },
  panel: PANEL,
  // An owner's row, mirroring the home screen's bubble: a speech bubble from x with its tail
  // at the right pointing at the face in its well, and the owner's name in rust at 1x under
  // the well, its capitals nameY under the row's top, centred on the well. The bubble's frame
  // takes frame.top rows over its cream and frame.bottom under it. Its text is a block: a fired
  // row's "{owner} fired you" in the title font over the closing line, whose first capitals sit
  // LABEL_HELP_GAP clear rows under the title font's lowest ink (helpCapDy), or a happy row's
  // closing line alone; from the first line's highest letter ink (letterTop: a body line's
  // ascenders) to the last line's lowest ink. The block is centred down the cream, any odd row
  // left under it, at least pad clear rows above and below; a larger pad would push the tallest
  // panel, three fired rows under six breakdown lines, onto the badges. The bubble is as tall as
  // the block needs and at least as tall as the well, its top on the well's; the row is at least
  // as tall as the name's lowest ink, and the next row starts gap under it. A 1px tan rule width
  // wide from x runs above over the first row.
  quips: {
    bubble: { frame: { bottom: 3, top: 2 }, pad: 2, width: 244, x: 36 },
    face: { x: 291, y: 1 },
    gap: 2,
    nameY: 37,
    rule: { above: 8, width: 288, x: 36 },
    tail: { x: 279, y: 15 },
    textX: 42,
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
  // one row; the zone count and the total end at right. TOTAL's row ends totalHeight under
  // totalY, under the lowest ink of both. The row sits on a band (sideTotalBand): fill from padX
  // columns left of TOTAL's ink to padX right of the total's, and from padY rows over the row's
  // highest ink to padY under its lowest, a 1px lip row under it and a 1px outline round both.
  // The column ends under the band's outline.
  side: {
    band: {
      fill: "yellow",
      lip: "amber",
      outline: "ink",
      padX: 4,
      padY: 1,
      text: { amount: "forest", label: "plum" },
    },
    pipPitch: 21,
    pipsY: PANEL.y + 60,
    right: 320,
    totalHeight: 12,
    totalY: PANEL.y + 81,
    x: 208,
  },
  titleY: PANEL.y + 18,
} as const;

// How wide a fired row's header and a closing line may be: from the text column to 6px inside
// the bubble's right edge.
export const QUIP_TEXT_ROOM =
  END_LAYOUT.quips.bubble.x + END_LAYOUT.quips.bubble.width - 6 - END_LAYOUT.quips.textX;

// The most lines a closing line wraps onto, while the panel has room for them.
export const QUIP_LINES = 2;

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

// The band behind TOTAL's row, round TOTAL's ink starting at side.x and the total's ink ending
// at amountInkRight (exclusive): its outline, its fill and the lip under the fill.
// The row's highest ink is the higher of TOTAL's letters' and the total's, whose $ and digits
// rise no higher than the body font's letters.
export function sideTotalBand(
  body: FontMetrics,
  title: FontMetrics,
  amountInkRight: number,
): { fill: Rect; lip: Rect; outline: Rect } {
  const { band, totalY, x } = END_LAYOUT.side;
  const inkTop = Math.min(
    totalY - (title.capTop - title.letterTop) * TEXT_SCALE,
    sideTotalAmountY(body, title) - (body.capTop - body.letterTop) * TEXT_SCALE,
  );
  const top = inkTop - band.padY;
  const left = x - band.padX;
  const fill = {
    height: sideTotalInkBottom() + band.padY - top,
    width: amountInkRight + band.padX - left,
    x: left,
    y: top,
  };
  return {
    fill,
    lip: { ...fill, height: 1, y: fill.y + fill.height },
    outline: { height: fill.height + 3, width: fill.width + 2, x: fill.x - 1, y: fill.y - 1 },
  };
}

// The row under TOTAL's row's lowest ink.
function sideTotalInkBottom(): number {
  return END_LAYOUT.side.totalY + END_LAYOUT.side.totalHeight;
}

// The row under the side column: under the band's outline, which ends a lip and an outline row
// under its padY.
function sideBottom(): number {
  return sideTotalInkBottom() + END_LAYOUT.side.band.padY + 2;
}

// An owner's row: whether the owner fired you, and how many lines its closing line takes.
export interface QuipRow {
  readonly fired: boolean;
  readonly lines: number;
}

// The fonts an owner's row is set in: the header in title, the closing line in body.
export interface QuipFonts {
  readonly body: FontMetrics;
  readonly title: FontMetrics;
}

// How far a row's first line inks above its capitals at 2x: a body line's ascenders, or none
// for a fired row's header, whose letters start on its capitals.
function quipRise(fonts: QuipFonts, row: QuipRow): number {
  const first = row.fired ? fonts.title : fonts.body;
  return (first.capTop - first.letterTop) * TEXT_SCALE;
}

// From a row's first capitals (a fired row's header's, else its closing line's) to its closing
// line's first capitals.
function quipHeaderDy(fonts: QuipFonts, row: QuipRow): number {
  return row.fired ? helpCapDy(fonts.title, TEXT_SCALE) : 0;
}

// A row's text block: from its first line's highest letter ink to its closing line's lowest
// ink, on lines lines of the body font at 2x.
function quipBlockHeight(fonts: QuipFonts, row: QuipRow): number {
  const lines = inkRowsOfLines(fonts.body, row.lines) * TEXT_SCALE;
  return quipRise(fonts, row) + quipHeaderDy(fonts, row) + lines;
}

// An owner's bubble's height: its frame, pad clear rows either side of the text block, and at
// least the well's height.
export function quipBubbleHeight(fonts: QuipFonts, row: QuipRow): number {
  const { bubble, well } = END_LAYOUT.quips;
  const { bottom, top } = bubble.frame;
  return Math.max(well.size, top + bubble.pad + quipBlockHeight(fonts, row) + bubble.pad + bottom);
}

// An owner's row's height: its bubble's, and at least down to the lowest ink of the name under
// the well.
export function quipRowHeight(fonts: QuipFonts, row: QuipRow): number {
  const { nameY } = END_LAYOUT.quips;
  return Math.max(quipBubbleHeight(fonts, row), nameY + inkRowsFromCapTop(fonts.body));
}

// The text block's highest ink, from the row's top: the block centred down the bubble's cream,
// any odd row left under it.
export function quipInkTop(fonts: QuipFonts, row: QuipRow): number {
  const { bottom, top } = END_LAYOUT.quips.bubble.frame;
  const cream = quipBubbleHeight(fonts, row) - top - bottom;
  return top + Math.floor((cream - quipBlockHeight(fonts, row)) / 2);
}

// The row's first capitals, from its top: a fired row's header's, else its closing line's.
export function quipCapsTop(fonts: QuipFonts, row: QuipRow): number {
  return quipInkTop(fonts, row) + quipRise(fonts, row);
}

// The closing line's first capitals, from the row's top: under a fired row's header, or the
// row's first capitals on a happy row.
export function quipTextY(fonts: QuipFonts, row: QuipRow): number {
  return quipCapsTop(fonts, row) + quipHeaderDy(fonts, row);
}

// The breakdown ends a pitch under its last line's top; the side column ends under its total's
// band.
// The owners' rows start QUIPS_GAP under whichever ends lower, the tan rule 8px over them, and
// the panel ends 8px under the last row.
const QUIPS_GAP = 10;
const PANEL_FOOT = 8;

interface EndPanelLayout {
  panel: typeof PANEL;
  // Each owner's row: its top, its height and its bubble's.
  rows: { bubble: number; height: number; top: number }[];
}

// The panel and the owners' rows, each row's closing line on the lines it is given.
export function endPanelLayout(
  fonts: QuipFonts,
  breakdownLines: number,
  quipRows: readonly QuipRow[],
): EndPanelLayout {
  const { breakdown, quips } = END_LAYOUT;
  const listBottom = breakdown.top + breakdownLines * breakdown.pitch;
  let top = Math.max(listBottom, sideBottom()) + QUIPS_GAP;
  const shown = quipRows.length === 0 ? [{ fired: false, lines: 1 }] : quipRows;
  const rows = shown.map((quip) => {
    const row = { bubble: quipBubbleHeight(fonts, quip), height: quipRowHeight(fonts, quip), top };
    top += row.height + quips.gap;
    return row;
  });
  const last = rows.at(-1);
  const rowsBottom = last === undefined ? top : last.top + last.height;
  return { panel: { ...PANEL, height: rowsBottom + PANEL_FOOT - PANEL.y }, rows };
}

// The badge strip for rows rows of badges: badges, grown up into the panel's room as tall as
// its rows need (badgeStripMinHeight), its bottom kept over the button.
export function endBadgeStrip(rows: number): Rect {
  const { badges } = END_LAYOUT;
  const height = Math.max(badges.height, badgeStripMinHeight(rows));
  return { ...badges, height, y: badges.y + badges.height - height };
}

// Whether a panel ends above the badge strip while badgeRows rows of badges show, or else
// within the strip's area, which it then grows into.
export function endPanelFits(badgeRows: number, panel: typeof PANEL): boolean {
  const strip = endBadgeStrip(badgeRows);
  return panel.y + panel.height <= (badgeRows > 0 ? strip.y : strip.y + strip.height);
}

// The rows count badges take on the end screen (badgeStripRows), or one when the panel, every
// owner's row on one line, would not end above more.
export function endBadgeRows(
  fonts: QuipFonts,
  breakdownLines: number,
  owners: readonly Pick<QuipRow, "fired">[],
  count: number,
): number {
  const rows = badgeStripRows(count);
  const oneLine = owners.map(({ fired }) => ({ fired, lines: 1 }));
  const { panel } = endPanelLayout(fonts, breakdownLines, oneLine);
  return rows <= 1 || endPanelFits(rows, panel) ? rows : 1;
}

// The lines each owner's row gets: the lines it wants, from the top row down, while the panel
// still fits with every row after it on one line; one line once it would not.
export function grantedQuipLines(
  fonts: QuipFonts,
  badgeRows: number,
  breakdownLines: number,
  wanted: readonly QuipRow[],
): number[] {
  return wanted.reduce<number[]>((granted, row, i) => {
    const above = granted.map((lines, j) => ({ fired: wanted[j]?.fired ?? false, lines }));
    const rest = wanted.slice(i + 1).map(({ fired }) => ({ fired, lines: 1 }));
    const tried = endPanelLayout(fonts, breakdownLines, [...above, row, ...rest]);
    return [...granted, endPanelFits(badgeRows, tried.panel) ? row.lines : 1];
  }, []);
}

// Where the owner's name under the well starts, inkWidth wide at 1x: centred on the well.
export function quipNameX(inkWidth: number): number {
  const { well } = END_LAYOUT.quips;
  return Math.round(well.x + well.size / 2 - inkWidth / 2);
}
