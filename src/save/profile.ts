import type { SaveStore, StoreLoadResult } from "@andornaut/game-kit/save/saveStore";

import type { AchievementId, HintId } from "../data/types";
import { newlyEarned } from "../rules/achievements";
import type { Change } from "../rules/causes";
import type { Cents } from "../units";
import { earnedIfBanked } from "./achievementPreview";
import { awardAchievements, type AwardContext, earnedSince } from "./achievements";
import { bankCheckpoint, recordCheckpoint, recordRunEnd, type RunResult } from "./checkpoint";
import type { LaunchWalk, ResumeWalk } from "./resume";
import type { Checkpoint, SaveDocument, Settings } from "./schema";

// "unavailable" once storage could not be read, or while the last write failed: play goes on with
// the save in memory, and the home screen says progress won't be saved. A later write that succeeds
// makes it "available" again; a failed read lasts the session, since the store then writes nothing.
// "newer" when a later version of the game wrote the stored save: play goes on with the save in
// memory, nothing is written for the session, and the home screen's plate offers the newer
// version.
export type StorageState = "available" | "newer" | "unavailable";

// What the end screen shows beyond the saved stats: the achievements the run earned, whether
// it beat the best walk, and every change it made and the cash it lost, for the earnings
// breakdown.
export interface RunEnd {
  readonly achievements: readonly AchievementId[];
  readonly changes: readonly Change[];
  readonly lostCents: Cents;
  readonly newBestWalk: boolean;
}

type SettingsListener = (settings: Settings) => void;

// A player's first settings on this device: reduced motion follows the device's setting.
export function deviceSettings(settings: Settings): Settings {
  const reducedMotion =
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  return { ...settings, reducedMotion };
}

// A new player's save on this device.
export function newPlayerOnDevice(save: SaveDocument): SaveDocument {
  return { ...save, settings: deviceSettings(save.settings) };
}

// The save a load gives: the stored one, or else (none stored, or one that could not be kept)
// a new player's, through newPlayer.
export function loadedSave(
  load: StoreLoadResult<SaveDocument>,
  newPlayer: (save: SaveDocument) => SaveDocument,
): SaveDocument {
  return load.status === "loaded" ? load.save : newPlayer(load.save);
}

interface OpenedProfile {
  load: StoreLoadResult<SaveDocument>;
  session: ProfileSession;
}

// What a launch does with a checkpoint: launchWalk in src/save/resume.ts. Without it, every
// checkpoint banks.
type LaunchDecision = (checkpoint: Checkpoint) => LaunchWalk;

const bankEvery: LaunchDecision = () => ({ kind: "bank", reason: "resuming is off" });

function withoutResume(checkpoint: Checkpoint): Checkpoint {
  const { resume, ...banked } = checkpoint;
  return resume === undefined ? checkpoint : banked;
}

// The player's save for this page's life. Every change applies to the save in memory at
// once, so a scene can read it straight after, and is then written in the order made.
export class ProfileSession {
  // Earned away from a run's end (on launch or by a purchase), for the home screen to show.
  private celebrations: AchievementId[] = [];
  private document: SaveDocument;
  private ended: RunEnd | null = null;
  private readonly settingsListeners = new Set<SettingsListener>();
  private state: StorageState;
  private writes: Promise<void> = Promise.resolve();
  // The walk the launch resumes, until the walk takes it (takeResumedWalk).
  private resumable: ResumeWalk | null = null;
  // Set once the game has crashed: no later checkpoint keeps a resume point (stopResuming).
  private resumeStopped = false;

  private constructor(
    private readonly awards: AwardContext,
    private readonly store: SaveStore<SaveDocument>,
    document: SaveDocument,
    state: StorageState,
  ) {
    this.document = document;
    this.state = state;
  }

  // Loads the save. A new player's save goes through newPlayer first (for settings read from
  // the device). A run left unfinished at its last checkpoint resumes when launch says so, the
  // checkpoint kept until the run ends (takeResumedWalk); otherwise it is banked as if the player
  // had headed home, and the banked save is written back. Achievements the save already meets
  // (such as one from before they existed) are awarded and wait to be celebrated.
  static async open(
    awards: AwardContext,
    store: SaveStore<SaveDocument>,
    newPlayer: (save: SaveDocument) => SaveDocument = (save) => save,
    launch: LaunchDecision = bankEvery,
  ): Promise<OpenedProfile> {
    const load = await store.load();
    const state =
      load.status === "newer" || load.status === "unavailable" ? load.status : "available";
    const loaded = loadedSave(load, newPlayer);
    const session = new ProfileSession(awards, store, loaded, state);
    if (loaded.checkpoint !== null) {
      const decided = launch(loaded.checkpoint);
      if (decided.kind === "resume") {
        session.resumable = decided.walk;
      } else {
        if (decided.kind === "bank") {
          console.info(`The unfinished walk banks as heading home: ${decided.reason}`);
        }
        await session.update((save) => bankCheckpoint(session.awards, save));
      }
    }
    const banked = session.save;
    if (newlyEarned(awards.data, banked, banked, null).length > 0) {
      await session.update((save) => awardAchievements(session.awards, null, save, save));
    }
    session.celebrations = earnedSince(awards.data, loaded, session.save);
    return { load, session };
  }

  get save(): SaveDocument {
    return this.document;
  }

  get storage(): StorageState {
    return this.state;
  }

  // The last run finished this session, or null before one.
  get lastRunEnd(): RunEnd | null {
    return this.ended;
  }

  // Resolves once this change, and every one before it, has been written or has failed. With
  // a newer version's save stored, the change stays in memory and nothing is written.
  update(change: (save: SaveDocument) => SaveDocument): Promise<void> {
    this.document = change(this.document);
    if (this.state === "newer") {
      return this.writes;
    }
    const document = this.document;
    this.writes = this.writes.then(async () => {
      const result = await this.store.save(document);
      if (result.status === "invalid") {
        console.error(`The save was not written: ${result.reason}`);
      } else {
        this.state = result.status === "saved" ? "available" : "unavailable";
      }
    });
    return this.writes;
  }

  setSettings(settings: Settings): Promise<void> {
    const written = this.update((save) => ({ ...save, settings }));
    for (const listener of this.settingsListeners) {
      listener(settings);
    }
    return written;
  }

  // Returns a function that stops listening.
  onSettingsChanged(listener: SettingsListener): () => void {
    this.settingsListeners.add(listener);
    return () => this.settingsListeners.delete(listener);
  }

  shownHints(): ReadonlySet<HintId> {
    return new Set(this.document.shownHints);
  }

  markHintShown(hint: HintId): Promise<void> {
    if (this.document.shownHints.includes(hint)) {
      return this.writes;
    }
    return this.update((save) => ({ ...save, shownHints: [...save.shownHints, hint] }));
  }

  // What banking result now would newly earn, for a mid-run preview; nothing is written.
  earnedIfBanked(result: RunResult): AchievementId[] {
    return earnedIfBanked(this.awards, this.document, result);
  }

  // The walk the launch resumes, once: its resume point leaves the stored checkpoint, so a
  // resumed walk that crashes before it saves again banks on the next launch rather than
  // resuming into the crash. null when the launch resumes none.
  takeResumedWalk(): ResumeWalk | null {
    const walk = this.resumable;
    this.resumable = null;
    if (walk !== null) {
      void this.update((save) =>
        save.checkpoint === null ? save : recordCheckpoint(save, withoutResume(save.checkpoint)),
      );
    }
    return walk;
  }

  // Whether the launch resumes a walk, which takes it with takeResumedWalk.
  get resumesWalk(): boolean {
    return this.resumable !== null;
  }

  // Saves the run so far, with the point the next launch resumes it from unless the game has
  // crashed (stopResuming).
  checkpointRun(slice: Checkpoint): Promise<void> {
    const kept = this.resumeStopped ? withoutResume(slice) : slice;
    return this.update((save) => recordCheckpoint(save, kept));
  }

  // After a crash the walk in memory may be what broke, so the checkpoints it still writes (as
  // the page hides) bank on the next launch rather than resume.
  stopResuming(): void {
    this.resumeStopped = true;
  }

  finishRun(result: RunResult, changes: readonly Change[]): Promise<void> {
    const before = this.document;
    const written = this.update((save) => recordRunEnd(this.awards, save, result));
    // Banking raised the best for the walk's pack size, which a dev start past zone 1 never does.
    const size = result.dogs.length;
    this.ended = {
      achievements: earnedSince(this.awards.data, before, this.document),
      changes,
      lostCents: result.lostCents,
      newBestWalk:
        this.document.stats.bestCentsByPackSize[size] !== before.stats.bestCentsByPackSize[size],
    };
    return written;
  }

  // A purchase, or another change to what the player owns: the ownership achievements it
  // meets are awarded and wait to be celebrated.
  purchase(change: (save: SaveDocument) => SaveDocument): Promise<void> {
    const before = this.document;
    const written = this.update((save) => awardAchievements(this.awards, null, save, change(save)));
    this.celebrations.push(...earnedSince(this.awards.data, before, this.document));
    return written;
  }

  // The achievements waiting to be celebrated on the home screen, once each.
  takeCelebrations(): AchievementId[] {
    const taken = this.celebrations;
    this.celebrations = [];
    return taken;
  }
}
