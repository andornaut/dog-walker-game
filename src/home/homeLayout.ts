import type { DogId } from "../data/types";
import type { PackPlacement } from "../layout/packFormation";
import type { Rect } from "../lib/rect";
import { type FontMetrics, inkRowsFromCapTop, inkRowsOfLines } from "../ui/fontMetrics";
import type { GridSpec } from "../ui/grid";
import type { TextFitStyle } from "../ui/textFit";
import type { SectionId } from "./sections";

// Every tappable thing is at least 44 game pixels (48 CSS pixels on a 390px-wide phone) on
// each side, except the top bar's buttons, 34 wide in the walk bar's columns; tiles side by
// side are 8 apart.
const GAP = 8;
// The gate scene in the screen-home art: the street, the yard and the path to the gate.
const GATE = { height: 156, y: 40 };
// The top bar's content lies above its 2px bottom rule, and each button's 20-row
// ui-icon-button face is centred on the rows above the rule.
const TOP_BAR_HEIGHT = 40;
const TOP_BAR_RULE = 2;
const TOP_BAR_MID = (TOP_BAR_HEIGHT - TOP_BAR_RULE) / 2;
const TOP_BAR_FACE = 20;
const TOP_BAR_FACE_Y = TOP_BAR_MID - TOP_BAR_FACE / 2;

// The separator bar under the gate scene: 3 rows (the gate scene's last row is 195).
const GATE_BAR = { height: 3, y: GATE.y + GATE.height };
// Every gap between the bar, the three sections, Start walk and the screen's bottom.
const SECTION_GAP = 2;
// A section's tiles start this far below its top: the frame's 3px, the band's 20 rows and its
// 1px rule.
const TILE_OFFSET = 24;
// The Pocket's denim carries a 2px stitch at its top, and its cells sit under that, 1px apart.
const POCKET_CELLS_OFFSET = TILE_OFFSET + 3;
const START_BUTTON: Rect = { height: 44, width: 352, x: 4, y: 514 };
// A walker tile's cells, its portrait box, and the row a locked walker's plate and an owned
// one's name put their caps on.
const WALKER_TILES = { cellHeight: 44, cellWidth: 77, columns: 4, gapX: GAP, gapY: 0 } as const;
const WALKER_BOX = { dx: 3, dy: 4, size: 34 } as const;
const WALKER_ORIGIN_X = 14;
const WALKER_TEXT_Y = 28;

// The sections stack from the bar down to Start walk, each SECTION_GAP apart; the Pocket takes
// the rest.
const WALKER_SECTION: Rect = {
  height: 71,
  width: 352,
  x: 4,
  y: GATE_BAR.y + GATE_BAR.height + SECTION_GAP,
};
const DOGS_SECTION: Rect = {
  height: 159,
  width: 352,
  x: 4,
  y: WALKER_SECTION.y + WALKER_SECTION.height + SECTION_GAP,
};
const POCKET_SECTION: Rect = {
  height: START_BUTTON.y - SECTION_GAP - (DOGS_SECTION.y + DOGS_SECTION.height + SECTION_GAP),
  width: 352,
  x: 4,
  y: DOGS_SECTION.y + DOGS_SECTION.height + SECTION_GAP,
};

// A section's tile area inside its frame, under the band: the rect its fill's TileSprite covers.
export function sectionFill(section: Rect): Rect {
  const { height, width, x, y } = section;
  return { height: height - 27, width: width - 6, x: x + 3, y: y + TILE_OFFSET };
}

// The Pocket's lining inside its section frame, each piece a TileSprite whose tile origin is
// its own top-left: the denim fill under the band, then the tan stitch 2px inside the fill's
// edge on the left, right, top and bottom.
export function pocketLining(section: Rect) {
  const { height, width, x, y } = section;
  const fill = sectionFill(section);
  const stitchInset = 2;
  const stitchThickness = 2;
  const stitchTop = fill.y + 1;
  const stitchBottom = y + height - 6;
  const stitchLeft = fill.x + stitchInset;
  const stitchRight = x + width - 7;
  const stitchSpanX = stitchRight + stitchThickness - stitchLeft;
  const stitchSpanY = stitchBottom + stitchThickness - stitchTop;
  return {
    denim: fill,
    stitchBottom: { height: stitchThickness, width: stitchSpanX, x: stitchLeft, y: stitchBottom },
    stitchLeft: { height: stitchSpanY, width: stitchThickness, x: stitchLeft, y: stitchTop },
    stitchRight: { height: stitchSpanY, width: stitchThickness, x: stitchRight, y: stitchTop },
    stitchTop: { height: stitchThickness, width: stitchSpanX, x: stitchLeft, y: stitchTop },
  } as const satisfies Record<string, Rect>;
}

// The home screen's geometry, in screen pixels. Each icon button is drawn at its icon spot
// and tapped anywhere in its hit area.
export const HOME_LAYOUT = {
  // The band's text sits on section rows 8..17, 9px in from either side.
  bandText: { inset: 9, y: 8 },
  // The Dogs band's pack-size bonus, its ink ending countGap left of the pack count's left edge:
  // its line, gap, then ui-heart's full frame at scale, inked over its first heartInk columns,
  // with its top rise above the text's capitals.
  bonus: { countGap: 14, gap: 4, heartInk: 7, rise: 1, scale: 2 },
  // The detail card that opens over the screen, centred and as tall as what it shows, in card
  // pixels: the paper starts 2px in, the band runs across its top 6px in with the title's caps
  // 7px below the band's top, and the well sits under the band. Rows of 2x body text, each
  // wrapped within the card less pad, rowGap between rows: a detail card's subtitle and status
  // beside the well from besideX, besideDy under its top. A locked card's padlock sits at 2x
  // over the well's top-left corner.
  card: {
    band: { height: 24, inset: 6, titleY: 7 },
    besideDy: 4,
    besideX: 90,
    pad: 12,
    padlock: { scale: 2, x: 8, y: 31 },
    rowGap: 8,
    well: { picture: 2, size: 68, x: 12, y: 36 },
    width: 300,
  },
  dogOrigin: { x: 14, y: DOGS_SECTION.y + TILE_OFFSET },
  // A dog tile's face sits face.dx and face.dy inside the drawn tile, on a box 1px wider each
  // side. Its name and a locked dog's price plate start textX in and keep padRight inside its
  // right edge. An owned dog's name has its capitals centred on the face (dogTileNameY); a
  // locked dog's "???" has its capitals lockedNameY down, and its plate's lowest ink sits
  // plateFoot above the tile's bottom (dogTilePlateY). A locked dog's padlock sits over the
  // tile's top-left corner.
  dogTile: {
    face: { dx: 4, dy: 5, size: 32 },
    lock: { dx: -2, dy: -3 },
    lockedNameY: 4,
    padRight: 3,
    plateFoot: 1,
    textX: 39,
  },
  // Each dog tile is drawn this far inside its hit area, leaving 2px between the rows.
  dogTileInset: 1,
  // The dog rows are hit areas 44 tall with no gap.
  dogTiles: { cellHeight: 44, cellWidth: 105, columns: 3, gapX: GAP, gapY: 0 },
  gap: GAP,
  gate: GATE,
  gateBar: GATE_BAR,
  // At the gate the pack spreads out around the walker, the first dog through the gate.
  gateSpots: [
    { dx: 0, footDy: -46 },
    { dx: -26, footDy: -14 },
    { dx: 26, footDy: -12 },
  ],
  gearBadge: { height: 18, width: 18, x: 194, y: 166 },
  // The top bar's four buttons at its right end, left to right: Logbook, Help, Sound and
  // Settings, under the walk bar's last four (its Help, Sound, Settings and Pause). Each is its
  // ui-icon-button face and its 34x44 hit area from the bar's top, the walk bar's hit columns,
  // side by side to the screen's edge with each face centred in its hit.
  help: { face: { x: 265, y: TOP_BAR_FACE_Y }, hit: { height: 44, width: 34, x: 258, y: 0 } },
  logbook: { face: { x: 231, y: TOP_BAR_FACE_Y }, hit: { height: 44, width: 34, x: 224, y: 0 } },
  // The logbook card's Stats and Badges buttons, side by side across its padded width.
  logbookButton: { gap: 12, height: 44, width: 132 },
  logo: { x: 6, y: 146 },
  mute: { face: { x: 299, y: TOP_BAR_FACE_Y }, hit: { height: 44, width: 34, x: 292, y: 0 } },
  path: { width: 32, x: 164 },
  // The Pet shop building on the yard's right lot, which opens the shop; its hit area is its
  // frame. board is its PET SHOP board, which the walker's bubble keeps clear of.
  petShop: {
    board: { height: 22, width: 114, x: 237, y: 86 },
    height: 108,
    width: 120,
    x: 234,
    y: 86,
  },
  // The Pocket's row of gear cells under its section's band, in the walker row's columns, each
  // drawing its tile 1px inside. In a tile: the icon box and the art in it, the padlock over its
  // top-left corner, and the price plate's caps, centred.
  pocket: {
    box: { dx: 21, dy: 3, size: 34 },
    cells: WALKER_TILES,
    icon: { dx: 22, dy: 4 },
    lock: { dx: -2, dy: -3 },
    origin: { x: WALKER_ORIGIN_X, y: POCKET_SECTION.y + POCKET_CELLS_OFFSET },
    priceY: 28,
    tileInset: 1,
  },
  pocketLining: pocketLining(POCKET_SECTION),
  porchDogOffset: { dx: -12, footDy: 3 },
  // Before the first walk the starter owners wait in the yard left of the path, behind the
  // yard sign, each with their dog at their feet. Feet positions, by dog; a starter dog with
  // no spot is not drawn.
  porchSpots: {
    biscuit: { footY: 145, x: 120 },
    duchess: { footY: 148, x: 150 },
    koda: { footY: 145, x: 92 },
  },
  // The seamless image each section's fill tiles, drawn over its tile area.
  sectionFillKeys: { dogs: "ui-plaid", pocket: "ui-denim", walker: "ui-cork" },
  // A section's 3px frame, and its band's 20 rows and 1px rule inside the frame's top.
  sectionFrame: { band: 20, edge: 3 },
  sectionGap: SECTION_GAP,
  // Under the gate, three framed sections top to bottom (walker, dogs, pocket), each a
  // heading band over its tiles; then Start walk.
  sections: {
    dogs: DOGS_SECTION,
    pocket: POCKET_SECTION,
    walker: WALKER_SECTION,
  },
  settings: {
    face: { x: 333, y: TOP_BAR_FACE_Y },
    hit: { height: 44, width: 34, x: 326, y: 0 },
  },
  // The walker's speech bubble, its top speech.top under the gate scene's: up to lines lines
  // of 2x body text a line of the font apart, padX in from its sides, the first line's
  // capitals padTop under its top and the last line's lowest ink padBottom over its bottom. It
  // keeps clearance clear of the Pet shop's board and margin inside the screen's left edge.
  speech: { clearance: 2, lines: 4, margin: GAP / 2, padBottom: 3, padTop: 4, padX: 5, top: 6 },
  startButton: START_BUTTON,
  // Start walk's label caps: on the raised face when ready, on the sunk face when not.
  startLabel: { notReadyY: 15, readyY: 12, scale: 3 },
  // The pressed face's label while the walk waits for its art: centred on the ready label's
  // caps, at its size if that fits inside the face less 12px a side, else smaller.
  startLoading: {
    room: START_BUTTON.width - 24,
    styles: [
      { letterSpacing: 0, scale: 3 },
      { letterSpacing: 0, scale: 2 },
      { letterSpacing: -0.5, scale: 2 },
    ] satisfies TextFitStyle[],
  },
  // The street name's centre and caps top on screen-home's street sign, clear of the walker's
  // speech bubble.
  streetSign: { x: 327, y: 75 },
  // A section's tiles start this far below its top.
  tileOffset: TILE_OFFSET,
  // A selected tile's ui-select frame sits 1px outside it.
  tileSelectOutset: 1,
  // The top bar: the bank in its well at the left, then plain plum, then the buttons. The well
  // (wellKey) is ink on its first well.width - lip columns and well.height - lip rows, its lip
  // on the last. The bank, the title font's "$" and amount one font advance apart, is set at the
  // largest of bank.scales whose ink fits the columns bank.ink.left to bank.ink.right (the
  // well's ink), centred across them, its capitals' top at bank.capsY by scale; past every
  // scale, its short form at the smallest.
  topBar: {
    bank: {
      capsY: { 2: 14, 3: 11 },
      ink: { left: 5, right: 73 },
      scales: [3, 2],
    },
    faceSize: TOP_BAR_FACE,
    height: TOP_BAR_HEIGHT,
    mid: TOP_BAR_MID,
    rule: TOP_BAR_RULE,
    well: { height: 28, lip: 1, width: 70, x: 5, y: 5 },
    wellKey: "ui-home-cash-well",
  },
  walkerAtGate: { footY: GATE.y + GATE.height, x: 180 },
  walkerOrigin: { x: WALKER_ORIGIN_X, y: WALKER_SECTION.y + TILE_OFFSET },
  // A walker tile: the portrait's box and the portrait in it, the walker's perk icon right of
  // the box at icons.dy (a walker has one perk), and a locked walker's padlock over
  // the tile's top-left corner and its name plate's caps, centred. An owned walker's name, in
  // the 1x body font with its ink at most name.room wide, is centred at name.x between the
  // box's right edge and the tile's last column, its caps on the plate's row. The tiles sit
  // 7px inside the section's inner frame edge, leaving the selected badge's overhang on screen.
  walkerTile: {
    box: WALKER_BOX,
    face: { dx: 4, dy: 5 },
    icons: { dx: 46, dy: [5] },
    lock: { dx: -2, dy: -3 },
    name: {
      capY: WALKER_TEXT_Y,
      room: 36,
      x: Math.round((WALKER_BOX.dx + WALKER_BOX.size + WALKER_TILES.cellWidth - 1) / 2),
    },
    plateY: WALKER_TEXT_Y,
  },
  walkerTiles: WALKER_TILES,
} as const satisfies Readonly<Record<string, unknown>> & {
  dogTiles: GridSpec;
  gateSpots: readonly PackPlacement[];
  petShop: Rect & { board: Rect };
  pocket: { readonly [key: string]: unknown; cells: GridSpec };
  porchSpots: Readonly<Partial<Record<DogId, { footY: number; x: number }>>>;
  sectionFillKeys: Readonly<Record<SectionId, string>>;
  sections: Readonly<Record<SectionId, Rect>>;
  walkerTiles: GridSpec;
};

type BankScale = (typeof HOME_LAYOUT.topBar.bank.scales)[number];

// How wide the bank's ink may be.
export const BANK_ROOM = HOME_LAYOUT.topBar.bank.ink.right + 1 - HOME_LAYOUT.topBar.bank.ink.left;

// The bank's text and scale: the first of texts (the full amount, then its short form) whose
// ink, inkWidthAt1x wide at 1x, fits BANK_ROOM at one of the bank's scales, at the largest that
// fits; else the last text at the smallest scale.
export function bankFit(
  inkWidthAt1x: (text: string) => number,
  texts: readonly string[],
): { scale: BankScale; text: string } {
  const { scales } = HOME_LAYOUT.topBar.bank;
  for (const text of texts) {
    const width = inkWidthAt1x(text);
    const scale = scales.find((each) => width * each <= BANK_ROOM);
    if (scale !== undefined) {
      return { scale, text };
    }
  }
  return { scale: scales.at(-1) ?? scales[0], text: texts[texts.length - 1] ?? "" };
}

// The bank's first ink column for ink inkWidth wide on screen: centred across its ink columns,
// a half pixel rounded left.
export function bankLeft(inkWidth: number): number {
  const { ink } = HOME_LAYOUT.topBar.bank;
  return Math.floor((ink.left + ink.right) / 2 - (inkWidth - 1) / 2);
}

// How wide a line of the walker's speech may be, as a label measures it: a bubble that wide
// fits between the screen's margin and the Pet shop's board, so it never reaches the board.
export const SPEECH_ROOM =
  HOME_LAYOUT.petShop.board.x -
  HOME_LAYOUT.speech.clearance -
  HOME_LAYOUT.speech.margin -
  2 * HOME_LAYOUT.speech.padX;

// The speech bubble's height for lines lines of 2x body text.
export function speechBubbleHeight(body: FontMetrics, lines: number): number {
  const { padBottom, padTop } = HOME_LAYOUT.speech;
  return padTop + inkRowsOfLines(body, lines) * 2 + padBottom;
}

// Rows of 2x body text from top down, each lineCounts[i] lines a line of the body font apart,
// the next row starting a row's lines and the card's rowGap under the one before: each row's
// capitals' top, the row after the last's, and the last row's lowest ink.
export function cardTextRows(
  body: FontMetrics,
  top: number,
  lineCounts: readonly number[],
): { bottom: number; next: number; tops: number[] } {
  const pitch = body.lineHeight * 2;
  let y = top;
  let bottom = top;
  const tops = lineCounts.map((lines) => {
    const at = y;
    bottom = at + inkRowsOfLines(body, lines) * 2;
    y += Math.max(1, lines) * pitch + HOME_LAYOUT.card.rowGap;
    return at;
  });
  return { bottom, next: y, tops };
}

// How wide the detail card's rows beside the well and under it, and the logbook's rows, may be.
export const CARD_TEXT_ROOM = {
  beside: HOME_LAYOUT.card.width - HOME_LAYOUT.card.besideX - HOME_LAYOUT.card.pad,
  full: HOME_LAYOUT.card.width - 2 * HOME_LAYOUT.card.pad,
} as const;

// A detail card's rows beside the well and under it, each as many lines as given, and the
// card's height: padded under whichever reaches lowest, the well or a row's ink.
export function detailCardLayout(
  body: FontMetrics,
  lineCounts: { below: readonly number[]; beside: readonly number[] },
): { below: number[]; beside: number[]; height: number } {
  const { besideDy, pad, well } = HOME_LAYOUT.card;
  const beside = cardTextRows(body, well.y + besideDy, lineCounts.beside);
  const below = cardTextRows(body, well.y + well.size + pad, lineCounts.below);
  const bottoms = [
    well.y + well.size,
    beside.bottom,
    ...(lineCounts.below.length > 0 ? [below.bottom] : []),
  ];
  return { below: below.tops, beside: beside.tops, height: Math.max(...bottoms) + pad };
}

// How wide a dog tile's name may be: from its text column to padRight inside its edge.
export const DOG_TILE_TEXT_ROOM =
  HOME_LAYOUT.dogTiles.cellWidth - HOME_LAYOUT.dogTile.textX - HOME_LAYOUT.dogTile.padRight;

// The top of an owned dog's name's capitals, from the drawn tile's top, so its 2x body
// capitals are centred on the face's middle row.
export function dogTileNameY(body: FontMetrics): number {
  const { face } = HOME_LAYOUT.dogTile;
  return face.dy + face.size / 2 - body.capHeight;
}

// The top of a locked dog tile's price plate's capitals, from the drawn tile's top, with its
// 2x body text's lowest ink plateFoot above the tile's bottom.
export function dogTilePlateY(body: FontMetrics): number {
  const height = HOME_LAYOUT.dogTiles.cellHeight - 2 * HOME_LAYOUT.dogTileInset;
  return height - HOME_LAYOUT.dogTile.plateFoot - inkRowsFromCapTop(body) * 2;
}
