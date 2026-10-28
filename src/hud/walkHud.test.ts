import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { decodePng } from "../assets/atlas/atlasBuild";
import { opaqueRect } from "../assets/atlas/atlasPixels";
import { dogFaceKey, ownerCardFaceKey } from "../assets/spriteKeys";
import { gameData } from "../data";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen";
import type { DebuffId, DogId } from "../data/types";
import { dollarAmountText } from "../home/home";
import { keysOf } from "../lib/records";
import { type Point, type Rect, rectsOverlap } from "../lib/rect";
import { maxHearts } from "../rules/dogs";
import { modifiersOf } from "../rules/modifiers";
import { walkLength } from "../rules/route";
import { cents, pixels, read } from "../rules/units";
import { zoneLength } from "../runner/walk";
import { bodyTextWidth } from "../testing/bodyFont";
import { fontFileMetrics, fontInk } from "../testing/fontInk";
import { LONE } from "../testing/packPlaces";
import { inside } from "../testing/rects";
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
  ownerNameLines,
  ownerTabRect,
  TITLE_CAP_ROWS,
  WALK_BAR,
  WALK_BAR_BUTTONS,
  walkBarLayout,
  ZONE_PROGRESS,
  zoneProgressLayout,
  zoneProgressText,
  zoneShare,
} from "./walkHud";

const LAYOUT = SCREEN_LAYOUT;
const { dogSlots, topBar } = LAYOUT;
const BAR = walkBarLayout(topBar);
const WELLS = BAR.effectWells.length;

const centre = (rect: Rect): Point => ({
  x: rect.x + Math.floor(rect.width / 2),
  y: rect.y + Math.floor(rect.height / 2),
});
const BODY = fontFileMetrics("font-body");

// The columns a line inks in the body font at 1x, from its left edge to its last ink.
const inkRight = (line: string) =>
  fontInk("font-body", { letterSpacing: 0, scale: 1 }, plainMarks(line)).right;

// Every dog's owner's name, by dog.
const owners = keysOf(gameData.dogs).map((dog) => [dog, gameData.dogs[dog].owner.name] as const);

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
    expect(inside(topBar, LAYOUT.screen)).toBe(true);
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
        expect(rectsOverlap(hold, hit)).toBe(false);
      }
    }
    for (const part of parts) {
      expect(inside(part, topBar)).toBe(true);
    }
    expect(rectsOverlap(WALK_BAR.cash.well, BAR.zoneWell)).toBe(false);
    for (const well of BAR.effectWells) {
      expect(rectsOverlap(well, BAR.zoneWell)).toBe(false);
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

  it("spans the cash well from the neighbourhood well's top to the effect wells' bottom", () => {
    const { cash, effects, zone } = WALK_BAR;
    expect(cash.well.y).toBe(zone.well.y);
    expect(cash.well.y + cash.well.height).toBe(effects.y + effects.size);
  });

  it("ends the neighbourhood well before the first button's hit area", () => {
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

  // The most cash a walk could plausibly reach, from the tuning: the purse, a full pack's pay in
  // every zone, every tip at Big tipper's value, every lucky find a kept wallet, and the Walk
  // bonus.
  const money = (key: Parameters<typeof read<"money">>[2]) => read(gameData.tuning, "money", key);
  const count = (key: Parameters<typeof read<"counts">>[2]) => read(gameData.tuning, "counts", key);
  const zones = walkLength(gameData);
  const busiest = Math.max(...gameData.world.zones.map(({ density }) => density.luckyFinds));
  const tipValue = money("tip") + money("bigTipperTipBonus");
  const perZone = (zone: number) =>
    count("packSizeMax") * money("payPerDog") +
    (count("tipsFirstZone") + count("tipsGainPerZone") * zone) * tipValue +
    Math.ceil(gameData.tuning.counts.luckyFindsPerZone.lostWallet * busiest) *
      money("lostWalletKeep");
  const plausible = cents(
    money("startPurse") +
      Array.from({ length: zones }, (_, zone) => perZone(zone)).reduce((a, b) => a + b, 0) +
      money("walkBonus"),
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
  it.each<[string, number, number, number]>([
    ["a one-zone walk with no Pocket", 0, 1, 2],
    ["a two-zone walk with a Pocket", 1, 2, 4],
    ["a four-zone walk with two Pocket items", 2, 4, 7],
  ])(
    "counts the perk, the Pocket, the found gear and a fork's upgrade each for %s",
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

describe("the neighbourhood's progress line", () => {
  const strip = LAYOUT.zoneProgress;
  const empty = zoneProgressLayout(strip, 0);
  const { track } = empty;
  const { border, colours } = ZONE_PROGRESS;

  it("fills the strip edge to edge: its borders and a row per fill colour", () => {
    expect(strip.height).toBe(2 * border + colours.fill.length);
    expect(strip.width).toBe(SCREEN_CONFIG.width);
    expect(empty.frame).toEqual(strip);
    expect(track).toEqual({
      height: strip.height - 2 * border,
      width: empty.frame.width - 2 * border,
      x: empty.frame.x + border,
      y: strip.y + border,
    });
  });

  it("keeps the strip under every dog card", () => {
    for (const slot of dogSlots) {
      expect(rectsOverlap(slot, strip)).toBe(false);
    }
  });

  const length = zoneLength(gameData);
  it.each<[string, number, number]>([
    ["empty at the neighbourhood's start", 0, 0],
    ["half full half way", length / 2, 0.5],
    ["full where the walk ends the neighbourhood", length, 1],
    ["full past the end", length * 2, 1],
  ])("is %s", (_name, distance, share) => {
    expect(zoneShare(gameData, { zoneDistance: pixels(distance) })).toBe(share);
  });

  it.each<[string, number, number]>([
    ["no pixels at the start", 0, 0],
    ["the whole pixels half way covers", 0.5, Math.floor(track.width / 2)],
    ["one pixel short just before the end", 1 - 1 / (2 * track.width), track.width - 1],
    ["the whole track at the end", 1, track.width],
  ])("grows its fill rows by %s", (_name, share, width) => {
    const { fills } = zoneProgressLayout(strip, share);
    expect(fills.map(({ colour }) => colour)).toEqual(colours.fill);
    fills.forEach((fill, i) => {
      expect(fill).toMatchObject({ height: 1, width, x: track.x, y: track.y + i });
    });
  });
});

describe("the dog cards", () => {
  it.each(dogSlots.map((slot, i) => [i, slot] as const))(
    "places card %i at the card's size just over the progress line, side by side",
    (i, slot) => {
      expect({ height: slot.height, width: slot.width }).toEqual(DOG_CARD.size);
      expect(slot.x).toBe(i * DOG_CARD.size.width);
      expect(slot.y + slot.height).toBe(LAYOUT.zoneProgress.y);
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

  // The most hearts an owner can have: any dog's, walked alone, with every gear's raise.
  const gearModifiers = modifiersOf(Object.values(gameData.shopGear).flatMap((g) => g.effects));
  const mostHearts = Math.max(
    ...Object.values(gameData.dogs).map((dog) =>
      maxHearts(gameData.tuning, gearModifiers, LONE, dog),
    ),
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
        (heart) =>
          rectsOverlap(heart, lead) || rectsOverlap(heart, ownerPhoto) || !inside(heart, card),
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
    expect(rectsOverlap(area, ownerPhoto)).toBe(false);
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
    const dogFace = frameSize(dogFaceKey(gameData, "kilo"));
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
    const photo = { ...frameSize(dogFaceKey(gameData, "kilo")), ...dogFace };
    expect(inside(text, photo)).toBe(true);
    expect(rectsOverlap(text, ownerPhoto)).toBe(false);
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
          rectsOverlap(rect, ownerPhoto) ||
          rectsOverlap(rect, lead) ||
          hearts.some((heart) => rectsOverlap(rect, heart)),
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
  it.each<[string, number[], 1 | 2]>([
    ["a name that fits at 2x", [room / 2], 2],
    ["a name one pixel too wide for 2x", [room / 2 + 1], 1],
    ["every name at 2x when all fit", [room / 2, room / 4], 2],
    ["every name at 1x when one is too wide for 2x", [room / 4, room / 2 + 1], 1],
  ])("sets %s", (_name, widths, scale) => {
    expect(cardNameFit(widths)).toEqual({ scale, top: DOG_CARD.name.tops[scale] });
  });

  it.each<[string, boolean[], number | undefined]>([
    ["the first dog while it walks", [true, true, true], 0],
    ["the next walking dog once the first is fired", [false, true, true], 1],
    ["no dog once all are fired", [false, false], undefined],
  ])("tags %s LEAD", (_name, walking, expected) => {
    expect(leadSlot(walking)).toBe(expected);
  });
});

describe("the owner's tab", () => {
  it.each(dogSlots.map((card, i) => [i, card, ownerTabRect(card)] as const))(
    "pops tab %i in centred on its card's top edge, overlapping the card's top",
    (_i, card, tab) => {
      expect(tab.x + tab.width / 2).toBe(card.x + card.width / 2);
      expect(tab.y).toBeLessThan(card.y);
      expect(tab.y + tab.height).toBeGreaterThan(card.y);
    },
  );
});

// The neighbourhood's name from name.x and "n of N" right-aligned to progress.right, both at 1x
// in the body font, stay in the well and apart, for every zone beside the widest count.
describe("the walk bar's neighbourhood name and count", () => {
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
  const dogs: (DogId | undefined)[] = ["kilo", "biscuit", undefined];
  const debuffs: DebuffId[] = ["muddy", "stinky"];
  const shown = (effects: number): ExplainShown => ({ debuffs, dogs, effects });
  const holdAt = (i: number) => centre(BAR.effectHolds[i] ?? topBar);
  const bars = debuffBarRects(topBar, debuffs.length);
  const button = centre(BAR.buttons[WALK_BAR_BUTTONS[0]].hit);
  const first: ExplainTarget = { effect: 0, kind: "effect" };
  const last: ExplainTarget = { effect: WELLS - 1, kind: "effect" };
  const muddy: ExplainTarget = { debuff: "muddy", kind: "debuff" };
  const stinky: ExplainTarget = { debuff: "stinky", kind: "debuff" };
  const kilo: ExplainTarget = { dog: "kilo", kind: "dog" };
  const biscuit: ExplainTarget = { dog: "biscuit", kind: "dog" };
  // What a press explains on the walk, and under the pause menu's dim, where the debuff bars
  // are the dim's.
  it.each<[string, number, Point, ExplainTarget | undefined, ExplainTarget | undefined]>([
    ["the first effect", 1, holdAt(0), first, first],
    [
      "the neighbourhood well's column over an effect",
      1,
      centre(BAR.zoneWell),
      undefined,
      undefined,
    ],
    ["an empty well", 1, holdAt(1), undefined, undefined],
    ["the last well with as many effects as wells", WELLS, holdAt(WELLS - 1), last, last],
    ["the cash well", 1, centre(WALK_BAR.cash.well), undefined, undefined],
    ["a button", 1, button, undefined, undefined],
    ["the first debuff bar", 0, centre(bars[0] ?? topBar), muddy, undefined],
    ["the second debuff bar", 0, centre(bars[1] ?? topBar), stinky, undefined],
    ["the first card", 0, centre(dogSlots[0] ?? topBar), kilo, kilo],
    ["the second card", 0, centre(dogSlots[1] ?? topBar), biscuit, biscuit],
    ["a card with no dog", 0, centre(dogSlots[2] ?? topBar), undefined, undefined],
    ["the road", 0, centre(LAYOUT.road), undefined, undefined],
  ])("finds what %s explains", (_name, effects, point, walking, dimmed) => {
    expect(explainTargetAt(LAYOUT, shown(effects), false, point)).toEqual(walking);
    expect(explainTargetAt(LAYOUT, shown(effects), true, point)).toEqual(dimmed);
  });
});
