import type { DebuffId, GameData } from "../data/types";
import { inPill } from "../ui/namePills";
import type { FaceText } from "./faceText";

// An effect's name where it sits beside its description, set in a pill of its kind's colours: a
// debuff's own, or the one every buff (gear, a walker's perk or an upgrade) shares.
export type EffectNameKind = DebuffId | "buff";

// Each kind's pill, as ui/namePills.ts numbers them.
const PILL_INDEX: Readonly<Record<EffectNameKind, number>> = {
  buff: 0,
  muddy: 1,
  spotlight: 2,
  stinky: 3,
  zoomies: 4,
};

export const EFFECT_NAME_KINDS = Object.keys(PILL_INDEX) as EffectNameKind[];

// The kind of the index-th pill, or undefined for none.
export function pillKind(index: number): EffectNameKind | undefined {
  return EFFECT_NAME_KINDS.find((kind) => PILL_INDEX[kind] === index);
}

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

// Text with marks, its own and every name effectNameMarks finds, each set in its kind's pill: a
// name's colon goes, as the pill sets the name apart. Returns the text and where each of the
// old text's characters went.
function pilled(
  data: NameData,
  text: string,
  own: readonly NameMark[],
): { moved: (at: number) => number; text: string } {
  const marks = [...own, ...effectNameMarks(data, text)].sort((a, b) => a.at - b.at);
  const offsets: number[] = [];
  let out = "";
  let from = 0;
  for (const { at, kind, length } of marks) {
    if (at < from) {
      continue;
    }
    for (let i = from; i < at; i++) {
      offsets[i] = out.length + i - from;
    }
    out += text.slice(from, at);
    const pill = inPill(PILL_INDEX[kind], text.slice(at, at + length));
    for (let i = at; i < at + length; i++) {
      offsets[i] = out.length + 1 + i - at;
    }
    out += pill;
    from = at + length + (text.charAt(at + length) === ":" ? 1 : 0);
  }
  for (let i = from; i <= text.length; i++) {
    offsets[i] = out.length + i - from;
  }
  out += text.slice(from);
  return { moved: (at) => offsets[at] ?? at, text: out };
}

// The text with each effect's name that leads its description set in its pill
// (effectNameMarks), as the scenes draw it.
export function withNamePills(data: NameData, text: string): string {
  return pilled(data, text, []).text;
}

// A face text, such as a message strip line, with each effect's name in its pill: the names it
// marks itself (a debuff's start line marks its lead) and those effectNameMarks finds. Its
// owners' marks move with the text.
export function faceTextWithNamePills(
  data: NameData,
  line: FaceText & { readonly names?: readonly NameMark[] },
): FaceText {
  const { moved, text } = pilled(data, line.text, line.names ?? []);
  const marks = line.marks?.map((mark) => ({ ...mark, at: moved(mark.at) }));
  return marks === undefined ? { text } : { marks, text };
}
