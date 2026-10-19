import type { GameData, WalkerId } from "../data/types";
import type { Owned } from "../save/schema";
import type { HomeLoadout } from "./home";
import { packCountLine } from "./homeLines";

// The home screen's three framed sections, each a card with a heading band.
export type SectionId = "dogs" | "pocket" | "walker";

// A section is neutral until its pick is made, then complete. The Dogs band shows the pack
// count either way; the Walker band asks for a face until one is picked; the Pocket band
// names the pocketed item, or says how many it holds while it is empty.
export type SectionState = "complete" | "neutral";

export interface Section {
  readonly heading: string;
  // The band's right-hand text: what a neutral section needs, or the choice once complete.
  readonly note: string;
  readonly state: SectionState;
}

export type Sections = Readonly<Record<SectionId, Section>>;

export function homeSections(
  data: Pick<GameData, "homeText" | "shopGear" | "tuning" | "walkers">,
  owned: Pick<Owned, "dogSlots">,
  choice: { readonly loadout: HomeLoadout; readonly walker: WalkerId | null },
): Sections {
  const text = data.homeText;
  const { loadout, walker } = choice;
  return {
    dogs: {
      heading: text.sectionDogs,
      note: packCountLine(data, owned, loadout),
      state: loadout.dogs.length === 0 ? "neutral" : "complete",
    },
    pocket:
      loadout.gear === null
        ? { heading: text.pocket.title, note: text.pocket.note, state: "neutral" }
        : { heading: text.pocket.title, note: data.shopGear[loadout.gear].name, state: "complete" },
    walker:
      walker === null
        ? { heading: text.sectionWalker, note: text.sectionWalkerPrompt, state: "neutral" }
        : { heading: text.sectionWalker, note: data.walkers[walker].name, state: "complete" },
  };
}

// Start walk is ready once a walker and a dog are picked; the Pocket is optional.
export function startReady(sections: Sections): boolean {
  return sections.walker.state === "complete" && sections.dogs.state === "complete";
}
