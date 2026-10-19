import type { HomeText } from "../data/types";
import { type FieldTable, fillNames } from "../text/lines";

export { placeholders } from "../text/lines";

type LineKey = { [K in keyof HomeText]: HomeText[K] extends string ? K : never }[keyof HomeText];

// The {name}s each home text line may use; a group's table lists only its lines with names.
export const HOME_TEXT_FIELDS = {
  detail: {
    dogFee: ["fee"],
    dogKind: ["energy", "size", "trait"],
    dogOwner: ["owner", "role"],
    dogQuirk: ["description", "need", "quirk"],
    dogTemperament: ["temperament"],
    dogTotals: ["fired", "walks", "zones"],
    priceBuy: ["price"],
    priceLocked: ["price"],
  },
  dogBought: ["dog"],
  dogCantAfford: ["amount", "dog"],
  dogSlotName: ["slot"],
  focus: {
    dogLocked: ["dog", "kind", "price", "temper"],
    dogOwned: ["dog", "fee", "kind", "temper"],
    gear: ["effect", "gear"],
    gearLocked: ["effect", "gear", "price"],
    kind: ["need", "quirk", "size", "trait"],
    priceBuy: ["price"],
    priceShort: ["amount", "price"],
    temper: ["owner", "temperament"],
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
  noticePackFull: [],
  noticeSoundOff: [],
  noticeSoundOn: [],
  packCount: ["count", "max"],
  pocket: {
    item: ["effect", "gear"],
  },
  sectionDogs: [],
  sectionWalker: [],
  sectionWalkerPrompt: [],
  shop: {
    slotFirst: ["slot"],
    slotLine: ["count"],
    slotsOwned: ["max", "owned"],
  },
  slotBought: ["slot"],
  startWalk: [],
  topBar: {
    best: ["amount"],
    walkMany: ["count"],
    walkOne: ["count"],
  },
  unsaved: [],
  zoneFee: ["fee"],
} as const satisfies Record<LineKey, readonly string[]> & FieldTable;

type Fields<K extends LineKey> = Record<(typeof HOME_TEXT_FIELDS)[K][number], string>;

export function homeLine<K extends LineKey>(text: HomeText, key: K, fields: Fields<K>): string {
  return fillNames(text[key], fields);
}
