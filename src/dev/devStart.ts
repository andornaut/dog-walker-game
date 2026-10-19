import type { DogId, GearId } from "../data/types";
import { type HomeLoadout, packOf } from "../home/home";
import type { Loadout } from "../state/runState";
import type { RunSetup } from "./runSetup";
import { loadoutFor } from "./setupRun";

// The parameters that describe a run. A URL with any of them skips the home screen; dev alone
// only shows the overlay.
const RUN_PARAMS = ["gear", "money", "pack", "seed", "speed", "zone"] as const;

export function namesRunSetup(search: string): boolean {
  const params = new URLSearchParams(search);
  return RUN_PARAMS.some((name) => params.has(name));
}

// The run a dev link starts: its pack and gear over the saved last loadout, or over the first
// owned dog when nothing was picked yet.
export function devRunLoadout(
  saved: HomeLoadout,
  firstOwned: DogId,
  setup: RunSetup<DogId, GearId>,
): Loadout {
  return loadoutFor({ dogs: packOf(saved) ?? [firstOwned], gear: saved.gear }, setup);
}
