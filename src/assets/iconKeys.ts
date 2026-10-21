import type { DogStatusId } from "../runner/statuses";
import { kebabCase } from "./spriteKeys";

// The 16x16 icon a dog's status shows on its doghouse slot.
export function statusIconKey(status: DogStatusId): string {
  return `icon-${kebabCase(status)}`;
}

// The 16x16 icon in a dog's pull bubble while it strains toward a squirrel.
export const SQUIRREL_ICON_KEY = "icon-trait-chaser";

// The 16x16 coin in the top bar's money well.
export const MONEY_ICON_KEY = "icon-money";
