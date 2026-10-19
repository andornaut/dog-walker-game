import type { GameData, WalkerId } from "../data/types";
import type { Owned } from "../save/schema";
import type { HomeLoadout } from "./home";
import { packCountLine } from "./homeLines";

// The home screen's two framed sections, top to bottom, each a card with a heading band.
// The Pocket strip under them is optional and has no frame.
export type SectionId = "dogs" | "walker";

// A section is incomplete until its pick is made, then complete.
export type SectionState = "complete" | "incomplete";

export interface Section {
  readonly heading: string;
  // The band's right-hand text: what an incomplete section needs, or the choice once
  // complete.
  readonly note: string;
  readonly state: SectionState;
}

export type Sections = Readonly<Record<SectionId, Section>>;

export function homeSections(
  data: Pick<GameData, "homeText" | "tuning" | "walkers">,
  owned: Pick<Owned, "dogSlots">,
  choice: { readonly loadout: HomeLoadout; readonly walker: WalkerId | null },
): Sections {
  const text = data.homeText;
  const { loadout, walker } = choice;
  return {
    dogs:
      loadout.dogs.length === 0
        ? { heading: text.sectionDogs, note: text.sectionDogsPrompt, state: "incomplete" }
        : {
            heading: text.sectionDogs,
            note: packCountLine(data, owned, loadout),
            state: "complete",
          },
    walker:
      walker === null
        ? { heading: text.sectionWalker, note: text.sectionWalkerPrompt, state: "incomplete" }
        : { heading: text.sectionWalker, note: data.walkers[walker].name, state: "complete" },
  };
}

// Start walk is ready once no section is incomplete: a walker and a dog are picked.
export function startReady(sections: Sections): boolean {
  return Object.values(sections).every((section) => section.state !== "incomplete");
}
