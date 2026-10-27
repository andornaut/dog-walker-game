import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { Debuff, DebuffId } from "../data/types";
import { fillNames } from "../lib/lines";
import type { HeartChange, MoneyChange } from "../rules/causes";
import { formatDollars, sentenceList } from "../rules/effectText";
import { cents, clampHearts, read } from "../rules/units";
import {
  bumpLines,
  debuffChanges,
  debuffLines,
  firedLine,
  forgivenLines,
  fullPackLine,
  lowHeartsLines,
  luckyLine,
  pullLine,
  STRIP_OWNER_MOODS,
  treatLine,
} from "./stripLines";

const { strip } = gameData.runText;
const kilo = gameData.dogs.kilo;
const owner = kilo.owner.name;

const hearts = (
  before: number,
  after: number,
  causes: HeartChange["causes"] = [],
): HeartChange => ({
  after: clampHearts(9, after),
  before: clampHearts(9, before),
  causes,
  dog: "kilo",
  kind: "hearts",
});
const secondChance: HeartChange["causes"][number] = {
  amount: 1,
  forgives: true,
  kind: "modifier",
  source: { kind: "walker", walker: "casey" },
};

const forgivenLoss = hearts(4, 4, [{ amount: -1, kind: "bump" }, secondChance]);

describe("bumpLines", () => {
  // Spotlight's cash, taken on top of the hearts.
  const cash: MoneyChange = {
    amount: cents(-700),
    causes: [{ amount: -700, kind: "bump" }],
    dog: null,
    kind: "money",
  };
  const softened = hearts(4, 3, [{ amount: -2, kind: "bump" }, secondChance]);
  const dodge = fillNames(strip.dodge, { dog: kilo.name, obstacle: "cone" });
  const hit = (lost: string) =>
    fillNames(strip.plainHit, { dog: kilo.name, hearts: lost, obstacle: "cone", owner });
  const paid = fillNames(strip.cashHit, { amount: formatDollars(cents(700)) });
  // A loss forgiven whole says nothing here: its forgiven line says it.
  it.each([
    { cash: null, change: null, dodged: true, lines: [dodge], name: "a dodge" },
    { cash: null, change: hearts(4, 2), dodged: false, lines: [hit("2")], name: "hearts lost" },
    {
      cash: null,
      change: softened,
      dodged: false,
      lines: [hit("1")],
      name: "hearts lost past Second chance",
    },
    { cash: null, change: forgivenLoss, dodged: false, lines: [], name: "a loss forgiven whole" },
    {
      cash,
      change: hearts(4, 3),
      dodged: false,
      lines: [hit("1"), paid],
      name: "a heart and Spotlight's cash",
    },
    {
      cash,
      change: forgivenLoss,
      dodged: false,
      lines: [paid],
      name: "Spotlight's cash with the heart forgiven",
    },
  ])("says $name", ({ cash: taken, change, dodged, lines }) => {
    const said = bumpLines(gameData, { cash: taken, change, dodged, dog: "kilo" }, "Cone");
    expect(said.map(({ text }) => text)).toEqual(lines);
  });
});

describe("the strip's other lines", () => {
  it("says each walk moment's line, and nothing where there is none", () => {
    const cases: [string, unknown, unknown][] = [
      [
        "a treat",
        treatLine(gameData, hearts(2, 3))?.text,
        fillNames(strip.treat, { dog: kilo.name, hearts: "1", owner }),
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
        firedLine(gameData, "kilo").text,
        fillNames(strip.fired, { dog: kilo.name, owner }),
      ],
      ["a pull", pullLine(gameData, "kilo").text, fillNames(strip.pull, { dog: kilo.name })],
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
                at: strip.secondChance.indexOf("{owner}"),
                dog: "kilo",
                length: owner.length,
                mood: STRIP_OWNER_MOODS.secondChance,
              },
            ],
            text: fillNames(strip.secondChance, { owner }),
          },
        ],
      ],
    ];
    for (const [name, line, expected] of cases) {
      expect(line, name).toEqual(expected);
    }
  });
});

describe("luckyLine: the friendly neighbour", () => {
  // The line with both its fields, so each one's filling shows.
  const data = {
    ...gameData,
    runText: {
      ...gameData.runText,
      strip: { ...strip, luckyNeighbour: "{hearts} / {gains}" },
    },
  };
  const total = String(read(gameData.tuning, "hearts", "neighbourHearts"));
  const reggie = gameData.dogs.reggie;
  const gain = (dog: typeof kilo, gained: number) =>
    fillNames(strip.luckyNeighbourGain, {
      dog: dog.name,
      hearts: String(gained),
      owner: dog.owner.name,
    });
  const reggieGain: HeartChange = { ...hearts(1, 2), dog: "reggie" };
  const cappedKilo = hearts(8, 9, [
    { amount: 2, kind: "effect", source: { encounter: "pettingNeighbour", kind: "instant" } },
    { amount: -1, bound: "max", kind: "limit" },
  ]);
  const found: MoneyChange = { amount: cents(500), causes: [], dog: null, kind: "money" };

  const duchess = gameData.dogs.duchess;
  const duchessGain: HeartChange = { ...hearts(1, 2), dog: "duchess" };

  it.each<[string, (HeartChange | MoneyChange)[], string[]]>([
    ["a lone owner's gain", [hearts(1, 4)], [gain(kilo, 3)]],
    ["each owner's gain in order", [hearts(1, 3), reggieGain], [gain(kilo, 2), gain(reggie, 1)]],
    [
      "a trio's gains",
      [hearts(1, 2), reggieGain, duchessGain],
      [gain(kilo, 1), gain(reggie, 1), gain(duchess, 1)],
    ],
    [
      "an owner's actual gain under their max",
      [cappedKilo, reggieGain],
      [gain(kilo, 1), gain(reggie, 1)],
    ],
    ["no gains when every owner was at their max", [], []],
    ["no gain for money", [found], []],
  ])("says the total and %s", (_name, changes, gains) => {
    const said = luckyLine(data, "pettingNeighbour", changes);
    expect(said?.icon).toBe("lucky");
    expect(said?.text).toBe(
      fillNames(data.runText.strip.luckyNeighbour, {
        gains: sentenceList(gameData.homeText.sentenceList, gains),
        hearts: total,
      }),
    );
  });
});

describe("debuffLines", () => {
  const active = (debuff: DebuffId, secondsLeft: number) => ({ debuff, secondsLeft, untilZone: 0 });
  // How much slower Muddy makes lane changes: 1 less muddyLaneSlow, as a percent.
  const muddySlower = `${Math.round(100 * (1 - read(gameData.tuning, "multipliers", "muddyLaneSlow")))}%`;
  // A debuff's bump cash, for one that makes bumps cost cash, such as Spotlight.
  const cashOf = (debuff: DebuffId) => {
    const key = (gameData.debuffs[debuff] as Debuff).bumpMoney;
    return formatDollars(key === undefined ? cents(0) : read(gameData.tuning, "money", key));
  };

  it("announces every debuff starting and ending", () => {
    for (const debuff of Object.keys(gameData.debuffs) as DebuffId[]) {
      const on = { debuffs: [active(debuff, 20)] };
      const off = { debuffs: [] };
      const slower = debuff === "muddy" ? muddySlower : "0%";
      const fields = { cash: cashOf(debuff), seconds: "20", slower };
      expect(debuffLines(gameData, debuffChanges(off, on))).toEqual([
        { icon: debuff, text: fillNames(strip.debuffStart[debuff], fields) },
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
