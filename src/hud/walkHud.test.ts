import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DebuffId, DogId } from "../data/types";
import { type Point, type Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { walkLength } from "../rules/route";
import { read } from "../rules/units";
import { bodyTextWidth } from "../testing/bodyFont";
import { fitInFont, fontFileMetrics, fontInk } from "../testing/fontInk";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { maxEffects } from "./effectIcons";
import {
  cardHearts,
  cardNameFit,
  cashScale,
  cashTop,
  DEBUFF_BAR,
  debuffBarRects,
  debuffFillWidth,
  DOG_CARD,
  EFFECT_WELLS,
  type ExplainShown,
  type ExplainTarget,
  explainTargetAt,
  leadSlot,
  OWNER_TAB,
  ownerTabRect,
  QUIP_STYLES,
  quipOverLaneBlocked,
  type QuipPlace,
  quipPlace,
  quipRoom,
  type QuipSide,
  quipSide,
  TITLE_CAP_ROWS,
  WALK_BAR,
  WALK_BAR_BUTTONS,
  walkBarLayout,
} from "./walkHud";

const LAYOUT = screenLayout(SCREEN_CONFIG);
const { dogSlots, topBar } = LAYOUT;
const BAR = walkBarLayout(topBar);
const WELLS = BAR.effectWells.length;

const centre = (rect: Rect): Point => ({
  x: rect.x + Math.floor(rect.width / 2),
  y: rect.y + Math.floor(rect.height / 2),
});
const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const BODY = fontFileMetrics("font-body");

// The columns a line inks in the body font at 1x, from its left edge to its last ink.
const inkRight = (line: string) =>
  fontInk("font-body", { letterSpacing: 0, scale: 1 }, plainMarks(line)).right;

// A quip as the tab's bubble measures it: wrapped to the widest room any bubble has, each
// line's label width (its advances, the last glyph's trailing pixel included), and the
// speaker's name's.
function quipText(name: string, text: string) {
  const room = quipRoom(LAYOUT.walkView) - 1;
  const { lines } = fitInFont("font-body", QUIP_STYLES, room, plainMarks(text));
  return {
    lineHeight: BODY.lineHeight,
    lines: lines.length,
    name: bodyTextWidth(1, plainMarks(name)),
    width: Math.max(...lines.map((line) => bodyTextWidth(1, line))),
  };
}

// Every dog's owner's name, by dog.
const owners = (Object.keys(gameData.dogs) as DogId[]).map(
  (dog) => [dog, gameData.dogs[dog].owner.name] as const,
);

// An image's size, from its PNG header, and a frame of a sprite's from its sheet's data.
function pngSize(path: string): { height: number; width: number } {
  const png = readFileSync(new URL(`../../public/art/${path}`, import.meta.url));
  return { height: png.readUInt32BE(20), width: png.readUInt32BE(16) };
}
const HEART_SHEET = JSON.parse(
  readFileSync(new URL("../../public/art/sprites/ui-heart.json", import.meta.url), "utf8"),
) as { frames: Record<string, { sourceSize: { h: number; w: number } }> };
const HEART_FRAME = Object.values(HEART_SHEET.frames)[0]?.sourceSize ?? { h: 0, w: 0 };
const HEART_SIZE = { height: HEART_FRAME.h, width: HEART_FRAME.w };

// The columns text inks in the title font at 1x, from its left edge to its last ink.
function titleWidth(text: string): number {
  return fontInk("font-title", { letterSpacing: 0, scale: 1 }, text).right;
}

describe("the walk bar", () => {
  it("keeps its wells, effect wells and buttons inside the bar, none over another", () => {
    const parts = [
      WALK_BAR.cash.well,
      BAR.zoneWell,
      ...BAR.effectWells,
      ...WALK_BAR_BUTTONS.map((id) => BAR.buttons[id].hit),
    ];
    for (const part of parts) {
      expect(inside(part, topBar)).toBe(true);
    }
    expect(overlaps(WALK_BAR.cash.well, BAR.zoneWell)).toBe(false);
    for (const well of BAR.effectWells) {
      expect(overlaps(well, BAR.zoneWell)).toBe(false);
    }
  });

  it("lines a well for every effect under the neighbourhood well, its holds up to the first button", () => {
    const first = BAR.buttons[WALK_BAR_BUTTONS[0]].hit;
    expect(BAR.effectWells).toHaveLength(EFFECT_WELLS);
    for (const hold of BAR.effectHolds) {
      expect(hold.x).toBeGreaterThanOrEqual(BAR.zoneWell.x - WALK_BAR.effects.holdInset);
      expect(hold.x + hold.width).toBeLessThanOrEqual(first.x);
    }
    const last = BAR.effectHolds.at(-1);
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBe(first.x);
    for (const well of BAR.effectWells) {
      const { icon, iconSize } = WALK_BAR.effects;
      const art = { height: iconSize, width: iconSize, x: well.x + icon, y: well.y + icon };
      expect(inside(art, well)).toBe(true);
    }
    BAR.effectWells.forEach((well, i) => {
      const hold = BAR.effectHolds[i];
      expect(hold).toBeDefined();
      expect(inside(well, hold ?? well)).toBe(true);
      expect((hold?.y ?? 0) + (hold?.height ?? 0)).toBe(topBar.y + topBar.height);
      const next = BAR.effectHolds[i + 1];
      if (next !== undefined) {
        expect(next.x).toBe((hold?.x ?? 0) + (hold?.width ?? 0));
      }
    });
  });

  it("ends the neighbourhood well before the first button's hit area", () => {
    const first = BAR.buttons[WALK_BAR_BUTTONS[0]].hit;
    expect(BAR.zoneWell.x + BAR.zoneWell.width).toBeLessThanOrEqual(first.x);
  });
});

describe("cashScale", () => {
  const { scales, text } = WALK_BAR.cash;
  const [largest = 1] = scales;
  const smallest = scales.at(-1) ?? 1;
  // Amounts as the game writes them, the thousands comma included.
  it.each(["$0", "$888", "$1,234", "$99,999", "$1,000,000"])(
    "sets %s at the largest scale that fits the cash's room",
    (cash) => {
      const width = titleWidth(cash);
      const scale = cashScale(width);
      const fits = scales.filter((each) => width * each <= text.width);
      expect(scale).toBe(fits[0] ?? smallest);
    },
  );

  it("sets the largest scale for a small amount and the smallest past every room", () => {
    expect(cashScale(titleWidth("$0"))).toBe(largest);
    expect(cashScale(text.width + 1)).toBe(smallest);
  });

  it.each(scales.map((scale) => [scale] as const))(
    "keeps the capitals' bottom row on the same row at %ix, inside the well",
    (scale) => {
      const bottom = cashTop(scale) + TITLE_CAP_ROWS * scale - 1;
      expect(bottom).toBe(WALK_BAR.cash.capsBottom);
      expect(cashTop(scale)).toBeGreaterThan(WALK_BAR.cash.well.y);
    },
  );
});

describe("maxEffects", () => {
  const walk = { ...gameData.world, walkLength: walkLength(gameData) };
  it.each<[string, number, number, number]>([
    [
      "the game's walk",
      read(gameData.tuning, "counts", "loadoutMax"),
      walk.walkLength,
      EFFECT_WELLS,
    ],
    ["a one-zone walk with no Pocket", 0, 1, 1],
    ["a two-zone walk with a Pocket", 1, 2, 3],
    ["a four-zone walk with two Pocket items", 2, 4, 6],
  ])(
    "counts the perk, the Pocket and a fork's upgrade each for %s",
    (_name, pocket, zones, expected) => {
      const tuning = {
        ...gameData.tuning,
        counts: { ...gameData.tuning.counts, loadoutMax: pocket },
      };
      const world = { ...gameData.world, walkLength: zones };
      expect(maxEffects({ tuning, world })).toBe(expected);
    },
  );
});

describe("the debuff bars", () => {
  it.each([1, 2])(
    "stacks %i bars under the walk bar, each the bar's height, full width",
    (count) => {
      const bars = debuffBarRects(topBar, count);
      expect(bars).toHaveLength(count);
      bars.forEach((bar, i) => {
        expect(bar).toEqual({
          height: DEBUFF_BAR.height,
          width: topBar.width,
          x: topBar.x,
          y: topBar.y + topBar.height + i * DEBUFF_BAR.height,
        });
      });
    },
  );

  it("keeps the bars over the backdrop band", () => {
    for (const bar of debuffBarRects(topBar, 2)) {
      expect(inside(bar, LAYOUT.backdrop)).toBe(true);
    }
  });

  const full = DEBUFF_BAR.fill.width;
  it.each<[string, number, number, number]>([
    ["full as it starts", 20, 20, full],
    ["half way through", 10, 20, Math.round(full / 2)],
    ["empty as it ends", 0, 20, 0],
    ["full when it lasts longer than its seconds", 25, 20, full],
    ["empty when a fraction rounds to nothing", 0.01, 20, 0],
    ["empty for a debuff of no seconds", 3, 0, 0],
  ])("draws the fill %s", (_name, left, seconds, expected) => {
    expect(debuffFillWidth(left, seconds)).toBe(expected);
  });
});

describe("the dog cards", () => {
  it.each(dogSlots.map((slot, i) => [i, slot] as const))(
    "places card %i at the card's size on the screen's bottom rows, side by side",
    (i, slot) => {
      expect({ height: slot.height, width: slot.width }).toEqual(DOG_CARD.size);
      expect(slot.x).toBe(i * DOG_CARD.size.width);
      expect(slot.y + slot.height).toBe(SCREEN_CONFIG.height);
      expect(inside(slot, LAYOUT.dogRow)).toBe(true);
    },
  );

  it.each<[string, number, number, number]>([
    ["a full meter of three", 3, 3, 3],
    ["five of seven", 5, 7, 7],
    ["none of eleven", 0, 11, 11],
  ])("lays out the hearts of %s in rows inside the card", (_name, hearts, max, cells) => {
    const shown = cardHearts(hearts, max);
    expect(shown).toHaveLength(cells);
    expect(shown.filter(({ full }) => full)).toHaveLength(hearts);
    const { perRow, pitch, x, y } = DOG_CARD.hearts;
    shown.forEach((cell, i) => {
      expect(cell).toMatchObject({
        x: x + (i % perRow) * pitch,
        y: y + Math.floor(i / perRow) * pitch,
      });
      expect(cell.x + pitch).toBeLessThanOrEqual(DOG_CARD.size.width);
      expect(cell.y + pitch).toBeLessThanOrEqual(DOG_CARD.size.height);
    });
  });

  it.each([5, 6, 11])("keeps every heart of %i inside the card and clear of LEAD", (max) => {
    const lead = { ...pngSize("images/ui-lead-tag.png"), ...DOG_CARD.lead };
    const card = { ...DOG_CARD.size, x: 0, y: 0 };
    const hit = cardHearts(max, max)
      .map((cell) => ({ ...HEART_SIZE, x: cell.x, y: cell.y }))
      .filter((heart) => overlaps(heart, lead) || !inside(heart, card));
    expect(hit).toEqual([]);
  });

  it("puts a sixth heart under the first", () => {
    const { perRow, pitch, x, y } = DOG_CARD.hearts;
    expect(cardHearts(perRow + 1, perRow + 1)[perRow]).toMatchObject({ x, y: y + pitch });
  });

  it("keeps the owner's name inside the card over the hearts", () => {
    const { owner } = DOG_CARD;
    expect(owner.x + owner.room).toBeLessThanOrEqual(DOG_CARD.size.width);
    expect(owner.y).toBeLessThan(DOG_CARD.hearts.y);
  });

  it.each(owners)("fits the name of %s's owner, %s, on the card in the body font", (_dog, name) => {
    expect(inkRight(name)).toBeLessThanOrEqual(DOG_CARD.owner.room);
  });

  const { room } = DOG_CARD.name;
  it.each<[string, number, 1 | 2]>([
    ["a name that fits at 2x", room / 2, 2],
    ["a name one pixel too wide for 2x", room / 2 + 1, 1],
  ])("sets %s", (_name, width, scale) => {
    expect(cardNameFit(width)).toEqual({ scale, top: DOG_CARD.name.tops[scale] });
  });

  it.each<[string, boolean[], number | undefined]>([
    ["the first dog while it walks", [true, true, true], 0],
    ["the next walking dog once the first is fired", [false, true, true], 1],
    ["no dog once all are fired", [false, false], undefined],
  ])("tags %s LEAD", (_name, walking, expected) => {
    expect(leadSlot(walking)).toBe(expected);
  });
});

describe("the owner's tab and quip", () => {
  const screen = LAYOUT.walkView;
  const middle = screen.x + screen.width / 2;
  const { quip } = OWNER_TAB;
  const tabs = dogSlots.map(ownerTabRect);

  const low = screen.x + quip.margin;
  const high = screen.x + screen.width - quip.margin;
  const last = dogSlots.length - 1;

  it.each(tabs.map((tab, i) => [i, tab] as const))(
    "pops tab %i in centred on its card's top edge, overlapping the card's top",
    (i, tab) => {
      const card = dogSlots[i] ?? tab;
      expect(tab.x + tab.width / 2).toBe(card.x + card.width / 2);
      expect(tab.y).toBeLessThan(card.y);
      expect(tab.y + tab.height).toBeGreaterThan(card.y);
    },
  );

  // A one-line quip textWidth wide, its speaker's name name wide.
  const one = (textWidth: number, name = 20) => ({
    lineHeight: BODY.lineHeight,
    lines: 1,
    name,
    width: textWidth,
  });

  it.each<[string, number, number, "left" | "right"]>([
    ["right on the first card with the pack left of centre", 0, middle - 1, "right"],
    ["right on the first card with the pack right of centre", 0, middle + 1, "right"],
    ["left on the last card with the pack left of centre", last, middle - 1, "left"],
    ["left on the last card with the pack right of centre", last, middle + 1, "left"],
    ["right on a middle card with the pack on the centre", 1, middle, "right"],
    ["left on a middle card with the pack right of centre", 1, middle + 1, "left"],
  ])("prefers %s", (_name, slot, packX, side) => {
    expect(quipSide(screen, dogSlots.length, packX, slot)).toBe(side);
  });

  // A tab left of the screen's centre, with room for a narrow bubble on either side and a wide
  // one only on its right; a bubble wider than either side's room goes above.
  const offCentre = { ...(tabs[0] ?? screen), x: 100 };
  const roomLeft = offCentre.x - quip.gap - low;
  const roomRight = high - (offCentre.x + offCentre.width + quip.gap);
  const text = (bubble: number) => bubble - 2 * quip.padX;
  it.each<[string, "left" | "right", number, QuipSide]>([
    ["on the preferred left side when it has room", "left", text(roomLeft), "left"],
    ["on the preferred right side when it has room", "right", text(roomLeft), "right"],
    ["on the other side when the preferred lacks room", "left", text(roomLeft + 1), "right"],
    ["above when neither side has room", "right", text(roomRight + 1), "above"],
  ])("places the quip %s", (_name, prefers, textWidth, side) => {
    const place = quipPlace(screen, prefers, offCentre, one(textWidth));
    expect(place.side).toBe(side);
    expect(place.bubble.width).toBe(textWidth + 2 * quip.padX);
    expect(place.text).toEqual({ x: place.bubble.x + quip.padX, y: place.bubble.y + quip.capsY });
  });

  // The widest bubble that keeps inside the margins, over a tab near either edge.
  const widest = text(high - low);
  it.each<[string, number, "x" | "right", number]>([
    ["the first tab, kept right of the screen's margin", 0, "x", low],
    ["the last tab, kept left of the screen's margin", last, "right", high],
  ])("places a bubble too wide for either side above %s", (_name, slot, edge, at) => {
    const tab = tabs[slot] ?? screen;
    const prefers = quipSide(screen, tabs.length, middle, slot);
    const { bubble, side, tail } = quipPlace(screen, prefers, tab, one(widest));
    expect(side).toBe("above");
    expect(bubble.y).toBe(tab.y + quip.above.top);
    const { height, width, x, y } = quip.above.tail;
    expect(tail).toEqual({ height, width, x: tab.x + x, y: tab.y + y });
    expect(edge === "x" ? bubble.x : bubble.x + bubble.width).toBe(at);
  });

  it("centres an above bubble on a middle tab", () => {
    const tab = tabs[1] ?? screen;
    const roomBeside = high - (tab.x + tab.width + quip.gap);
    const place = quipPlace(screen, "right", tab, one(text(roomBeside + 1)));
    expect(place.side).toBe("above");
    expect(place.bubble.x + place.bubble.width / 2).toBe(tab.x + tab.width / 2);
  });

  it.each<[string, "left" | "right", number]>([
    ["beside the tab", "right", 40],
    ["above the tab", "right", widest],
  ])("grows a two-line bubble %s up by a line, its plate on its top", (_name, prefers, width) => {
    const tab = tabs[1] ?? screen;
    const single = quipPlace(screen, prefers, tab, one(width));
    const double = quipPlace(screen, prefers, tab, { ...one(width), lines: 2 });
    expect(double.side).toBe(single.side);
    expect(double.bubble).toEqual({
      ...single.bubble,
      height: single.bubble.height + BODY.lineHeight,
      y: single.bubble.y - BODY.lineHeight,
    });
    expect(double.plate.y).toBe(double.bubble.y - quip.plate.rise);
    expect(double.text.y).toBe(double.bubble.y + quip.capsY);
    expect(double.tail).toEqual(single.tail);
  });

  // Every owner's every quip as the bubble measures it, on every card, with the pack on either
  // side of the centre.
  const cases = owners.flatMap(([dog, name]) =>
    tabs.flatMap((_tab, slot) =>
      [middle, middle + 1].map((packX) => [dog, slot, packX, name] as const),
    ),
  );
  it.each(cases)(
    "keeps the quips and name plate of %s's owner on screen on card %i with the pack at x %d",
    (dog, slot, packX, name) => {
      const tab = tabs[slot] ?? screen;
      const prefers = quipSide(screen, tabs.length, packX, slot);
      const lines = Object.values(gameData.quips[dog]).flat();
      const right = (rect: Rect) => rect.x + rect.width;
      const wrong = lines.flatMap((line) => {
        const shown = quipText(name, line);
        const { bubble, plate, side } = quipPlace(screen, prefers, tab, shown);
        const bottom = tab.y + (side === "above" ? quip.above.top : quip.top) + quip.height;
        const nearEnd =
          side === "left"
            ? right(plate) + quip.plate.inset === right(bubble)
            : plate.x === bubble.x + quip.plate.inset;
        const problems: [string, boolean][] = [
          ["more than two lines", shown.lines > 2],
          ["bubble off screen", bubble.x < low || right(bubble) > high],
          ["bubble grown down", bubble.y + bubble.height !== bottom],
          ["plate outside the bubble", plate.x < bubble.x || right(plate) > right(bubble)],
          ["plate off the bubble's rim", plate.y !== bubble.y - quip.plate.rise],
          ["plate off the end nearest the tab", !nearEnd],
          ["above an outer card", side === "above" && (slot === 0 || slot === last)],
        ];
        return problems.filter(([, hit]) => hit).map(([problem]) => `${line}: ${side}, ${problem}`);
      });
      expect(wrong).toEqual([]);
    },
  );

  it.each<["left" | "right", number]>([
    ["right", 0],
    ["left", last],
  ])("points a %s bubble's tail at the tab", (side, slot) => {
    const tab = tabs[slot] ?? screen;
    const place = quipPlace(screen, side, tab, one(40));
    expect(place.side).toBe(side);
    expect(place.bubble.y).toBe(tab.y + quip.top);
    expect(place.tail.y).toBe(tab.y + quip.tail.y);
    if (side === "right") {
      expect(place.bubble.x).toBe(tab.x + tab.width + quip.gap);
      expect(place.tail.x + quip.tail.width - quip.tail.overlap).toBe(place.bubble.x);
    } else {
      expect(place.bubble.x + place.bubble.width + quip.gap).toBe(tab.x);
      expect(place.tail.x).toBe(place.bubble.x + place.bubble.width - quip.tail.overlap);
    }
  });

  it.each<["left" | "right", number]>([
    ["right", 0],
    ["left", last],
  ])("sets the name on its plate on a %s bubble", (side, slot) => {
    const tab = tabs[slot] ?? screen;
    const place = quipPlace(screen, side, tab, one(60, 30));
    const { plate } = quip;
    expect(place.plate).toMatchObject({ height: plate.height, width: 30 + 2 * plate.padX });
    expect(place.name).toEqual({ x: place.plate.x + plate.padX, y: place.plate.y + plate.capsY });
  });

  it.each(tabs.map((_tab, slot) => [slot] as const))(
    "covers card %i's bubble, plate and tail, beside or above the tab",
    (slot) => {
      const tab = tabs[slot] ?? screen;
      for (const textWidth of [40, widest]) {
        const prefers = quipSide(screen, tabs.length, middle, slot);
        const place = quipPlace(screen, prefers, tab, one(textWidth));
        expect(place.covers).toEqual([place.bubble, place.plate, place.tail]);
      }
    },
  );

  // A middle card's quip above its tab, one beside it on two lines and one on one, and what a
  // moment over the lane covers.
  const midTab = tabs[1] ?? screen;
  const above = quipPlace(screen, "right", midTab, one(widest));
  const beside = quipPlace(screen, "right", midTab, one(40));
  const wrapped = quipPlace(screen, "right", midTab, { ...one(40), lines: 2 });
  const over = (rect: Rect) => [{ height: 2, width: 2, x: rect.x + 1, y: rect.y + 1 }];
  it.each<[string, QuipPlace, Rect[], boolean]>([
    ["blocks a quip above its tab under a moment's bubble", above, over(above.bubble), true],
    ["blocks a quip above its tab under a moment over its plate", above, over(above.plate), true],
    ["blocks a quip above its tab under a moment over its tail", above, over(above.tail), true],
    ["lets a quip above its tab show with nothing over it", above, [], false],
    ["blocks a two-line quip beside its tab under a moment", wrapped, over(wrapped.bubble), true],
    [
      "leaves a one-line quip beside its tab to the owners' lane",
      beside,
      over(beside.bubble),
      false,
    ],
  ])("%s", (_name, place, clearOf, blocked) => {
    expect(quipOverLaneBlocked(clearOf, place)).toBe(blocked);
  });
});

// The neighbourhood's name, centred on name.x at 1x in the body font, stays inside the well and
// over the pips.
describe("the walk bar's neighbourhood name", () => {
  const { name, pips } = WALK_BAR.zone;
  const well = BAR.zoneWell;
  const body = fontFileMetrics("font-body");
  it.each(gameData.world.zones.map((zone) => zone.name))("fits %j in the well", (zoneName) => {
    const ink = fontInk("font-body", { letterSpacing: 0, scale: 1 }, plainMarks(zoneName));
    // Phaser centres the label on its advances, the last glyph's spacing included.
    const left = Math.round(name.x - bodyTextWidth(1, plainMarks(zoneName)) / 2);
    expect(left + ink.left).toBeGreaterThan(well.x);
    expect(left + ink.right).toBeLessThan(well.x + well.width);
    expect(name.y + inkRowsFromCapTop(body)).toBeLessThanOrEqual(pips.y);
  });
});

describe("explainTargetAt", () => {
  const dogs: (DogId | undefined)[] = ["koda", "biscuit", undefined];
  const debuffs: DebuffId[] = ["muddy", "stinky"];
  const shown = (effects: number): ExplainShown => ({ debuffs, dogs, effects });
  const holdAt = (i: number) => centre(BAR.effectHolds[i] ?? topBar);
  const bars = debuffBarRects(topBar, debuffs.length);
  const button = centre(BAR.buttons[WALK_BAR_BUTTONS[0]].hit);
  it.each<[string, number, Point, ExplainTarget | undefined]>([
    ["the first effect", 1, holdAt(0), { effects: [0], kind: "effects" }],
    ["the neighbourhood well's column over an effect", 1, centre(BAR.zoneWell), undefined],
    ["an empty well", 1, holdAt(1), undefined],
    [
      "the last well with as many effects as wells",
      WELLS,
      holdAt(WELLS - 1),
      { effects: [WELLS - 1], kind: "effects" },
    ],
    ["the cash well", 1, centre(WALK_BAR.cash.well), undefined],
    ["a button", 1, button, undefined],
    ["the first debuff bar", 0, centre(bars[0] ?? topBar), { debuff: "muddy", kind: "debuff" }],
    ["the second debuff bar", 0, centre(bars[1] ?? topBar), { debuff: "stinky", kind: "debuff" }],
    ["the first card", 0, centre(dogSlots[0] ?? topBar), { dog: "koda", kind: "dog" }],
    ["the second card", 0, centre(dogSlots[1] ?? topBar), { dog: "biscuit", kind: "dog" }],
    ["a card with no dog", 0, centre(dogSlots[2] ?? topBar), undefined],
    ["the road", 0, centre(LAYOUT.road), undefined],
  ])("finds what %s explains", (_name, effects, point, expected) => {
    expect(explainTargetAt(LAYOUT, shown(effects), point)).toEqual(expected);
  });
});
