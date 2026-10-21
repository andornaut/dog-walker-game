import { debuffIconKey } from "../assets/iconKeys";
import { dogPortraitKey, gearIconKey, walkerPortraitKey } from "../assets/spriteKeys";
import type { GameData } from "../data/types";
import {
  type DetailCard,
  type DetailPicture,
  dogDetail,
  gearDetail,
  walkerDetail,
} from "../home/detail";
import { fillLine, fillNames } from "../lib/lines";
import { maxHearts } from "../rules/dogs";
import { capitalize } from "../rules/effectText";
import type { Cents } from "../rules/units";
import type { Owned, SaveStats } from "../save/schema";
import { placeInPack } from "../state/pack";
import type { RunState } from "../state/runState";
import { extraHearts } from "./buffMarks";
import { effectIconKey, effectItems } from "./effectIcons";
import { RUN_TEXT_FIELDS } from "./runText";
import type { ExplainTarget } from "./walkHud";

type ExplainData = Pick<
  GameData,
  | "debuffs"
  | "dogSlots"
  | "dogs"
  | "encounters"
  | "homeText"
  | "runText"
  | "shopGear"
  | "tuning"
  | "upgrades"
  | "walkerPerks"
  | "walkers"
  | "world"
>;

type ExplainRun = Pick<
  RunState,
  | "debuffs"
  | "gear"
  | "immunities"
  | "modifiers"
  | "pack"
  | "route"
  | "upgradesPicked"
  | "walker"
  | "zoneIndex"
>;

// What the home screen's Details read of the save: what is owned, the bank and the totals.
export interface ExplainSave {
  readonly bankCents: Cents;
  readonly owned: Owned;
  readonly stats: Pick<SaveStats, "dogs">;
}

// The detail card a held element opens, laid out as the home screen's dog or walker card (its
// rows under the picture) or gear card (its rows beside it).
export interface ExplainDetail {
  readonly card: DetailCard;
  readonly kind: "dog" | "gear" | "walker";
  readonly picture: DetailPicture;
}

// A 16x16 icon fills the card's 64x64 well at 4x.
const ICON_SCALE = 4;

// What target explains, from the data, the save and the walk as it stands, on the detail card
// the home screen's Details show: a dog card's dog, with its owner's hearts now as its status
// and each source of their extra max hearts after its rows; the walker's perk as its walker;
// gear as the gear; an upgrade's effect; or a debuff's stake with its seconds left. None for
// what the walk no longer has.
export function explainDetail(
  data: ExplainData,
  save: ExplainSave,
  run: ExplainRun,
  target: ExplainTarget,
): ExplainDetail | undefined {
  const text = data.runText.explain;
  switch (target.kind) {
    case "effect": {
      const item = effectItems(data, run)[target.effect];
      if (item === undefined) {
        return undefined;
      }
      switch (item.kind) {
        case "gear":
          return {
            card: gearDetail(data, save.owned, save.bankCents, { gear: item.gear }, item.gear),
            kind: "gear",
            picture: { key: gearIconKey(item.gear), scale: 2 },
          };
        case "perk":
          return {
            card: walkerDetail(data, save.owned, run.walker),
            kind: "walker",
            picture: {
              fallback: data.walkers[run.walker].portraitKey,
              key: walkerPortraitKey(run.walker),
              scale: 1,
            },
          };
        case "upgrade": {
          const { effect, name } = data.upgrades[item.upgrade];
          return {
            card: {
              lines: [effect],
              locked: false,
              status: text.upgradeStatus,
              subtitle: "",
              title: name,
            },
            kind: "gear",
            picture: { key: effectIconKey(item), scale: ICON_SCALE },
          };
        }
        default:
          return item satisfies never;
      }
    }
    case "debuff": {
      const active = run.debuffs.find(({ debuff }) => debuff === target.debuff);
      if (active === undefined) {
        return undefined;
      }
      const { name, stake } = data.debuffs[target.debuff];
      const seconds = String(Math.ceil(active.secondsLeft));
      return {
        card: {
          lines: [capitalize(fillNames(stake, { seconds }))],
          locked: false,
          status: text.debuffStatus,
          subtitle: "",
          title: name,
        },
        kind: "gear",
        picture: { key: debuffIconKey(target.debuff), scale: ICON_SCALE },
      };
    }
    case "dog": {
      const slot = run.pack.find(({ dog }) => dog === target.dog);
      if (slot === undefined) {
        return undefined;
      }
      const home = dogDetail(data, save.owned, save.bankCents, save.stats, target.dog);
      const hearts = fillLine(RUN_TEXT_FIELDS.explain, text, "dogHearts", {
        hearts: String(slot.status === "walking" ? slot.hearts : 0),
        max: String(
          maxHearts(
            data.tuning,
            run.modifiers,
            placeInPack(run, target.dog),
            data.dogs[target.dog],
          ),
        ),
      });
      return {
        card: {
          ...home,
          lines: [...home.lines, ...extraHearts(data, run, target.dog)],
          locked: false,
          status: hearts,
        },
        kind: "dog",
        picture: { key: dogPortraitKey(data, target.dog), scale: 1 },
      };
    }
    default:
      return target satisfies never;
  }
}
