import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DebuffId, DogId } from "../data/types";
import { containsPoint, type Point, type Rect, rectsOverlap } from "../layout/rect";
import type { ScreenLayout } from "../layout/screenLayout";
import type { TextFitStyle } from "../layout/textFit";
import { maxEffects } from "./effectIcons";
import { heartRows } from "./hudView";

// The walk screen's HUD: the walk bar (ui-walk-bar) across the top, a full-width bar per active
// debuff under it, and a card per dog slot along the bottom. Every position is the art's, in
// screen pixels from the bar's top-left corner, the debuff bar's or the card's; text y is the
// top of the capitals.

// The walk bar's buttons, left to right.
export const WALK_BAR_BUTTONS = ["home", "sound", "settings", "pause"] as const;
export type WalkBarButtonId = (typeof WALK_BAR_BUTTONS)[number];

// The walk bar as ui-walk-bar draws it, in bar pixels; every position the HUD uses comes from
// this table. buttons: each button's face x and its hit area's x and width, the hit area the
// bar's full height and minHitWidth wide or more (narrower than the 44px square elsewhere, so
// four fit beside five effect wells), its face buttonFace.size square on row buttonFace.y. cash:
// the "$" and the amount from text.x at the largest of scales that fits text.width, their
// capitals' bottom on capsBottom. zone: the neighbourhood well, the name centred on name.x and
// the pips from pips, pitch apart. effects: a well of size at pitch from x along y for every
// effect a walk can have (EFFECT_WELLS), each icon iconSize at icon,icon in its well and held
// from holdInset left of it down to the bar's bottom, the last hold reaching the first button.
export const WALK_BAR = {
  buttonFace: { size: 20, y: 12 },
  buttons: {
    home: { faceX: 224, hitWidth: 36, hitX: 216 },
    pause: { faceX: 332, hitWidth: 36, hitX: 324 },
    settings: { faceX: 296, hitWidth: 36, hitX: 288 },
    sound: { faceX: 260, hitWidth: 36, hitX: 252 },
  } satisfies Readonly<Record<WalkBarButtonId, { faceX: number; hitWidth: number; hitX: number }>>,
  cash: {
    capsBottom: 30,
    coin: { x: 8, y: 15 },
    scales: [3, 2, 1],
    text: { width: 70, x: 26 },
    well: { height: 40, width: 93, x: 4, y: 4 },
  },
  effects: { holdInset: 1, icon: 1, iconSize: 20, pitch: 23, size: 22, x: 101, y: 22 },
  minHitWidth: 36,
  zone: {
    name: { x: 157, y: 5 },
    pips: { pitch: 26, x: 109, y: 12 },
    well: { height: 17, width: 114, x: 101, y: 4 },
  },
} as const;

// The most effects a walk can have, one well each: the walker's perk, the Pocket's gear and an
// upgrade from each fork.
export const EFFECT_WELLS = maxEffects(gameData);

// The title font's capitals are this many rows tall at 1x.
export const TITLE_CAP_ROWS = 5;

// A button's face and its hit area.
export interface BarButton {
  face: Point;
  hit: Rect;
}

export interface WalkBarLayout {
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
  const effectHolds = effectWells.map((well, i) => {
    const x = well.x - effects.holdInset;
    const width = i === wells - 1 ? firstHit.x - x : effects.pitch;
    return { height: bar.y + bar.height - zoneWell.y, width, x, y: zoneWell.y };
  });
  return { buttons, effectHolds, effectWells, zoneWell };
}

// The largest of the cash's scales at which text measuring widthAt1x fits its room, else the
// smallest.
export function cashScale(widthAt1x: number): number {
  const { scales, text } = WALK_BAR.cash;
  return scales.find((scale) => widthAt1x * scale <= text.width) ?? scales[scales.length - 1] ?? 1;
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
  const share = seconds > 0 ? Math.min(1, Math.max(0, secondsLeft / seconds)) : 0;
  return Math.round(DEBUFF_BAR.fill.width * share);
}

// A dog card (ui-dog-card, the size of a slot in the card row). The name is centred on name.x
// at the largest of its scales that fits name.room, its top by scale. The owner's name labels
// the hearts under it on every card with a dog, a fired dog's included, within owner.room.
// Hearts sit in rows of perRow, pitch apart. The LEAD tag is on the front dog's card, and FIRED
// is centred on fired.x on a fired dog's.
export const DOG_CARD = {
  dogFace: { x: 6, y: 28 },
  fired: { x: 78, y: 42 },
  hearts: { perRow: 5, pitch: 9, x: 44, y: 36 },
  lead: { x: 88, y: 51 },
  name: { room: 108, tops: { 1: 7, 2: 5 }, x: 60 },
  owner: { room: 72, x: 44, y: 26 },
  size: {
    height: SCREEN_CONFIG.dogCardHeight,
    width: SCREEN_CONFIG.width / SCREEN_CONFIG.dogSlotCount,
  },
} as const;

export interface CardHeart extends Point {
  full: boolean;
}

// The card's hearts, the first `hearts` of max full, from the card's top-left corner.
export function cardHearts(hearts: number, max: number): CardHeart[] {
  const { perRow, pitch, x, y } = DOG_CARD.hearts;
  return heartRows(perRow, hearts, max).flatMap((row, rowIndex) =>
    row.map((full, column) => ({ full, x: x + column * pitch, y: y + rowIndex * pitch })),
  );
}

// The 2x name when it fits, else 1x, with the top of its capitals.
export function cardNameFit(widthAt1x: number): { scale: 1 | 2; top: number } {
  const { room, tops } = DOG_CARD.name;
  const scale = widthAt1x * 2 <= room ? 2 : 1;
  return { scale, top: tops[scale] };
}

// The card the LEAD tag is on: the first dog still walking.
export function leadSlot(walking: readonly boolean[]): number | undefined {
  const index = walking.indexOf(true);
  return index < 0 ? undefined : index;
}

// The owner's photo tab (ui-owner-tab, 36x36) pops in centred on a card's top edge, the owner's
// face face pixels inside it. Their quip is a ui-quip bubble height tall, the text's width and
// 2 padX wide, the text padX in and its capitals capsY rows down. Beside the tab, the bubble's
// top is top rows into the tab, gap pixels clear of it, and its tail (ui-quip-tail, tail's
// size) sits tail.y rows into the tab against the bubble's edge, overlapping it tail.overlap
// pixels. Above the tab, the bubble's top is above.top rows from the tab's top and its tail
// (ui-quip-tail-down, above.tail's size) sits at above.tail from the tab's corner. A bubble
// keeps margin pixels inside the screen. The speaker's name plate (ui-quip-name) is plate.height tall and the name's
// width and 2 plate.padX wide, plate.rise rows above the bubble's top and plate.inset in from
// the bubble's end nearest the tab, the name plate.padX in and its capitals plate.capsY down.
export const OWNER_TAB = {
  face: 2,
  quip: {
    above: { tail: { height: 6, width: 8, x: 13, y: -5 }, top: -22 },
    capsY: 6,
    gap: 5,
    height: 18,
    margin: 4,
    padX: 6,
    plate: { capsY: 3, height: 12, inset: 4, padX: 4, rise: 9 },
    tail: { height: 8, overlap: 1, width: 6, y: 9 },
    top: 4,
  },
  size: 36,
  x: 42,
  y: -34,
} as const;

export function ownerTabRect(card: Pick<Rect, "x" | "y">): Rect {
  const { size, x, y } = OWNER_TAB;
  return { height: size, width: size, x: card.x + x, y: card.y + y };
}

export type QuipSide = "above" | "left" | "right";
type BesideSide = Exclude<QuipSide, "above">;

export interface QuipPlace {
  bubble: Rect;
  // The bubble, its plate and its tail: what the quip covers on screen.
  covers: Rect[];
  // The speaker's name, the top of its capitals.
  name: Point;
  // Whether the quip reaches above the owners' lane: above its tab, or grown onto a second line.
  overLane: boolean;
  plate: Rect;
  // Beside the tab or above it: a left bubble's tail is mirrored, an above one's points down.
  side: QuipSide;
  tail: Rect;
  // The quip's text, the top of its capitals.
  text: Point;
}

// The widest a quip's text may be on one line: a bubble across the screen inside its margins,
// as one above its tab may be. A quip wider than this wraps.
export function quipRoom(screen: Pick<Rect, "width">): number {
  const { quip } = OWNER_TAB;
  return screen.width - 2 * quip.margin - 2 * quip.padX;
}

// A quip is 1x body text on up to two lines.
export const QUIP_STYLES: readonly TextFitStyle[] = [{ letterSpacing: 0, lines: 2, scale: 1 }];

// A quip as drawn: its text's lines, lineHeight apart, the widest width wide, and its speaker's
// name name wide.
export interface QuipText {
  lineHeight: number;
  lines: number;
  name: number;
  width: number;
}

// Whether a quip reaching above the owners' lane, which the HUD's other layers keep clear of,
// would lie under any of clearOf: what a moment drawn over the lane covers.
export function quipOverLaneBlocked(clearOf: readonly Rect[], place: QuipPlace): boolean {
  return (
    place.overLane &&
    place.covers.some((cover) => clearOf.some((rect) => rectsOverlap(cover, rect)))
  );
}

// The side of its tab a card's quip prefers: right on the first card and left on the last, so it
// leans into the screen; on a card between them, right while the pack's centre is at or left
// of the screen's centre, else left, so it leans away from the pack.
export function quipSide(
  screen: Pick<Rect, "width" | "x">,
  slots: number,
  packX: number,
  slot: number,
): BesideSide {
  if (slot === 0) {
    return "right";
  }
  if (slot === slots - 1) {
    return "left";
  }
  return packX <= screen.x + screen.width / 2 ? "right" : "left";
}

// The quip and its speaker's name plate by their tab: on the preferred side, else the other
// side, else above the tab, the first that keeps the bubble inside the screen's margins. Each
// line past the first grows the bubble up by a line, its name plate riding on its top.
export function quipPlace(
  screen: Pick<Rect, "width" | "x">,
  prefers: BesideSide,
  tab: Rect,
  text: QuipText,
): QuipPlace {
  const { quip } = OWNER_TAB;
  const width = text.width + 2 * quip.padX;
  const grow = (Math.max(1, text.lines) - 1) * text.lineHeight;
  const low = screen.x + quip.margin;
  const high = screen.x + screen.width - quip.margin;
  const besideX: Record<BesideSide, number> = {
    left: tab.x - quip.gap - width,
    right: tab.x + tab.width + quip.gap,
  };
  const sides: BesideSide[] = prefers === "right" ? ["right", "left"] : ["left", "right"];
  const side: QuipSide =
    sides.find((s) => besideX[s] >= low && besideX[s] + width <= high) ?? "above";
  const bubble = { height: quip.height + grow, width, x: 0, y: 0 };
  let tail: Rect;
  if (side === "above") {
    const centred = tab.x + tab.width / 2 - Math.floor(width / 2);
    bubble.x = Math.max(low, Math.min(high - width, centred));
    bubble.y = tab.y + quip.above.top - grow;
    const { height, width: tailWidth, x, y } = quip.above.tail;
    tail = { height, width: tailWidth, x: tab.x + x, y: tab.y + y };
  } else {
    bubble.x = besideX[side];
    bubble.y = tab.y + quip.top - grow;
    const tailX =
      side === "right"
        ? bubble.x - quip.tail.width + quip.tail.overlap
        : bubble.x + width - quip.tail.overlap;
    tail = { height: quip.tail.height, width: quip.tail.width, x: tailX, y: tab.y + quip.tail.y };
  }
  const { plate } = quip;
  const plateWidth = text.name + 2 * plate.padX;
  const plateRect = {
    height: plate.height,
    width: plateWidth,
    x: side === "left" ? bubble.x + width - plate.inset - plateWidth : bubble.x + plate.inset,
    y: bubble.y - plate.rise,
  };
  return {
    bubble,
    covers: [bubble, plateRect, tail],
    name: { x: plateRect.x + plate.padX, y: plateRect.y + plate.capsY },
    overLane: side === "above" || grow > 0,
    plate: plateRect,
    side,
    tail,
    text: { x: bubble.x + quip.padX, y: bubble.y + quip.capsY },
  };
}

// What a held press explains: an effect (its index in the walk's list), a debuff, or a dog.
export type ExplainTarget =
  | { debuff: DebuffId; kind: "debuff" }
  | { dog: DogId; kind: "dog" }
  | { effects: number[]; kind: "effects" };

// What the HUD shows, for finding what a press explains: the walk's effects, its debuffs in
// the order they began, and each card's dog, if any.
export interface ExplainShown {
  debuffs: readonly DebuffId[];
  dogs: readonly (DogId | undefined)[];
  effects: number;
}

// The element under point that explains itself, if any.
export function explainTargetAt(
  layout: Pick<ScreenLayout, "dogSlots" | "topBar">,
  shown: ExplainShown,
  point: Point,
): ExplainTarget | undefined {
  const { x, y } = point;
  const bar = walkBarLayout(layout.topBar);
  const well = bar.effectHolds.findIndex((rect) => containsPoint(rect, x, y));
  if (well >= 0 && well < shown.effects) {
    return { effects: [well], kind: "effects" };
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
export type SlotShown = "dog" | "empty" | "hidden";

export function slotShown(ownedSlots: number, index: number, hasDog: boolean): SlotShown {
  if (hasDog) {
    return "dog";
  }
  return index < ownedSlots ? "empty" : "hidden";
}
