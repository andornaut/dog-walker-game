import type { StoreLoadResult } from "@andornaut/game-kit/save/saveStore";
import { localSaveStorage } from "@andornaut/game-kit/save/storage";
import { type Game, type Scene, Scenes } from "phaser";

import { gameData } from "../data";
import type { AchievementId, HintId, WalkerId } from "../data/types";
import { soundVolumes } from "../home/settings";
import type { Change } from "../rules/causes";
import type { RunResult } from "../save/checkpoint";
import { saveContextFrom } from "../save/load";
import {
  deviceSettings,
  newPlayerOnDevice,
  ProfileSession,
  type RunEnd,
  type StorageState,
} from "../save/profile";
import { encodeResume, launchWalk, type ResumeWalk } from "../save/resume";
import {
  type Checkpoint,
  DEFAULT_SETTINGS,
  type SaveDocument,
  type Settings,
} from "../save/schema";
import { pageSaveStore, RESUME_BACKUP_KEY } from "../save/storage";
import { soundboardOf } from "./soundboard";

export type { Settings } from "../save/schema";

// The player's save, shared by every scene through the game's registry. BootScene opens it
// before any other scene runs.
const SESSION_KEY = "profileSession";

// The opened profile, or undefined before BootScene opens it.
function openedSession(scene: Scene): ProfileSession | undefined {
  return scene.registry.get(SESSION_KEY) as ProfileSession | undefined;
}

function session(scene: Scene): ProfileSession {
  const opened = openedSession(scene);
  if (opened === undefined) {
    throw new Error("The profile is read before BootScene opened it");
  }
  return opened;
}

// The settings' volumes, or silence while muted.
export function applySound(scene: Scene, settings: Settings): void {
  const soundboard = soundboardOf(scene);
  soundboard.setVolumes(soundVolumes(settings));
  soundboard.setMuted(settings.muted);
}

// Loads the save from localStorage and applies the saved volumes. A new player's reduced motion
// follows the device's setting. A run left at a checkpoint resumes when resume allows it and its
// resume point is good (launchWalk), and is banked as heading home otherwise; a resume point
// that could not be read is kept under RESUME_BACKUP_KEY.
export async function openProfile(
  scene: Scene,
  resume: boolean,
): Promise<StoreLoadResult<SaveDocument>> {
  const launch = (checkpoint: Checkpoint) => {
    const decided = launchWalk(gameData, resume, checkpoint);
    if (decided.kind === "bank" && decided.backup !== undefined) {
      localSaveStorage()
        .write(RESUME_BACKUP_KEY, decided.backup)
        .catch((error: unknown) => console.warn("The resume point was not backed up.", error));
    }
    return decided;
  };
  const { load, session: opened } = await ProfileSession.open(
    { data: gameData },
    pageSaveStore(saveContextFrom(gameData)),
    newPlayerOnDevice,
    launch,
  );
  scene.registry.set(SESSION_KEY, opened);
  applySound(scene, opened.save.settings);
  return load;
}

// Whether the launch resumes a walk left unfinished.
export function resumesWalk(scene: Scene): boolean {
  return session(scene).resumesWalk;
}

// The walk the launch resumes, once, for the run scene that resumes it; null when there is none.
export function takeResumedWalk(scene: Scene): ResumeWalk | null {
  return session(scene).takeResumedWalk();
}

// Called as the crash screen stops the game: the walk's later checkpoints keep no resume point.
export function stopResuming(game: Game): void {
  (game.registry.get(SESSION_KEY) as ProfileSession | undefined)?.stopResuming();
}

export function profileSave(scene: Scene): SaveDocument {
  return session(scene).save;
}

export function updateProfile(
  scene: Scene,
  change: (save: SaveDocument) => SaveDocument,
): Promise<void> {
  return session(scene).update(change);
}

// A purchase: like updateProfile, and the ownership achievements it meets are awarded.
export function purchaseInProfile(
  scene: Scene,
  change: (save: SaveDocument) => SaveDocument,
): Promise<void> {
  return session(scene).purchase(change);
}

// Achievements earned on launch or by a purchase, for the home screen to celebrate once.
export function takeCelebrations(scene: Scene): AchievementId[] {
  return session(scene).takeCelebrations();
}

export function storageState(scene: Scene): StorageState {
  return session(scene).storage;
}

// The last run finished this session, for the end screen.
export function lastRunEnd(scene: Scene): RunEnd | null {
  return session(scene).lastRunEnd;
}

// Before the save loads, the defaults, with reduced motion following the device's setting.
export function currentSettings(scene: Scene): Settings {
  return openedSession(scene)?.save.settings ?? deviceSettings(DEFAULT_SETTINGS);
}

// Calls listener with the new settings on every change, until the scene shuts down.
export function onSettingsChanged(scene: Scene, listener: (settings: Settings) => void): void {
  scene.events.once(Scenes.Events.SHUTDOWN, session(scene).onSettingsChanged(listener));
}

// Saves the settings, applies the volumes and tells every listener.
export function setSettings(scene: Scene, settings: Settings): Promise<void> {
  applySound(scene, settings);
  return session(scene).setSettings(settings);
}

export function isMuted(scene: Scene): boolean {
  return currentSettings(scene).muted;
}

// Mutes or unmutes all sound: saved, applied and told to every settings listener.
function setMuted(scene: Scene, muted: boolean): void {
  void setSettings(scene, { ...currentSettings(scene), muted });
}

// Flips mute, as the M key, the run's sound button and the home screen's do, and returns
// whether sound is now muted.
export function toggleMuted(scene: Scene): boolean {
  const muted = !isMuted(scene);
  setMuted(scene, muted);
  return muted;
}

export function markHintShown(scene: Scene, hintId: HintId): void {
  void session(scene).markHintShown(hintId);
}

export function shownHints(scene: Scene): ReadonlySet<HintId> {
  return session(scene).shownHints();
}

// At each fork, as each zone after the first starts, and as the tab hides. src/save/runSlices.ts
// builds the slice from the run; resume is where the next launch resumes the walk, or null for a
// walk that does not resume.
export function checkpointRun(
  scene: Scene,
  slice: Checkpoint,
  resume: ResumeWalk | null,
): Promise<void> {
  const text = resume === null ? undefined : encodeResume(gameData, resume);
  return session(scene).checkpointRun(text === undefined ? slice : { ...slice, resume: text });
}

// What banking result now would newly earn, for a mid-run badge line: nothing is written, and
// nothing is earned without an opened profile.
export function earnedIfBanked(scene: Scene, result: RunResult): AchievementId[] {
  return openedSession(scene)?.earnedIfBanked(result) ?? [];
}

// At run end, before EndScene opens. changes is every change the run made, for the end
// screen's earnings breakdown. The save in memory is updated before this returns.
export function finishRun(
  scene: Scene,
  result: RunResult,
  changes: readonly Change[],
): Promise<void> {
  return session(scene).finishRun(result, changes);
}

// The walker a walk uses: the one picked, or the default while none is, as after a dev link
// starts a run.
export function walkerInUse(save: Pick<SaveDocument, "walker">): WalkerId {
  return save.walker ?? gameData.defaultWalker;
}

// The walker's road sprite, or the default walker's while its own is not loaded.
export function walkerSpriteKey(scene: Scene, walker: WalkerId): string {
  const own = gameData.walkers[walker].spriteKey;
  return scene.textures.exists(own) ? own : gameData.walkers[gameData.defaultWalker].spriteKey;
}
