import type { DogId, GearId, WalkerId } from "../data/types";
import type { HomeLoadout } from "../home/home";
import { packDogsOf } from "../state/pack";
import type { Loadout } from "../state/runState";
import type { RunSetup } from "./runSetup";
import { loadoutFor } from "./setupRun";

// The parameters that describe a run. A URL with any of them skips the home screen; dev alone
// only shows the overlay.
const RUN_PARAMS = ["gear", "money", "pack", "seed", "speed", "walker", "zone"] as const;

// Every parameter that overrides a walk, `route` included: it shapes the walk but does not
// start one on its own.
const OVERRIDE_PARAMS = [...RUN_PARAMS, "route"] as const;

export function namesRunSetup(search: string): boolean {
  const params = new URLSearchParams(search);
  return RUN_PARAMS.some((name) => params.has(name));
}

// The run a dev link starts: its pack, gear and walker over the saved last loadout and walker,
// or over the first owned dog when nothing was picked yet.
export function devRunLoadout(
  saved: HomeLoadout,
  walker: WalkerId,
  firstOwned: DogId,
  setup: RunSetup<DogId, GearId, WalkerId>,
): Loadout {
  return loadoutFor(
    { dogs: packDogsOf(saved.dogs) ?? [firstOwned], gear: saved.gear, walker },
    setup,
  );
}

// The URL without its run overrides, and without `dev` too when dev mode is being disabled. The
// path, the hash and every other parameter stay.
export function stripDevParams(href: string, disableDev: boolean): string {
  const url = new URL(href);
  const names = disableDev ? [...OVERRIDE_PARAMS, "dev"] : OVERRIDE_PARAMS;
  names.forEach((name) => url.searchParams.delete(name));
  return url.toString();
}

// The setup the next walk takes once the player is home: no overrides, a fresh seed and dev
// mode as it was, or off when disabled. Overrides apply only to the walk they start.
export function homeRunSetup(
  setup: RunSetup<DogId, GearId, WalkerId>,
  seed: number,
  disableDev: boolean,
): RunSetup<DogId, GearId, WalkerId> {
  return { dev: disableDev ? false : setup.dev, seed, speed: 1, zone: 1 };
}
