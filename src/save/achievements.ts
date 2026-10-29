import type { AchievementId } from "../data/types";
import { type AchievementData, newlyEarned, type RunFacts } from "../rules/achievements";
import type { SaveDocument } from "./schema";

// What awarding needs: the achievements and the content their "all" counts.
export interface AwardContext {
  readonly data: AchievementData;
}

// after with every achievement that before had not earned and after (with runFacts for a run)
// now meets, added in wall order.
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
  return { ...after, achievements: [...after.achievements, ...earned] };
}

// The achievements after has that before had not, in wall order.
export function earnedSince(
  data: Pick<AchievementData, "achievements">,
  before: Pick<SaveDocument, "achievements">,
  after: Pick<SaveDocument, "achievements">,
): AchievementId[] {
  return data.achievements
    .filter(({ id }) => !before.achievements.includes(id) && after.achievements.includes(id))
    .map(({ id }) => id);
}
