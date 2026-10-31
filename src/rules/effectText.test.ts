import { fillNames } from "@andornaut/game-kit/lines";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { DEBUFFS } from "../data/debuffs";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { TUNING } from "../data/tuning";
import type { Effect, MoneyKey, MultiplierKey } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { WALKER_PERKS } from "../data/walkers";
import { TEST_TUNING } from "../testing/tuning";
import { cents } from "../units";
import {
  agilityPercent,
  capitalize,
  effectText,
  formatDollars,
  gearShort,
  laneSpeedText,
  perkEffect,
  sentenceList,
  SIZE_NAMES,
} from "./effectText";
import { read } from "./units";

// The game's chances, which the test tuning pins to 0, so a dodge reads as one in so many.
const data = {
  debuffs: DEBUFFS,
  encounters: ENCOUNTERS,
  homeText: HOME_TEXT,
  tuning: { ...TEST_TUNING, probability: TUNING.probability },
};

const words = HOME_TEXT.effect;
const dollars = (key: MoneyKey) => formatDollars(read(TEST_TUNING, "money", key));
const percent = (key: MultiplierKey) =>
  Math.round((read(TEST_TUNING, "multipliers", key) - 1) * 100);
// An added agility as a signed percent of the base lane-change speed.
const addedAgility = (key: MultiplierKey) => {
  const added = Math.round(read(TEST_TUNING, "multipliers", key) * 100);
  return `${added < 0 ? "−" : "+"}${Math.abs(added)}%`;
};

describe("effectText", () => {
  it("writes each effect's text", () => {
    for (const [, effects, text] of [
      [
        "money once",
        [{ amount: "thiefLetGo", change: "lose", kind: "money" }],
        `−${dollars("thiefLetGo")}`,
      ],
      [
        "a gain once",
        [{ amount: "lostWalletKeep", change: "gain", kind: "money" }],
        `+${dollars("lostWalletKeep")}`,
      ],
      [
        "hearts each",
        [{ amount: -2, kind: "hearts", target: { kind: "affected" } }],
        fillNames(words.heartsEach, { hearts: "−2♥" }),
      ],
      [
        "hearts to the lead dog's owner",
        [{ amount: -1, kind: "hearts", target: { kind: "lead" } }],
        fillNames(words.heartsLead, { hearts: "−1♥" }),
      ],
      [
        "hearts shared by the pack, by their total",
        [{ amount: "neighbourHearts", kind: "sharedHearts" }],
        capitalize(
          fillNames(words.heartsShared, {
            hearts: `+${read(TEST_TUNING, "hearts", "neighbourHearts")}♥`,
          }),
        ),
      ],
      [
        "a dodge for the sizes it names, as one in so many",
        [{ chance: "whistleDodgeChance", kind: "dodge", sizes: ["medium", "large"] }],
        capitalize(
          fillNames(HOME_TEXT.dodgeEffect, {
            dodgeIn: String(Math.round(1 / TUNING.probability.whistleDodgeChance)),
            sizes: sentenceList(HOME_TEXT.sentenceList, [SIZE_NAMES.medium, SIZE_NAMES.large]),
          }),
        ),
      ],
      [
        "several effects, naming a debuff",
        [
          { amount: "encounterLow", change: "lose", kind: "money" },
          { debuff: "stinky", kind: "debuff" },
        ],
        `−${dollars("encounterLow")}, ${DEBUFFS.stinky.name}: ${DEBUFFS.stinky.stake.replace(
          "{seconds}",
          String(read(TEST_TUNING, "seconds", DEBUFFS.stinky.seconds)),
        )}`,
      ],
      [
        "an immunity as the cards it stops",
        [{ duration: "run", encounter: "thief", kind: "immune" }],
        `No ${ENCOUNTERS.thief.name} cards ${words.durations.run}`,
      ],
      [
        "a contact obstacle's immunity as its own line",
        [{ duration: "run", encounter: "puddle", kind: "immune" }],
        `${capitalize(ENCOUNTERS.puddle.resolution.immuneText)} all walk`,
      ],
      [
        "a duration every phrase shares once, at the end",
        UPGRADES.rushHour.effects,
        capitalize(
          `+${percent("rushHourTips")}% ${words.stats.tipSpawns}, ` +
            `+${percent("rushHourObstacles")}% ${words.stats.obstacleSpawns}, ` +
            `+${percent("rushHourTreats")}% ${words.stats.treatSpawns} ${words.durations.nextZone}`,
        ),
      ],
      [
        "spare treats as a signed count",
        [{ by: "fannyPackTreats", kind: "modifier", operation: "add", stat: "spareTreats" }],
        capitalize(`+${read(TEST_TUNING, "counts", "fannyPackTreats")} ${words.stats.spareTreats}`),
      ],
      [
        "a raised agility as a percent of the base lane-change speed",
        [{ by: "runningShoesAgility", kind: "modifier", operation: "add", stat: "agility" }],
        capitalize(`${addedAgility("runningShoesAgility")} ${words.stats.agility}`),
      ],
      [
        "a lowered agility as a percent of the base lane-change speed",
        [{ by: "largeDogAgility", kind: "modifier", operation: "add", stat: "agility" }],
        capitalize(`${addedAgility("largeDogAgility")} ${words.stats.agility}`),
      ],
      ["a free Walk on by", [{ kind: "skipOption" }], capitalize(words.skipOption)],
      [
        "free cards as cash options free",
        [{ by: "sweetTalkerFreeCards", kind: "modifier", operation: "add", stat: "freeCards" }],
        capitalize(
          read(TEST_TUNING, "counts", "sweetTalkerFreeCards") === 1
            ? words.freeCard
            : fillNames(words.freeCards, {
                count: String(read(TEST_TUNING, "counts", "sweetTalkerFreeCards")),
              }),
        ),
      ],
      ["no effects as nothing", [], words.nothing],
    ] satisfies readonly [string, readonly Effect[], string][]) {
      expect(effectText(data, effects)).toBe(text);
    }
  });
});

// A share of the base lane-change speed as an unsigned whole percent.
const unsignedPercent = (fraction: number) => `${Math.abs(Math.round(fraction * 100))}%`;

describe("agilityPercent", () => {
  it.each<[number, string | null]>([
    [1, null],
    [1.004, null],
    [1.15, "+15%"],
    [0.85, "−15%"],
  ])("gives an agility of %d as %s against the base", (agility, text) => {
    expect(agilityPercent(agility)).toBe(text);
  });
});

describe("laneSpeedText", () => {
  it.each(["largeDogAgility", "smallDogAgility"] as const)(
    "gives %s as an unsigned percent of the base lane-change speed",
    (key) => {
      expect(laneSpeedText(TEST_TUNING, key)).toBe(
        unsignedPercent(read(TEST_TUNING, "multipliers", key)),
      );
    },
  );
});

describe("gearShort", () => {
  it("keeps a shop line with no substitutions unchanged", () => {
    const gearData = { shopGear: gameData.shopGear, tuning: TEST_TUNING };
    expect(gearShort(gearData, "runningShoes")).toBe(gameData.shopGear.runningShoes.short);
  });
});

describe("perkEffect", () => {
  it("substitutes the named multiplier's change from the base", () => {
    const perk = WALKER_PERKS.keenEye;
    const percent = unsignedPercent(read(gameData.tuning, "multipliers", perk.percent) - 1);
    expect(perkEffect(gameData.tuning, perk)).toBe(fillNames(perk.effect, { percent }));
  });

  it("keeps a perk without a percentage unchanged", () => {
    const perk = WALKER_PERKS.longReach;
    expect(perkEffect(gameData.tuning, perk)).toBe(perk.effect);
  });
});

describe("formatDollars", () => {
  it("shows cents as dollars", () => {
    for (const [amount, text] of [
      [500, "$5"],
      [150, "$1.50"],
    ] as const) {
      expect(formatDollars(cents(amount))).toBe(text);
    }
  });
});
