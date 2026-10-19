import type { GameData, WalkerId } from "../data/types";
import type { Owned } from "../save/schema";
import type { HomeLoadout } from "./home";
import { packCountLine } from "./homeLines";

// The home screen's three sections, top to bottom: each is a framed card with a heading band.
export type SectionId = "dogs" | "gear" | "walker";

// A required section is incomplete until its pick is made, then complete. Gear is optional,
// so with nothing equipped it is neutral, never incomplete.
export type SectionState = "complete" | "incomplete" | "neutral";

export interface Section {
  readonly heading: string;
  // The band's right-hand text: what an incomplete section needs, the choice once complete,
  // and nothing when neutral.
  readonly note: string;
  readonly state: SectionState;
}

export type Sections = Readonly<Record<SectionId, Section>>;

// The walker counts as picked once the player has walked, or has tapped a face this visit:
// the save always holds a walker, so a new player's default is not yet a choice.
export function walkerPicked(walks: number, tappedThisVisit: boolean): boolean {
  return walks > 0 || tappedThisVisit;
}

export function homeSections(
  data: Pick<GameData, "homeText" | "shopGear" | "tuning" | "walkers">,
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
    gear:
      loadout.gear === null
        ? { heading: text.sectionGear, note: "", state: "neutral" }
        : {
            heading: text.sectionGear,
            note: data.shopGear[loadout.gear].name,
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
