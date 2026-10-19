import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import { cardArtCandidates } from "./cardArt";

const images = new Set(manifest.images.map(({ key }) => key));

describe("cardArtCandidates", () => {
  it("tries the whole label first, then shorter runs of its words", () => {
    expect(
      cardArtCandidates({ affected: [], encounter: "otherDog", kind: "encounter" }, "Pull away", 1),
    ).toEqual(["card-other-dog-pull-away", "card-other-dog-pull", "card-other-dog-away"]);
  });

  it("finds a drawn illustration for an encounter and a forced stop option", () => {
    const rinse = cardArtCandidates(
      { affected: [], encounter: "skunk", kind: "encounter" },
      "Quick rinse",
      1,
    );
    expect(rinse.some((key) => images.has(key))).toBe(true);
    const moveOn = cardArtCandidates(
      { kind: "forcedStop", stop: "chattyNeighbour" },
      "Politely move on",
      1,
    );
    expect(moveOn.some((key) => images.has(key))).toBe(true);
  });

  it("names an upgrade's illustration by the offered upgrade", () => {
    const source = {
      kind: "upgradeOffer",
      offered: ["bellyRubs", "bigTipper", "raincoats"],
    } as const;
    expect(cardArtCandidates(source, "Big tipper", 1)).toEqual(["card-big-tipper"]);
  });
});
