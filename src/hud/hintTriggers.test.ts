import { describe, expect, it } from "vitest";

import type { HintTrigger } from "../data/types";
import type { CardSource } from "../state/runState";
import { testState } from "../testing/runState";
import { cardHintTriggers, runHintTriggers } from "./hintTriggers";

const PACK = testState({ biscuit: 5, duchess: 5, koda: 5 });

describe("cardHintTriggers", () => {
  it.each<[string, CardSource, HintTrigger[]]>([
    ["a fork", { kind: "fork", paths: [], upgrades: [] }, [{ kind: "fork" }]],
    [
      "a puddle",
      { affected: ["koda"], encounter: "skunk", kind: "encounter" },
      [{ encounter: "skunk", kind: "encounter" }, { kind: "card" }],
    ],
    [
      "a skunk",
      { affected: ["biscuit", "duchess", "koda"], encounter: "skunk", kind: "encounter" },
      [{ encounter: "skunk", kind: "encounter" }, { kind: "card" }],
    ],
  ])("for %s", (_, source, triggers) => {
    expect(cardHintTriggers(source)).toEqual(triggers);
  });
});

describe("runHintTriggers", () => {
  it.each<[string, ReturnType<typeof testState>, HintTrigger["kind"][]]>([
    ["a calm walk", PACK, []],
    ["an owner at 1 heart", testState({ duchess: 5, koda: 1 }), ["firedOwner"]],
    ["a fired owner only", testState({ duchess: 5, koda: "fired" }), []],
  ])("for %s", (_, run, kinds) => {
    expect(runHintTriggers(run).map(({ kind }) => kind)).toEqual(kinds);
  });
});
