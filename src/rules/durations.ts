import type { Duration, LiveTuning, SecondsKey } from "../data/types";
import type { ActiveDebuff, RunState } from "../state/runState";
import { assertNever } from "./assertNever";
import { modifiedStat } from "./modifiers";
import { read } from "./units";

// The last zone an effect lasts through, by zone index. Absent: it lasts the run.
export interface Lasting {
  readonly untilZone?: number;
}

// Whether the walk waits at a fork, between zones, after the zone index has moved on.
function atFork(state: Pick<RunState, "phase">): boolean {
  return state.phase.kind === "card" && state.phase.source.kind === "fork";
}

// Picked at a fork, "zone" and "nextZone" both mean the zone about to start. Picked during a
// zone, "zone" is the rest of it and "nextZone" lasts through the zone after it.
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
      return { untilZone: atFork(state) ? state.zoneIndex : state.zoneIndex + 1 };
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

// A debuff applied now: it lasts its seconds, no further than the rest of the zone.
// debuffSeconds modifiers, such as Calm voice's, change how long it lasts.
export function debuffLasting(
  tuning: LiveTuning,
  seconds: SecondsKey,
  state: Pick<RunState, "modifiers" | "zoneIndex">,
): Omit<ActiveDebuff, "debuff"> {
  const lasting = modifiedStat(
    tuning,
    state.modifiers,
    "debuffSeconds",
    read(tuning, "seconds", seconds),
  );
  return { secondsLeft: lasting, untilZone: state.zoneIndex };
}

// Counts the debuffs down by seconds walked; one that runs out ends. Unchanged, the same
// state comes back.
export function tickDebuffs(seconds: number, state: RunState): RunState {
  if (seconds <= 0 || state.debuffs.length === 0) {
    return state;
  }
  const debuffs = state.debuffs.flatMap((active): ActiveDebuff[] => {
    const secondsLeft = active.secondsLeft - seconds;
    return secondsLeft > 0 ? [{ ...active, secondsLeft }] : [];
  });
  return { ...state, debuffs };
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
