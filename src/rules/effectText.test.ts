import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { DEBUFFS } from "../data/debuffs";
import { ENCOUNTERS } from "../data/encounters";
import { HOME_TEXT } from "../data/homeText";
import { TUNING } from "../data/tuning";
import type { Effect, GearId, MoneyKey, MultiplierKey } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { fillNames, placeholders } from "../lib/lines";
import { TEST_TUNING } from "../testing/tuning";
import {
  capitalize,
  effectText,
  formatDollars,
  gearShort,
  heavySpeedText,
  sentenceList,
  SIZE_NAMES,
} from "./effectText";
import { modifiersOf, modifierValue } from "./modifiers";
import { cents, read } from "./units";

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
const agilityPercent = (key: MultiplierKey) => {
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
        "a dodge for the sizes it names, as one in so many",
        [{ chance: "dogWhistleDodgeChance", kind: "dodge", sizes: ["medium", "big"] }],
        capitalize(
          fillNames(HOME_TEXT.dodgeEffect, {
            dodgeIn: String(Math.round(1 / TUNING.probability.dogWhistleDodgeChance)),
            sizes: sentenceList(HOME_TEXT.sentenceList, [SIZE_NAMES.medium, SIZE_NAMES.big]),
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
        "a multiplier as a percentage with its duration",
        [
          {
            by: "rushHourTips",
            duration: "nextZone",
            kind: "modifier",
            operation: "multiply",
            stat: "tipSpawns",
          },
        ],
        capitalize(
          `${words.stats.tipSpawns} +${percent("rushHourTips")}% ${words.durations.nextZone}`,
        ),
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
          `${words.stats.tipSpawns} +${percent("rushHourTips")}%, ` +
            `${words.stats.obstacleSpawns} +${percent("rushHourObstacles")}%, ` +
            `${words.stats.treatSpawns} +${percent("rushHourTreats")}% ${words.durations.nextZone}`,
        ),
      ],
      [
        "starting cash",
        [{ by: "fannyPackStart", kind: "modifier", operation: "add", stat: "startMoney" }],
        capitalize(`${words.stats.startMoney} +${dollars("fannyPackStart")}`),
      ],
      [
        "a raised agility as a percent of the base lane-change speed",
        [{ by: "runningShoesAgility", kind: "modifier", operation: "add", stat: "agility" }],
        capitalize(`${words.stats.agility} ${agilityPercent("runningShoesAgility")}`),
      ],
      [
        "a lowered agility as a percent of the base lane-change speed",
        [{ by: "bigDogAgility", kind: "modifier", operation: "add", stat: "agility" }],
        capitalize(`${words.stats.agility} ${agilityPercent("bigDogAgility")}`),
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

describe("heavySpeedText", () => {
  it("gives bigDogAgility as an unsigned percent of the base lane-change speed", () => {
    expect(heavySpeedText(TEST_TUNING)).toBe(
      unsignedPercent(read(TEST_TUNING, "multipliers", "bigDogAgility")),
    );
  });
});

describe("gearShort", () => {
  const gearData = { shopGear: gameData.shopGear, tuning: TEST_TUNING };
  const agilityAdded = (gear: GearId) =>
    modifiersOf(gameData.shopGear[gear].effects)
      .filter((modifier) => modifier.operation === "add" && modifier.stat === "agility")
      .reduce((sum, modifier) => sum + modifierValue(TEST_TUNING, modifier), 0);

  it.each(Object.keys(gameData.shopGear) as GearId[])(
    "fills %s's shop line's {percent} with the agility it adds, leaving no names",
    (gear) => {
      const { short } = gameData.shopGear[gear];
      expect(placeholders(short).every((name) => name === "percent")).toBe(true);
      expect(placeholders(short).length === 0 || agilityAdded(gear) !== 0).toBe(true);
      expect(gearShort(gearData, gear)).toBe(
        fillNames(short, { percent: unsignedPercent(agilityAdded(gear)) }),
      );
      expect(placeholders(gearShort(gearData, gear))).toEqual([]);
    },
  );
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
