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
  dogOrigin: { x: 4, y: 294 },
  // Each dog tile is drawn this far inside its hit area, leaving 2px between the rows.
  dogTileInset: 1,
  // The dog rows are hit areas 44 tall with no gap.
  dogTiles: { cellHeight: 44, cellWidth: 112, columns: 3, gapX: GAP, gapY: 0 },
  gap: GAP,
  gate: GATE,
  // At the gate the pack spreads out around the walker, the first dog through the gate.
  gateSpots: [
    { dx: 0, footDy: -46 },
    { dx: -26, footDy: -14 },
    { dx: 26, footDy: -12 },
  ],
  gearBadge: { height: 18, width: 18, x: 194, y: 166 },
  gearCardHeight: 150,
  // The top bar's controls at its right end: help, sound, then settings.
  help: { hit: { height: 44, width: 44, x: 228, y: 0 }, icon: { x: 240, y: 10 } },
  // The Logbook button at the bar's left, after the bank; its hit area takes in the best walk
  // and walk count beside it.
  logbook: {
    hit: { height: 44, width: 134, x: 92, y: 0 },
    icon: { x: 104, y: 10 },
    textX: 130,
  },
  // The logbook card's Stats and Badges buttons, side by side across its padded width.
  logbookButton: { gap: 12, height: 44, width: 132 },
  logo: { x: 6, y: 146 },
  mute: { hit: { height: 44, width: 44, x: 272, y: 0 }, icon: { x: 284, y: 10 } },
  // The padlock on the Dogs band while a dog slot is for sale, left of the pack count, which
  // moves left to make room; it opens the shop on the next slot. Its hit area reaches up
  // into the walker section's empty right end.
  packLock: {
    hit: { height: 44, width: 44, x: 316, y: 250 },
    icon: { dx: -16, y: 274 },
    noteShift: 20,
  },
  path: { width: 32, x: 164 },
  // The Pet shop building on the yard's right lot, which opens the shop; its hit area is its
  // frame. board is its PET SHOP board, which the walker's bubble keeps clear of.
  petShop: {
    board: { height: 19, width: 61, x: 263, y: 90 },
    height: 104,
    width: 120,
    x: 234,
    y: 90,
  },
  // The Pocket strip on the wood under the Dogs section, with no frame: its title and note,
  // a row of gear cells, each drawing its tile 1px inside, and the effect line under them.
  // In a tile: the icon box and the art in it, the padlock over its top-left corner, and the
  // price plate's caps, centred.
  pocket: {
    box: { dx: 14, dy: 3, size: 34 },
    cells: { cellHeight: 44, cellWidth: 64, columns: 5, gapX: GAP, gapY: 0 },
    effect: { maxWidth: 352, x: 4, y: 499 },
    icon: { dx: 15, dy: 4 },
    lock: { dx: -2, dy: -3 },
    note: { x: 356, y: 434 },
    origin: { x: 4, y: 450 },
    priceY: 28,
    tileInset: 1,
    title: { x: 4, y: 434 },
  },
  porchDogOffset: { dx: -12, footDy: 3 },
  // Before the first walk the starter owners wait in the yard left of the path, behind the
  // yard sign, each with their dog at their feet. Feet positions, by dog; a starter dog with
  // no spot is not drawn.
  porchSpots: {
    biscuit: { footY: 145, x: 120 },
    duchess: { footY: 148, x: 150 },
    koda: { footY: 145, x: 92 },
  },
  // A section's 3px frame, and its band's 20 rows and 1px rule inside the frame's top.
  sectionFrame: { band: 20, edge: 3 },
  // Under the gate, two framed sections top to bottom (walker, dogs), each a heading band
  // over its tiles; then the Pocket strip and Start walk.
  sections: {
    dogs: { height: 160, width: 360, x: 0, y: 270 },
    walker: { height: 72, width: 360, x: 0, y: 198 },
  },
  settings: { hit: { height: 44, width: 44, x: 316, y: 0 }, icon: { x: 328, y: 10 } },
  startButton: { height: 44, width: 352, x: 4, y: 514 },
  // Start walk's label caps: on the raised face when ready, on the sunk face when not.
  startLabel: { notReadyY: 15, readyY: 12, scale: 3 },
  // The street name's centre and caps top on screen-home's street sign, clear of the walker's
  // speech bubble.
  streetSign: { x: 327, y: 75 },
  // A selected tile's ui-select frame sits 1px outside it.
  tileSelectOutset: 1,
  topBar: { height: 40 },
  walkerAtGate: { footY: GATE.y + GATE.height, x: 180 },
  walkerOrigin: { x: 80, y: 223 },
  walkerTiles: { cellHeight: 44, cellWidth: 44, columns: 4, gapX: GAP, gapY: 0 },
} as const satisfies Readonly<Record<string, unknown>> & {
  dogTiles: GridSpec;
  gateSpots: readonly PackPlacement[];
  petShop: Rect & { board: Rect };
  pocket: { readonly [key: string]: unknown; cells: GridSpec };
  porchSpots: Readonly<Partial<Record<DogId, { footY: number; x: number }>>>;
  sections: Readonly<Record<SectionId, Rect>>;
  walkerTiles: GridSpec;
};
