import type { AchievementId, GameData } from "../data/types";
import { isMoneyGoal } from "../rules/achievements";
import type { RunState } from "../state/runState";
import { type AwardContext, earnedSince } from "./achievements";
import { recordRunEnd, type RunResult } from "./checkpoint";
import { runResultOf } from "./runSlices";
import type { SaveDocument } from "./schema";

// The achievements banking result into save would newly earn, without writing anything.
export function earnedIfBanked(
  context: AwardContext,
  save: SaveDocument,
  result: RunResult,
): AchievementId[] {
  return earnedSince(context.data, save, recordRunEnd(context, save, result));
}

// A walk's mid-run badge lines preview what heading home at that moment would earn, each badge once
// a walk, leaving out money goals, which are checked only on the total the walk banks. They
// award nothing: the run's end (or its checkpoint, banked on the next launch)
// does, and the end screen celebrates every badge the walk earned, announced or not. facts is
// what the last look was taken at.
export interface AchievementPreview {
  readonly facts: string;
  readonly shown: readonly AchievementId[];
}

export const NOTHING_PREVIEWED: AchievementPreview = { facts: "", shown: [] };

// Mid-run, only a finished zone, a tally or a firing can earn a previewed badge, so
// the bank is looked at again only when one of them has changed. Finished walks count only
// at the end, and an ended run is left to the end screen.
function previewFacts(run: RunState): string {
  const fired = run.pack.filter((slot) => slot.status === "fired").length;
  return [run.zoneIndex, JSON.stringify(run.tallies), fired].join(":");
}

export function previewAchievements(
  data: Pick<GameData, "achievements" | "world">,
  earned: (result: RunResult) => readonly AchievementId[],
  preview: AchievementPreview,
  run: RunState,
): { readonly earned: readonly AchievementId[]; readonly preview: AchievementPreview } {
  const facts = previewFacts(run);
  if (run.phase.kind === "ended" || facts === preview.facts) {
    return { earned: [], preview };
  }
  const money = new Set(data.achievements.filter(isMoneyGoal).map(({ id }) => id));
  const fresh = earned(runResultOf(data, run)).filter(
    (id) => !money.has(id) && !preview.shown.includes(id),
  );
  return { earned: fresh, preview: { facts, shown: [...preview.shown, ...fresh] } };
}
