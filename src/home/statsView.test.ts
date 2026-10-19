import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { WORLD } from "../data/world";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import { dogRows, overallRows } from "./statsView";

const data = { dogs: DOGS, world: WORLD };

describe("overallRows", () => {
  it("shows the overall figures and runs by outcome", () => {
    const { outcomes, overall } = overallRows(data, veteranSave().stats);
    expect(overall).toEqual([
      { label: "Runs played", value: "5" },
      { label: "Best run", value: "$90" },
      { label: "Lifetime earnings", value: "$300" },
      { label: "Times fired", value: "1 (most: Jesse)" },
      { label: "Best zone completed", value: "4" },
    ]);
    expect(outcomes).toEqual([
      { label: "Finished", value: "2" },
      { label: "Headed home", value: "2" },
      { label: "Out of dogs", value: "1" },
    ]);
  });

  it("names no owner before anyone has fired you", () => {
    const { overall } = overallRows(data, newPlayerSave.stats);
    expect(overall).toContainEqual({ label: "Times fired", value: "0" });
  });
});

describe("dogRows", () => {
  it("lists every owned or walked dog in roster order, zeros for unwalked ones", () => {
    const save = veteranSave();
    const rows = dogRows(data, save.owned, save.stats);
    expect(rows.map((row) => row.dog)).toEqual(
      Object.keys(DOGS).filter((dog) => save.owned.dogs.includes(dog as never)),
    );
    expect(rows.find((row) => row.dog === "koda")).toMatchObject({
      timesFired: 1,
      walks: 5,
      zonesFinished: 12,
    });
    expect(rows.find((row) => row.dog === "duchess")).toMatchObject({ walks: 0 });
  });

  it("keeps a dog with stats the player no longer owns", () => {
    const save = veteranSave();
    const rows = dogRows(data, { dogs: [] }, save.stats);
    expect(rows.map((row) => row.dog).sort()).toEqual(["biscuit", "koda"]);
  });
});
