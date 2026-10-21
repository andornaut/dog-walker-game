import type { Events } from "phaser";

import type { DogId } from "../data/types";
import type { RunPause } from "../hud/topBar";
import type { ExplainTarget } from "../hud/walkHud";
import type { Point } from "../lib/rect";
import type { RunState } from "../state/runState";
import type { PauseSceneData } from "./PauseScene";

// What the HUD draws: the run, the dogs the open card affects, what a held press explains, the
// pack's centre across the screen, and how far through the zone.
export interface RunHudView {
  affected: readonly DogId[];
  explaining: ExplainTarget | undefined;
  packX: number;
  run: RunState;
  zoneFraction: number;
}

// What the HUD reads of the walk it shows, every frame: what it draws, where each dog is on the
// road, the events it shows the walk's moments from, the walk's pause and whether motion is
// reduced. RunScene's walk, or a still walk a picture shows.
export interface HudWalk {
  dogPoint(dog: DogId): Point | undefined;
  readonly events: Events.EventEmitter;
  hudView(): RunHudView | undefined;
  reducedMotion(): boolean;
  runPause(): RunPause;
}

// The run the walk bar's buttons act on: the walk the HUD shows, and the pause menu and pages
// the bar opens over it.
export interface HudRun extends HudWalk {
  closePause(): void;
  openFromBar(open: "help" | "settings"): void;
  openPause(mode?: PauseSceneData["mode"]): void;
}
