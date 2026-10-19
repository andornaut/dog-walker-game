import type { HomeText } from "../data/types";

type LineKey = Exclude<keyof HomeText, "bubble">;

// The {name}s each home text line may use.
export const HOME_TEXT_FIELDS = {
  dogBought: ["dog"],
  dogCantAfford: ["amount", "dog"],
  hint: [],
  packCount: ["count", "max"],
  packDogsMany: ["count"],
  packDogsOne: ["count"],
  slotBuy: [],
  slotSave: ["amount"],
  slotSign: ["price", "slot"],
  startWalk: ["dogs", "fee"],
  stepDogs: [],
  stepGear: [],
  stepWalker: [],
} as const satisfies Record<LineKey, readonly string[]>;

type Fields<K extends LineKey> = Record<(typeof HOME_TEXT_FIELDS)[K][number], string>;

// The {name}s in a line, in order of appearance.
export function placeholders(line: string): string[] {
  return [...line.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "");
}

export function homeLine<K extends LineKey>(text: HomeText, key: K, fields: Fields<K>): string {
  const values: Readonly<Record<string, string>> = fields;
  return text[key].replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}
