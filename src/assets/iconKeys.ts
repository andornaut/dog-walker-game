import type { DogId, Energy, GameData, NeedId, Temperament, TraitId } from "../data/types";
import type { DogStatusId } from "../runner/statuses";
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

// The 16x16 icon a dog's status shows on its doghouse slot.
export function statusIconKey(status: DogStatusId): string {
  return `icon-${kebabCase(status)}`;
}

// The 16x16 icon of a need, in its bubble over the dog and on its spots.
export function needIconKey(need: NeedId): string {
  return `icon-need-${kebabCase(need)}`;
}

// The 16x16 growl in a nervous dog's bubble while she strains toward another dog.
export const GROWL_ICON_KEY = "icon-growl";

// The 16x16 icon of a dog's quirk, on its detail card and its doghouse, by the dog's art name.
export function quirkIconKey(data: Pick<GameData, "dogs">, dog: DogId): string {
  return `icon-quirk-${data.dogs[dog].art}`;
}
