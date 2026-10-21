import { debuffIconKey } from "../assets/iconKeys";
import type { GameData } from "../data/types";
import { fillLine, fillNames } from "../lib/lines";
import { maxHearts } from "../rules/dogs";
import { capitalize, SIZE_NAMES } from "../rules/effectText";
import { placeInPack } from "../state/pack";
import type { RunState } from "../state/runState";
import { extraHearts } from "./buffMarks";
import { effectIconKey, effectItems, effectLine, effectName } from "./effectIcons";
import { messageIconKey } from "./messageStrip";
import { RUN_TEXT_FIELDS } from "./runText";
import type { ExplainTarget } from "./walkHud";

type ExplainData = Pick<
  GameData,
  | "debuffs"
  | "dogs"
  | "runText"
  | "shopGear"
  | "tuning"
  | "upgrades"
  | "walkerPerks"
  | "walkers"
  | "world"
>;

// A line the message strip shows while a press holds an element: its 16x16 icon and text.
export interface ExplainLine {
  readonly iconKey: string;
  readonly text: string;
}

const FIELDS = RUN_TEXT_FIELDS.explain;

// What target explains, from the data and the walk as it stands: one line per effect (the
// effects past the wells take turns), a debuff's stake with its seconds left, or a dog's size,
// hearts and owner, then where its owner's extra max hearts come from. None for what the walk
// no longer has.
export function explainLines(
  data: ExplainData,
  run: Pick<
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
  >,
  target: ExplainTarget,
): ExplainLine[] {
  const text = data.runText.explain;
  switch (target.kind) {
    case "effects": {
      const items = effectItems(data, run);
      return target.effects.flatMap((index) => {
        const item = items[index];
        if (item === undefined) {
          return [];
        }
        const line = fillLine(FIELDS, text, "effect", {
          effect: effectLine(data, item),
          name: effectName(data, item),
        });
        return [{ iconKey: effectIconKey(item), text: line }];
      });
    }
    case "debuff": {
      const active = run.debuffs.find(({ debuff }) => debuff === target.debuff);
      if (active === undefined) {
        return [];
      }
      const { name, stake } = data.debuffs[target.debuff];
      const seconds = String(Math.ceil(active.secondsLeft));
      const line = fillLine(FIELDS, text, "debuff", { name, stake: fillNames(stake, { seconds }) });
      return [{ iconKey: debuffIconKey(target.debuff), text: line }];
    }
    case "dog": {
      const slot = run.pack.find(({ dog }) => dog === target.dog);
      if (slot === undefined) {
        return [];
      }
      const dog = data.dogs[target.dog];
      const line = fillLine(FIELDS, text, "dog", {
        dog: dog.name,
        hearts: String(slot.status === "walking" ? slot.hearts : 0),
        max: String(maxHearts(data.tuning, run.modifiers, placeInPack(run, target.dog), dog)),
        owner: dog.owner.name,
        size: capitalize(SIZE_NAMES[dog.size]),
      });
      return [
        { iconKey: messageIconKey("hint"), text: line },
        ...extraHearts(data, run, target.dog).lines,
      ];
    }
    default:
      return target satisfies never;
  }
}
