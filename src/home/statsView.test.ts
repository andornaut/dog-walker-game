import { describe, expect, it } from "vitest";

import { DOGS } from "../data/dogs";
import { MENU_TEXT } from "../data/menuText";
import { WORLD } from "../data/world";
import { newPlayerSave, veteranSave } from "../save/fixtures";
import { dogRows, overallRows } from "./statsView";

const data = { dogs: DOGS, menuText: MENU_TEXT, world: WORLD };
const words = MENU_TEXT.stats;

describe("overallRows", () => {
  it("shows the overall figures and runs by outcome", () => {
    const { outcomes, overall } = overallRows(data, veteranSave().stats);
    expect(overall).toEqual([
      { label: words.overall.runsPlayed, value: "5" },
      { label: words.overall.dogsWalked, value: "7" },
      { label: words.overall.bestRun, value: "$90" },
      { label: words.overall.bestRunZones, value: "4" },
      { label: words.overall.bestRunDogs, value: DOGS.koda.name },
      { label: "", value: DOGS.penny.name },
      { label: words.overall.lifetime, value: "$300" },
      { label: words.overall.timesFired, value: "1 (most: Jesse)" },
      { label: words.overall.bestZone, value: "4" },
    ]);
    expect(outcomes).toEqual([
      { label: words.outcomes.finished, value: "2" },
      { label: words.outcomes.wentHome, value: "2" },
      { label: words.outcomes.noDogs, value: "1" },
    ]);
    const before = overallRows(data, newPlayerSave.stats).overall;
    expect(before).toContainEqual({ label: words.overall.timesFired, value: "0" });
    expect(before).toContainEqual({ label: words.overall.bestRunZones, value: "0" });
    expect(before.map(({ label }) => label)).not.toContain(words.overall.bestRunDogs);
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
    const unowned = dogRows(data, { dogs: [] }, save.stats);
    expect(unowned.map((row) => row.dog).sort()).toEqual(["biscuit", "koda"]);
  });
});
