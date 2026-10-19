import type { GameData, WalkerId } from "../data/types";
import { earningsKind } from "../home/endView";
import { dollarText } from "../home/home";
import type { Change } from "../rules/causes";
import { type Cents, cents } from "../rules/units";
import { newWalkers } from "../rules/walkers";
import { fillLine } from "../text/lines";
import { RUN_TEXT_FIELDS as FIELDS } from "./runText";

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

export interface CelebrationText {
  // The tap that moves on, or null when the celebration moves on by itself.
  readonly button: string | null;
  readonly lines: readonly string[];
  readonly title: string;
}

export function celebrationText(
  data: Pick<GameData, "runText" | "walkerPaces" | "walkerStyles" | "walkers">,
  celebration: ZoneCelebration,
): CelebrationText {
  const text = data.runText;
  if (celebration.kind === "zoneDone") {
    const earnings = fillLine(FIELDS.zoneDone, text.zoneDone, "earnings", {
      fees: dollarText(celebration.fees),
      tips: dollarText(celebration.tips),
    });
    const title = fillLine(FIELDS.zoneDone, text.zoneDone, "title", { zone: celebration.zone });
    return { button: null, lines: [earnings], title };
  }
  const { name, pace, style } = data.walkers[celebration.walker];
  const greeting = fillLine(FIELDS.card, text.card, "walkerGreeting", { walker: name });
  const info = fillLine(FIELDS.newWalker, text.newWalker, "info", {
    pace: data.walkerPaces[pace].name,
    style: data.walkerStyles[style].name,
  });
  return {
    button: text.newWalker.button,
    lines: [greeting, info],
    title: fillLine(FIELDS.newWalker, text.newWalker, "title", { walker: name }),
  };
}
