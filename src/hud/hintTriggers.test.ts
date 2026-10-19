import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { HintTrigger } from "../data/types";
import type { CardSource } from "../state/runState";
import { testState } from "../testing/runState";
import { TEST_TUNING } from "../testing/tuning";
import { cardHintTriggers, runHintTriggers } from "./hintTriggers";

const data = { ...gameData, tuning: TEST_TUNING };
const PACK = testState({ biscuit: 5, duchess: 5, koda: 5 });

describe("cardHintTriggers", () => {
  it.each<[string, CardSource, HintTrigger[]]>([
    [
      "an upgrade offer",
      { kind: "upgradeOffer", offered: ["bellyRubs", "bigTipper", "raincoats"] },
      [{ kind: "upgrade" }],
    ],
    ["a fork", { kind: "fork", paths: [] }, [{ kind: "fork" }]],
    [
      "a forced stop",
      { kind: "forcedStop", stop: "chattyNeighbour" },
      [{ kind: "forcedStop" }, { kind: "card" }],
    ],
    ["a need card", { affected: ["koda"], card: "accident", kind: "need" }, [{ kind: "card" }]],
    [
      "a puddle catching some dogs",
      { affected: ["koda"], encounter: "puddle", kind: "encounter" },
      [{ encounter: "puddle", kind: "encounter" }, { kind: "areaEffect" }, { kind: "card" }],
    ],
    [
      "a skunk catching every dog",
      { affected: ["biscuit", "duchess", "koda"], encounter: "skunk", kind: "encounter" },
      [{ encounter: "skunk", kind: "encounter" }, { kind: "card" }],
    ],
    [
      "a thief, which affects the pack",
      { affected: ["koda"], encounter: "thief", kind: "encounter" },
      [{ encounter: "thief", kind: "encounter" }, { kind: "card" }],
    ],
    [
      "a lucky find",
      { affected: ["biscuit", "duchess", "koda"], encounter: "lemonade", kind: "encounter" },
      [{ encounter: "lemonade", kind: "encounter" }, { kind: "luckyFind" }, { kind: "card" }],
    ],
  ])("for %s", (_, source, triggers) => {
    expect(cardHintTriggers(data, PACK, source)).toEqual(triggers);
  });

  it("counts only walking dogs for an area effect", () => {
    const run = testState({ duchess: "fired", koda: 5 });
    const source = { affected: ["koda"], encounter: "puddle", kind: "encounter" } as const;
    expect(cardHintTriggers(data, run, source)).not.toContainEqual({ kind: "areaEffect" });
  });
});

describe("runHintTriggers", () => {
  it.each<[string, ReturnType<typeof testState>, number, HintTrigger["kind"][]]>([
    ["a calm walk", PACK, 0, []],
    ["an owner at 1 heart", testState({ duchess: 5, koda: 1 }), 0, ["firedOwner"]],
    ["a fired owner only", testState({ duchess: 5, koda: "fired" }), 0, []],
    ["an item in the strip", PACK, 1, ["strip"]],
    [
      "an urgent need",
      testState({ koda: 5 }, { needSeconds: { koda: 10_000 } }),
      0,
      ["needUrgent"],
    ],
    [
      "all three at once",
      testState({ duchess: 1, koda: 5 }, { needSeconds: { koda: 10_000 } }),
      2,
      ["firedOwner", "strip", "needUrgent"],
    ],
  ])("for %s", (_, run, stripCount, kinds) => {
    expect(runHintTriggers(data, run, stripCount).map(({ kind }) => kind)).toEqual(kinds);
  });
});
