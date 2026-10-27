import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DebuffId } from "../data/types";
import { cardEffectText, type CardTextContext } from "../rules/effectText";
import { cents } from "../rules/units";
import { effectNameMarks } from "./effectNames";

// The text each mark covers, with its kind.
function marked(text: string): { kind: string; name: string }[] {
  return effectNameMarks(gameData, text).map(({ at, kind, length }) => ({
    kind,
    name: text.slice(at, at + length),
  }));
}

const CONTEXT: CardTextContext = {
  dogs: () => ["kilo"],
  forgiven: () => false,
  money: () => ({ amount: cents(0), modified: null }),
  seconds: () => 30,
};

const BUFF_NAMES = [gameData.shopGear, gameData.upgrades, gameData.walkerPerks].flatMap((items) =>
  Object.values(items).map(({ name }) => name),
);

describe("effectNameMarks", () => {
  it.each(Object.keys(gameData.debuffs) as DebuffId[])(
    "marks %s's name in a card's stake, after the option's other changes",
    (debuff) => {
      const text = cardEffectText(gameData, CONTEXT, [
        { amount: -1, kind: "hearts", target: { kind: "all" } },
        { debuff, kind: "debuff" },
      ]);
      expect(marked(text)).toEqual([{ kind: debuff, name: gameData.debuffs[debuff].name }]);
    },
  );

  it.each(BUFF_NAMES)("marks %s as a buff where it leads its description", (name) => {
    expect(marked(`${name}: does a thing`)).toEqual([{ kind: "buff", name }]);
  });

  it.each([
    ["no colon after it", "The pack is Muddy for 20s"],
    ["inside a word", "UnMuddy: clean"],
    ["a dog's name", "Kilo: −1♥"],
  ])("marks no name with %s", (_case, text) => {
    expect(marked(text)).toEqual([]);
  });

  it("marks every name in a text, in order", () => {
    const [gear] = Object.values(gameData.shopGear);
    const text = `Stinky: tips pay nothing, ${gear?.name ?? ""}: helps`;
    expect(marked(text).map(({ kind }) => kind)).toEqual(["stinky", "buff"]);
  });
});
