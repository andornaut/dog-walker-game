import type { GameData, WalkerId, ZoneId } from "../data/types";
import { earningsKind } from "../home/endView";
import { signedDollarText } from "../home/home";
import { fillLine, fillNames } from "../lib/lines";
import type { Change } from "../rules/causes";
import { agilityPercent } from "../rules/effectText";
import { type Cents, cents } from "../rules/units";
import { newWalkers } from "../rules/walkers";
import type { RunState } from "../state/runState";
import { perkIconKey } from "./effectIcons";
import { RUN_TEXT_FIELDS as FIELDS } from "./runText";

// What plays once a zone's fee coins have landed: the walker that zone unlocks for the first
// time joins, or else the walker in use cheers over the zone's fees and tips. After the last
// zone only a joining walker plays, before the end screen.
export type ZoneCelebration =
  | { readonly kind: "newWalker"; readonly walker: WalkerId }
  | {
      readonly fees: Cents;
      readonly kind: "zoneDone";
      readonly tips: Cents;
      readonly walker: WalkerId;
      readonly zone: string;
    };

interface ZoneFinish {
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

// The heading of the banner a zone opens with: the world's name and the zone's place in the
// walk, from 1.
export function zoneBannerHeading(
  data: Pick<GameData, "runText" | "world">,
  run: Pick<RunState, "zoneIndex">,
): string {
  const fields: Record<(typeof FIELDS.zoneBanner)[number], string> = {
    n: String(run.zoneIndex + 1),
    world: data.world.name,
  };
  return fillNames(data.runText.zoneBanner, fields);
}

// A piece of a line drawn in parts: plain text, an amount of money, or a name after its icon.
export type LinePart =
  | { readonly kind: "icon"; readonly icon: string; readonly text: string }
  | { readonly kind: "money" | "text"; readonly text: string };

export type CelebrationText =
  | {
      readonly button: string;
      // The zone's fees and tips, the amounts as money.
      readonly earnings: readonly LinePart[];
      readonly kind: "zoneDone";
      readonly subtitle: string;
      readonly title: string;
    }
  | {
      readonly button: string;
      readonly greeting: string;
      // The walker's own agility against the base, left out at the base, and their perk after its
      // icon.
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
  data: Pick<GameData, "runText" | "walkerPerks" | "walkers">,
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
      button: words.button,
      earnings: lineParts(words.earnings, named),
      kind: "zoneDone",
      subtitle: fillLine(FIELDS.zoneDone, words, "subtitle", { zone: celebration.zone }),
      title: words.title,
    };
  }
  const words = text.newWalker;
  const { agility, name, perk } = data.walkers[celebration.walker];
  const percent = agilityPercent(agility);
  const perkPart: LinePart = {
    icon: perkIconKey(perk),
    kind: "icon",
    text: data.walkerPerks[perk].name,
  };
  // A walker at the base lane-change speed shows their perk alone.
  const info =
    percent === null
      ? lineParts(words.infoBase, { perk: perkPart })
      : lineParts(words.info, { agility: { kind: "text", text: percent }, perk: perkPart });
  return {
    button: words.button,
    greeting: data.walkers[celebration.walker].greeting,
    info,
    kind: "newWalker",
    subtitle: fillLine(FIELDS.newWalker, words, "subtitle", { walker: name }),
    title: words.title,
  };
}
