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
  it("writes money per dog or once, from the tuning", () => {
    expect(effectText(data, ENCOUNTERS.puddle.options[1].effects)).toBe("−$5 per dog");
    expect(effectText(data, ENCOUNTERS.squirrel.options[1].effects)).toBe("−$10");
  });

  it("writes hearts each, with a trait's own amount in brackets", () => {
    expect(effectText(data, ENCOUNTERS.puddle.options[0].effects)).toBe("−1 ♥ each (−2 Fancy)");
    expect(effectText(data, ENCOUNTERS.skunk.options[2].effects)).toBe("−2 ♥ each");
  });

  it("names the owners a targeted change reaches", () => {
    expect(effectText(data, FORCED_STOPS.iceCreamTruck.options[1].effects)).toBe(
      "−1 ♥ to Food-driven owners",
    );
    expect(effectText(data, FORCED_STOPS.kidWantsToPet.options[1].effects)).toBe(
      "−1 ♥ to one random owner",
    );
    expect(effectText(data, ENCOUNTERS.photoOp.options[0].effects)).toBe(
      "+$10, +1 ♥ to dramatic owners",
    );
  });

  it("joins several effects and names a debuff", () => {
    expect(effectText(data, ENCOUNTERS.skunk.options[1].effects)).toBe("−$5 per dog, Stinky");
  });

  it("writes treats with the carry limit", () => {
    expect(effectText(data, ENCOUNTERS.biscuitNeighbour.options[0].effects)).toBe(
      "+1 treat per dog (carry up to 3)",
    );
  });

  it("writes modifiers as percentages, removals and additions with their duration", () => {
    expect(effectText(data, UPGRADES.bigTipper.effects)).toBe("Tip value +50% for the run");
    expect(effectText(data, SHOP_GEAR.runningShoes.effects)).toBe(
      "No lane-input lock after a pull",
    );
    expect(effectText(data, SHOP_GEAR.fannyPack.effects)).toBe("Starting money +$15");
    expect(effectText(data, UPGRADES.sweetTalker.effects)).toBe(
      "Card costs per dog −$2 for the run",
    );
  });

  it("writes an immunity as the cards it stops", () => {
    expect(effectText(data, SHOP_GEAR.whistle.effects)).toBe("No Thief cards for the run");
  });

  it("writes an option with no effects as nothing", () => {
    expect(effectText(data, [])).toBe("Nothing");
  });
});

describe("formatDollars", () => {
  it("shows whole dollars without cents and other amounts to the cent", () => {
    expect(formatDollars(cents(500))).toBe("$5");
    expect(formatDollars(cents(150))).toBe("$1.50");
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
    expect({
      encounters: options(gameData.encounters),
      forcedStops: options(gameData.forcedStops),
      gear: effects(gameData.shopGear),
      upgrades: effects(gameData.upgrades),
    }).toMatchSnapshot();
  });
});
