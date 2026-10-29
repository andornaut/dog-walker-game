import { type SaveKeys, type SaveStore, saveStore } from "@andornaut/game-kit/save/saveStore";
import { localSaveStorage, type SaveStorage } from "@andornaut/game-kit/save/storage";

import { type SaveContext, saveFormat } from "./load";
import type { SaveDocument } from "./schema";

export const SAVE_KEYS: SaveKeys = {
  backup: "dog-walker-game:save-backup",
  save: "dog-walker-game:save",
};

// Where a checkpoint's resume point that could not be read is copied as the launch banks it.
export const RESUME_BACKUP_KEY = "dog-walker-game:resume-backup";

// The game's save in storage, in its format for context.
export function gameSaveStore(context: SaveContext, storage: SaveStorage): SaveStore<SaveDocument> {
  return saveStore(storage, SAVE_KEYS, saveFormat(context));
}

// The page's save store, on localStorage.
export function pageSaveStore(context: SaveContext): SaveStore<SaveDocument> {
  return gameSaveStore(context, localSaveStorage());
}
