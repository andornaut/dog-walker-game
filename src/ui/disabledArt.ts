import { remapToGrey } from "../assets/greyRamp";
import { NEUTRAL_RAMP } from "./palette";
import { GREYED } from "./selection";

// The pictures a disabled tile draws in grey (uiKit's tileTextureKey and addTileSprite): each
// dog's and walker's face, gear item and walker perk icon, and the dog slot's icon.
const TILE_ART_PREFIXES = ["face-dog-", "face-walker-", "icon-perk-", "item-"];
const TILE_ART_KEYS: ReadonlySet<string> = new Set(["icon-dog-slot"]);

// Whether a disabled tile can draw the key's art in grey. A build packs each such key's grey
// copy on the atlas page beside its art, under disabledArtKey.
export function greysOnTile(key: string): boolean {
  return TILE_ART_KEYS.has(key) || TILE_ART_PREFIXES.some((prefix) => key.startsWith(prefix));
}

// The texture key of a key's grey copy for a disabled tile.
export function disabledArtKey(key: string): string {
  return `${key}-disabled`;
}

// RGBA pixels remapped in place to a disabled tile's grey: each colour moved to the colour of
// NEUTRAL_RAMP nearest its brightness, then GREYED.copyDarker steps down the ramp, alpha kept.
export function greyForDisabledTile(pixels: Uint8ClampedArray): void {
  remapToGrey(NEUTRAL_RAMP, GREYED.copyDarker, pixels);
}
