import type { DogId, GameData, GearId, HomeText } from "../data/types";
import { zoneFee } from "../rules/dogs";
import { effectText, SIZE_NAMES, TEMPERAMENT_NAMES, TRAIT_NAMES } from "../rules/effectText";
import type { Cents } from "../rules/units";
import type { Owned, SaveStats } from "../save/schema";
import { fillLine } from "../text/lines";
import { dollarText, type HomeLoadout, purchasePrice } from "./home";
import { HOME_TEXT_FIELDS } from "./homeText";

type DetailData = Pick<
  GameData,
  "debuffs" | "dogSlots" | "dogs" | "encounters" | "homeText" | "needs" | "shopGear" | "tuning"
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

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
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

// A dog's breed, its traits in words, its owner and their temperament, its fee, and the
// walks, zones and firings the save has counted for it.
export function dogDetail(
  data: DetailData,
  owned: Owned,
  bank: Cents,
  stats: Pick<SaveStats, "dogs">,
  dog: DogId,
): DetailCard {
  const { breed, energy, name, owner, size, trait } = data.dogs[dog];
  const counted = stats.dogs[dog] ?? { timesFired: 0, walks: 0, zonesFinished: 0 };
  const fee = dollarText(zoneFee(data.tuning, [], data.dogs[dog]));
  const cost = purchasePrice(data, owned, { dog, kind: "dog" });
  const text = data.homeText.detail;
  return {
    lines: [
      fillLine(FIELDS, text, "dogKind", {
        energy: capitalized(energy),
        size: capitalized(SIZE_NAMES[size]),
        trait: TRAIT_NAMES[trait],
      }),
      fillLine(FIELDS, text, "dogOwner", { owner: owner.name, role: owner.role }),
      fillLine(FIELDS, text, "dogTemperament", {
        temperament: capitalized(TEMPERAMENT_NAMES[owner.temperament]),
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
    lines: [`${capitalized(effectText(data, item.effects))}.`],
    locked: cost !== null && cost > bank,
    status: priceLine(text, cost, bank) ?? status,
    subtitle: text.gearSubtitle,
    title: item.name,
  };
}
