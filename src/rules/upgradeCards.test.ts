import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { Effect, UpgradeDuration, UpgradeId } from "../data/types";
import { testState } from "../testing/runState";
import { cardFor } from "./choices";

// How long an effect lasts, as an upgrade's duration names it.
function effectDuration(effect: Effect): UpgradeDuration {
  if ((effect.kind === "modifier" || effect.kind === "immune") && effect.duration !== undefined) {
    return effect.duration === "zone" ? "nextZone" : effect.duration;
  }
  return "now";
}

describe("an upgrade's duration", () => {
  it.each(Object.entries(gameData.upgrades))("agrees with the effects of %s", (_, upgrade) => {
    expect(new Set(upgrade.effects.map(effectDuration))).toEqual(new Set([upgrade.duration]));
  });

  it("is on each upgrade card, for its plaque", () => {
    const offered: [UpgradeId, UpgradeId, UpgradeId] = ["bellyRubs", "rushHour", "bigTipper"];
    const card = cardFor(gameData, testState({ koda: 5 }), { kind: "upgradeOffer", offered });
    expect(card.options.map(({ duration }) => duration)).toEqual(["now", "nextZone", "run"]);
  });

  it("is not on a fork's path cards", () => {
    const card = cardFor(gameData, testState({ koda: 5 }), {
      kind: "fork",
      paths: ["snoozeCrescent", "park"],
    });
    expect(card.options.map(({ duration }) => duration)).toEqual([undefined, undefined]);
  });
});
