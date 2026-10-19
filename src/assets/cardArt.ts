import type { CardSource } from "../state/runState";
import { kebabCase } from "./spriteKeys";

export const SKIP_CARD_ART = "card-skip";

// CLEANUP (added 2026-10-19): guesses an option's illustration key from its label until
// card options carry their art key. Remove once OptionView.art reaches the card scene.
// Candidates are card-<source>-<words of the label>, longest run of words first.
export function cardArtCandidates(source: CardSource, label: string, index: number): string[] {
  if (source.kind === "upgradeOffer") {
    const upgrade = source.offered[index];
    return upgrade === undefined ? [] : [`card-${kebabCase(upgrade)}`];
  }
  const prefix = `card-${kebabCase(source.kind === "encounter" ? source.encounter : source.stop)}`;
  const words = label
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word !== "");
  const runs: string[] = [];
  for (let length = words.length; length > 0; length--) {
    for (let start = 0; start + length <= words.length; start++) {
      runs.push(`${prefix}-${words.slice(start, start + length).join("-")}`);
    }
  }
  return runs;
}
