import type { HomeText } from "../data/types";
import { type FieldTable, fillNames } from "../lib/lines";

type LineKey = { [K in keyof HomeText]: HomeText[K] extends string ? K : never }[keyof HomeText];

// The {name}s each home text line may use; a group's table lists only its lines with names.
export const HOME_TEXT_FIELDS = {
  detail: {
    dogKind: ["hearts", "size"],
    dogLarge: ["speed"],
    dogSmall: ["dodgeIn"],
    ownerRole: ["role"],
    priceBuy: ["price"],
    priceLocked: ["price"],
    walkerAgility: ["agility"],
    walkerPerk: ["effect", "perk"],
  },
  dodgeEffect: ["dodgeIn", "sizes"],
  dogBought: ["dog"],
  dogCantAfford: ["amount", "dog"],
  dogSlotName: ["slot"],
  effect: {
    freeCards: ["count"],
    heartsEach: ["hearts"],
    heartsLead: ["hearts"],
    heartsShared: ["hearts"],
  },
  focus: {
    dogLocked: ["dog", "kind", "price"],
    dogOwned: ["dog", "kind"],
    gear: ["effect", "gear"],
    gearLocked: ["effect", "gear", "price"],
    kind: ["hearts", "size"],
    priceBuy: ["price"],
    priceShort: ["amount", "price"],
  },
  gateSign: [],
  gearBought: ["gear"],
  newerSave: [],
  noticePackFull: [],
  noticeSoundOff: [],
  noticeSoundOn: [],
  packBonus: ["hearts"],
  packCount: ["count", "max"],
  sectionDogs: [],
  sectionWalker: [],
  sectionWalkerPrompt: [],
  shop: {
    confirmLeft: ["amount"],
    confirmTitle: ["name"],
    ownedCount: ["max", "owned"],
    slotLine: [],
  },
  slotBought: ["slot"],
  slotSign: [],
  startLoading: [],
  startWalk: [],
  unsaved: [],
  walkerInfo: ["agility", "perk", "walker"],
  walkerInfoBase: ["perk", "walker"],
  walkerLocked: ["zone"],
} as const satisfies Record<LineKey, readonly string[]> & FieldTable;

type Fields<K extends LineKey> = Record<(typeof HOME_TEXT_FIELDS)[K][number], string>;

export function homeLine<K extends LineKey>(text: HomeText, key: K, fields: Fields<K>): string {
  return fillNames(text[key], fields);
}
