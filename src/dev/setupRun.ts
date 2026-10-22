import type { DogId, GearId, WalkerId, ZoneId } from "../data/types";
import { defaultRoute, type RouteData } from "../rules/route";
import { cents } from "../rules/units";
import { packDogsOf } from "../state/pack";
import type { Loadout, RunState } from "../state/runState";
import type { RunSetup } from "./runSetup";

// The setup's pack, gear and walker over a fallback loadout, such as the save's last one.
export function loadoutFor(fallback: Loadout, setup: RunSetup<DogId, GearId, WalkerId>): Loadout {
  return {
    dogs: (setup.pack === undefined ? undefined : packDogsOf(setup.pack)) ?? fallback.dogs,
    gear: setup.gear === undefined ? fallback.gear : setup.gear,
    walker: setup.walker ?? fallback.walker,
  };
}

// The route a setup starts on: its own route up to its zone, the run's own route from the
// first zone, or the pre-fork route up to a later zone. parseRunSetup checked its ids.
function setupRoute(data: RouteData, setup: RunSetup, state: RunState): readonly ZoneId[] {
  if (setup.route !== undefined) {
    return setup.route.slice(0, setup.zone) as ZoneId[];
  }
  return setup.zone === 1 ? state.route : defaultRoute(data, setup.zone);
}

// A new run moved to the setup's zone, on the setup's route, and given its money, applied
// after newRun so the override replaces the gear's starting money. The zones before the
// setup's are skipped.
export function withSetupStart(data: RouteData, setup: RunSetup, state: RunState): RunState {
  return {
    ...state,
    firstZone: setup.zone - 1,
    money: setup.money === undefined ? state.money : cents(setup.money),
    route: setupRoute(data, setup, state),
    startMoney: setup.money === undefined ? state.startMoney : cents(setup.money),
    zoneIndex: setup.zone - 1,
  };
}
