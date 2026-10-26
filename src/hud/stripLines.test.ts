import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DebuffId } from "../data/types";
import { fillNames } from "../lib/lines";
import type { HeartChange } from "../rules/causes";
import { bumpHearts } from "../rules/run";
import { cents, clampHearts, read } from "../rules/units";
import { testState } from "../testing/runState";
import {
  bumpLine,
  debuffChanges,
  debuffLines,
  firedLine,
  forgivenLines,
  fullPackLine,
  lowHeartsLines,
  luckyLine,
  muddyHeartsLines,
  pullLine,
  STRIP_OWNER_MOODS,
  treatLine,
} from "./stripLines";

const { strip } = gameData.runText;
const koda = gameData.dogs.koda;
const owner = koda.owner.name;

const hearts = (
  before: number,
  after: number,
  causes: HeartChange["causes"] = [],
): HeartChange => ({
  after: clampHearts(9, after),
  before: clampHearts(9, before),
  causes,
  dog: "koda",
  kind: "hearts",
});
const secondChance: HeartChange["causes"][number] = {
  amount: 1,
  forgives: true,
  kind: "modifier",
  source: { kind: "walker", walker: "casey" },
};

const forgivenLoss = hearts(4, 4, [{ amount: -1, kind: "bump" }, secondChance]);

describe("bumpLine", () => {
  it("says a dodge, a hit's hearts lost past Second chance, and nothing for a loss forgiven whole", () => {
    const said = (change: HeartChange | null, dodged: boolean) =>
      bumpLine(gameData, { change, dodged, dog: "koda" }, "Cone")?.text ?? null;
    expect(said(null, true)).toBe(fillNames(strip.dodge, { dog: koda.name, obstacle: "cone" }));
    expect(said(hearts(4, 2), false)).toBe(
      fillNames(strip.plainHit, { dog: koda.name, hearts: "2", obstacle: "cone", owner }),
    );
    const softened = hearts(4, 3, [{ amount: -2, kind: "bump" }, secondChance]);
    expect(said(softened, false)).toBe(
      fillNames(strip.plainHit, { dog: koda.name, hearts: "1", obstacle: "cone", owner }),
    );
    // Its forgiven line says it.
    expect(said(forgivenLoss, false)).toBeNull();
  });
});

describe("the strip's other lines", () => {
  it("says each walk moment's line, and nothing where there is none", () => {
    const cases: [string, unknown, unknown][] = [
      [
        "a treat",
        treatLine(gameData, hearts(2, 3))?.text,
        fillNames(strip.treat, { dog: koda.name, hearts: "1", owner }),
      ],
      ["nothing for a treat at the max", treatLine(gameData, hearts(3, 3)), null],
      [
        "the last heart",
        lowHeartsLines(gameData, [hearts(2, 1)])[0]?.text,
        fillNames(strip.lowHearts, { owner }),
      ],
      ["no last heart already on one", lowHeartsLines(gameData, [hearts(1, 1)]), []],
      [
        "a firing",
        firedLine(gameData, "koda").text,
        fillNames(strip.fired, { dog: koda.name, owner }),
      ],
      ["a pull", pullLine(gameData, "koda").text, fillNames(strip.pull, { dog: koda.name })],
      [
        "the lost wallet's money",
        luckyLine(gameData, "lostWallet", [
          { amount: cents(1000), causes: [], dog: null, kind: "money" },
        ])?.text,
        fillNames(strip.luckyWallet, { amount: "$10" }),
      ],
      [
        "the Walk bonus",
        fullPackLine(gameData, [
          {
            amount: cents(3000),
            causes: [{ amount: 3000, kind: "bonus" }],
            dog: null,
            kind: "money",
          },
        ])?.text,
        fillNames(strip.fullPackHome, { amount: "$30" }),
      ],
      ["no bonus without one", fullPackLine(gameData, []), null],
      [
        "Second chance for a forgiven loss, and nothing for a plain one",
        forgivenLines(gameData, [forgivenLoss, hearts(4, 3, [{ amount: -1, kind: "bump" }])]),
        [
          {
            icon: { kind: "perk", perk: gameData.walkers.casey.perk },
            marks: [
              {
                at: strip.kindWords.indexOf("{owner}"),
                dog: "koda",
                length: owner.length,
                mood: STRIP_OWNER_MOODS.kindWords,
              },
            ],
            text: fillNames(strip.kindWords, { owner }),
          },
        ],
      ],
    ];
    for (const [name, line, expected] of cases) {
      expect(line, name).toEqual(expected);
    }
  });
});

describe("muddyHeartsLines", () => {
  it("warns an owner down to a Muddy bump's cost, leaving the last heart to its own line", () => {
    const calm = testState({ koda: 5 });
    const muddy = testState({ koda: 5 }, { debuffs: [{ debuff: "muddy", secondsLeft: 20 }] });
    const cost = bumpHearts(gameData, muddy);
    expect(cost).toBeGreaterThan(Math.max(1, bumpHearts(gameData, calm)));
    const warning = fillNames(strip.muddyHearts, {
      cost: String(cost),
      hearts: String(cost),
      owner,
    });
    const said = (run: typeof calm, change: HeartChange) =>
      muddyHeartsLines(gameData, run, [change]).map(({ text }) => text);
    expect(said(muddy, hearts(cost + 1, cost))).toEqual([warning]);
    expect(said(muddy, hearts(cost + cost, cost))).toEqual([warning]);
    expect(said(muddy, hearts(cost, 1))).toEqual([]);
    expect(said(muddy, hearts(9, cost + 1))).toEqual([]);
    expect(said(muddy, hearts(cost - 1, cost))).toEqual([]);
    expect(said(calm, hearts(cost + 1, cost))).toEqual([]);
  });
});

describe("debuffLines", () => {
  const active = (debuff: DebuffId, secondsLeft: number) => ({ debuff, secondsLeft, untilZone: 0 });
  const muddyHearts = String(read(gameData.tuning, "multipliers", "muddyBumpHearts"));

  it("announces every debuff starting and ending", () => {
    for (const debuff of Object.keys(gameData.debuffs) as DebuffId[]) {
      const on = { debuffs: [active(debuff, 20)] };
      const off = { debuffs: [] };
      expect(debuffLines(gameData, debuffChanges(off, on))).toEqual([
        {
          icon: debuff,
          text: fillNames(strip.debuffStart[debuff], { hearts: muddyHearts, seconds: "20" }),
        },
      ]);
      expect(debuffLines(gameData, debuffChanges(on, off))).toEqual([
        { icon: debuff, text: strip.debuffEnd[debuff] },
      ]);
    }
  });

  it("announces a debuff that restarts, and not one that counts down", () => {
    expect(
      debuffChanges({ debuffs: [active("muddy", 5)] }, { debuffs: [active("muddy", 20)] }),
    ).toEqual({ ended: [], started: [active("muddy", 20)] });
    expect(
      debuffChanges({ debuffs: [active("muddy", 5)] }, { debuffs: [active("muddy", 4)] }),
    ).toEqual({ ended: [], started: [] });
  });
});
