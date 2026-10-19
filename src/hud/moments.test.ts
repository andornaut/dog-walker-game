import { describe, expect, it } from "vitest";

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
  firingLayout,
  firingShowMs,
  lowHeartDogs,
  MOMENTS,
  newlyLow,
  type PayoutCue,
  payoutFlights,
  payoutMs,
  trotOffX,
} from "./moments";

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
  it("places the face, pop, plate, line and tail from the slot's corner", () => {
    expect(firingLayout({ x: 120, y: 470 })).toEqual({
      face: { x: 180, y: 436 },
      line: { x: 180, y: 398 },
      plate: { height: 28, width: 72, x: 144, y: 468 },
      pop: { x: 116, y: 372 },
      tail: { x: 180, y: 397 },
    });
  });

  it("centres the 2x pop on the 2x face", () => {
    const { face, pop } = firingLayout({ x: 240, y: 470 });
    expect({ x: pop.x + 64, y: pop.y + 64 }).toEqual(face);
  });

  it("points the line's tail down at the top of the 2x face, under the bubble", () => {
    const { face, line, tail } = firingLayout({ x: 0, y: 470 });
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
