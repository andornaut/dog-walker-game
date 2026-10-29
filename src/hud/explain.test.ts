import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { fillLine, fillNames } from "../lib/lines";
import { maxHearts, placeInPack } from "../rules/dogs";
import { testState } from "../testing/runState";
import { newPlayerSave } from "../testing/saves";
import { explainDetail } from "./explain";
import { RUN_TEXT_FIELDS } from "./runText";
import type { ExplainTarget } from "./walkHud";

// Kilo walks at 2 hearts with Lucky collar in the Pocket, a Whistle found, the Raincoats upgrade
// in effect and Muddy on the pack: the effects are the walker's perk, the Pocket's gear, the found
// gear, then the upgrade.
const run = testState(
  { kilo: 2 },
  {
    debuffs: [{ debuff: "muddy", secondsLeft: 9.2 }],
    foundGear: "whistle",
    gear: "luckyCollar",
    immunities: [{ encounter: "puddle", source: { kind: "upgrade", upgrade: "raincoats" } }],
    upgradesPicked: ["raincoats"],
  },
);
const text = gameData.runText.explain;
const kilo = gameData.dogs.kilo;

describe("explainDetail", () => {
  it.each<[string, ExplainTarget, { kind: string; status?: string; title: string }]>([
    [
      "the walker's perk as its walker",
      { effect: 0, kind: "effect" },
      { kind: "walker", title: gameData.walkers[run.walker].name },
    ],
    [
      "gear as the home screen's gear card",
      { effect: 1, kind: "effect" },
      { kind: "gear", title: gameData.shopGear.luckyCollar.name },
    ],
    [
      "found gear as its gear card, named and marked found",
      { effect: 2, kind: "effect" },
      {
        kind: "gear",
        status: text.foundStatus,
        title: fillNames(gameData.runText.foundGear, { gear: gameData.shopGear.whistle.name }),
      },
    ],
    [
      "an upgrade with its status",
      { effect: 3, kind: "effect" },
      { kind: "gear", status: text.upgradeStatus, title: gameData.upgrades.raincoats.name },
    ],
    [
      "a debuff with its status",
      { debuff: "muddy", kind: "debuff" },
      { kind: "gear", status: text.debuffStatus, title: gameData.debuffs.muddy.name },
    ],
    [
      "a dog with its owner's hearts now as its status",
      { dog: "kilo", kind: "dog" },
      {
        kind: "dog",
        status: fillLine(RUN_TEXT_FIELDS.explain, text, "dogHearts", {
          hearts: "2",
          max: String(maxHearts(gameData.tuning, run.modifiers, placeInPack(run, "kilo"), kilo)),
        }),
        title: kilo.name,
      },
    ],
  ])("shows %s", (_name, target, expected) => {
    const detail = explainDetail(gameData, newPlayerSave, run, target);
    expect({
      kind: detail?.kind,
      title: detail?.card.title,
      ...(expected.status === undefined ? {} : { status: detail?.card.status }),
    }).toEqual(expected);
  });

  it.each<[string, ExplainTarget]>([
    ["an effect past the walk's", { effect: 4, kind: "effect" }],
    ["a debuff that wore off", { debuff: "stinky", kind: "debuff" }],
    ["a dog not in the pack", { dog: "lady", kind: "dog" }],
  ])("shows nothing for %s", (_name, target) => {
    expect(explainDetail(gameData, newPlayerSave, run, target)).toBeUndefined();
  });

  it("fills the debuff's stake with its whole seconds left", () => {
    const detail = explainDetail(gameData, newPlayerSave, run, { debuff: "muddy", kind: "debuff" });
    expect(detail?.card.lines.join(" ").toLowerCase()).toContain(
      fillNames(gameData.debuffs.muddy.stake, { seconds: "10" }).toLowerCase(),
    );
  });
});
