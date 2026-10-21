import * as v from "valibot";

import { loadSave, type SaveContext } from "./load";
import { createDefaultSave, type SaveDocument, saveSchema } from "./schema";

export const SAVE_KEY = "dog-walker-game:save";
export const SAVE_BACKUP_KEY = "dog-walker-game:save-backup";

export interface SaveStorage {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

// "unavailable" means storage threw: the game plays on with this save in memory and
// tells the player progress won't be saved.
export type StoreLoadResult =
  | { reason: string; save: SaveDocument; status: "corrupt" | "unavailable" }
  | { save: SaveDocument; status: "loaded" | "new" };

type StoreSaveResult = { reason: string; status: "invalid" | "unavailable" } | { status: "saved" };

export interface SaveStore {
  load(context: SaveContext): Promise<StoreLoadResult>;
  save(document: SaveDocument): Promise<StoreSaveResult>;
}

export function memoryStorage(entries: Map<string, string> = new Map()): SaveStorage {
  return {
    read: async (key) => entries.get(key) ?? null,
    write: async (key, value) => {
      entries.set(key, value);
    },
  };
}

// The only code that touches browser storage. A throwing getItem or setItem (private
// mode, quota) becomes a rejected promise.
export function browserStorage(storage: StorageLike): SaveStorage {
  return {
    read: async (key) => storage.getItem(key),
    write: async (key, value) => {
      storage.setItem(key, value);
    },
  };
}

// Looks the storage up on each call: reading window.localStorage itself throws when the
// browser blocks site data, and this turns that into a throw from getItem or setItem, which
// browserStorage reports as unavailable.
export function lazyStorage(lookup: () => StorageLike): StorageLike {
  return {
    getItem: (key) => lookup().getItem(key),
    setItem: (key, value) => lookup().setItem(key, value),
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Once a read fails, or a corrupt save cannot be backed up, the store stops writing for
// the session, so it never overwrites a save it could not read or keep.
export function saveStore(storage: SaveStorage): SaveStore {
  let writesBlocked = false;

  const unavailable = (context: SaveContext, error: unknown): StoreLoadResult => {
    writesBlocked = true;
    return {
      reason: describe(error),
      save: createDefaultSave(context.defaults),
      status: "unavailable",
    };
  };

  return {
    async load(context) {
      let raw: string | null;
      try {
        raw = await storage.read(SAVE_KEY);
      } catch (error) {
        return unavailable(context, error);
      }
      const result = loadSave(context, raw);
      if (result.status !== "corrupt") {
        return { save: result.save, status: result.status };
      }
      try {
        await storage.write(SAVE_BACKUP_KEY, result.raw);
      } catch (error) {
        return unavailable(context, error);
      }
      return { reason: result.reason, save: result.save, status: "corrupt" };
    },

    async save(document) {
      if (writesBlocked) {
        return { reason: "storage was unavailable at load", status: "unavailable" };
      }
      const validated = v.safeParse(saveSchema, document);
      if (!validated.success) {
        return { reason: v.summarize(validated.issues), status: "invalid" };
      }
      try {
        await storage.write(SAVE_KEY, JSON.stringify(validated.output));
      } catch (error) {
        return { reason: describe(error), status: "unavailable" };
      }
      return { status: "saved" };
    },
  };
}
