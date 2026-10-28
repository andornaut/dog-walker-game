// Remembers, per device, that the start screen has suggested installing the game, so it does so
// once. Installing is per device, so the flag sits beside the save under its own key rather
// than in it.
import type { SaveStorage } from "../save/storage";
import { type InstallState, offersInstall } from "./installState";

export const INSTALL_NUDGE_KEY = "dog-walker-game:install-nudged";
const SHOWN = "1";

export interface InstallNudge {
  // Whether the suggestion may show now: the flag has been read and is unset, and the state
  // offers a way to install.
  due(state: InstallState): boolean;
  // Records that it showed. A failed write is ignored: the flag stays set for the session.
  markShown(): void;
  // Settles once the flag has been read.
  readonly ready: Promise<void>;
}

// Reads the flag at once. Until the read settles, and when it fails, the suggestion counts as
// shown, so storage the game cannot write never makes it repeat.
export function createInstallNudge(storage: SaveStorage): InstallNudge {
  let shown = true;
  let marked = false;
  const ready = storage.read(INSTALL_NUDGE_KEY).then(
    (value) => {
      shown = marked || value === SHOWN;
    },
    () => undefined,
  );
  return {
    due: (state) => !shown && offersInstall(state),
    markShown() {
      marked = true;
      shown = true;
      storage.write(INSTALL_NUDGE_KEY, SHOWN).catch(() => undefined);
    },
    ready,
  };
}
