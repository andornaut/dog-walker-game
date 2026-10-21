import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { decodePng } from "../assets/atlas/atlasBuild";
import { opaqueRect } from "../assets/atlas/atlasPixels";
import { dogFaceKey, ownerCardFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DebuffId, DogId } from "../data/types";
import { dollarAmountText } from "../home/home";
import { type Point, type Rect } from "../layout/rect";
import { screenLayout } from "../layout/screenLayout";
import { maxHearts } from "../rules/dogs";
import { modifiersOf } from "../rules/modifiers";
import { walkLength } from "../rules/route";
import { cents, read } from "../rules/units";
import { bodyTextWidth } from "../testing/bodyFont";
import { fitInFont, fontFileMetrics, fontInk } from "../testing/fontInk";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import { maxEffects } from "./effectIcons";
import {
  cardHearts,
  cardNameFit,
  cashLeft,
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
  ownerNameLines,
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
  zoneNameRoom,
  zoneProgressText,
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
function frameSize(key: string): { height: number; width: number } {
  const sheet = JSON.parse(
    readFileSync(new URL(`../../public/art/sprites/${key}.json`, import.meta.url), "utf8"),
  ) as { frames: Record<string, { sourceSize: { h: number; w: number } }> };
  const frame = Object.values(sheet.frames)[0]?.sourceSize ?? { h: 0, w: 0 };
  return { height: frame.h, width: frame.w };
}
const HEART_SIZE = frameSize("ui-heart");

// The columns text inks in the title font at 1x, from its left edge to its last ink.
function titleWidth(text: string): number {
  return fontInk("font-title", { letterSpacing: 0, scale: 1 }, text).right;
}

describe("the walk bar", () => {
  it("keeps its wells, effect wells, holds and buttons inside the bar on screen, none over another", () => {
    const screen = { height: SCREEN_CONFIG.height, width: SCREEN_CONFIG.width, x: 0, y: 0 };
    expect(inside(topBar, screen)).toBe(true);
    const hits = WALK_BAR_BUTTONS.map((id) => BAR.buttons[id].hit);
    const parts = [
      WALK_BAR.cash.well,
      BAR.zoneWell,
      ...BAR.effectWells,
      ...BAR.effectHolds,
      ...hits,
    ];
    for (const hold of BAR.effectHolds) {
      for (const hit of hits) {
        expect(overlaps(hold, hit)).toBe(false);
      }
    }
    for (const part of parts) {
      expect(inside(part, topBar)).toBe(true);
    }
    expect(overlaps(WALK_BAR.cash.well, BAR.zoneWell)).toBe(false);
    for (const well of BAR.effectWells) {
      expect(overlaps(well, BAR.zoneWell)).toBe(false);
    }
  });

  it("lines a well for every effect under the neighborhood well, its holds up to the first button", () => {
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

  it("runs the hits side by side to the bar's right edge, each face centred in its hit", () => {
    const { size } = WALK_BAR.buttonFace;
    const hits = WALK_BAR_BUTTONS.map((id) => BAR.buttons[id].hit);
    hits.slice(1).forEach((hit, i) => {
      expect(hit.x).toBe((hits[i]?.x ?? 0) + (hits[i]?.width ?? 0));
    });
    const last = hits.at(-1);
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBe(topBar.x + topBar.width);
    for (const id of WALK_BAR_BUTTONS) {
      const { face, hit } = BAR.buttons[id];
      expect(2 * (face.x - hit.x) + size).toBe(hit.width);
    }
  });

  it("spans the cash well from the neighborhood well's top to the effect wells' bottom", () => {
    const { cash, effects, zone } = WALK_BAR;
    expect(cash.well.y).toBe(zone.well.y);
    expect(cash.well.y + cash.well.height).toBe(effects.y + effects.size);
  });

  it("ends the neighborhood well before the first button's hit area", () => {
    const first = BAR.buttons[WALK_BAR_BUTTONS[0]].hit;
    expect(BAR.zoneWell.x + BAR.zoneWell.width).toBeLessThanOrEqual(first.x);
  });
});

describe("cashScale", () => {
  const { room, scales } = WALK_BAR.cash;
  const [largest = 1] = scales;
  const smallest = scales.at(-1) ?? 1;
  // Amounts as the game writes them, the thousands comma included.
  it.each(["$0", "$888", "$1,234", "$99,999", "$1,000,000"])(
    "sets %s at the largest scale that fits the cash's room",
    (cash) => {
      const width = titleWidth(cash);
      const scale = cashScale(width);
      const fits = scales.filter((each) => width * each <= room);
      expect(scale).toBe(fits[0] ?? smallest);
    },
  );

  // The most cash a walk could plausibly reach, from the tuning: the purse and the Fanny pack,
  // a full pack's pay in every zone at the dearest zone's fees, every tip at Big tipper's value,
  // every lucky find a kept wallet, and the Full pack bonus.
  const money = (key: Parameters<typeof read<"money">>[2]) => read(gameData.tuning, "money", key);
  const count = (key: Parameters<typeof read<"counts">>[2]) => read(gameData.tuning, "counts", key);
  const zones = walkLength(gameData);
  const dearest = Math.max(...gameData.world.zones.map((zone) => zone.fees));
  const tipValue = money("tip") + money("bigTipperTipBonus");
  const perZone = (zone: number) =>
    count("packSizeMax") * money("payPerDog") * dearest +
    (count("tipsFirstZone") + count("tipsGainPerZone") * zone) * tipValue +
    count("luckyEncountersPerZone") * money("lostWalletKeep");
  const plausible = cents(
    money("startPurse") +
      money("fannyPackStart") +
      Array.from({ length: zones }, (_, zone) => perZone(zone)).reduce((a, b) => a + b, 0) +
      count("packSizeMax") * money("fullPackBonusPerDog"),
  );
  const amounts = [...[0, 9, 99, 999].map((dollars) => cents(dollars * 100)), plausible];
  it.each(amounts.map((amount) => `$${dollarAmountText(amount)}`))(
    "fits %s in the cash's room at the scale it takes",
    (cash) => {
      const width = titleWidth(cash);
      expect(width * cashScale(width)).toBeLessThanOrEqual(room);
    },
  );

  it("sets the largest scale for a small amount and the smallest past every room", () => {
    expect(cashScale(titleWidth("$0"))).toBe(largest);
    expect(cashScale(room + 1)).toBe(smallest);
  });

  it.each(scales.map((scale) => [scale] as const))(
    "keeps the capitals' bottom row on the same row at %ix, inside the well",
    (scale) => {
      const bottom = cashTop(scale) + TITLE_CAP_ROWS * scale - 1;
      expect(bottom).toBe(WALK_BAR.cash.capsBottom);
      expect(cashTop(scale)).toBeGreaterThan(WALK_BAR.cash.well.y);
    },
  );

  // Amounts as the game writes them, by the scale each takes; every scale is covered.
  const ranged = [0, 5, 88, 888, 1_234, 99_999, 1_000_000, 123_456_789].map(
    (dollars) => `$${dollarAmountText(cents(dollars * 100))}`,
  );
  it("covers every scale with the ranged amounts", () => {
    const taken = new Set(ranged.map((cash) => cashScale(titleWidth(cash))));
    expect([...taken].sort()).toEqual([...scales].sort());
  });

  it.each(ranged)("centres %s across the well's ink at the scale it takes", (cash) => {
    const { ink } = WALK_BAR.cash;
    const inkWidth = titleWidth(cash) * cashScale(titleWidth(cash));
    const left = cashLeft(inkWidth);
    const right = left + inkWidth - 1;
    expect(left).toBeGreaterThanOrEqual(ink.left);
    expect(right).toBeLessThanOrEqual(ink.right);
    // Centred, a half pixel at most to the left when the widths' parities differ.
    const offCentre = (ink.left + ink.right) / 2 - (left + right) / 2;
    expect(offCentre).toBeGreaterThanOrEqual(0);
    expect(offCentre).toBeLessThanOrEqual(0.5);
  });
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

  // The most hearts an owner can have: the biggest dog's, with every gear's raise.
  const gearModifiers = modifiersOf(Object.values(gameData.shopGear).flatMap((g) => g.effects));
  const mostHearts = Math.max(
    ...Object.values(gameData.dogs).map((dog) => maxHearts(gameData.tuning, gearModifiers, dog)),
  );
  const card = { ...DOG_CARD.size, x: 0, y: 0 };
  const lead = { ...pngSize("images/ui-lead-tag.png"), ...DOG_CARD.lead };
  const { face } = DOG_CARD.owner;
  // The owner's photo: its ink frame and white mat, 2px round the face.
  const ownerPhoto = { height: face.size + 4, width: face.size + 4, x: face.x - 2, y: face.y - 2 };
  const heartRects = (max: number) =>
    cardHearts(max, max).map((cell) => ({ ...HEART_SIZE, x: cell.x, y: cell.y }));

  it("fits the most hearts an owner can have on one row", () => {
    expect(mostHearts).toBeLessThanOrEqual(DOG_CARD.hearts.perRow);
    expect(new Set(cardHearts(mostHearts, mostHearts).map(({ y }) => y))).toEqual(
      new Set([DOG_CARD.hearts.y]),
    );
  });

  it.each([DOG_CARD.hearts.perRow, mostHearts])(
    "keeps every heart of %i inside the card, under the owner's photo and clear of LEAD",
    (max) => {
      const hit = heartRects(max).filter(
        (heart) => overlaps(heart, lead) || overlaps(heart, ownerPhoto) || !inside(heart, card),
      );
      expect(hit).toEqual([]);
    },
  );

  // ui-dog-card's heart-loss flash, from its first frame's opaque pixels.
  const flashArea = (() => {
    const sheet = JSON.parse(
      readFileSync(new URL("../../public/art/sprites/ui-dog-card.json", import.meta.url), "utf8"),
    ) as {
      frames: Record<string, { frame: { h: number; w: number; x: number; y: number } }>;
      meta: { frameTags: { from: number; name: string }[] };
    };
    const from = sheet.meta.frameTags.find(({ name }) => name === "heart-loss")?.from ?? -1;
    const frame = Object.values(sheet.frames)[from]?.frame ?? { h: 0, w: 0, x: 0, y: 0 };
    const image = decodePng(
      readFileSync(new URL("../../public/art/sprites/ui-dog-card.png", import.meta.url)),
    );
    const area = opaqueRect(image, { height: frame.h, width: frame.w, x: frame.x, y: frame.y });
    return area === undefined ? undefined : { ...area, x: area.x - frame.x, y: area.y - frame.y };
  })();

  it("flashes a heart loss over every heart of the most an owner can have, clear of the owner's photo", () => {
    expect(flashArea).toBeDefined();
    const area = flashArea ?? card;
    expect(heartRects(mostHearts).filter((heart) => !inside(heart, area))).toEqual([]);
    expect(overlaps(area, ownerPhoto)).toBe(false);
  });

  it("keeps LEAD inside the card", () => {
    expect(inside(lead, card)).toBe(true);
  });

  it("centres Empty's capitals in the card's outline", () => {
    const { empty, size } = DOG_CARD;
    expect(empty.x).toBe(size.width / 2);
    expect(empty.y + Math.floor(TITLE_CAP_ROWS / 2)).toBe(Math.floor(size.height / 2));
  });

  it("keeps the owner's photo inside the card, right of the dog's", () => {
    const dogFace = frameSize(dogFaceKey(gameData, "koda"));
    expect(inside(ownerPhoto, card)).toBe(true);
    expect(ownerPhoto.x).toBeGreaterThan(DOG_CARD.dogFace.x + dogFace.width);
  });

  it.each(owners)("draws the card face of %s's owner, %s, the photo's size", (dog) => {
    expect(frameSize(ownerCardFaceKey(gameData, dog))).toEqual({
      height: face.size,
      width: face.size,
    });
  });

  it("centres FIRED in the dog's photo, clear of the owner's", () => {
    const width = titleWidth(gameData.runText.fired);
    const { dogFace, fired } = DOG_CARD;
    const left = fired.x - Math.floor(width / 2);
    const text = { height: TITLE_CAP_ROWS, width, x: left, y: fired.y };
    const photo = { ...frameSize(dogFaceKey(gameData, "koda")), ...dogFace };
    expect(inside(text, photo)).toBe(true);
    expect(overlaps(text, ownerPhoto)).toBe(false);
  });

  // Each line of the owner's name as the card sets it: its ink from the top of its capitals to
  // its lowest ink, from owner.x.
  const nameRects = (name: string) =>
    ownerNameLines(inkRight, name).map((line) => ({
      height: inkRowsFromCapTop(BODY),
      width: inkRight(line.text),
      x: DOG_CARD.owner.x,
      y: line.top,
    }));

  it.each(owners)(
    "fits the name of %s's owner, %s, beside their photo within the room, one line when it fits",
    (_dog, name) => {
      const lines = ownerNameLines(inkRight, name);
      expect(lines).toHaveLength(inkRight(name) <= DOG_CARD.owner.room ? 1 : 2);
      expect(lines.map(({ text }) => text).join(" ")).toBe(name);
      expect(lines.filter(({ text }) => inkRight(text) > DOG_CARD.owner.room)).toEqual([]);
    },
  );

  it.each(owners)(
    "keeps the name of %s's owner, %s, inside the card, clear of the photos and over the hearts",
    (_dog, name) => {
      const hearts = heartRects(mostHearts);
      const hit = nameRects(name).filter(
        (rect) =>
          !inside(rect, card) ||
          overlaps(rect, ownerPhoto) ||
          overlaps(rect, lead) ||
          hearts.some((heart) => overlaps(rect, heart)),
      );
      expect(hit).toEqual([]);
    },
  );

  const { oneLine, twoLines } = DOG_CARD.owner.tops;
  it.each<[string, string, number, { text: string; top: number }[]]>([
    ["a name that fits on one line", "Ab Cd", 0, [{ text: "Ab Cd", top: oneLine }]],
    [
      "a name one pixel too wide at its first space",
      "Ab Cd",
      1,
      [
        { text: "Ab", top: twoLines[0] },
        { text: "Cd", top: twoLines[1] },
      ],
    ],
    [
      "a three-word name too wide at its first space only",
      "Ab Cd Ef",
      1,
      [
        { text: "Ab", top: twoLines[0] },
        { text: "Cd Ef", top: twoLines[1] },
      ],
    ],
    ["a name too wide with no space on one line", "Abcdef", 1, [{ text: "Abcdef", top: oneLine }]],
  ])("sets %s", (_case, name, over, expected) => {
    const rightEdge = (line: string) => (line === name ? DOG_CARD.owner.room + over : 0);
    expect(ownerNameLines(rightEdge, name)).toEqual(expected);
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

// The neighborhood's name from name.x and "n of N" right-aligned to progress.right, both at 1x
// in the body font, stay in the well and apart, for every zone beside the widest count.
describe("the walk bar's neighborhood name and count", () => {
  const { name, progress, textGap } = WALK_BAR.zone;
  const well = BAR.zoneWell;
  const body = fontFileMetrics("font-body");
  const inkOf = (text: string) =>
    fontInk("font-body", { letterSpacing: 0, scale: 1 }, plainMarks(text));
  const counts = Array.from({ length: walkLength(gameData) }, (_, i) =>
    zoneProgressText(gameData, i),
  );
  const widest = counts.reduce((a, b) => (bodyTextWidth(1, b) > bodyTextWidth(1, a) ? b : a), "");
  const progressInk = inkOf(widest);
  // Phaser right-aligns the label on its advances, the last glyph's spacing included.
  const progressLeft = progress.right + 1 - bodyTextWidth(1, plainMarks(widest));

  it("keeps the widest count inside the well's right edge", () => {
    expect(progressLeft + progressInk.left).toBeGreaterThan(well.x);
    expect(progressLeft + progressInk.right).toBeLessThan(well.x + well.width);
  });

  it.each(gameData.world.zones.map((zone) => zone.name))(
    "fits %j beside the widest count",
    (zoneName) => {
      const ink = inkOf(zoneName);
      expect(name.x + ink.left).toBeGreaterThan(well.x);
      expect(name.x + ink.right + textGap).toBeLessThanOrEqual(progressLeft + progressInk.left);
      expect(bodyTextWidth(1, plainMarks(zoneName))).toBeLessThanOrEqual(
        zoneNameRoom(bodyTextWidth(1, plainMarks(widest))),
      );
    },
  );

  it("keeps both texts' rows inside the well", () => {
    for (const y of [name.y, progress.y]) {
      expect(y).toBeGreaterThan(well.y);
      expect(y + inkRowsFromCapTop(body)).toBeLessThanOrEqual(well.y + well.height);
    }
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
    ["the neighborhood well's column over an effect", 1, centre(BAR.zoneWell), undefined],
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
