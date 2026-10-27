import type { DebuffId, GameData } from "../data/types";

// An effect's name where it sits beside its description, so the text can set the name apart: a
// debuff's in its own colour, a buff's (gear, a walker's perk or an upgrade) in the buffs' one.
export type EffectNameKind = DebuffId | "buff";

// An effect's name in a text: text[at, at + length).
export interface NameMark {
  readonly at: number;
  readonly kind: EffectNameKind;
  readonly length: number;
}

type NameData = Pick<GameData, "debuffs" | "shopGear" | "upgrades" | "walkerPerks">;

// Every effect's name and kind, longest first, so a name inside a longer one is not found in it.
function effectNames(data: NameData): { kind: EffectNameKind; name: string }[] {
  const buffs = [data.shopGear, data.upgrades, data.walkerPerks].flatMap((items) =>
    Object.values(items).map(({ name }): { kind: EffectNameKind; name: string } => ({
      kind: "buff",
      name,
    })),
  );
  const debuffs = (Object.keys(data.debuffs) as DebuffId[]).map((kind) => ({
    kind,
    name: data.debuffs[kind].name,
  }));
  return [...debuffs, ...buffs].sort((a, b) => b.name.length - a.name.length);
}

// Each effect's name in text that leads its description after a colon, as a card's stake
// "Stinky: tips pay nothing for 30s" or a walker's "Second chance: …", in order. A name starts
// the text or follows a character that is not a letter.
export function effectNameMarks(data: NameData, text: string): NameMark[] {
  const marks: NameMark[] = [];
  for (const { kind, name } of effectNames(data)) {
    for (let at = text.indexOf(`${name}:`); at >= 0; at = text.indexOf(`${name}:`, at + 1)) {
      const end = at + name.length;
      const free = marks.every((mark) => end <= mark.at || at >= mark.at + mark.length);
      if (free && !/\p{L}/u.test(text.charAt(at - 1))) {
        marks.push({ at, kind, length: name.length });
      }
    }
  }
  return marks.sort((a, b) => a.at - b.at);
}
