import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { keysOf } from "../lib/records";
import { cardEffectText, type CardTextContext } from "../rules/effectText";
import { cents } from "../rules/units";
import { PILL_CLOSE, PILL_SPACE, pillIndex } from "../ui/namePills";
import {
  debuffNameMarks,
  effectNameMarks,
  faceTextWithNamePills,
  pillKind,
  withNamePills,
} from "./effectNames";

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

// A buff of one word and one of several: every buff is looked up the same way, by its name.
const BUFF_NAMES = [gameData.shopGear, gameData.upgrades, gameData.walkerPerks]
  .flatMap((items) => Object.values(items).map(({ name }) => name))
  .filter(
    (name, i, names) =>
      names.findIndex((other) => other.includes(" ") === name.includes(" ")) === i,
  );

describe("effectNameMarks", () => {
  it.each(keysOf(gameData.debuffs))(
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

// The kind of the pill text opens with, and the rest of the text.
function opened(text: string): { kind: string | undefined; rest: string } {
  const index = pillIndex(text.charAt(0));
  return { kind: index === undefined ? undefined : pillKind(index), rest: text.slice(1) };
}

const NAMES = [
  ...keysOf(gameData.debuffs).map((kind) => ({
    kind,
    name: gameData.debuffs[kind].name,
  })),
  ...BUFF_NAMES.map((name) => ({ kind: "buff", name })),
];

describe("withNamePills", () => {
  it.each(NAMES)("sets $name in its $kind pill in place of its colon", ({ kind, name }) => {
    const pill = `${name.replaceAll(" ", PILL_SPACE)}${PILL_CLOSE}`;
    expect(opened(withNamePills(gameData, `${name}: does a thing`))).toEqual({
      kind,
      rest: `${pill} does a thing`,
    });
  });

  it("leaves text naming no effect as it is", () => {
    expect(withNamePills(gameData, "Kilo: −1♥ Second chance")).toBe("Kilo: −1♥ Second chance");
  });
});

describe("faceTextWithNamePills", () => {
  it("sets the line's own marks in their pills, and moves its owners' marks with the text", () => {
    const text = "Stinky pack! Stinky: Rosa smiles";
    const shown = faceTextWithNamePills(gameData, {
      marks: [{ at: text.indexOf("Rosa"), dog: "kilo", length: 4, mood: "happy" }],
      names: debuffNameMarks(gameData, "stinky", text),
      text,
    });
    const [mark] = shown.marks ?? [];
    expect(shown.text.slice(mark?.at, (mark?.at ?? 0) + 4)).toBe("Rosa");
    const { kind, rest } = opened(shown.text);
    expect(kind).toBe("stinky");
    expect(rest.startsWith(`Stinky${PILL_CLOSE} pack! `)).toBe(true);
    expect(shown.text.split(PILL_CLOSE)).toHaveLength(3);
  });
});

describe("debuffNameMarks", () => {
  it.each([
    ["So Stinky", [{ at: 3, kind: "stinky", length: 6 }]],
    ["Stinky pack! Stinky again", [{ at: 0, kind: "stinky", length: 6 }]],
    ["UnStinky", []],
    ["Stinkyness", []],
  ])("marks the first word %s names Stinky by", (text, marks) => {
    expect(debuffNameMarks(gameData, "stinky", text)).toEqual(marks);
  });
});
