// CLEANUP (added 2026-10-28): road sprites the data names before art draws them, which the game
// draws as a placeholder box meanwhile. Remove an entry once its sprite is in the manifest, and
// this file once the set is empty.
const UNDRAWN_ART: ReadonlySet<string> = new Set(["pothole"]);

// Whether the art tests skip a sprite: it is listed as undrawn and the manifest lacks it.
export function undrawn(has: (key: string) => boolean, key: string): boolean {
  return UNDRAWN_ART.has(key) && !has(key);
}
