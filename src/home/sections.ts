import type { GameData, WalkerId } from "../data/types";
import type { Owned } from "../save/schema";
import type { HomeLoadout } from "./home";
import { packCountLine } from "./homeLines";

// The home screen's three sections, top to bottom: each is a framed card with a heading band.
export type SectionId = "dogs" | "gear" | "walker";

// A required section is incomplete until its pick is made, then complete. Gear is optional,
// so it is never incomplete: it lights as complete once the required picks are made or an item
// is equipped, and stays neutral (dark, with no prompt) before then.
export type SectionState = "complete" | "incomplete" | "neutral";

export interface Section {
  readonly heading: string;
  // The band's right-hand text: what an incomplete section needs, the choice once complete,
  // and nothing when neutral.
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
  const required = walker !== null && loadout.dogs.length > 0;
  return {
    dogs:
      loadout.dogs.length === 0
        ? { heading: text.sectionDogs, note: text.sectionDogsPrompt, state: "incomplete" }
        : {
            heading: text.sectionDogs,
            note: packCountLine(data, owned, loadout),
            state: "complete",
          },
    gear: {
      heading: text.sectionGear,
      note: loadout.gear === null ? "" : data.shopGear[loadout.gear].name,
      state: required || loadout.gear !== null ? "complete" : "neutral",
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
