import type { DogId, GameData, GearId, HomeText, WalkerId } from "../data/types";
import { maxHearts } from "../rules/dogs";
import { capitalize, effectText, SIZE_NAMES } from "../rules/effectText";
import type { Cents } from "../rules/units";
import { walkerGoal } from "../rules/walkers";
import type { Owned, SaveStats } from "../save/schema";
import { ZERO_DOG_STATS } from "../save/stats";
import { fillLine } from "../text/lines";
import { dogFeeText, dollarText, type HomeLoadout, purchasePrice } from "./home";
import { HOME_TEXT_FIELDS, homeLine } from "./homeText";
import { walkerDetailLines } from "./walkers";

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

// A dog's breed, its size and hearts, its owner, its pay, and the walks, zones and firings the
// save has counted for it.
export function dogDetail(
  data: DetailData,
  owned: Owned,
  bank: Cents,
  stats: Pick<SaveStats, "dogs">,
  dog: DogId,
): DetailCard {
  const { breed, name, owner, size } = data.dogs[dog];
  const counted = stats.dogs[dog] ?? ZERO_DOG_STATS;
  const fee = dogFeeText(data);
  const cost = purchasePrice(data, owned, { dog, kind: "dog" });
  const text = data.homeText.detail;
  return {
    lines: [
      fillLine(FIELDS, text, "dogKind", {
        hearts: String(maxHearts(data.tuning, [], data.dogs[dog])),
        size: capitalize(SIZE_NAMES[size]),
      }),
      fillLine(FIELDS, text, "dogOwner", { owner: owner.name, role: owner.role }),
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

// A walker's agility word and perk lines. An owned walker's status says so; one not owned is
// locked, and its status names the zone whose finish unlocks it.
export function walkerDetail(
  data: DetailData,
  owned: Pick<Owned, "walkers">,
  walker: WalkerId,
): DetailCard {
  const { name } = data.walkers[walker];
  const text = data.homeText;
  const has = owned.walkers.includes(walker);
  const goal = walkerGoal(data.walkers[walker]);
  const zone = data.world.zones.find(({ id }) => id === goal)?.name ?? "";
  return {
    lines: walkerDetailLines(data, walker),
    locked: !has,
    status: has ? text.detail.walkerStatus : homeLine(text, "walkerLocked", { walker: name, zone }),
    subtitle: text.detail.walkerSubtitle,
    title: name,
  };
}
