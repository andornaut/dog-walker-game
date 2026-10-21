import { describe, expect, expectTypeOf, it } from "vitest";

import { type Cents, type Hearts, read, type Seconds } from "../rules/units";
import type { Pack } from "../state/runState";
import { TUNING } from "./tuning";
import type {
  CardOptions,
  Dog,
  DogId,
  Encounter,
  EncounterId,
  HeartsEffect,
  Modifier,
  MoneyEffect,
  Upgrade,
  WalkerId,
} from "./types";

// Type-level checks: tsc (npm run check) fails if a @ts-expect-error line stops erroring.
const check = <T>(value: T): T => value;
const option = { art: "card-option", effects: [], name: "Option" };

describe("types", () => {
  it("reads each tuning group in its unit", () => {
    expectTypeOf(read(TUNING, "money", "tip")).toEqualTypeOf<Cents>();
    expectTypeOf(read(TUNING, "seconds", "laneMove")).toEqualTypeOf<Seconds>();
    expectTypeOf(read(TUNING, "counts", "luckyEncountersPerZone")).toEqualTypeOf<number>();
  });

  it("derives content ids from the data", () => {
    expectTypeOf<DogId>().toEqualTypeOf<
      | "biscuit"
      | "archie"
      | "duchess"
      | "koda"
      | "nugget"
      | "pierre"
      | "snowball"
      | "penny"
      | "zippy"
    >();
    expectTypeOf<WalkerId>().toBeString();
  });

  it("rejects a money key that is missing, from another unit, or a nested table", () => {
    // @ts-expect-error: no such money key
    check<MoneyEffect>({ amount: "nope", change: "lose", kind: "money" });
    // @ts-expect-error: a multiplier key, not a money key
    check<MoneyEffect>({ amount: "bigTipperTip", change: "lose", kind: "money" });
    // @ts-expect-error: a nested table, not an amount
    check<MoneyEffect>({ amount: "feeByTemperament", change: "lose", kind: "money" });
    // @ts-expect-error: a money key added to a hearts stat
    check<Modifier>({ by: "fannyPackStart", operation: "add", stat: "maxHearts" });
    expect(check<MoneyEffect>({ amount: "tip", change: "gain", kind: "money" }).kind).toBe("money");
  });

  it("limits a hearts change to -3 to 3, never 0", () => {
    // @ts-expect-error: beyond 3
    check<HeartsEffect>({ amount: 4, kind: "hearts", target: { kind: "all" } });
    // @ts-expect-error: a change of 0
    check<HeartsEffect>({ amount: 0, kind: "hearts", target: { kind: "all" } });
  });

  it("makes Hearts only through clampHearts", () => {
    // @ts-expect-error: a plain number is not Hearts
    check<Hearts>(3);
  });

  it("gives a card two or three options", () => {
    // @ts-expect-error: one option
    check<CardOptions>([option]);
    // @ts-expect-error: four options
    check<CardOptions>([option, option, option, option]);
    expect(check<CardOptions>([option, option])).toHaveLength(2);
  });

  it("requires an upgrade effect, every dog attribute and every encounter", () => {
    // @ts-expect-error: an upgrade with no effects
    check<Upgrade>({ effects: [], kind: "boost", name: "Nothing" });
    const owner = { name: "Pat", role: "baker" } as const;
    const noSize = { art: "rex", breed: "Mutt", look: "", name: "Rex", owner, price: "rex" };
    // @ts-expect-error: a dog with no size
    check<Dog>({ ...noSize, unlock: "shop" });
    // @ts-expect-error: encounters missing
    check<Record<EncounterId, Encounter>>({});
  });

  it("lets only a lucky encounter apply at once", () => {
    const instant = {
      art: "card-instant",
      effects: [{ amount: 1, kind: "hearts", target: { kind: "all" } }],
      kind: "instant",
    } as const;
    const base = { name: "Find" } as const;
    // @ts-expect-error: an obstacle always opens a card
    check<Encounter>({ ...base, kind: "obstacle", resolution: instant });
    expect(check<Encounter>({ ...base, kind: "lucky", resolution: instant }).kind).toBe("lucky");
  });

  it("holds 1 to 3 dogs in a pack", () => {
    // @ts-expect-error: an empty pack
    check<Pack>([]);
  });
});
