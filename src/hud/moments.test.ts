import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { SCREEN_CONFIG } from "../data/screen";
import type { DogId } from "../data/types";
import { screenLayout } from "../layout/screenLayout";
import type { Rect } from "../lib/rect";
import { maxHearts } from "../rules/dogs";
import { modifiersOf } from "../rules/modifiers";
import { faceMood } from "../rules/treats";
import { cents, clampHearts } from "../rules/units";
import type { Pack } from "../state/runState";
import { bodyRunWidth } from "../testing/bodyFont";
import { defined } from "../testing/defined";
import { fitInFont, fontFileMetrics } from "../testing/fontInk";
import { PACK_PLACES } from "../testing/packPlaces";
import { inkRowsFromCapTop } from "../ui/fontMetrics";
import { plainMarks } from "../ui/pixelFont";
import type { TextFitStyle } from "../ui/textFit";
import { fittingFaceRows, inlineFaceBox } from "./faceText";
import { linePanels } from "./messageStrip";
import {
  arcControl,
  bowRightControl,
  bubbleX,
  cardOwnerMood,
  curvePoint,
  DOWN_TAILS,
  downTail,
  endScreenDelayMs,
  FIRED_LINE,
  FIRED_LINE_FIT,
  firedLineHeight,
  firedLineX,
  FIRING_PARTS,
  firingLayout,
  firingTimeline,
  LOW_CHIP,
  LOW_CHIP_FIT,
  lowChipPlace,
  lowHeartDogs,
  lowHeartsText,
  MOMENTS,
  newlyLow,
  PAYOUT_TAG,
  type PayoutCue,
  payoutFlights,
  payoutMs,
  payoutTagTop,
  trotOffX,
} from "./moments";
import { ownerTabRect } from "./walkHud";

const walking = (dog: "biscuit" | "duchess" | "kilo", hearts: number) =>
  ({ dog, hearts: clampHearts(10, hearts), status: "walking" }) as const;
const PACK: Pack = [
  walking("duchess", 1),
  { dog: "biscuit", status: "fired", zoneIndex: 0 },
  walking("kilo", 4),
];
const fee = (dog: PayoutCue["dog"], amount: number): PayoutCue => ({
  amount: cents(amount),
  dog,
  text: `+$${amount / 100} fee`,
});

describe("firingTimeline", () => {
  const { fadeMs, plateMs, popMs } = MOMENTS.firing;
  const holds = [0, (fadeMs + popMs) / 2000, 2, 3, 4.5];
  const cases = holds.flatMap((seconds) => [false, true].map((still) => ({ seconds, still })));

  it.each(cases)(
    "ends every part with a $seconds s hold, reduced motion $still",
    ({ seconds, still }) => {
      const timeline = firingTimeline(seconds, still);
      const ends = {
        face: timeline.fadeAtMs + timeline.fadeMs,
        line: timeline.fadeAtMs + timeline.fadeMs,
        plate: timeline.fadeAtMs + timeline.fadeMs,
        trot: timeline.trotMs,
      };
      const holdMs = seconds * 1000;
      expect(ends).toEqual({ face: holdMs, line: holdMs, plate: holdMs, trot: holdMs });
      expect(Math.max(timeline.popMs, timeline.plateMs)).toBeLessThanOrEqual(timeline.fadeAtMs);
    },
  );

  it.each([
    { name: "plays in full in a long hold", seconds: 3, still: false, want: [popMs, plateMs] },
    {
      name: "sets the face and plate in place with reduced motion",
      seconds: 3,
      still: true,
      want: [0, 0],
    },
    {
      name: "plays no intro in a hold no longer than its fade",
      seconds: fadeMs / 1000,
      still: false,
      want: [0, 0],
    },
  ])("pops the face and drops the plate: $name", ({ seconds, still, want }) => {
    const { plateMs: plate, popMs: pop } = firingTimeline(seconds, still);
    expect([pop, plate]).toEqual(want);
  });
});

describe("firingLayout", () => {
  const { dogSlots: cards, screen: whole, walkView: screen } = screenLayout(SCREEN_CONFIG);
  const { popSize } = FIRING_PARTS;

  const FACE_HALF = 32;
  // Each part's rect on screen for card: the 2x face, the plate, the pop and the line's tail
  // tips (the bubble keeps under the bank's lane, below).
  const partRects = (card: Rect): Rect[] => {
    const { face, plate, pop, tail } = firingLayout(screen, card);
    const faceRect = {
      height: 2 * FACE_HALF,
      width: 2 * FACE_HALF,
      x: face.x - FACE_HALF,
      y: face.y - FACE_HALF,
    };
    const tails = DOWN_TAILS.map(({ height }) => ({ height, width: 0, ...tail }));
    return [faceRect, plate, { height: popSize, width: popSize, ...pop }, ...tails];
  };

  it.each(cards.map((card, i) => [i, card] as const))(
    "centres card %i's 2x face over its owner's tab, the 2x pop level with it",
    (_i, card) => {
      const { face, pop } = firingLayout(screen, card);
      const tab = ownerTabRect(card);
      expect(face.x).toBe(tab.x + tab.width / 2);
      expect(face.y).toBeLessThan(tab.y);
      expect(pop.y + popSize / 2).toBe(face.y);
    },
  );

  it.each(cards.map((card, i) => [i, card] as const))(
    "keeps every part of card %i's moment on screen and above the card",
    (_i, card) => {
      for (const rect of partRects(card)) {
        expect(rect.x).toBeGreaterThanOrEqual(whole.x);
        expect(rect.x + rect.width).toBeLessThanOrEqual(whole.x + whole.width);
        expect(rect.y).toBeGreaterThanOrEqual(whole.y);
        expect(rect.y + rect.height).toBeLessThanOrEqual(card.y);
      }
    },
  );

  it.each<[string, number, number]>([
    ["centres the pop on a face with room either side", 1, 0],
    ["moves the pop right of the screen's left edge", 0, 1],
    ["moves the pop left of the screen's right edge", cards.length - 1, -1],
  ])("%s", (_name, slot, direction) => {
    const card = cards[slot] ?? screen;
    const { face, pop } = firingLayout(screen, card);
    const offset = Math.sign(pop.x + popSize / 2 - face.x);
    expect(offset).toBe(direction);
    if (direction !== 0) {
      expect(direction > 0 ? pop.x : pop.x + popSize).toBe(
        direction > 0 ? screen.x : screen.x + screen.width,
      );
    }
  });

  it.each(cards.map((card, i) => [i, card] as const))(
    "puts card %i's plate under the 2x face, over the card's top and within its sides",
    (_i, card) => {
      const { face, plate } = firingLayout(screen, card);
      expect(plate.y).toBeGreaterThanOrEqual(face.y + FACE_HALF);
      expect(plate.x).toBeGreaterThanOrEqual(card.x);
      expect(plate.x + plate.width).toBeLessThanOrEqual(card.x + card.width);
      expect(plate.y + plate.height).toBeLessThan(card.y);
    },
  );

  it("points the line's tail down at the top of the 2x face, under the bubble", () => {
    const { face, line, tail } = firingLayout(screen, cards[0] ?? { x: 0, y: 0 });
    expect(tail.x).toBe(face.x);
    expect(tail.y).toBe(line.y - 1);
    for (const { height } of DOWN_TAILS) {
      expect(tail.y + height).toBeLessThanOrEqual(face.y - FACE_HALF);
    }
  });
});

describe("downTail", () => {
  it("takes the quip's down tail, tip at column 5, and the hint's while it is missing", () => {
    expect(downTail(() => true)).toMatchObject({ key: "ui-quip-tail-down", tipX: 5 });
    expect(downTail((key) => key === "ui-hint-tail")).toMatchObject({ key: "ui-hint-tail" });
    expect(downTail(() => false)).toBeUndefined();
  });
});

// The screen's gutter, which every bubble keeps from either edge.
const GUTTER = 8;

describe("bubbleX", () => {
  it.each([
    ["centres a bubble on its speaker", 180, 130],
    ["keeps a bubble by the left edge inside the gutter", 20, GUTTER],
    ["keeps a bubble by the right edge inside the gutter", 340, 360 - GUTTER - 100],
  ])("%s", (_name, centreX, expected) => {
    expect(bubbleX(360, centreX, 100)).toBe(expected);
  });
});

describe("firedLineX", () => {
  // A tail 8 wide over the faces of slots 0, 1 and 2.
  const tails = [55, 175, 295].map((x) => ({ width: 8, x }));
  it.each<[string, { width: number; x: number }[], number, number, number | undefined]>([
    ["centres a lone bubble over its tail", [], 1, 100, 129],
    ["keeps a lone bubble inside the gutter", [], 0, 140, GUTTER],
    ["centres a bubble clear of an open one", [{ width: 100, x: 2 }], 1, 100, 129],
    ["opens beside an open bubble it would overlap", [{ width: 150, x: 2 }], 1, 150, 154],
    ["opens left of an open bubble on its right", [{ width: 150, x: 208 }], 1, 150, 56],
    ["waits while beside would leave its tail", [{ width: 100, x: 40 }], 0, 100, undefined],
    ["waits while beside would leave the screen", [{ width: 180, x: 90 }], 2, 120, undefined],
    ["waits while beside would cross the gutter", [{ width: 100, x: 108 }], 0, 100, undefined],
    [
      "waits while the room between two open bubbles is too small",
      [
        { width: 100, x: 2 },
        { width: 100, x: 258 },
      ],
      1,
      160,
      undefined,
    ],
  ])("%s", (_name, open, slot, width, expected) => {
    expect(firedLineX(360, open, tails[slot] ?? { width: 8, x: 0 }, width)).toBe(expected);
  });
});

describe("trotOffX", () => {
  const road = { width: 360, x: 0 };
  it("leaves by the nearer edge, just out of sight", () => {
    expect(trotOffX(road, 16, 150)).toBe(-16);
    expect(trotOffX(road, 16, 300)).toBe(376);
  });
});

describe("lowHeartDogs and newlyLow", () => {
  it("finds the walking owners on their last heart, not fired ones", () => {
    expect(lowHeartDogs(PACK)).toEqual(["duchess"]);
  });

  it("cues only an owner who has just dropped to their last heart", () => {
    expect(newlyLow([], ["duchess"])).toEqual(["duchess"]);
    expect(newlyLow(["duchess"], ["duchess"])).toEqual([]);
    expect(newlyLow(["duchess"], ["duchess", "kilo"])).toEqual(["kilo"]);
  });
});

describe("cardOwnerMood", () => {
  // Every max a dog can have, at any place in a pack, with no gear and with every gear's raise.
  const gear = modifiersOf(Object.values(gameData.shopGear).flatMap((g) => g.effects));
  const maxes = [
    ...new Set(
      Object.values(gameData.dogs).flatMap((dog) =>
        PACK_PLACES.flatMap((place) => [
          maxHearts(gameData.tuning, [], place, dog),
          maxHearts(gameData.tuning, gear, place, dog),
        ]),
      ),
    ),
  ];
  const cases = maxes.flatMap((max) =>
    Array.from({ length: max + 1 }, (_, hearts) => [max, hearts] as const),
  );

  it.each(cases)(
    "shows a walking dog's owner (max %i) at %i hearts worried on the last heart, else as the dog's face",
    (max, hearts) => {
      const mood = cardOwnerMood(gameData, max, walking("kilo", hearts));
      expect(mood).toBe(hearts === MOMENTS.lowHearts ? "worried" : faceMood(gameData, max, hearts));
    },
  );

  it.each(Array.from({ length: gameData.tuning.hearts.maxOwnerHearts }, (_, i) => i + 1))(
    "shows a full owner (max %i) happy, or worried when full is the last heart",
    (max) => {
      expect(cardOwnerMood(gameData, max, walking("kilo", max))).toBe(
        max === MOMENTS.lowHearts ? "worried" : "happy",
      );
    },
  );

  it.each(maxes)("shows a fired dog's owner (max %i) fired", (max) => {
    expect(cardOwnerMood(gameData, max, { dog: "kilo", status: "fired", zoneIndex: 0 })).toBe(
      "fired",
    );
  });
});

describe("payoutTagTop", () => {
  const { dogSlots } = screenLayout(SCREEN_CONFIG);

  it.each(dogSlots.map((slot, i) => [i, slot] as const))(
    "starts slot %i's tag above its roof, clear of its faces and hearts",
    (_, slot) => {
      expect(payoutTagTop(slot) + PAYOUT_TAG.height + PAYOUT_TAG.gap).toBe(slot.y);
    },
  );
});

describe("payoutFlights", () => {
  const cues = [fee("kilo", 2000), fee("duchess", 2000), fee("biscuit", 3000)];

  it("sends each paid dog's coins in slot order, staggered, and skips dogs not in the pack", () => {
    const { flightMs, staggerMs } = MOMENTS.payout;
    const flights = payoutFlights(cues, PACK, false);
    expect(
      flights.map(({ dog, landMs, slot, startMs }) => ({ dog, landMs, slot, startMs })),
    ).toEqual([
      { dog: "duchess", landMs: flightMs, slot: 0, startMs: 0 },
      { dog: "biscuit", landMs: staggerMs + flightMs, slot: 1, startMs: staggerMs },
      { dog: "kilo", landMs: 2 * staggerMs + flightMs, slot: 2, startMs: 2 * staggerMs },
    ]);
  });

  it("lands every amount at once with reduced motion", () => {
    const flights = payoutFlights(cues, PACK, true);
    expect(flights.every(({ landMs, startMs }) => landMs === 0 && startMs === 0)).toBe(true);
    expect(payoutMs(flights)).toBe(MOMENTS.payout.chipMs);
  });

  it("lasts until the last amount has faded at the bank, or not at all with no fees", () => {
    const { chipMs, flightMs, staggerMs } = MOMENTS.payout;
    expect(payoutMs(payoutFlights(cues, PACK, false))).toBe(2 * staggerMs + flightMs + chipMs);
    expect(payoutMs([])).toBe(0);
  });
});

describe("endScreenDelayMs", () => {
  it("waits for the longer of a final firing and a final payout", () => {
    expect(endScreenDelayMs({ firingSeconds: 1, payoutMs: 0 })).toBe(1000);
    expect(endScreenDelayMs({ firingSeconds: 0, payoutMs: 1950 })).toBe(1950);
    expect(endScreenDelayMs({ firingSeconds: 0, payoutMs: 0 })).toBe(0);
  });
});

describe("curvePoint", () => {
  const from = { x: 112, y: 21 };
  const to = { x: 40, y: 246 };

  it("starts at from and ends at to", () => {
    const control = arcControl(from, to, 40);
    expect(curvePoint(from, control, to, 0)).toEqual(from);
    expect(curvePoint(from, control, to, 1)).toEqual(to);
  });

  it("throws a treat up above both ends on the way", () => {
    expect(curvePoint(from, arcControl(from, to, 40), to, 0.25).y).toBeLessThan(from.y);
    const level = { x: 100, y: 100 };
    const start = { x: 0, y: 100 };
    expect(curvePoint(start, arcControl(start, level, 40), level, 0.5)).toEqual({ x: 50, y: 60 });
  });

  it("bows a coin's path right of the straight line", () => {
    const roof = { x: 40, y: 214 };
    const bank = { x: 16, y: 21 };
    const middle = curvePoint(roof, bowRightControl(roof, bank, 48), bank, 0.5);
    expect(middle).toEqual({ x: 28 + 48, y: 117.5 });
  });
});

const BODY = fontFileMetrics("font-body");
const SLOTS = screenLayout(SCREEN_CONFIG).dogSlots;
const DOGS = Object.keys(gameData.dogs) as DogId[];
const boxAt = (style: TextFitStyle) => inlineFaceBox(BODY, style.scale);

// Every owner's low-hearts line, over every card, fits on one line led by the owner's face on
// a chip kept on screen and clear of the card's top: the chip holds the body font's ink at the
// line's scale padTop and padBottom inside it, and the face faceInset inside it.
describe("the low-hearts chip", () => {
  it.each(
    SLOTS.flatMap((slot, i) =>
      DOGS.map((dog) => [i, gameData.dogs[dog].owner.name, dog, slot] as const),
    ),
  )("over card %i keeps %s's line, led by their face, on screen", (_i, name, dog, slot) => {
    const said = lowHeartsText(gameData, dog);
    const line = { ...said, text: plainMarks(said.text) };
    const fitted = fittingFaceRows(
      LOW_CHIP_FIT.styles,
      bodyRunWidth,
      boxAt,
      LOW_CHIP_FIT.room,
      line,
    );
    const [row] = fitted.rows;
    expect(fitted.rows).toHaveLength(1);
    expect(row?.width).toBeLessThanOrEqual(LOW_CHIP_FIT.room);
    expect(row?.faces.map((face) => face.dog)).toEqual([dog]);
    expect(row?.texts.some(({ text }) => text.startsWith(name))).toBe(true);
    const face = defined(boxAt(fitted.style));
    const { scale } = fitted.style;
    const width = Math.ceil(row?.width ?? 0);
    const { box, text: caps } = lowChipPlace(BODY, SCREEN_CONFIG.width, slot, {
      face,
      scale,
      width,
    });
    const frameTop = caps.y - face.rise;
    const inkBottom = caps.y + inkRowsFromCapTop(BODY) * scale;
    const bottom = box.y + box.height;
    expect(box.x).toBeGreaterThanOrEqual(LOW_CHIP.margin);
    expect(box.x + box.width).toBeLessThanOrEqual(SCREEN_CONFIG.width - LOW_CHIP.margin);
    expect(caps.y - box.y).toBeGreaterThanOrEqual(LOW_CHIP.padTop);
    expect(bottom - inkBottom).toBeGreaterThanOrEqual(LOW_CHIP.padBottom);
    expect(frameTop - box.y).toBe(Math.max(LOW_CHIP.faceInset, LOW_CHIP.padTop - face.rise));
    expect(bottom - (frameTop + face.framed)).toBeGreaterThanOrEqual(LOW_CHIP.faceInset);
    expect(bottom).toBe(slot.y - LOW_CHIP.gap);
  });
});

// Every owner's fired line wraps onto the bubble's lines at 2x, and the bubble, grown up from
// over the face, stays under the lowest the message strip reaches, under any count of debuff
// bars.
describe("a fired line's bubble", () => {
  const { topBar } = screenLayout(SCREEN_CONFIG);
  const bars = Array.from({ length: Object.keys(gameData.debuffs).length + 1 }, (_, i) => i);
  const panels = bars.flatMap((count) => linePanels(BODY, count, topBar));
  const stripBottom = Math.max(...panels.map((panel) => panel.y + panel.height));
  const fired = Object.values(gameData.quips).flatMap(({ fired: lines }) => lines);
  it.each(fired)("holds %j", (text) => {
    const plain = plainMarks(text);
    const fitted = fitInFont("font-body", FIRED_LINE_FIT.styles, FIRED_LINE_FIT.room, plain);
    expect(fitted.lines.length).toBeLessThanOrEqual(FIRED_LINE.lines);
    expect(fitted.widest).toBeLessThanOrEqual(FIRED_LINE_FIT.room);
    for (const slot of SLOTS) {
      const top =
        firingLayout(screenLayout(SCREEN_CONFIG).walkView, slot).line.y -
        firedLineHeight(BODY, fitted.lines.length);
      expect(top).toBeGreaterThanOrEqual(stripBottom);
    }
  });

  it("pads the first line's capitals and the last line's lowest ink alike", () => {
    const ink = (BODY.lineHeight + inkRowsFromCapTop(BODY)) * FIRED_LINE.scale;
    expect(firedLineHeight(BODY, 2)).toBe(2 * FIRED_LINE.padding + ink);
  });
});
