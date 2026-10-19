import type { GameData, WalkerId } from "../data/types";
import { earningsKind } from "../home/endView";
import { dollarText } from "../home/home";
import type { Change } from "../rules/causes";
import { type Cents, cents } from "../rules/units";
import { newWalkers } from "../rules/walkers";
import { fillLine } from "../text/lines";
import { RUN_TEXT_FIELDS as FIELDS } from "./runText";
import { stripIconKey } from "./stateStrip";

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
  // The zones the run has finished, this one included.
  readonly finished: number;
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
  const before = newWalkers(data, owned, finish.finished - 1);
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

// A piece of a line with icons: text, or a name after its icon.
export type LinePart = { readonly icon: string; readonly text: string } | { readonly text: string };

export type CelebrationText =
  | {
      readonly earnings: string;
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

const INFO_NAMES = /\{(pace|style)\}/;

export function celebrationText(
  data: Pick<GameData, "runText" | "walkerPaces" | "walkerStyles" | "walkers">,
  celebration: ZoneCelebration,
): CelebrationText {
  const text = data.runText;
  if (celebration.kind === "zoneDone") {
    const words = text.zoneDone;
    return {
      earnings: fillLine(FIELDS.zoneDone, words, "earnings", {
        fees: dollarText(celebration.fees),
        tips: dollarText(celebration.tips),
      }),
      kind: "zoneDone",
      subtitle: fillLine(FIELDS.zoneDone, words, "subtitle", { zone: celebration.zone }),
      title: words.title,
    };
  }
  const words = text.newWalker;
  const { name, pace, style } = data.walkers[celebration.walker];
  const named = {
    pace: { icon: stripIconKey({ kind: "pace", pace }), text: data.walkerPaces[pace].name },
    style: { icon: stripIconKey({ kind: "style", style }), text: data.walkerStyles[style].name },
  };
  // Split on a capturing pattern, each name sits at an odd index between the text around it.
  const info = words.info
    .split(INFO_NAMES)
    .flatMap((part, i): LinePart[] =>
      i % 2 === 1 ? [named[part as keyof typeof named]] : part === "" ? [] : [{ text: part }],
    );
  return {
    button: words.button,
    greeting: fillLine(FIELDS.card, text.card, "walkerGreeting", { walker: name }),
    info,
    kind: "newWalker",
    subtitle: fillLine(FIELDS.newWalker, words, "subtitle", { walker: name }),
    title: words.title,
  };
}
