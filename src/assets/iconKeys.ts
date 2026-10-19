import type { Energy, Temperament, TraitId } from "../data/types";
import { kebabCase } from "./spriteKeys";

// The 16x16 icons for a dog's trait and energy and its owner's temperament.
export function traitIconKey(trait: TraitId): string {
  return `icon-trait-${kebabCase(trait)}`;
}

export function energyIconKey(energy: Energy): string {
  return `icon-energy-${kebabCase(energy)}`;
}

export function temperamentIconKey(temperament: Temperament): string {
  return `icon-owner-${kebabCase(temperament)}`;
}
