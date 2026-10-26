import type { DogId, GameData, GearId, HomeText, WalkerId } from "../data/types";
import { fillLine } from "../lib/lines";
import { isHeavy, sizeHearts } from "../rules/dogs";
import { capitalize, effectText, heavySpeedText, SIZE_NAMES } from "../rules/effectText";
import type { Cents } from "../rules/units";
import type { Owned, SaveStats } from "../save/schema";
import { ZERO_DOG_STATS } from "../save/stats";
import { dollarText, type HomeLoadout, purchasePrice } from "./home";
import { HOME_TEXT_FIELDS } from "./homeText";
import { walkerDetailLines, walkerLockedLine } from "./walkers";

type DetailData = Pick<
  GameData,
  | "debuffs"
  | "dogSlots"
  | "dogs"
  | "encounters"
  | "homeText"
  | "shopGear"
  | "tuning"
  | "walkerPerks"
  | "walkers"
  | "world"
>;

// What a held dog, walker or gear tile's detail card says, owned or not: a title, a line under
// it, rows of text, and a status row (the fee or price, owned or equipped, or the goal). locked
// is true while the item costs more than the bank holds, or the walker is not owned.
export interface DetailCard {
  readonly lines: readonly string[];
  readonly locked: boolean;
  readonly status: string;
  readonly subtitle: string;
  readonly title: string;
}

// What a detail card shows in its well: a dog's or walker's portrait, or a gear item's,
// effect's or debuff's icon.
export interface DetailPicture {
  // Drawn centred in the well at 1x while key has no texture, such as a walker's face before
  // its portrait is drawn.
  readonly fallback?: string;
  readonly key: string;
  // Drawn at this whole-number scale: 1 for a 64x64 portrait, 2 for a 32x32 icon, 4 for a
  // 16x16 icon.
  readonly scale: number;
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

// A dog's breed, its size and hearts, a heavy dog's row, its owner, and the walks, zones and
// firings the save has counted for it.
export function dogDetail(
  data: DetailData,
  owned: Owned,
  bank: Cents,
  stats: Pick<SaveStats, "dogs">,
  dog: DogId,
): DetailCard {
  const { breed, name, owner, size } = data.dogs[dog];
  const counted = stats.dogs[dog] ?? ZERO_DOG_STATS;
  const cost = purchasePrice(data, owned, { dog, kind: "dog" });
  const text = data.homeText.detail;
  return {
    lines: [
      fillLine(FIELDS, text, "dogKind", {
        hearts: String(sizeHearts(data.tuning, data.dogs[dog])),
        size: capitalize(SIZE_NAMES[size]),
      }),
      ...(isHeavy(data.dogs[dog])
        ? [fillLine(FIELDS, text, "dogHeavy", { speed: heavySpeedText(data.tuning) })]
        : []),
      fillLine(FIELDS, text, "dogOwner", { owner: owner.name, role: owner.role }),
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
  loadout: Pick<HomeLoadout, "gear">,
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

// A walker's agility and perk lines. An owned walker's status says so; one not owned is
// locked, and its status names the zone whose finish unlocks it.
export function walkerDetail(
  data: DetailData,
  owned: Pick<Owned, "walkers">,
  walker: WalkerId,
): DetailCard {
  const { name } = data.walkers[walker];
  const text = data.homeText;
  const has = owned.walkers.includes(walker);
  return {
    lines: walkerDetailLines(data, walker),
    locked: !has,
    status: has ? text.detail.walkerStatus : walkerLockedLine(data, walker),
    subtitle: text.detail.walkerSubtitle,
    title: name,
  };
}
