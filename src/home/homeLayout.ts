import type { DogId } from "../data/types";
import { ownerPhotoRect, WALK_BAR, type WalkBarButtonId } from "../hud/walkHud";
import type { PackPlacement } from "../layout/packFormation";
import type { Point, Rect } from "../lib/rect";
import { type FontMetrics, helpCapDy, inkRowsFromCapTop, inkRowsOfLines } from "../ui/fontMetrics";
import type { GridSpec } from "../ui/grid";
import { BUTTON_LIP_PX } from "../ui/selection";
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
// The top bar's button in the walk bar's walkId column, its hit area from the bar's top.
function topBarButton(walkId: WalkBarButtonId) {
  const { faceX, hitWidth, hitX } = WALK_BAR.buttons[walkId];
  return {
    face: { x: faceX, y: TOP_BAR_FACE_Y },
    hit: { height: 44, width: hitWidth, x: hitX, y: 0 },
  } as const;
}

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
// The Pocket's gear cells: one per gear item on one row, across the walker row's span.
const POCKET_TILES = { cellHeight: 44, cellWidth: 60, columns: 5, gapX: GAP, gapY: 0 } as const;
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
  // beside the well from besideX, besideDy under its top. A dog's card puts its owner's photo,
  // name and role between them (detailOwner): their face-owner-<art> face (owner.face square) in
  // the walk card's photo mat and frame, then owner.gap right of the photo their name in 2x body
  // text and under it their role in 2x body text, wrapped, its capitals LABEL_HELP_GAP clear rows
  // under the body font's lowest ink (helpCapDy). The name is in owner.nameColour: plum, where
  // the walk card's name is tan, because this card's paper is cream and the walk card's is navy;
  // the role is in owner.roleColour.
  card: {
    band: { height: 24, inset: 6, titleY: 7 },
    besideDy: 4,
    besideX: 90,
    owner: { face: 32, gap: 6, nameColour: "plum", roleColour: "darkBrown" },
    pad: 12,
    rowGap: 8,
    well: { picture: 2, size: 68, x: 12, y: 36 },
    width: 300,
  },
  dogOrigin: { x: 14, y: DOGS_SECTION.y + TILE_OFFSET },
  // A dog tile's face sits face.dx and face.dy inside the drawn tile, on a box 1px wider each
  // side. Its name and a locked dog's price plate start textX in and keep padRight inside its
  // right edge. An owned dog's name has its capitals centred on the face (dogTileNameY); a
  // locked dog's name has its capitals lockedNameY down, and its plate's lowest ink sits
  // plateFoot above the tile's bottom (dogTilePlateY). A locked dog's badge sits over the
  // tile's top-left corner.
  dogTile: {
    badge: { dx: -2, dy: -3 },
    face: { dx: 4, dy: 5, size: 32 },
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
  help: topBarButton("sound"),
  logbook: topBarButton("help"),
  mute: topBarButton("settings"),
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
  // The Pocket's row of gear cells under its section's band, across the walker row's span, each
  // drawing its tile 1px inside. In a tile: the icon box and the art in it, the badge over its
  // top-left corner, and the price plate's caps, centred.
  pocket: {
    badge: { dx: -2, dy: -3 },
    box: { dx: 12, dy: 3, size: 34 },
    cells: POCKET_TILES,
    icon: { dx: 13, dy: 4 },
    origin: { x: WALKER_ORIGIN_X, y: POCKET_SECTION.y + POCKET_CELLS_OFFSET },
    priceY: 28,
    tileInset: 1,
  },
  pocketLining: pocketLining(POCKET_SECTION),
  porchDogOffset: { dx: -12, footDy: 3 },
  // Before the first walk the starter dog's owner waits in the yard left of the path, behind
  // the yard sign, with their dog at their feet. Feet positions, by dog; a starter dog with no
  // spot is not drawn.
  porchSpots: {
    archie: { footY: 145, x: 120 },
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
  settings: topBarButton("pause"),
  // The dog slot sign hung from the Pet shop's awning across its front: its art (key, with
  // normal and pressed tags) drawn at art, its board inside the frame, and its gold outline 2px
  // outside the board. The board's cream lies inside its frame, lit top row and shaded bottom
  // row (boardEdge). Its call to buy (in headColour) and the cheapest slot's price (in priceColour
  // while affordable) are body text at scale, linePitch apart, centred on the cream
  // (slotSignText); pressed, the board drops pressDrop on longer cords and the text with it. The
  // hit area is the board widened to 44 tall.
  slotSign: {
    art: { x: 255, y: 120 },
    board: { height: 24, width: 79, x: 256, y: 125 },
    boardEdge: { frame: 1, lit: 1, shade: 1 },
    headColour: "plum",
    hit: { height: 44, width: 79, x: 256, y: 115 },
    key: "ui-slot-sign",
    linePitch: 9,
    pressDrop: 1,
    priceColour: "forest",
    scale: 1,
  },
  // The walker's speech bubble, its top speech.top under the gate scene's, growing down to hold
  // every line it says of 2x body text a line of the font apart, padX in from its sides, the
  // first line's capitals padTop under its top and the last line's lowest ink padBottom over its
  // bottom. It keeps clearance clear of the Pet shop's board and margin inside the screen's left
  // edge.
  // An owner's parting line has the owner's column at its right, inset from the bubble's right
  // edge and gap right of the text, as wide as the owner's size square face or their name's
  // 1x ink, whichever is wider: the face, framed in 1px of ink over tan, centred in it top
  // under the bubble's top, and the name in rust centred under it, its capitals nameGap under
  // the face. The text then wraps roomCut narrower than the column, and the bubble is at least
  // foot taller than the face, with the text centred down it.
  speech: {
    clearance: 2,
    margin: GAP / 2,
    owner: { foot: 18, gap: 6, inset: 3, nameGap: 3, roomCut: 4, size: 32, top: 4 },
    padBottom: 3,
    padTop: 4,
    padX: 5,
    top: 6,
  },
  startButton: START_BUTTON,
  // Start walk's label caps on its raised face; the label sinks with the face.
  startLabel: { readyY: 12, scale: 3 },
  // The pressed face's label while the walk waits for its art: the ready label's, at its size
  // on its caps, inside the face less 12px a side.
  startLoading: { room: START_BUTTON.width - 24 },
  // The street name's centre and caps top on screen-home's street sign, clear of the walker's
  // speech bubble.
  streetSign: { x: 327, y: 75 },
  // A section's tiles start this far below its top.
  tileOffset: TILE_OFFSET,
  // A selected tile's ui-select frame sits 1px outside it.
  tileSelectOutset: 1,
  // The top bar: the bank in its well at the left, then plain plum, then the buttons. The well
  // is as wide as the bank needs (bankWell), at most well.maxWidth, drawn from wellKeys: its left
  // column, the middle column repeated, and its right column. It is ink on its first
  // well.height - lip rows, its lip on the last. The bank, the title font's "$" and amount one
  // font advance apart, is set at bank.scale in full with thousands separated (bankAmountText),
  // its ink bank.pad columns in from the well's left, its capitals' top at bank.capsY.
  topBar: {
    bank: { capsY: 11, pad: 3, scale: WALK_BAR.cash.scale },
    faceSize: TOP_BAR_FACE,
    height: TOP_BAR_HEIGHT,
    mid: TOP_BAR_MID,
    rule: TOP_BAR_RULE,
    well: { height: 28, lip: 1, maxWidth: 220, x: 5, y: 5 },
    wellKeys: {
      left: "ui-home-cash-well-left",
      mid: "ui-home-cash-well-mid",
      right: "ui-home-cash-well-right",
    },
  },
  // The update plate under the top bar while a newer version waits: a ui-panel across the gate
  // scene's top, over the street sign and clear of the Pet shop's board, in place of the
  // walker's bubble. On one row: iconKey's 16x16 icon at icon.x, the title in 2x title text in
  // titleColour, its ink starting at titleX, and the ui-button's go look at button with its
  // label, centred, at least labelPad inside either side. The label's capitals are centred on the
  // button's face (the button less its lip), the title's share their row, and the icon is
  // centred on that row (updatePlateText). The tap area is hit.
  updatePlate: {
    button: { height: 28, width: 128, x: 218, y: 49 },
    hit: { height: 44, width: 128, x: 218, y: 41 },
    icon: { size: 16, x: 14 },
    iconKey: "icon-update",
    labelPad: 8,
    panel: { height: 44, width: 352, x: 4, y: 41 },
    titleColour: "plum",
    titleX: 36,
  },
  walkerAtGate: { footY: GATE.y + GATE.height, x: 180 },
  walkerOrigin: { x: WALKER_ORIGIN_X, y: WALKER_SECTION.y + TILE_OFFSET },
  // A walker tile: the portrait's box and the portrait in it, the walker's perk icon right of
  // the box at icons.dy (a walker has one perk), a locked walker's badge over the tile's
  // top-left corner, and every walker's name plate, its caps at plateY, centred. The tiles sit
  // 7px inside the section's inner frame edge, leaving the selected mark's overhang on screen.
  walkerTile: {
    badge: { dx: -2, dy: -3 },
    box: WALKER_BOX,
    face: { dx: 4, dy: 5 },
    icons: { dx: 46, dy: [5] },
    plateY: WALKER_TEXT_Y,
  },
  walkerTiles: WALKER_TILES,
  // The yard sign's board, baked into screen-home, which the dog slot sign keeps clear of.
  yardSign: { height: 38, width: 128, x: 6, y: 138 },
} as const satisfies Readonly<Record<string, unknown>> & {
  dogTiles: GridSpec;
  gateSpots: readonly PackPlacement[];
  petShop: Rect & { board: Rect };
  pocket: { readonly [key: string]: unknown; cells: GridSpec };
  porchSpots: Readonly<Partial<Record<DogId, { footY: number; x: number }>>>;
  sectionFillKeys: Readonly<Record<SectionId, string>>;
  sections: Readonly<Record<SectionId, Rect>>;
  slotSign: { readonly [key: string]: unknown; board: Rect; hit: Rect };
  updatePlate: { readonly [key: string]: unknown; button: Rect; hit: Rect; panel: Rect };
  walkerTiles: GridSpec;
  yardSign: Rect;
};

// How wide the bank's ink may be: the widest well less its padding.
export const BANK_ROOM = HOME_LAYOUT.topBar.well.maxWidth - 2 * HOME_LAYOUT.topBar.bank.pad;

// The bank's well for its ink inkWidth wide on screen: bank.pad columns either side of the ink,
// at most well.maxWidth wide.
export function bankWell(inkWidth: number): Rect {
  const { bank, well } = HOME_LAYOUT.topBar;
  const width = Math.min(well.maxWidth, inkWidth + 2 * bank.pad);
  return { height: well.height, width, x: well.x, y: well.y };
}

// Which of the bank's texts, without its "$", it shows: full, the amount with thousands
// separated, where "$" and it at bank.scale fit BANK_ROOM as inkWidthAt1x measures them at 1x,
// else short, its short form.
export function bankAmountText(
  inkWidthAt1x: (text: string) => number,
  texts: { full: string; short: string },
): string {
  const fits = inkWidthAt1x(`$${texts.full}`) * HOME_LAYOUT.topBar.bank.scale <= BANK_ROOM;
  return fits ? texts.full : texts.short;
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

// The owner's row on a dog's card, with its role on roleLines lines.
export interface OwnerRow {
  readonly roleLines: number;
}

// A detail card row: its lines of 2x body text, or the owner's row.
export type DetailRow = number | OwnerRow;

// The rows from the owner's name's capitals to their role's lowest ink, the role on roleLines
// lines.
function ownerTextRows(body: FontMetrics, roleLines: number): number {
  return helpCapDy(body, 2) + inkRowsOfLines(body, roleLines) * 2;
}

// How tall the owner's row is, its role on roleLines lines: the photo or the text beside it,
// whichever is taller.
export function detailOwnerHeight(body: FontMetrics, roleLines: number): number {
  const photo = ownerPhotoRect(HOME_LAYOUT.card.owner.face, { x: 0, y: 0 });
  return Math.max(photo.height, ownerTextRows(body, roleLines));
}

// The owner's photo, name and role on a dog's card, the row's top-left at at, the role on
// roleLines lines: the photo, the face inside it, the name's left edge and capitals' top, and
// the role's first line's capitals' top and line pitch. The photo and the text from the name's
// capitals to the role's lowest ink are each centred down the row (detailOwnerHeight), any odd
// row left under them, so the shorter sits centred on the taller.
export function detailOwner(
  body: FontMetrics,
  at: Point,
  roleLines: number,
): { face: Point; name: Point; photo: Rect; role: Point & { pitch: number } } {
  const { face, gap } = HOME_LAYOUT.card.owner;
  const height = detailOwnerHeight(body, roleLines);
  const probe = ownerPhotoRect(face, { x: 0, y: 0 });
  const photo = { ...probe, x: at.x, y: at.y + Math.floor((height - probe.height) / 2) };
  const x = photo.x + photo.width + gap;
  const nameY = at.y + Math.floor((height - ownerTextRows(body, roleLines)) / 2);
  return {
    face: { x: photo.x - probe.x, y: photo.y - probe.y },
    name: { x, y: nameY },
    photo,
    role: {
      pitch: body.lineHeight * 2,
      x,
      y: nameY + helpCapDy(body, 2),
    },
  };
}

// Rows from top down, the next starting as far under a row's lowest ink as one line of 2x body
// text starts under the last (a line of the font and the card's rowGap past its capitals): each
// row's top (its capitals', or the owner's photo's), and the last row's lowest ink.
function cardRows(
  body: FontMetrics,
  top: number,
  rows: readonly DetailRow[],
): { bottom: number; tops: number[] } {
  const inkGap = body.lineHeight * 2 + HOME_LAYOUT.card.rowGap - inkRowsFromCapTop(body) * 2;
  let y = top;
  let bottom = top;
  const tops = rows.map((row) => {
    const at = y;
    bottom =
      at +
      (typeof row === "number"
        ? inkRowsOfLines(body, row) * 2
        : detailOwnerHeight(body, row.roleLines));
    y = bottom + inkGap;
    return at;
  });
  return { bottom, tops };
}

// The title band across the top of a card drawn as the detail card is, card.band.inset inside
// its top and sides.
export function cardBand(card: Rect): Rect {
  const { height, inset } = HOME_LAYOUT.card.band;
  return { height, width: card.width - 2 * inset, x: card.x + inset, y: card.y + inset };
}

const BESIDE_ROOM = HOME_LAYOUT.card.width - HOME_LAYOUT.card.besideX - HOME_LAYOUT.card.pad;

// How wide the detail card's rows beside the well and under it may be, and the owner's name
// right of their photo.
export const CARD_TEXT_ROOM = {
  beside: BESIDE_ROOM,
  full: HOME_LAYOUT.card.width - 2 * HOME_LAYOUT.card.pad,
  ownerName:
    BESIDE_ROOM -
    ownerPhotoRect(HOME_LAYOUT.card.owner.face, { x: 0, y: 0 }).width -
    HOME_LAYOUT.card.owner.gap,
} as const;

// A detail card's rows beside the well and under it, and the card's height. The rows under the
// well start pad under whichever reaches lowest, the well or the rows beside it, and the card
// is padded under the lowest of all.
export function detailCardLayout(
  body: FontMetrics,
  rows: { below: readonly DetailRow[]; beside: readonly DetailRow[] },
): { below: number[]; beside: number[]; height: number } {
  const { besideDy, pad, well } = HOME_LAYOUT.card;
  const beside = cardRows(body, well.y + besideDy, rows.beside);
  const upper = Math.max(well.y + well.size, beside.bottom);
  const below = cardRows(body, upper + pad, rows.below);
  const bottom = rows.below.length > 0 ? below.bottom : upper;
  return { below: below.tops, beside: beside.tops, height: bottom + pad };
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

// The dog slot sign's cream inside its board's frame and lit and shaded rows, and where its two
// lines go: each line's ink centred on the cream's middle column, the block from the call's
// capitals to the price's lowest ink centred down the cream, any odd row left under it.
export function slotSignText(body: FontMetrics): {
  cream: Rect;
  headCapY: number;
  priceCapY: number;
  x: number;
} {
  const { board, boardEdge, linePitch, scale } = HOME_LAYOUT.slotSign;
  const { frame, lit, shade } = boardEdge;
  const cream = {
    height: board.height - 2 * frame - lit - shade,
    width: board.width - 2 * frame,
    x: board.x + frame,
    y: board.y + frame + lit,
  };
  const block = linePitch + inkRowsFromCapTop(body) * scale;
  const headCapY = cream.y + Math.floor((cream.height - block) / 2);
  return { cream, headCapY, priceCapY: headCapY + linePitch, x: cream.x + cream.width / 2 };
}

// How wide the update plate's title and button label may be: the title from titleX to GAP
// short of the button, the label inside the button less labelPad either side.
export const UPDATE_PLATE_ROOM = {
  label: HOME_LAYOUT.updatePlate.button.width - 2 * HOME_LAYOUT.updatePlate.labelPad,
  title: HOME_LAYOUT.updatePlate.button.x - GAP - HOME_LAYOUT.updatePlate.titleX,
} as const;

// The update plate's row, from the 2x title font's metrics: the capitals' top for the title
// and the button's label, centred on the button's face, and the icon's top, centred on the
// capitals.
export function updatePlateText(title: FontMetrics): { capY: number; iconY: number } {
  const { button, icon } = HOME_LAYOUT.updatePlate;
  const caps = title.capHeight * 2;
  const capY = button.y + Math.floor((button.height - BUTTON_LIP_PX - caps) / 2);
  return { capY, iconY: capY + Math.floor((caps - icon.size) / 2) };
}
