import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { HintTrigger } from "../data/types";
import { hintFor } from "../rules/hints";
import type { MoverTell } from "../runner/movers";
import type { CardSource } from "../state/runState";
import { testState } from "../testing/runState";
import { cardHintTriggers, moverHintTriggers, runHintTriggers } from "./hintTriggers";

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

describe("moverHintTriggers", () => {
  it.each<[string, MoverTell | null, HintTrigger[]]>([
    ["no cue", null, []],
    ["an arrow across the road", { direction: 1, kind: "across" }, [{ kind: "moverCue" }]],
    ["an arrow down its lanes", { kind: "down" }, [{ kind: "moverCue" }]],
    ["an arrow up its lanes", { kind: "up" }, [{ kind: "moverCue" }]],
    ["the wander mark, no arrow", { kind: "wander" }, []],
  ])("for %s", (_, tell, triggers) => {
    expect(moverHintTriggers(tell)).toEqual(triggers);
  });

  it("raises a hint that the data has, said once", () => {
    const [trigger] = moverHintTriggers({ kind: "down" });
    const hint = trigger === undefined ? null : hintFor(gameData, [], trigger);
    expect(hint).not.toBeNull();
    expect(hint === null ? null : hintFor(gameData, [hint.id], { kind: "moverCue" })).toBeNull();
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
