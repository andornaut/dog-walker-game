import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { DEBUFFS } from "../data/debuffs";
import { ENCOUNTERS } from "../data/encounters";
import { FORCED_STOPS } from "../data/forcedStops";
import { SHOP_GEAR } from "../data/shop";
import type { CardOption, Effect } from "../data/types";
import { UPGRADES } from "../data/upgrades";
import { TEST_TUNING } from "../testing/tuning";
import { affectText, conditionText, effectText, formatDollars } from "./effectText";
import { cents } from "./units";

const data = { debuffs: DEBUFFS, encounters: ENCOUNTERS, tuning: TEST_TUNING };

describe("effectText", () => {
  const { puddle, skunk, squirrel } = ENCOUNTERS;
  const { iceCreamTruck, kidWantsToPet } = FORCED_STOPS;

  it.each<[string, readonly Effect[], string]>([
    ["money per dog", puddle.resolution.options[1].effects, "−$5 per dog"],
    ["money once", squirrel.resolution.options[1].effects, "−$10"],
    [
      "hearts each, a trait's own amount",
      puddle.resolution.options[0].effects,
      "−1 ♥ each (−2 Fancy)",
    ],
    ["hearts each", skunk.resolution.options[2].effects, "−2 ♥ each"],
    ["the owners of a trait", iceCreamTruck.options[1].effects, "−1 ♥ to Food-driven owners"],
    ["one random owner", kidWantsToPet.options[1].effects, "−1 ♥ to one random owner"],
    [
      "owners of a temperament",
      ENCOUNTERS.photoOp.resolution.effects,
      "+$10, +1 ♥ to dramatic owners",
    ],
    ["the unhappiest owner", UPGRADES.secondWind.effects, "+2 ♥ to the unhappiest owner"],
    [
      "several effects, naming a debuff",
      skunk.resolution.options[1].effects,
      "−$5 per dog, Stinky",
    ],
    [
      "treats with the carry limit",
      ENCOUNTERS.biscuitNeighbour.resolution.effects,
      "+1 treat per dog (carry up to 3)",
    ],
    ["a multiplier as a percentage", UPGRADES.bigTipper.effects, "Tip value +50% for the run"],
    ["a removal", SHOP_GEAR.runningShoes.effects, "No lane-input lock after a pull"],
    ["an addition", SHOP_GEAR.fannyPack.effects, "Starting money +$15"],
    [
      "a per-dog cost change with its duration",
      UPGRADES.sweetTalker.effects,
      "Card costs per dog −$2 for the run",
    ],
    ["an immunity as the cards it stops", SHOP_GEAR.whistle.effects, "No Thief cards for the run"],
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

describe("affectText and conditionText", () => {
  it("describes who an encounter affects and when it opens no card", () => {
    expect(affectText(TEST_TUNING, ENCOUNTERS.skunk.affects)).toBe(
      "Dogs caught by the roll (25% small, 50% medium, 50% big)",
    );
    expect(affectText(TEST_TUNING, ENCOUNTERS.squirrel.affects)).toBe("Chaser dogs");
    expect(conditionText({ kind: "packHasSize", size: "big" })).toBe("Pack has a big dog");
  });
});

// Every card's text from the real data, so a content or tuning edit shows up as a
// snapshot diff to review. Update with: npx vitest run -u
describe("every card's text", () => {
  it("matches the snapshot", () => {
    const options = (
      cards: Readonly<Record<string, { readonly options: readonly CardOption[] }>>,
    ) =>
      Object.fromEntries(
        Object.entries(cards).flatMap(([id, card]) =>
          card.options.map((option) => [
            `${id}: ${option.name}`,
            effectText(gameData, option.effects),
          ]),
        ),
      );
    const effects = (items: Readonly<Record<string, { readonly effects: readonly Effect[] }>>) =>
      Object.fromEntries(
        Object.entries(items).map(([id, item]) => [id, effectText(gameData, item.effects)]),
      );
    const encounters = Object.fromEntries(
      Object.entries(gameData.encounters).flatMap(([id, { resolution }]) =>
        resolution.kind === "instant"
          ? [[`${id}: instant`, effectText(gameData, resolution.effects)]]
          : resolution.options.map((option) => [
              `${id}: ${option.name}`,
              effectText(gameData, option.effects),
            ]),
      ),
    );
    expect({
      encounters,
      forcedStops: options(gameData.forcedStops),
      gear: effects(gameData.shopGear),
      needCards: options(gameData.needCards),
      needs: Object.fromEntries(
        Object.entries(gameData.needs).map(([id, need]) => [
          id,
          {
            goneWrong:
              need.goneWrong.kind === "card"
                ? need.goneWrong.card
                : effectText(gameData, need.goneWrong.effects),
            met: effectText(gameData, need.met),
          },
        ]),
      ),
      upgrades: effects(gameData.upgrades),
    }).toMatchSnapshot();
  });
});
