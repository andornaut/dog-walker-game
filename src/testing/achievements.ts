import { ACHIEVEMENTS } from "../data/achievements";
import type { AchievementId } from "../data/types";
import { type Cents, dollarsToCents } from "../rules/units";

// What an achievement's earnings condition asks one walk to earn, read from the data.
export function earningsGoal(id: AchievementId): Cents {
  const condition = ACHIEVEMENTS.find((achievement) => achievement.id === id)?.conditions.find(
    (each) => each.kind === "earnings",
  );
  if (condition?.kind !== "earnings") {
    throw new Error(`${id} has no earnings condition`);
  }
  return dollarsToCents(condition.dollars);
}
