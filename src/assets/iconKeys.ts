import type { DebuffId } from "../data/types";
import { kebabCase } from "./spriteKeys";

// The 16x16 icon of a debuff, on its bar.
export function debuffIconKey(debuff: DebuffId): string {
  return `icon-${kebabCase(debuff)}`;
}

// The 16x16 icon in a dog's pull bubble while it strains toward a squirrel.
export const SQUIRREL_ICON_KEY = "icon-trait-chaser";

// The 16x16 coin in the walk bar's cash well.
export const MONEY_ICON_KEY = "icon-money";
