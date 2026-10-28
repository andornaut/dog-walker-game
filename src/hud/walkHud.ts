import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DebuffId, DogId, GameData } from "../data/types";
import type { ScreenLayout } from "../layout/screenLayout";
import { fillNames } from "../lib/lines";
import { clamp01 } from "../lib/numbers";
import { containsPoint, insetRect, type Point, type Rect } from "../lib/rect";
import { walkLength } from "../rules/route";
import { zoneLength } from "../runner/walk";
import type { RunState } from "../state/runState";
import { maxEffects } from "./effectIcons";
import { heartRows } from "./hudView";

// The walk screen's HUD: the walk bar (ui-walk-bar) across the top, a full-width bar per active
// debuff under it, a card per dog slot along the bottom and the neighbourhood's progress line
// under the cards. Every position is the art's, in screen pixels from the bar's top-left
// corner, the debuff bar's or the card's; text y is the top of the capitals.

// The walk bar's buttons, left to right.
export const WALK_BAR_BUTTONS = ["help", "sound", "settings", "pause"] as const;
export type WalkBarButtonId = (typeof WALK_BAR_BUTTONS)[number];

// The cash well's ink columns, which the home top bar's bank well shares.
const CASH_INK = { left: 5, right: 73 } as const;

// The most effects a walk can have, one well each: the walker's perk, the Pocket's gear, the
// found gear and an upgrade from each fork.
export const EFFECT_WELLS = maxEffects(gameData);

// The left edge of a section width wide set between left and right (the first column past the
// section before it and the first of the section after it) with an equal gap on either side,
// an odd leftover column going to the gap on its right.
export function evenGapLeft(left: number, right: number, width: number): number {
  return left + Math.floor((right - left - width) / 2);
}

// The walk bar's three sections, left to right: the cash well, the neighbourhood column (its
// well over the effect wells) and the buttons. The cash well and the buttons keep their places
// at the bar's ends, and the neighbourhood column sits evenly between the cash well's right
// edge and the first button's face. The column is its contents (the neighbourhood's text line,
// ZONE_LINE.width wide, over the effect wells side by side) with NEIGHBOURHOOD_PADDING columns
// either side, which the neighbourhood well spans.
const CASH_WELL = { height: 37, width: 70, x: 5, y: 5 } as const;
const BUTTONS = {
  help: { faceX: 231, hitWidth: 34, hitX: 224 },
  pause: { faceX: 333, hitWidth: 34, hitX: 326 },
  settings: { faceX: 299, hitWidth: 34, hitX: 292 },
  sound: { faceX: 265, hitWidth: 34, hitX: 258 },
} as const satisfies Readonly<
  Record<WalkBarButtonId, { faceX: number; hitWidth: number; hitX: number }>
>;
const EFFECT_ROW = { holdInset: 1, icon: 1, iconSize: 20, pitch: 22, size: 22, y: 20 } as const;
const ZONE_LINE = { height: 12, width: 132, y: 5 } as const;
const NEIGHBOURHOOD_PADDING = 4;
const NEIGHBOURHOOD_WIDTH =
  Math.max(ZONE_LINE.width, (EFFECT_WELLS - 1) * EFFECT_ROW.pitch + EFFECT_ROW.size) +
  2 * NEIGHBOURHOOD_PADDING;
const NEIGHBOURHOOD_X = evenGapLeft(
  CASH_WELL.x + CASH_WELL.width,
  BUTTONS[WALK_BAR_BUTTONS[0]].faceX,
  NEIGHBOURHOOD_WIDTH,
);

// The walk bar as ui-walk-bar draws it, in bar pixels; every position the HUD uses comes from
// this table. buttons: each button's face x and its hit area's x and width, the hit areas the
// bar's full height and minHitWidth wide or more (narrower than a 44px square, so four fit beside
// six effect wells), side by side to the bar's right edge, each face buttonFace.size square on
// row buttonFace.y, centred in its hit area. cash:
// the "$" and the amount at the largest of scales whose ink fits room, centred across the well's
// ink columns (ink.left to ink.right), their capitals' bottom on capsBottom. zone: the
// neighbourhood well on one text line, the name from name.x and "n of N" right-aligned to end on
// column progress.right, at least textGap apart.
// effects: a well of size at pitch from x along y for every effect a walk can have
// (EFFECT_WELLS), each icon iconSize at icon,icon in its well; the holds run side by side from
// holdInset left of the first well up to the first button, each from its well's left edge, down
// to the bar's bottom. The neighbourhood well spans the neighbourhood column, and the effect
// wells start the column's padding in from its left edge; the name starts 3 columns past the
// padding, and the count ends 5 columns before it on the right.
export const WALK_BAR = {
  buttonFace: { size: 20, y: 14 },
  buttons: BUTTONS,
  cash: {
    capsBottom: 30,
    ink: CASH_INK,
    room: 69,
    scales: [3, 2, 1],
    well: CASH_WELL,
  },
  effects: { ...EFFECT_ROW, x: NEIGHBOURHOOD_X + NEIGHBOURHOOD_PADDING },
  minHitWidth: 34,
  zone: {
    name: { x: NEIGHBOURHOOD_X + NEIGHBOURHOOD_PADDING + 3, y: 8 },
    progress: { right: NEIGHBOURHOOD_X + NEIGHBOURHOOD_WIDTH - NEIGHBOURHOOD_PADDING - 5, y: 8 },
    textGap: 4,
    well: {
      height: ZONE_LINE.height,
      width: NEIGHBOURHOOD_WIDTH,
      x: NEIGHBOURHOOD_X,
      y: ZONE_LINE.y,
    },
  },
} as const;

// A spare treat held shows as the road's smallest treat, size square, in the bottom-right
// corner of its gear's effect well, inset pixels in from the well's edges.
export const SPARE_TREAT_PIP = { inset: 1, size: 12 } as const;

// The top-left of the spare treat pip in well.
export function spareTreatPipAt(well: Rect): Point {
  const { inset, size } = SPARE_TREAT_PIP;
  return { x: well.x + well.width - inset - size, y: well.y + well.height - inset - size };
}

// The walk's place beside the neighbourhood's name: the zone at zoneIndex's number of the walk's.
export function zoneProgressText(
  data: Pick<GameData, "runText" | "world">,
  zoneIndex: number,
): string {
  const total = String(walkLength(data));
  return fillNames(data.runText.zoneProgress, { n: String(zoneIndex + 1), total });
}

// The title font's capitals are this many rows tall at 1x.
export const TITLE_CAP_ROWS = 5;

// A button's face and its hit area.
export interface BarButton {
  face: Point;
  hit: Rect;
}

interface WalkBarLayout {
  buttons: Readonly<Record<WalkBarButtonId, BarButton>>;
  // Each effect well, left to right, and the press area that holds it: the well's column of
  // the bar, from the neighbourhood well's top to the bar's bottom.
  effectHolds: Rect[];
  effectWells: Rect[];
  zoneWell: Rect;
}

// The walk bar's parts on screen, for the bar at bar with wells effect wells.
export function walkBarLayout(bar: Rect, wells = EFFECT_WELLS): WalkBarLayout {
  const { buttonFace, effects, zone } = WALK_BAR;
  const at = (point: Point): Point => ({ x: bar.x + point.x, y: bar.y + point.y });
  const buttons = Object.fromEntries(
    WALK_BAR_BUTTONS.map((id) => {
      const { faceX, hitWidth, hitX } = WALK_BAR.buttons[id];
      const hit = { height: bar.height, width: hitWidth, x: bar.x + hitX, y: bar.y };
      return [id, { face: at({ x: faceX, y: buttonFace.y }), hit }];
    }),
  ) as Record<WalkBarButtonId, BarButton>;
  const zoneWell = { ...zone.well, ...at(zone.well) };
  const effectWells = Array.from({ length: wells }, (_, i) => ({
    ...at({ x: effects.x + i * effects.pitch, y: effects.y }),
    height: effects.size,
    width: effects.size,
  }));
  const firstHit = buttons[WALK_BAR_BUTTONS[0]].hit;
  const starts = effectWells.map((well, i) => (i === 0 ? well.x - effects.holdInset : well.x));
  const effectHolds = starts.map((x, i) => ({
    height: bar.y + bar.height - zoneWell.y,
    width: (starts[i + 1] ?? firstHit.x) - x,
    x,
    y: zoneWell.y,
  }));
  return { buttons, effectHolds, effectWells, zoneWell };
}

// The largest of the cash's scales at which text measuring widthAt1x fits its room, else the
// smallest.
export function cashScale(widthAt1x: number): number {
  const { room, scales } = WALK_BAR.cash;
  return scales.find((scale) => widthAt1x * scale <= room) ?? scales[scales.length - 1] ?? 1;
}

// The first ink column of the cash, or the home top bar's bank, for ink inkWidth wide on
// screen: centred across the well's ink, a half pixel rounded left.
export function cashLeft(inkWidth: number): number {
  return Math.floor((CASH_INK.left + CASH_INK.right) / 2 - (inkWidth - 1) / 2);
}

// The top of the cash's capitals at scale, so their bottom row is the same at every scale.
export function cashTop(scale: number): number {
  return WALK_BAR.cash.capsBottom + 1 - TITLE_CAP_ROWS * scale;
}

// A debuff bar (ui-debuff-bar, 360x16): its icon, its name up to name.room wide, and the fill
// draining from fill.width as its seconds run out.
export const DEBUFF_BAR = {
  fill: { height: 5, width: 286, x: 69, y: 5 },
  height: 16,
  icon: { x: 4, y: 0 },
  name: { room: 40, x: 24, y: 5 },
} as const;

// The bars of count debuffs, under the walk bar, in the order the debuffs began.
export function debuffBarRects(bar: Rect, count: number): Rect[] {
  return Array.from({ length: count }, (_, i) => ({
    height: DEBUFF_BAR.height,
    width: bar.width,
    x: bar.x,
    y: bar.y + bar.height + i * DEBUFF_BAR.height,
  }));
}

// The fill's width with secondsLeft of seconds to go.
export function debuffFillWidth(secondsLeft: number, seconds: number): number {
  const share = seconds > 0 ? clamp01(secondsLeft / seconds) : 0;
  return Math.round(DEBUFF_BAR.fill.width * share);
}

// The neighbourhood's progress line on the screen's last rows, under the dog cards (the
// screen's zoneProgress strip): a track the screen's full width in a border on every side, and
// a fill that grows left to right in whole pixels with the share of the neighbourhood walked, a
// row per fill colour, top to bottom. The strip is the borders and the fill's rows tall. Each
// colour is a PALETTE name the scene draws it in.
export const ZONE_PROGRESS = {
  border: 1,
  colours: {
    border: "ink",
    fill: ["yellow", "amber"],
    track: "darkSlate",
  },
} as const;

type ZoneFillColour = (typeof ZONE_PROGRESS.colours.fill)[number];

// The share of the neighbourhood walked, from 0 at its start to 1 where the walk ends it.
export function zoneShare(
  data: Pick<GameData, "tuning">,
  run: Pick<RunState, "zoneDistance">,
): number {
  const length = zoneLength(data);
  return length > 0 ? clamp01(run.zoneDistance / length) : 0;
}

interface ZoneProgressLayout {
  // The line, its border included.
  frame: Rect;
  // The fill's rows, top to bottom, each in its fill colour.
  fills: (Rect & { colour: ZoneFillColour })[];
  track: Rect;
}

// The progress line in strip with share of the neighbourhood walked: the fill as wide as the
// whole pixels of the track that share covers, so it is full only at the neighbourhood's end.
export function zoneProgressLayout(strip: Rect, share: number): ZoneProgressLayout {
  const { border, colours } = ZONE_PROGRESS;
  const frame = strip;
  const track = insetRect(border, frame);
  const width = Math.floor(track.width * clamp01(share));
  const rowHeight = track.height / colours.fill.length;
  const fills = colours.fill.map((colour, i) => ({
    colour,
    height: rowHeight,
    width,
    x: track.x,
    y: track.y + i * rowHeight,
  }));
  return { fills, frame, track };
}

// A dog card (ui-dog-card, the size of a slot in the card row). The name is centred on name.x
// at the largest of its scales that fits name.room, its top by scale. The owner's photo heads
// the column right of the dog's, their face (face.size square) at owner.face on every card with
// a dog, a fired dog's included, inside the card art's photo: its white mat and ink frame, each
// photo's pixels wide, round the face. Their name goes beside it in the body font at scale from
// owner.x within owner.room, on one line or broken onto two (ownerNameLines). The hearts sit under the owner's photo in
// rows of perRow, pitch apart. The LEAD tag is pinned across the foot of the front dog's photo,
// and FIRED is centred on fired.x across a fired dog's empty photo. An owned slot with no dog
// shows "Empty" centred on empty.x in its outline.
export const DOG_CARD = {
  dogFace: { x: 8, y: 25 },
  empty: { x: 60, y: 33 },
  fired: { x: 24, y: 38 },
  hearts: { perRow: 6, pitch: 9, x: 45, y: 52 },
  lead: { x: 10, y: 54 },
  name: { room: 108, tops: { 1: 6, 2: 4 }, x: 60 },
  owner: {
    face: { size: 20, x: 47, y: 25 },
    photo: { frame: 1, mat: 1 },
    room: 41,
    scale: 1,
    tops: { oneLine: 32, twoLines: [27, 37] },
    x: 72,
  },
  size: {
    height: SCREEN_CONFIG.dogCardHeight,
    width: SCREEN_CONFIG.width / SCREEN_CONFIG.dogSlotCount,
  },
} as const;

interface CardLine {
  text: string;
  // The top of the line's capitals, from the card's top.
  top: number;
}

// The owner's photo round their size-square face, its top-left at face: the face inside the
// walk card's mat and frame.
export function ownerPhotoRect(size: number, face: Point): Rect {
  const { photo } = DOG_CARD.owner;
  const outset = photo.frame + photo.mat;
  const side = size + 2 * outset;
  return { height: side, width: side, x: face.x - outset, y: face.y - outset };
}

// The owner's name in the body font at owner.scale: one line when its right edge, as rightEdge measures a
// line from its left, fits owner.room, else broken at its first space onto two lines. A name too
// wide with no space stays on one line.
export function ownerNameLines(rightEdge: (line: string) => number, name: string): CardLine[] {
  const { room, tops } = DOG_CARD.owner;
  const space = name.indexOf(" ");
  if (rightEdge(name) <= room || space < 0) {
    return [{ text: name, top: tops.oneLine }];
  }
  const [first, second] = tops.twoLines;
  return [
    { text: name.slice(0, space), top: first },
    { text: name.slice(space + 1), top: second },
  ];
}

interface CardHeart extends Point {
  full: boolean;
}

// The card's hearts, the first `hearts` of max full, from the card's top-left corner.
export function cardHearts(hearts: number, max: number): CardHeart[] {
  const { perRow, pitch, x, y } = DOG_CARD.hearts;
  return heartRows(perRow, hearts, max).flatMap((row, rowIndex) =>
    row.map((full, column) => ({ full, x: x + column * pitch, y: y + rowIndex * pitch })),
  );
}

// The scale every card's name shares, from each name's width at 1x: 2x when every name fits,
// else 1x, with the top of the capitals.
export function cardNameFit(widthsAt1x: readonly number[]): { scale: 1 | 2; top: number } {
  const { room, tops } = DOG_CARD.name;
  const scale = widthsAt1x.every((width) => width * 2 <= room) ? 2 : 1;
  return { scale, top: tops[scale] };
}

// The card the LEAD tag is on: the first dog still walking.
export function leadSlot(walking: readonly boolean[]): number | undefined {
  const index = walking.indexOf(true);
  return index < 0 ? undefined : index;
}

// The owner's photo tab (ui-owner-tab, 36x36) pops in centred on a card's top edge, the owner's
// face face pixels inside it.
export const OWNER_TAB = {
  face: 2,
  size: 36,
  x: 42,
  y: -34,
} as const;

export function ownerTabRect(card: Pick<Rect, "x" | "y">): Rect {
  const { size, x, y } = OWNER_TAB;
  return { height: size, width: size, x: card.x + x, y: card.y + y };
}

// What a held press explains: an effect (its index in the walk's list), a debuff, or a dog.
export type ExplainTarget =
  | { debuff: DebuffId; kind: "debuff" }
  | { dog: DogId; kind: "dog" }
  | { effect: number; kind: "effect" };

// What the HUD shows, for finding what a press explains: the walk's effects, its debuffs in
// the order they began, and each card's dog, if any.
export interface ExplainShown {
  debuffs: readonly DebuffId[];
  dogs: readonly (DogId | undefined)[];
  effects: number;
}

// The element under point that explains itself, if any. dimmed: the pause menu's dim covers
// walkView, debuff bars included, and a press there is the menu's.
export function explainTargetAt(
  layout: Pick<ScreenLayout, "dogSlots" | "topBar" | "walkView">,
  shown: ExplainShown,
  dimmed: boolean,
  point: Point,
): ExplainTarget | undefined {
  const { x, y } = point;
  if (dimmed && containsPoint(layout.walkView, x, y)) {
    return undefined;
  }
  const bar = walkBarLayout(layout.topBar);
  const well = bar.effectHolds.findIndex((rect) => containsPoint(rect, x, y));
  if (well >= 0 && well < shown.effects) {
    return { effect: well, kind: "effect" };
  }
  const bars = debuffBarRects(layout.topBar, shown.debuffs.length);
  const debuff = shown.debuffs[bars.findIndex((rect) => containsPoint(rect, x, y))];
  if (debuff !== undefined) {
    return { debuff, kind: "debuff" };
  }
  const dog = shown.dogs[layout.dogSlots.findIndex((rect) => containsPoint(rect, x, y))];
  return dog === undefined ? undefined : { dog, kind: "dog" };
}

// What a card slot shows: its dog, "Empty" for a slot the player owns but filled with no dog,
// or nothing for a slot the player has not bought.
type SlotShown = "dog" | "empty" | "hidden";

export function slotShown(ownedSlots: number, index: number, hasDog: boolean): SlotShown {
  if (hasDog) {
    return "dog";
  }
  return index < ownedSlots ? "empty" : "hidden";
}
