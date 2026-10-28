// Road sprites art has yet to draw. Each shows the placeholder box until it lands, and the art
// tests pass over it only while the manifest lacks it, so it meets every check once it is drawn.
// Remove a key once its art has landed.
export const AWAITING_ART: ReadonlySet<string> = new Set(["taxi"]);

// Whether a sprite key is one art has yet to draw and the manifest still lacks.
export function awaitsArt(has: (key: string) => boolean, key: string): boolean {
  return AWAITING_ART.has(key) && !has(key);
}
