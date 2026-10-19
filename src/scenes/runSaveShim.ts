// CLEANUP (added 2026-10-19): a stand-in for the save contract in profileStore.ts and the
// slices in src/save/runSlices.ts, with the same names and signatures, until the home and
// save branch lands. Once it has, import these from there, start EndScene with no data, and
// delete this file.
import type { Scene } from "phaser";

import { gameData } from "../data";
import type { GameData, HintId, WalkerId } from "../data/types";
import { packOf, recordWalk, type WalkResult } from "../home/home";
import type { Change } from "../rules/causes";
import { type Cents, cents } from "../rules/units";
import type { RunResult } from "../save/checkpoint";
import { type Checkpoint, DEFAULT_SETTINGS, type DogRun, type SaveDocument } from "../save/schema";
import { packDogs } from "../state/pack";
import type { Loadout, RunState } from "../state/runState";
import type { EndSceneData } from "./EndScene";
import { homeProfile, lastLoadout, setHomeProfile } from "./profileStore";

export type Settings = SaveDocument["settings"];

const SETTINGS_KEY = "shimSettings";
const HINTS_KEY = "shimShownHints";
const END_KEY = "shimEndResult";
const CHECKPOINT_KEY = "shimCheckpoint";
const CHANGES_KEY = "shimRunChanges";

export function currentSettings(scene: Scene): Settings {
  return (scene.registry.get(SETTINGS_KEY) as Settings | undefined) ?? DEFAULT_SETTINGS;
}

// Calls listener with the new settings on every change until the returned function is called
// or the scene shuts down.
export function onSettingsChanged(
  scene: Scene,
  listener: (settings: Settings) => void,
): () => void {
  const onChange = (_parent: unknown, value: Settings) => listener(value);
  const event = `changedata-${SETTINGS_KEY}`;
  scene.registry.events.on(event, onChange);
  const off = () => scene.registry.events.off(event, onChange);
  scene.events.once("shutdown", off);
  return off;
}

const MUTED_KEY = "shimMuted";

export function isMuted(scene: Scene): boolean {
  return scene.registry.get(MUTED_KEY) === true;
}

export function setMuted(scene: Scene, muted: boolean): void {
  scene.registry.set(MUTED_KEY, muted);
}

export function shownHints(scene: Scene): ReadonlySet<HintId> {
  return new Set((scene.registry.get(HINTS_KEY) as HintId[] | undefined) ?? []);
}

export function markHintShown(scene: Scene, hintId: HintId): void {
  scene.registry.set(HINTS_KEY, [...shownHints(scene), hintId]);
}

export function checkpointRun(scene: Scene, slice: Checkpoint): Promise<void> {
  scene.registry.set(CHECKPOINT_KEY, slice);
  return Promise.resolve();
}

// Banks the run into the session's profile, as the save would, and keeps the end screen's view.
export function finishRun(
  scene: Scene,
  result: RunResult,
  changes: readonly Change[] = [],
): Promise<void> {
  scene.registry.set(CHANGES_KEY, changes);
  const walk: WalkResult = {
    dogs: result.dogs.map(({ id }) => id),
    earned: result.earnedCents,
    firings: result.dogs.flatMap(({ fired, id, zonesFinished }) =>
      fired ? [{ dog: id, zoneIndex: zonesFinished }] : [],
    ),
    reason: result.outcome,
    zonesFinished: result.outcome === "finished" ? result.zone : result.zone - 1,
  };
  setHomeProfile(scene, recordWalk(gameData, walk, homeProfile(scene)));
  scene.registry.set(END_KEY, walk);
  return Promise.resolve();
}

export function endSceneData(scene: Scene): EndSceneData {
  return { result: scene.registry.get(END_KEY) as WalkResult };
}

export interface RunLoadout {
  dogSlots: number;
  loadout: Loadout;
  walker: WalkerId;
  walkerSprite: string;
}

export function runLoadout(scene: Scene): RunLoadout {
  const profile = homeProfile(scene);
  const picked = lastLoadout(scene);
  const dogs = packOf(picked);
  if (dogs === undefined) {
    throw new Error("No dog is picked for the run");
  }
  return {
    dogSlots: profile.dogSlots,
    loadout: { dogs, gear: picked.gear },
    walker: profile.walker,
    walkerSprite: gameData.walkers[profile.walker].spriteKey,
  };
}

function dogRuns(run: RunState): DogRun[] {
  const walking = packDogs(run);
  return run.pack.map((slot) =>
    slot.status === "fired"
      ? { fired: true, id: slot.dog, zonesFinished: slot.zoneIndex }
      : {
          fired: false,
          id: slot.dog,
          zonesFinished: walking.includes(slot.dog) ? run.zoneIndex : 0,
        },
  );
}

// zonesFinished is the zone index the run has moved on to: after a zone's end, its number.
export function checkpointOf(_data: Pick<GameData, "world">, run: RunState): Checkpoint {
  return { dogs: dogRuns(run), earnedCents: run.money, zonesFinished: run.zoneIndex };
}

export function runResultOf(data: Pick<GameData, "world">, run: RunState): RunResult {
  const outcome = run.phase.kind === "ended" ? run.phase.reason : "wentHome";
  const zone = Math.min(run.zoneIndex, data.world.zones.length - 1) + 1;
  const earnedCents: Cents = cents(run.money);
  const dogs = dogRuns(run).map((dog) =>
    outcome === "finished" && !dog.fired ? { ...dog, zonesFinished: zone } : dog,
  );
  return { dogs, earnedCents, outcome, zone };
}
