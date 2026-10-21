import type { GameData, WalkerId, ZoneId } from "../data/types";
import { earningsKind } from "../home/endView";
import { signedDollarText } from "../home/home";
import type { Change } from "../rules/causes";
import { type Cents, cents } from "../rules/units";
import { agilityWord, newWalkers } from "../rules/walkers";
import { fillLine } from "../text/lines";
import { RUN_TEXT_FIELDS as FIELDS } from "./runText";
import { perkIconKey } from "./stateStrip";

// What plays between a zone's fee coins and the upgrade card, after every zone but the last:
// the walker that zone unlocks for the first time joins, or else the walker in use cheers over
// the zone's fees and tips.
export type ZoneCelebration =
  | { readonly kind: "newWalker"; readonly walker: WalkerId }
  | {
      readonly fees: Cents;
      readonly kind: "zoneDone";
      readonly tips: Cents;
      readonly walker: WalkerId;
      readonly zone: string;
    };

export interface ZoneFinish {
  // The changes made since the zone began, its fees included.
  readonly changes: readonly Change[];
  // The zones the run has finished, in order, this one included.
  readonly finished: readonly ZoneId[];
  readonly walker: WalkerId;
  // The finished zone's name.
  readonly zone: string;
}

// owned is the walkers owned when the walk began: a walk unlocks walkers only once banked, so
// one that joined after an earlier zone of this walk is left out by the zones before.
export function zoneCelebration(
  data: Pick<GameData, "walkers">,
  owned: readonly WalkerId[],
  finish: ZoneFinish,
): ZoneCelebration {
  const before = newWalkers(data, owned, finish.finished.slice(0, -1));
  const joining = newWalkers(data, owned, finish.finished).find((id) => !before.includes(id));
  if (joining !== undefined) {
    return { kind: "newWalker", walker: joining };
  }
  let fees = 0;
  let tips = 0;
  for (const change of finish.changes) {
    if (change.kind === "money") {
      const kind = earningsKind(change);
      fees += kind === "fees" ? change.amount : 0;
      tips += kind === "tips" ? change.amount : 0;
    }
  }
  const { walker, zone } = finish;
  return { fees: cents(fees), kind: "zoneDone", tips: cents(tips), walker, zone };
}

// A piece of a line drawn in parts: plain text, an amount of money, or a name after its icon.
export type LinePart =
  | { readonly kind: "icon"; readonly icon: string; readonly text: string }
  | { readonly kind: "money" | "text"; readonly text: string };

export type CelebrationText =
  | {
      // The zone's fees and tips, the amounts as money.
      readonly earnings: readonly LinePart[];
      readonly kind: "zoneDone";
      readonly subtitle: string;
      readonly title: string;
    }
  | {
      readonly button: string;
      readonly greeting: string;
      // The walker's pace and style, each after its icon.
      readonly info: readonly LinePart[];
      readonly kind: "newWalker";
      readonly subtitle: string;
      readonly title: string;
    };

// The line's text around its {name}s, with each name's part in its place.
function lineParts(line: string, named: Readonly<Record<string, LinePart>>): LinePart[] {
  // Split on a capturing pattern, each name sits at an odd index between the text around it.
  return line.split(/\{(\w+)\}/).flatMap((part, i): LinePart[] => {
    if (i % 2 === 1) {
      const found = named[part];
      return found === undefined ? [] : [found];
    }
    return part === "" ? [] : [{ kind: "text", text: part }];
  });
}

export function celebrationText(
  data: Pick<GameData, "homeText" | "runText" | "walkerPerks" | "walkers">,
  celebration: ZoneCelebration,
): CelebrationText {
  const text = data.runText;
  if (celebration.kind === "zoneDone") {
    const words = text.zoneDone;
    const amounts = { fees: celebration.fees, tips: celebration.tips };
    const named: Record<keyof typeof amounts, LinePart> = {
      fees: { kind: "money", text: signedDollarText(amounts.fees) },
      tips: { kind: "money", text: signedDollarText(amounts.tips) },
    };
    return {
      earnings: lineParts(words.earnings, named),
      kind: "zoneDone",
      subtitle: fillLine(FIELDS.zoneDone, words, "subtitle", { zone: celebration.zone }),
      title: words.title,
    };
  }
  const words = text.newWalker;
  const { agility, name, perk } = data.walkers[celebration.walker];
  const named: Record<"agility" | "perk", LinePart> = {
    agility: { kind: "text", text: agilityWord(data.homeText, agility) },
    perk: { icon: perkIconKey(perk), kind: "icon", text: data.walkerPerks[perk].name },
  };
  const info = lineParts(words.info, named);
  return {
    button: words.button,
    greeting: data.walkers[celebration.walker].greeting,
    info,
    kind: "newWalker",
    subtitle: fillLine(FIELDS.newWalker, words, "subtitle", { walker: name }),
    title: words.title,
  };
}
