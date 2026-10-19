import type { AchievementId } from "../data/types";
import { type AchievementData, newlyEarned, type RunFacts } from "../rules/achievements";
import type { SaveDocument } from "./schema";

// What awarding needs: the achievements and the content their "all" counts, and the time to
// stamp them with, in milliseconds since the Unix epoch.
export interface AwardContext {
  readonly data: AchievementData;
  readonly now: number;
}

// after with every achievement that before had not earned and after (with runFacts for a run)
// now meets, stamped with the context's time.
export function awardAchievements(
  context: AwardContext,
  runFacts: RunFacts | null,
  before: SaveDocument,
  after: SaveDocument,
): SaveDocument {
  const earned = newlyEarned(context.data, before, after, runFacts);
  if (earned.length === 0) {
    return after;
  }
  const achievements = { ...after.achievements };
  for (const id of earned) {
    achievements[id] = context.now;
  }
  return { ...after, achievements };
}

// The achievements after has that before had not, in wall order.
export function earnedSince(
  data: Pick<AchievementData, "achievements">,
  before: Pick<SaveDocument, "achievements">,
  after: Pick<SaveDocument, "achievements">,
): AchievementId[] {
  return data.achievements
    .filter(
      ({ id }) => before.achievements[id] === undefined && after.achievements[id] !== undefined,
    )
    .map(({ id }) => id);
}
