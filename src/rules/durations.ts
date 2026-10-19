import type { Duration } from "../data/types";
import type { RunState } from "../state/runState";
import { assertNever } from "./assertNever";

// The last zone an effect lasts through, by zone index. Absent: it lasts the run.
export interface Lasting {
  readonly untilZone?: number;
}

// Picked between zones (the upgrade offer, after the zone index has moved on), "zone" and
// "nextZone" both mean the zone about to start. Picked during a zone, "zone" is the rest of
// it and "nextZone" lasts through the zone after it.
export function lastingFor(
  duration: Duration | undefined,
  state: Pick<RunState, "phase" | "zoneIndex">,
): Lasting {
  switch (duration) {
    case undefined:
    case "run":
      return {};
    case "zone":
      return { untilZone: state.zoneIndex };
    case "nextZone":
      return { untilZone: state.phase.kind === "upgrade" ? state.zoneIndex : state.zoneIndex + 1 };
    default:
      return assertNever(duration);
  }
}

// The later of two lastings: a refreshed effect keeps whichever runs longer.
export function longerLasting(a: Lasting, b: Lasting): Lasting {
  if (a.untilZone === undefined || b.untilZone === undefined) {
    return {};
  }
  return { untilZone: Math.max(a.untilZone, b.untilZone) };
}

const outlasts = (endedZone: number, lasting: Lasting) =>
  lasting.untilZone === undefined || lasting.untilZone > endedZone;

// At the end of zone endedZone, the modifiers, debuffs and immunities that lasted through it
// expire. Run-long ones and gear stay.
export function expireAtZoneEnd(endedZone: number, state: RunState): RunState {
  return {
    ...state,
    debuffs: state.debuffs.filter((debuff) => outlasts(endedZone, debuff)),
    immunities: state.immunities.filter((immunity) => outlasts(endedZone, immunity)),
    modifiers: state.modifiers.filter((modifier) => outlasts(endedZone, modifier)),
  };
}
