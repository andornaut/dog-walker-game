import { describe, expect, it } from "vitest";

import { SCREEN_CONFIG } from "../data/screen";
import { screenLayout } from "../layout/screenLayout";
import { cents, clampHearts } from "../rules/units";
import type { Pack } from "../state/runState";
import {
  arcControl,
  bowRightControl,
  bubbleX,
  curvePoint,
  DOWN_TAILS,
  downTail,
  endScreenDelayMs,
  firedLineX,
  FIRING_PARTS,
  firingLayout,
  firingShowMs,
  lowHeartDogs,
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

const walking = (dog: "biscuit" | "duchess" | "koda", hearts: number) =>
  ({ dog, hearts: clampHearts(10, hearts), status: "walking" }) as const;
const PACK: Pack = [
  walking("duchess", 1),
  { dog: "biscuit", status: "fired", zoneIndex: 0 },
  walking("koda", 4),
];
const fee = (dog: PayoutCue["dog"], amount: number): PayoutCue => ({
  amount: cents(amount),
  dog,
  text: `+$${amount / 100} fee`,
});

describe("firingShowMs", () => {
  it("ends the face and plate just before the stop, never below zero", () => {
    expect(firingShowMs(1)).toBe(1000 - MOMENTS.firingEndMarginMs);
    expect(firingShowMs(0)).toBe(0);
  });
});

describe("firingLayout", () => {
  const { dogSlots: cards, walkView: screen } = screenLayout(SCREEN_CONFIG);
  const { popSize } = FIRING_PARTS;

  it.each(cards.map((card, i) => [i, card] as const))(
    "centres card %i's 2x face on its owner's tab, the 2x pop level with it and whole on screen",
    (_i, card) => {
      const { face, pop } = firingLayout(screen, card);
      const tab = ownerTabRect(card);
      expect(face).toEqual({ x: tab.x + tab.width / 2, y: tab.y + tab.height / 2 });
      expect(pop.y + popSize / 2).toBe(face.y);
      expect(pop.x).toBeGreaterThanOrEqual(screen.x);
      expect(pop.x + popSize).toBeLessThanOrEqual(screen.x + screen.width);
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
    "puts card %i's plate on the card under the 2x face, as wide as its name and inside it",
    (_i, card) => {
      const { face, plate } = firingLayout(screen, card);
      expect(plate.y).toBeGreaterThan(face.y + 32);
      expect(plate.x).toBeGreaterThanOrEqual(card.x);
      expect(plate.x + plate.width).toBeLessThanOrEqual(card.x + card.width);
      expect(plate.y + plate.height).toBeLessThanOrEqual(card.y + card.height);
    },
  );

  it("points the line's tail down at the top of the 2x face, under the bubble", () => {
    const { face, line, tail } = firingLayout(screen, cards[0] ?? { x: 0, y: 0 });
    expect(tail.x).toBe(face.x);
    expect(tail.y).toBe(line.y - 1);
    for (const { height } of DOWN_TAILS) {
      expect(tail.y + height).toBeLessThanOrEqual(face.y - 32);
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

describe("bubbleX", () => {
  it("centres a bubble on its speaker, kept 2px inside the screen", () => {
    expect(bubbleX(360, 180, 100)).toBe(130);
    expect(bubbleX(360, 20, 100)).toBe(2);
    expect(bubbleX(360, 340, 100)).toBe(258);
  });
});

describe("firedLineX", () => {
  // A tail 8 wide over the faces of slots 0, 1 and 2.
  const tails = [55, 175, 295].map((x) => ({ width: 8, x }));
  it.each<[string, { width: number; x: number }[], number, number, number | undefined]>([
    ["centres a lone bubble over its tail", [], 1, 100, 129],
    ["keeps a lone bubble on screen", [], 0, 140, 2],
    ["centres a bubble clear of an open one", [{ width: 100, x: 2 }], 1, 100, 129],
    ["opens beside an open bubble it would overlap", [{ width: 150, x: 2 }], 1, 150, 154],
    ["opens left of an open bubble on its right", [{ width: 150, x: 208 }], 1, 150, 56],
    ["waits while beside would leave its tail", [{ width: 100, x: 40 }], 0, 100, undefined],
    ["waits while beside would leave the screen", [{ width: 180, x: 90 }], 2, 120, undefined],
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
    expect(newlyLow(["duchess"], ["duchess", "koda"])).toEqual(["koda"]);
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
  const cues = [fee("koda", 2000), fee("duchess", 2000), fee("biscuit", 3000)];

  it("sends each paid dog's coins in slot order, staggered, and skips dogs not in the pack", () => {
    const { flightMs, staggerMs } = MOMENTS.payout;
    const flights = payoutFlights(cues, PACK, false);
    expect(
      flights.map(({ dog, landMs, slot, startMs }) => ({ dog, landMs, slot, startMs })),
    ).toEqual([
      { dog: "duchess", landMs: flightMs, slot: 0, startMs: 0 },
      { dog: "biscuit", landMs: staggerMs + flightMs, slot: 1, startMs: staggerMs },
      { dog: "koda", landMs: 2 * staggerMs + flightMs, slot: 2, startMs: 2 * staggerMs },
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
