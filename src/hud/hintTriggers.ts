import type { GameData, HintTrigger } from "../data/types";
import { isNeedUrgent } from "../runner/needs";
import type { CardSource, RunState } from "../state/runState";
import { lowHeartDogs } from "./moments";

// The hint triggers a card raises as it opens: an upgrade offer or a fork its own, any other
// card its stop or encounter, a lucky find, and then cards in general.
export function cardHintTriggers(
  data: Pick<GameData, "encounters">,
  source: CardSource,
): HintTrigger[] {
  switch (source.kind) {
    case "fork":
      return [{ kind: "fork" }];
    case "upgradeOffer":
      return [{ kind: "upgrade" }];
    case "forcedStop":
      return [{ kind: "forcedStop" }, { kind: "card" }];
    case "need":
      return [{ kind: "card" }];
    case "encounter":
      return [
        { encounter: source.encounter, kind: "encounter" },
        ...(data.encounters[source.encounter].kind === "lucky"
          ? [{ kind: "luckyFind" } as const]
          : []),
        { kind: "card" },
      ];
    default:
      return source satisfies never;
  }
}

// The hint triggers the run's state raises while it lasts: an owner down to their last heart,
// an item in the state strip, a walking dog's need turned urgent.
export function runHintTriggers(
  data: Pick<GameData, "dogs" | "tuning">,
  run: Pick<RunState, "needSeconds" | "pack">,
  stripCount: number,
): HintTrigger[] {
  const urgent = run.pack.some(
    (slot) => slot.status === "walking" && isNeedUrgent(data, run, slot.dog),
  );
  return [
    ...(lowHeartDogs(run.pack).length > 0 ? [{ kind: "firedOwner" } as const] : []),
    ...(stripCount > 0 ? [{ kind: "strip" } as const] : []),
    ...(urgent ? [{ kind: "needUrgent" } as const] : []),
  ];
}
