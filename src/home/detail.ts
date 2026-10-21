import type { DogId, GameData, GearId, HomeText, WalkerId } from "../data/types";
import {
  capitalize,
  effectText,
  ENERGY_NAMES,
  SIZE_NAMES,
  TEMPERAMENT_NAMES,
  TRAIT_NAMES,
} from "../rules/effectText";
import type { Cents } from "../rules/units";
import { walkerGoal } from "../rules/walkers";
import type { Owned, SaveStats } from "../save/schema";
import { ZERO_DOG_STATS } from "../save/stats";
import { fillLine } from "../text/lines";
import { dogFeeText, dollarText, type HomeLoadout, purchasePrice } from "./home";
import { HOME_TEXT_FIELDS, homeLine } from "./homeText";

type DetailData = Pick<
  GameData,
  | "debuffs"
  | "dogSlots"
  | "dogs"
  | "encounters"
  | "homeText"
  | "needs"
  | "quirks"
  | "shopGear"
  | "tuning"
  | "walkers"
>;

// What a held dog or gear tile's detail card says: a title, a line under it, rows of
// text, and a status row (the fee or price, owned or equipped). locked is true while the
// item costs more than the bank holds.
export interface DetailCard {
  readonly lines: readonly string[];
  readonly locked: boolean;
  readonly status: string;
  readonly subtitle: string;
  readonly title: string;
}

const FIELDS = HOME_TEXT_FIELDS.detail;

// What buying it would take, or null when it is already owned.
function priceLine(text: HomeText["detail"], cost: Cents | null, bank: Cents): string | null {
  if (cost === null) {
    return null;
  }
  const price = dollarText(cost);
  return fillLine(FIELDS, text, cost > bank ? "priceLocked" : "priceBuy", { price });
}

// A dog's breed, its traits, need and quirk in words, its owner and their temperament, its fee,
// and the walks, zones and firings the save has counted for it.
export function dogDetail(
  data: DetailData,
  owned: Owned,
  bank: Cents,
  stats: Pick<SaveStats, "dogs">,
  dog: DogId,
): DetailCard {
  const { breed, energy, name, need, owner, quirk, size, trait } = data.dogs[dog];
  const counted = stats.dogs[dog] ?? ZERO_DOG_STATS;
  const fee = dogFeeText(data, dog);
  const cost = purchasePrice(data, owned, { dog, kind: "dog" });
  const text = data.homeText.detail;
  return {
    lines: [
      fillLine(FIELDS, text, "dogKind", {
        energy: capitalize(ENERGY_NAMES[energy]),
        size: capitalize(SIZE_NAMES[size]),
        trait: TRAIT_NAMES[trait],
      }),
      fillLine(FIELDS, text, "dogQuirk", {
        description: data.quirks[quirk].description,
        need: data.needs[need].name,
        quirk: data.quirks[quirk].name,
      }),
      fillLine(FIELDS, text, "dogOwner", { owner: owner.name, role: owner.role }),
      fillLine(FIELDS, text, "dogTemperament", {
        temperament: capitalize(TEMPERAMENT_NAMES[owner.temperament]),
      }),
      fillLine(FIELDS, text, "dogFee", { fee }),
      fillLine(FIELDS, text, "dogTotals", {
        fired: String(counted.timesFired),
        walks: String(counted.walks),
        zones: String(counted.zonesFinished),
      }),
    ],
    locked: cost !== null && cost > bank,
    status: priceLine(text, cost, bank) ?? text.dogStatus,
    subtitle: breed,
    title: name,
  };
}

// A gear item's effect, and whether it is owned or equipped.
export function gearDetail(
  data: DetailData,
  owned: Owned,
  bank: Cents,
  loadout: HomeLoadout,
  gear: GearId,
): DetailCard {
  const item = data.shopGear[gear];
  const cost = purchasePrice(data, owned, { gear, kind: "gear" });
  const text = data.homeText.detail;
  const status = loadout.gear === gear ? text.gearEquipped : text.gearOwned;
  return {
    lines: [`${capitalize(effectText(data, item.effects))}.`],
    locked: cost !== null && cost > bank,
    status: priceLine(text, cost, bank) ?? status,
    subtitle: text.gearSubtitle,
    title: item.name,
  };
}

// A walker's description lines from the data. An owned walker's status says so; one not owned
// is locked, and its status is the zone that unlocks it.
export function walkerDetail(
  data: DetailData,
  owned: Pick<Owned, "walkers">,
  walker: WalkerId,
): DetailCard {
  const { detail, name } = data.walkers[walker];
  const text = data.homeText;
  const has = owned.walkers.includes(walker);
  const zone = String(walkerGoal(data.walkers[walker]));
  return {
    lines: detail ?? [],
    locked: !has,
    status: has ? text.detail.walkerStatus : homeLine(text, "walkerLocked", { walker: name, zone }),
    subtitle: text.detail.walkerSubtitle,
    title: name,
  };
}
