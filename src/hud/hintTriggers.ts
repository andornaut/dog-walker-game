import type { HintTrigger } from "../data/types";
import type { CardSource, RunState } from "../state/runState";
import { lowHeartDogs } from "./moments";

// The hint triggers a card raises as it opens: a fork its own, an obstacle's its encounter's,
// then cards in general.
export function cardHintTriggers(source: CardSource): HintTrigger[] {
  switch (source.kind) {
    case "fork":
      return [{ kind: "fork" }];
    case "encounter":
      return [{ encounter: source.encounter, kind: "encounter" }, { kind: "card" }];
    default:
      return source satisfies never;
  }
}

// The hint triggers the run's state raises while it lasts: an owner down to their last heart.
export function runHintTriggers(run: Pick<RunState, "pack">): HintTrigger[] {
  return lowHeartDogs(run.pack).length > 0 ? [{ kind: "firedOwner" }] : [];
}
