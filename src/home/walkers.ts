// CLEANUP (added 2026-10-19): the preset walkers held here until gameData.walkers carries
// this shape; then read the list from there and delete this file.
export interface PresetWalker {
  readonly name: string;
  readonly portraitKey: string;
  readonly spriteKey: string;
}

// All free. classic is the original walker sprite.
export const PRESET_WALKERS = {
  ada: { name: "Ada", portraitKey: "face-walker-ada", spriteKey: "walker-girl" },
  ben: { name: "Ben", portraitKey: "face-walker-ben", spriteKey: "walker-man" },
  classic: { name: "Classic", portraitKey: "face-walker-classic", spriteKey: "walker" },
  trista: { name: "Trista", portraitKey: "face-walker-trista", spriteKey: "walker-teacher" },
} as const satisfies Record<string, PresetWalker>;

export type PresetWalkerId = keyof typeof PRESET_WALKERS;

export const DEFAULT_WALKER: PresetWalkerId = "classic";

// The walker's sprite, or the classic one while its own has not been exported.
export function walkerSpriteKey(
  hasSprite: (key: string) => boolean,
  walker: PresetWalkerId,
): string {
  const { spriteKey } = PRESET_WALKERS[walker];
  return hasSprite(spriteKey) ? spriteKey : PRESET_WALKERS[DEFAULT_WALKER].spriteKey;
}
