import type { HintTrigger, LiveTuning } from "../data/types";
import { packSizeBonus, placeInPack } from "../rules/dogs";
import type { MoverTell } from "../runner/movers";
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

// The hint triggers a mover's cue raises while it shows on the road: an arrow across the road
// or along its lanes. The wander mark before a step is no arrow, so it raises none.
export function moverHintTriggers(tell: MoverTell | null): HintTrigger[] {
  return tell === null || tell.kind === "wander" ? [] : [{ kind: "moverCue" }];
}

// The hint triggers the run's state raises while it lasts: an owner down to their last heart.
export function runHintTriggers(run: Pick<RunState, "pack">): HintTrigger[] {
  return lowHeartDogs(run.pack).length > 0 ? [{ kind: "firedOwner" }] : [];
}

// The hint triggers a walk raises as it starts: the pack-size bonus when the lead dog's owner
// gets one.
export function startHintTriggers(tuning: LiveTuning, run: Pick<RunState, "pack">): HintTrigger[] {
  const lead = run.pack[0].dog;
  return packSizeBonus(tuning, placeInPack(run, lead)) > 0 ? [{ kind: "packBonus" }] : [];
}
