import type { DogId } from "../data/types";
import type { GridSpec } from "../layout/grid";
import type { PackPlacement } from "../layout/packFormation";
import type { Rect } from "../layout/rect";
import type { SectionId } from "./sections";

// Every tappable thing is at least 44 game pixels (48 CSS pixels on a 390px-wide phone) on
// each side; tiles side by side are 8 apart.
const GAP = 8;
// The gate scene in the screen-home art: the street, the yard and the path to the gate.
const GATE = { height: 156, y: 40 };
// The top bar's content lies above its 2px bottom rule; every control is centred on the
// middle row of that area. A 16px icon is centred on its rows 7 and 8 (art centre at its
// y + 8), and text is placed by its capitals, TOP_BAR_CAPS tall, two lines TOP_BAR_LINE_GAP
// apart.
const TOP_BAR_HEIGHT = 40;
const TOP_BAR_RULE = 2;
const TOP_BAR_MID = (TOP_BAR_HEIGHT - TOP_BAR_RULE) / 2;
const TOP_BAR_ICON = 16;
const TOP_BAR_CAPS = 10;
const TOP_BAR_LINE_GAP = 6;
const TOP_BAR_ICON_Y = TOP_BAR_MID - TOP_BAR_ICON / 2;
const TOP_BAR_ONE_LINE_Y = TOP_BAR_MID - TOP_BAR_CAPS / 2;
const TOP_BAR_FIRST_LINE_Y = TOP_BAR_MID - TOP_BAR_CAPS - TOP_BAR_LINE_GAP / 2;

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
// and tapped anywhere in its 44x44 hit area.
export const HOME_LAYOUT = {
  // The band's text sits on section rows 8..17, 9px in from either side.
  bandText: { inset: 9, y: 8 },
  // The detail card that opens over the screen, in card pixels: the paper starts 2px in, the
  // band runs across its top 6px in with the title's caps 6px below the band's top, and the
  // well sits under the band.
  card: {
    band: { height: 22, inset: 6, titleY: 6 },
    pad: 12,
    well: { picture: 2, size: 68, x: 12, y: 34 },
    width: 300,
  },
  // The dog card's place on screen, and the gear card's height; the gear card is centred.
  dogCard: { height: 376, width: 300, x: 30, y: 92 },
  dogOrigin: { x: 14, y: DOGS_SECTION.y + TILE_OFFSET },
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
  gearCardHeight: 150,
  // The top bar's controls at its right end: help, sound, then settings.
  help: { hit: { height: 44, width: 44, x: 228, y: 0 }, icon: { x: 240, y: TOP_BAR_ICON_Y } },
  // The Logbook button at the bar's left, after the bank; its hit area takes in the best walk
  // and walk count beside it.
  logbook: {
    hit: { height: 44, width: 134, x: 92, y: 0 },
    icon: { x: 104, y: TOP_BAR_ICON_Y },
    textX: 130,
  },
  // The logbook card's Stats and Badges buttons, side by side across its padded width.
  logbookButton: { gap: 12, height: 44, width: 132 },
  logo: { x: 6, y: 146 },
  mute: { hit: { height: 44, width: 44, x: 272, y: 0 }, icon: { x: 284, y: TOP_BAR_ICON_Y } },
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
  // The Pocket's row of gear cells under its section's band, each drawing its tile 1px inside.
  // In a tile: the icon box and the art in it, the padlock over its top-left corner, and the
  // price plate's caps, centred.
  pocket: {
    box: { dx: 12, dy: 3, size: 34 },
    cells: { cellHeight: 44, cellWidth: 60, columns: 5, gapX: 9, gapY: 0 },
    icon: { dx: 13, dy: 4 },
    lock: { dx: -2, dy: -3 },
    origin: { x: 12, y: POCKET_SECTION.y + POCKET_CELLS_OFFSET },
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
  settings: { hit: { height: 44, width: 44, x: 316, y: 0 }, icon: { x: 328, y: TOP_BAR_ICON_Y } },
  startButton: START_BUTTON,
  // Start walk's label caps: on the raised face when ready, on the sunk face when not.
  startLabel: { notReadyY: 15, readyY: 12, scale: 3 },
  // The street name's centre and caps top on screen-home's street sign, clear of the walker's
  // speech bubble.
  streetSign: { x: 327, y: 75 },
  // A section's tiles start this far below its top.
  tileOffset: TILE_OFFSET,
  // A selected tile's ui-select frame sits 1px outside it.
  tileSelectOutset: 1,
  topBar: {
    caps: TOP_BAR_CAPS,
    // The coin at the left, the bank text after it, and the Logbook's text lines.
    coin: { x: 6, y: TOP_BAR_ICON_Y },
    height: TOP_BAR_HEIGHT,
    iconSize: TOP_BAR_ICON,
    mid: TOP_BAR_MID,
    rule: TOP_BAR_RULE,
    textY: {
      bank: TOP_BAR_ONE_LINE_Y,
      best: TOP_BAR_FIRST_LINE_Y,
      noWalks: TOP_BAR_ONE_LINE_Y,
      walks: TOP_BAR_FIRST_LINE_Y + TOP_BAR_CAPS + TOP_BAR_LINE_GAP,
    },
  },
  walkerAtGate: { footY: GATE.y + GATE.height, x: 180 },
  walkerOrigin: { x: 14, y: WALKER_SECTION.y + TILE_OFFSET },
  // A walker tile: the portrait's box and the portrait in it, the pace icon over the style
  // icon right of the box, and a locked walker's padlock over the tile's top-left corner and
  // its name plate's caps, centred. The tiles sit 7px inside
  // the section's inner frame edge, leaving the selected badge's overhang on screen.
  walkerTile: {
    box: { dx: 3, dy: 4, size: 34 },
    face: { dx: 4, dy: 5 },
    icons: { dx: 46, dy: [5, 23] },
    lock: { dx: -2, dy: -3 },
    plateY: 28,
  },
  walkerTiles: { cellHeight: 44, cellWidth: 77, columns: 4, gapX: GAP, gapY: 0 },
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
