import type { DogId, GameData, GearId } from "../data/types";
import { zoneFee } from "../rules/dogs";
import { effectText, SIZE_NAMES, TEMPERAMENT_NAMES, TRAIT_NAMES } from "../rules/effectText";
import type { Cents } from "../rules/units";
import type { Owned, SaveStats } from "../save/schema";
import { dollarText, type HomeLoadout, purchasePrice } from "./home";

type DetailData = Pick<
  GameData,
  "debuffs" | "dogSlots" | "dogs" | "encounters" | "shopGear" | "tuning"
>;

// What a held dog or gear tile's detail card says: a title, a line under it, rows of
// text, and a status row (the fee or price, owned or equipped).
export interface DetailCard {
  readonly lines: readonly string[];
  readonly status: string;
  readonly subtitle: string;
  readonly title: string;
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// What buying it would take, or null when it is already owned.
function priceLine(cost: Cents | null, bank: Cents): string | null {
  if (cost === null) {
    return null;
  }
  return cost > bank
    ? `Price ${dollarText(cost)}, locked`
    : `Price ${dollarText(cost)}, tap to buy`;
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
  return {
    lines: [
      `${capitalized(SIZE_NAMES[size])} · ${TRAIT_NAMES[trait]} · ${capitalized(energy)} energy`,
      `Owner ${owner.name}, ${owner.role}`,
      `${capitalized(TEMPERAMENT_NAMES[owner.temperament])} owner`,
      `Fee ${fee}/zone`,
      `Walks ${counted.walks} · Zones ${counted.zonesFinished} · Fired ${counted.timesFired}`,
    ],
    status: priceLine(cost, bank) ?? "Your client",
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
  const status = loadout.gear === gear ? "Equipped" : "Owned, tap to equip";
  return {
    lines: [`${capitalized(effectText(data, item.effects))}.`],
    status: priceLine(cost, bank) ?? status,
    subtitle: "Gear",
    title: item.name,
  };
}
