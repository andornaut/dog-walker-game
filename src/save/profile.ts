import type { HintId } from "../data/types";
import type { Change } from "../rules/causes";
import {
  bankCheckpoint,
  isNewBestWalk,
  recordCheckpoint,
  recordRunEnd,
  type RunResult,
} from "./checkpoint";
import type { SaveContext } from "./load";
import type { Checkpoint, SaveDocument, Settings } from "./schema";
import type { SaveStore, StoreLoadResult } from "./storage";

// "unavailable" once storage could not be read or a write failed: play goes on with the save
// in memory, and the home screen says progress won't be saved.
export type StorageState = "available" | "unavailable";

// What the end screen shows beyond the saved stats: whether the run beat the best walk, and
// every change the run made, for the earnings breakdown.
export interface RunEnd {
  readonly changes: readonly Change[];
  readonly newBestWalk: boolean;
}

export type SettingsListener = (settings: Settings) => void;

export interface OpenedProfile {
  load: StoreLoadResult;
  session: ProfileSession;
}

// The player's save for this page's life. Every change applies to the save in memory at
// once, so a scene can read it straight after, and is then written in the order made.
export class ProfileSession {
  private document: SaveDocument;
  private ended: RunEnd | null = null;
  private readonly settingsListeners = new Set<SettingsListener>();
  private state: StorageState;
  private writes: Promise<void> = Promise.resolve();

  private constructor(
    private readonly store: SaveStore,
    document: SaveDocument,
    state: StorageState,
  ) {
    this.document = document;
    this.state = state;
  }

  // Loads the save. A new player's save goes through newPlayer first (for settings read from
  // the device). A run left unfinished at its last checkpoint is banked as if the player had
  // headed home, and the banked save is written back.
  static async open(
    context: SaveContext,
    store: SaveStore,
    newPlayer: (save: SaveDocument) => SaveDocument = (save) => save,
  ): Promise<OpenedProfile> {
    const load = await store.load(context);
    const state = load.status === "unavailable" ? "unavailable" : "available";
    const loaded = load.status === "loaded" ? load.save : newPlayer(load.save);
    const session = new ProfileSession(store, loaded, state);
    if (loaded.checkpoint !== null) {
      await session.update(bankCheckpoint);
    }
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

  // Resolves once this change, and every one before it, has been written or has failed.
  update(change: (save: SaveDocument) => SaveDocument): Promise<void> {
    this.document = change(this.document);
    const document = this.document;
    this.writes = this.writes.then(async () => {
      const result = await this.store.save(document);
      if (result.status === "unavailable") {
        this.state = "unavailable";
      } else if (result.status === "invalid") {
        console.error(`The save was not written: ${result.reason}`);
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

  checkpointRun(slice: Checkpoint): Promise<void> {
    return this.update((save) => recordCheckpoint(save, slice));
  }

  finishRun(result: RunResult, changes: readonly Change[]): Promise<void> {
    this.ended = {
      changes,
      newBestWalk: isNewBestWalk(this.document.stats, result.earnedCents),
    };
    return this.update((save) => recordRunEnd(save, result));
  }
}
