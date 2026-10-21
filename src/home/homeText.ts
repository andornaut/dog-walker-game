import type { HomeText } from "../data/types";
import { type FieldTable, fillNames } from "../lib/lines";

type LineKey = { [K in keyof HomeText]: HomeText[K] extends string ? K : never }[keyof HomeText];

// The {name}s each home text line may use; a group's table lists only its lines with names.
export const HOME_TEXT_FIELDS = {
  detail: {
    dogFee: ["fee"],
    dogKind: ["hearts", "size"],
    dogOwner: ["owner", "role"],
    dogTotals: ["fired", "walks", "zones"],
    priceBuy: ["price"],
    priceLocked: ["price"],
    walkerAgility: ["agility"],
    walkerPerk: ["effect", "perk"],
  },
  dogBought: ["dog"],
  dogCantAfford: ["amount", "dog"],
  dogSlotName: ["slot"],
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
  logbook: {
    best: ["best", "note"],
    bestNote: ["dogs", "zones"],
    last: ["last"],
    lastEarned: ["amount"],
    lastFinished: ["earned", "world", "zones"],
    lastFired: ["earned", "owner", "zone"],
    lastHeadedHome: ["earned", "zone"],
    totals: ["dogs", "fired", "walks"],
    zoneMany: ["count"],
    zoneOne: ["count"],
  },
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
    slotFirst: ["slot"],
    slotLine: ["count"],
  },
  slotBought: ["slot"],
  startLoading: [],
  startWalk: [],
  unsaved: [],
  walkerInfo: ["agility", "perk", "walker"],
  walkerLocked: ["zone"],
} as const satisfies Record<LineKey, readonly string[]> & FieldTable;

type Fields<K extends LineKey> = Record<(typeof HOME_TEXT_FIELDS)[K][number], string>;

export function homeLine<K extends LineKey>(text: HomeText, key: K, fields: Fields<K>): string {
  return fillNames(text[key], fields);
}
