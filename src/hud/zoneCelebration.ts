import { fillLine, fillNames } from "@andornaut/game-kit/lines";

import type { GameData, WalkerId } from "../data/types";
import { earningsKind } from "../home/endView";
import { signedDollarText } from "../home/home";
import type { Change } from "../rules/causes";
import { agilityPercent } from "../rules/effectText";
import { newWalkers } from "../rules/walkers";
import type { RunState } from "../state/runState";
import { type Cents, cents } from "../units";
import { perkIconKey } from "./effectIcons";
import { RUN_TEXT_FIELDS as FIELDS } from "./runText";

// The walker in use cheering over a zone's fees and tips, once its fee coins have landed, after
// each zone but the last.
interface ZoneDone {
  readonly fees: Cents;
  readonly kind: "zoneDone";
  readonly tips: Cents;
  readonly walker: WalkerId;
  readonly zone: string;
}

// What plays over the paused walk: a zone's ZoneDone, or, before the end screen, a walker the
// walk unlocked joining.
export type ZoneCelebration = { readonly kind: "newWalker"; readonly walker: WalkerId } | ZoneDone;

// The zone's earnings in the order the plate says them.
export const ZONE_EARNINGS = ["fees", "tips"] as const;

interface ZoneFinish {
  // The changes made since the zone began, its fees included.
  readonly changes: readonly Change[];
  readonly walker: WalkerId;
  // The finished zone's name.
  readonly zone: string;
}

// The New walker celebrations that play before the end screen, one per walker the walk unlocks,
// in unlock order (newWalkers). owned is the walkers owned when the walk began, since a walk
// unlocks walkers only once banked; finishedWith is the dogs still walking at the end of a
// finished walk (dogsFinishedWith), or null for a walk not finished.
export function newWalkerCelebrations(
  data: Pick<GameData, "walkers">,
  owned: readonly WalkerId[],
  finishedWith: number | null,
): ZoneCelebration[] {
  return newWalkers(data, owned, finishedWith).map((walker) => ({ kind: "newWalker", walker }));
}

// Shows the celebrations one at a time, each once the one before it is done (show calls done as
// it closes), then runs next after the last, or at once for none.
export function playInTurn(
  show: (celebration: ZoneCelebration, done: () => void) => void,
  next: () => void,
  celebrations: readonly ZoneCelebration[],
): void {
  const [first, ...rest] = celebrations;
  if (first === undefined) {
    next();
    return;
  }
  show(first, () => playInTurn(show, next, rest));
}

export function zoneCelebration(finish: ZoneFinish): ZoneDone {
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
  const amounts = { fees: cents(fees), tips: cents(tips) };
  return { ...amounts, kind: "zoneDone", walker, zone };
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
      // The zone's fees and tips, the tips left out at $0, the amounts as money.
      readonly earnings: readonly LinePart[];
      readonly kind: "zoneDone";
      readonly subtitle: string;
      readonly title: string;
    }
  | {
      readonly button: string;
      readonly greeting: string;
      // The info lines, each centred: the walker's own agility against the base, left out at the
      // base, over their perk after its icon.
      readonly info: readonly (readonly LinePart[])[];
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
    // Each earning but $0 ones, or the fees alone when every one is $0.
    const said = ZONE_EARNINGS.filter((key) => celebration[key] !== 0);
    const earnings = (said.length === 0 ? (["fees"] as const) : said).flatMap(
      (key, i): LinePart[] => [
        ...(i === 0 ? [] : [{ kind: "text", text: words.earnings.separator } as const]),
        ...lineParts(words.earnings[key], {
          amount: { kind: "money", text: signedDollarText(celebration[key]) },
        }),
      ],
    );
    const subtitle: Record<(typeof FIELDS.zoneDone.subtitle)[number], string> = {
      zone: celebration.zone,
    };
    return {
      button: words.button,
      earnings,
      kind: "zoneDone",
      subtitle: fillNames(words.subtitle, subtitle),
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
  const perkLine = lineParts(words.perk, { perk: perkPart });
  const info =
    percent === null
      ? [perkLine]
      : [lineParts(words.agility, { agility: { kind: "text", text: percent } }), perkLine];
  return {
    button: words.button,
    greeting: data.walkers[celebration.walker].greeting,
    info,
    kind: "newWalker",
    subtitle: fillLine(FIELDS.newWalker, words, "subtitle", { walker: name }),
    title: words.title,
  };
}
