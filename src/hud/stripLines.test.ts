import { fillNames } from "@andornaut/game-kit/lines";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { Debuff, DebuffId, GearId } from "../data/types";
import type { HeartChange, MoneyChange } from "../rules/causes";
import { formatDollars } from "../rules/effectText";
import { read } from "../rules/units";
import { defined } from "../testing/defined";
import { cents, clampHearts } from "../units";
import {
  bumpLines,
  debuffChanges,
  debuffLines,
  firedLine,
  forgivenLines,
  fullPackLine,
  gearFoundLine,
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
  const paid = strip.cashHit;
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
        "a firing",
        firedLine(gameData, "kilo").text,
        fillNames(strip.fired, { dog: kilo.name, owner }),
      ],
      ["a pull", pullLine(gameData, "kilo").text, fillNames(strip.pull, { dog: kilo.name })],
      ["the lost wallet's money", luckyLine(gameData, "lostWallet")?.text, strip.luckyWallet],
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
  it("says the hearts the neighbour shares", () => {
    const hearts = String(read(gameData.tuning, "hearts", "neighbourHearts"));
    expect(luckyLine(gameData, "friendlyNeighbour")).toEqual({
      icon: "lucky",
      text: fillNames(strip.luckyNeighbour, { hearts }),
    });
  });
});

describe("debuffLines", () => {
  const active = (debuff: DebuffId, secondsLeft: number) => ({ debuff, secondsLeft, untilZone: 0 });
  // A debuff's bump cash, for one that makes bumps cost cash, such as Spotlight.
  const cashOf = (debuff: DebuffId) => {
    const key = (gameData.debuffs[debuff] as Debuff).bumpMoney;
    return formatDollars(key === undefined ? cents(0) : read(gameData.tuning, "money", key));
  };

  it("announces every debuff starting and ending", () => {
    for (const debuff of keysOf(gameData.debuffs)) {
      const on = { debuffs: [active(debuff, 20)] };
      const off = { debuffs: [] };
      const fields = { cash: cashOf(debuff), seconds: "20" };
      expect(debuffLines(gameData, debuffChanges(off, on))).toMatchObject([
        { icon: debuff, text: fillNames(strip.debuffStart[debuff], fields) },
      ]);
      expect(debuffLines(gameData, debuffChanges(on, off))).toEqual([
        { icon: debuff, text: strip.debuffEnd[debuff] },
      ]);
    }
  });

  it.each(keysOf(gameData.debuffs))(
    "marks %s's name, and only its name, in its start line",
    (debuff) => {
      const [line] = debuffLines(gameData, { ended: [], started: [active(debuff, 20)] });
      const marks = line?.names ?? [];
      const named = marks.map(({ at, kind, length }) => ({
        kind,
        name: line?.text.slice(at, at + length),
      }));
      expect(named).toEqual([{ kind: debuff, name: gameData.debuffs[debuff].name }]);
    },
  );

  it("announces a debuff that restarts, and not one that counts down", () => {
    expect(
      debuffChanges({ debuffs: [active("muddy", 5)] }, { debuffs: [active("muddy", 20)] }),
    ).toEqual({ ended: [], started: [active("muddy", 20)] });
    expect(
      debuffChanges({ debuffs: [active("muddy", 5)] }, { debuffs: [active("muddy", 4)] }),
    ).toEqual({ ended: [], started: [] });
  });
});

describe("gear found line", () => {
  const GEAR = keysOf(gameData.shopGear);
  const name = (gear: GearId) => gameData.shopGear[gear].name;
  const { gearFound, gearSwapped } = gameData.runText.strip;
  // A first find, and a find that replaces the item found before it.
  const [first, next] = [defined(GEAR[0]), defined(GEAR[1])];
  it.each([
    { gear: first, replaced: null, text: fillNames(gearFound, { gear: name(first) }) },
    {
      gear: next,
      replaced: first,
      text: fillNames(gearSwapped, { gear: name(next), old: name(first) }),
    },
  ])("says $gear was found, replacing $replaced, led by its icon", ({ gear, replaced, text }) => {
    expect(gearFoundLine(gameData, gear, replaced)).toEqual({
      icon: { found: true, gear, kind: "gear" },
      text,
    });
  });
});
