import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { DEBUFFS } from "../data/debuffs";
import { ENCOUNTERS } from "../data/encounters";
import type { Effect, MoneyKey, MultiplierKey } from "../data/types";
import { TEST_TUNING } from "../testing/tuning";
import { effectText, formatDollars } from "./effectText";
import { cents, read } from "./units";

const data = {
  debuffs: DEBUFFS,
  encounters: ENCOUNTERS,
  tuning: TEST_TUNING,
};

const dollars = (key: MoneyKey) => formatDollars(read(TEST_TUNING, "money", key));
const percent = (key: MultiplierKey) =>
  Math.round((read(TEST_TUNING, "multipliers", key) - 1) * 100);

describe("effectText", () => {
  it.each<[string, readonly Effect[], string]>([
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
    ["hearts each", [{ amount: -2, kind: "hearts", target: { kind: "affected" } }], "−2♥ each"],
    [
      "one random owner",
      [{ amount: -1, kind: "hearts", target: { kind: "randomOne" } }],
      "−1♥ to one random owner",
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
      `Tips +${percent("rushHourTips")}% next neighborhood`,
    ],
    [
      "an immunity as the cards it stops",
      [{ duration: "run", encounter: "thief", kind: "immune" }],
      `No ${ENCOUNTERS.thief.name} cards all walk`,
    ],
    ["no effects as nothing", [], "Nothing"],
  ])("writes %s", (_, effects, text) => {
    expect(effectText(data, effects)).toBe(text);
  });
});

describe("formatDollars", () => {
  it.each([
    [500, "$5"],
    [150, "$1.50"],
  ])("shows %i cents as %s", (amount, text) => {
    expect(formatDollars(cents(amount))).toBe(text);
  });
});

// Every card's text from the real data, so a content or tuning edit shows up as a
// snapshot diff to review. Update with: npx vitest run -u
describe("every card's text", () => {
  it("matches the snapshot", () => {
    const effects = (items: Readonly<Record<string, { readonly effects: readonly Effect[] }>>) =>
      Object.fromEntries(
        Object.entries(items).map(([id, item]) => [id, effectText(gameData, item.effects)]),
      );
    const encounters = Object.fromEntries(
      Object.entries(gameData.encounters).flatMap(([id, { resolution }]) =>
        resolution.kind === "instant" || resolution.kind === "contact"
          ? [[`${id}: ${resolution.kind}`, effectText(gameData, resolution.effects)]]
          : resolution.kind === "pull"
            ? []
            : resolution.options.map((option) => [
                `${id}: ${option.name}`,
                effectText(gameData, option.effects),
              ]),
      ),
    );
    expect({
      encounters,
      gear: effects(gameData.shopGear),
      upgrades: effects(gameData.upgrades),
    }).toMatchSnapshot();
  });
});
