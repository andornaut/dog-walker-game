import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { Effect, UpgradeDuration, UpgradeId } from "../data/types";
import { testState } from "../testing/runState";
import { cardFor } from "./choices";

// How long an effect lasts, as an upgrade's duration names it.
function effectDuration(effect: Effect): UpgradeDuration {
  if ((effect.kind === "modifier" || effect.kind === "immune") && effect.duration !== undefined) {
    return effect.duration;
  }
  return "now";
}

describe("an upgrade's duration", () => {
  it("agrees with the effects of every upgrade", () => {
    for (const [, upgrade] of Object.entries(gameData.upgrades)) {
      expect(new Set(upgrade.effects.map(effectDuration))).toEqual(new Set([upgrade.duration]));
    }
  });

  it("is on each fork path card, for the upgrade it carries", () => {
    const upgrades: UpgradeId[] = ["bellyRubs", "rushHour", "raincoats"];
    const card = cardFor(gameData, testState({ koda: 5 }), {
      kind: "fork",
      paths: ["snoozeCrescent", "park", "street"],
      upgrades,
    });
    expect(card.options.map(({ duration }) => duration)).toEqual(
      upgrades.map((id) => gameData.upgrades[id].duration),
    );
  });
});
