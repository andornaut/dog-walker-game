import type { DebuffDuration, Duration, LiveTuning } from "../data/types";
import type { ActiveDebuff, RunState } from "../state/runState";
import { assertNever } from "./assertNever";
import { read } from "./units";

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

// A debuff applied now: it lasts the rest of the zone, and a timed one only its seconds of it.
export function debuffLasting(
  tuning: LiveTuning,
  duration: DebuffDuration,
  state: Pick<RunState, "zoneIndex">,
): Omit<ActiveDebuff, "debuff"> {
  const untilZone = state.zoneIndex;
  return duration === "zone"
    ? { untilZone }
    : { secondsLeft: read(tuning, "seconds", duration.seconds), untilZone };
}

// A debuff applied again: whichever runs longer, the one held or the new one.
export function refreshedDebuff(held: ActiveDebuff, applied: ActiveDebuff): ActiveDebuff {
  const { untilZone } = longerLasting(held, applied);
  const timed = held.secondsLeft !== undefined && applied.secondsLeft !== undefined;
  return {
    debuff: applied.debuff,
    ...(timed ? { secondsLeft: Math.max(held.secondsLeft, applied.secondsLeft) } : {}),
    ...(untilZone === undefined ? {} : { untilZone }),
  };
}

// Counts the timed debuffs down by seconds walked; one that runs out ends. Unchanged, the
// same state comes back.
export function tickDebuffs(seconds: number, state: RunState): RunState {
  if (seconds <= 0 || !state.debuffs.some((active) => active.secondsLeft !== undefined)) {
    return state;
  }
  const debuffs = state.debuffs.flatMap((active): ActiveDebuff[] => {
    if (active.secondsLeft === undefined) {
      return [active];
    }
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
