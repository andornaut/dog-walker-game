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
  quipPlace,
  quipRoom,
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

  it.each(tabs.map((tab, i) => [i, tab] as const))(
    "pops tab %i in on its card's top-right corner, overlapping the card's top",
    (i, tab) => {
      const card = dogSlots[i] ?? tab;
      expect(tab.x + tab.width).toBeLessThanOrEqual(card.x + card.width);
      expect(tab.y).toBeLessThan(card.y);
      expect(tab.y + tab.height).toBeGreaterThan(card.y);
    },
  );

  // A short quip and one too long to fit left of the first card's tab.
  const short = 40;
  const long = (tabs[0]?.x ?? 0) + 1;
  it.each<[string, number, number, number, "left" | "right"]>([
    ["right of card 0's tab with the pack left of centre", 0, middle - 1, short, "right"],
    ["right of card 0's tab with the pack on the centre", 0, middle, short, "right"],
    ["left of card 0's tab with the pack right of centre", 0, middle + 1, short, "left"],
    ["right of card 0's tab when the left lacks room", 0, middle + 1, long, "right"],
    ["left of card 2's tab when the right lacks room", 2, middle - 1, short, "left"],
    ["left of card 1's tab with the pack right of centre", 1, middle + 1, short, "left"],
  ])("puts the quip %s", (_name, slot, packX, width, side) => {
    const tab = tabs[slot] ?? screen;
    const place = quipPlace(screen, packX, tab, { lineHeight: 10, lines: 1, width });
    expect(place.side).toBe(side);
    expect(place.bubble.width).toBe(width + 2 * quip.padX);
    expect(place.bubble.y).toBe(tab.y + quip.top);
    if (side === "right") {
      expect(place.bubble.x).toBe(tab.x + tab.width + quip.gap);
      expect(place.tail.x + quip.tail.width - quip.tail.overlap).toBe(place.bubble.x);
    } else {
      expect(place.bubble.x + place.bubble.width + quip.gap).toBe(tab.x);
      expect(place.tail.x).toBe(place.bubble.x + place.bubble.width - quip.tail.overlap);
    }
  });
});

// Every owner's quip, at 1x in the body font as the tab's bubble measures it, keeps its bubble
// on screen beside each card's tab, wherever the pack is, wrapping onto a second line, the
// bubble growing up, where neither side has room for one.
describe("an owner's quip bubble", () => {
  const screen = LAYOUT.walkView;
  const { quip } = OWNER_TAB;
  const { lineHeight } = fontFileMetrics("font-body");
  const quips = Object.values(gameData.quips).flatMap((moments) => Object.values(moments).flat());
  const packs = [screen.x, screen.x + screen.width / 2, screen.x + screen.width - 1];
  it.each(
    dogSlots.flatMap((card, slot) =>
      quips.map((text) => [slot, text, ownerTabRect(card)] as const),
    ),
  )("beside card %i's tab, keeps %j on screen", (_slot, text, tab) => {
    const room = quipRoom(screen, tab) - 1;
    const { lines } = fitInFont("font-body", QUIP_STYLES, room, plainMarks(text));
    expect(lines.length).toBeLessThanOrEqual(2);
    const width = Math.max(...lines.map((line) => bodyTextWidth(1, line)));
    for (const packX of packs) {
      const place = quipPlace(screen, packX, tab, { lineHeight, lines: lines.length, width });
      const { bubble } = place;
      expect(bubble.x).toBeGreaterThanOrEqual(screen.x + quip.margin);
      expect(bubble.x + bubble.width).toBeLessThanOrEqual(screen.x + screen.width - quip.margin);
      expect(bubble.y + bubble.height).toBe(tab.y + quip.top + quip.height);
      expect(place.textY - bubble.y).toBe(quip.capsY - quip.top);
    }
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
