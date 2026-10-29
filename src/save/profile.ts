import type { AchievementId, HintId } from "../data/types";
import type { Cents } from "../lib/units";
import { type AchievementData, newlyEarned } from "../rules/achievements";
import type { Change } from "../rules/causes";
import { earnedIfBanked } from "./achievementPreview";
import { awardAchievements, type AwardContext, earnedSince } from "./achievements";
import { bankCheckpoint, recordCheckpoint, recordRunEnd, type RunResult } from "./checkpoint";
import type { SaveContext } from "./load";
import type { Checkpoint, SaveDocument, Settings } from "./schema";
import type { SaveStore, StoreLoadResult } from "./storage";

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

// The achievements and a clock, read each time something is awarded.
export interface Awards {
  readonly data: AchievementData;
  readonly now: () => number;
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
  load: StoreLoadResult,
  newPlayer: (save: SaveDocument) => SaveDocument,
): SaveDocument {
  return load.status === "loaded" ? load.save : newPlayer(load.save);
}

interface OpenedProfile {
  load: StoreLoadResult;
  session: ProfileSession;
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

  private constructor(
    private readonly awards: Awards,
    private readonly store: SaveStore,
    document: SaveDocument,
    state: StorageState,
  ) {
    this.document = document;
    this.state = state;
  }

  // Loads the save. A new player's save goes through newPlayer first (for settings read from
  // the device). A run left unfinished at its last checkpoint is banked as if the player had
  // headed home, and the banked save is written back. Achievements the save already meets
  // (such as one from before they existed) are awarded and wait to be celebrated.
  static async open(
    context: SaveContext,
    awards: Awards,
    store: SaveStore,
    newPlayer: (save: SaveDocument) => SaveDocument = (save) => save,
  ): Promise<OpenedProfile> {
    const load = await store.load(context);
    const state =
      load.status === "newer" || load.status === "unavailable" ? load.status : "available";
    const loaded = loadedSave(load, newPlayer);
    const session = new ProfileSession(awards, store, loaded, state);
    if (loaded.checkpoint !== null) {
      await session.update((save) => bankCheckpoint(session.awardContext(), save));
    }
    const banked = session.save;
    if (newlyEarned(awards.data, banked, banked, null).length > 0) {
      await session.update((save) => awardAchievements(session.awardContext(), null, save, save));
    }
    session.celebrations = earnedSince(awards.data, loaded, session.save);
    return { load, session };
  }

  private awardContext(): AwardContext {
    return { data: this.awards.data, now: this.awards.now() };
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
    return earnedIfBanked(this.awardContext(), this.document, result);
  }

  checkpointRun(slice: Checkpoint): Promise<void> {
    return this.update((save) => recordCheckpoint(save, slice));
  }

  finishRun(result: RunResult, changes: readonly Change[]): Promise<void> {
    const before = this.document;
    const written = this.update((save) => recordRunEnd(this.awardContext(), save, result));
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
    const written = this.update((save) =>
      awardAchievements(this.awardContext(), null, save, change(save)),
    );
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
