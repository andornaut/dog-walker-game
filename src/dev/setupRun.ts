import type { DogId, GearId, ZoneId } from "../data/types";
import { defaultRoute } from "../rules/route";
import { cents } from "../rules/units";
import type { Loadout, PackDogs, RunState } from "../state/runState";
import type { RunSetup } from "./runSetup";

function packDogsOf(dogs: readonly DogId[]): PackDogs | undefined {
  const [first, second, third] = dogs;
  if (first === undefined || dogs.length > 3) {
    return undefined;
  }
  if (second === undefined) {
    return [first];
  }
  return third === undefined ? [first, second] : [first, second, third];
}

// The setup's pack and gear over a fallback loadout, such as the save's last one.
export function loadoutFor(fallback: Loadout, setup: RunSetup<DogId, GearId>): Loadout {
  return {
    dogs: (setup.pack === undefined ? undefined : packDogsOf(setup.pack)) ?? fallback.dogs,
    gear: setup.gear === undefined ? fallback.gear : setup.gear,
  };
}

// The route a setup starts on: its own route up to its zone, the run's own route from the
// first zone, or the pre-fork route up to a later zone. parseRunSetup checked its ids.
function setupRoute(setup: RunSetup, state: RunState): readonly ZoneId[] {
  if (setup.route !== undefined) {
    return setup.route.slice(0, setup.zone) as ZoneId[];
  }
  return setup.zone === 1 ? state.route : defaultRoute(setup.zone);
}

// A new run moved to the setup's zone, on the setup's route, and given its money, applied
// after newRun so the override replaces the gear's starting money. The zones before the
// setup's are skipped.
export function withSetupStart(setup: RunSetup, state: RunState): RunState {
  return {
    ...state,
    firstZone: setup.zone - 1,
    money: setup.money === undefined ? state.money : cents(setup.money),
    route: setupRoute(setup, state),
    zoneIndex: setup.zone - 1,
  };
}
