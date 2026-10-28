// How well a steering bot plays, in seconds and chances. reactionSeconds is the delay from
// seeing an item to acting on it, and from a mistake to noticing it. lookAheadSeconds is how
// far ahead in walking time the bot plans. errorRate is the chance that a planned lane change
// is missed or mistimed. laneChangeCooldown is the shortest time between two lane changes.
// driftReactionSeconds is the delay from a Zoomies drift, or a Muddy starting, to the bot
// planning for it. visionSeconds, when set, is how far ahead an item must be before the bot sees
// it; unset, the bot sees an item as soon as it comes into view at the far edge of the road.
export interface Skill {
  readonly driftReactionSeconds: number;
  readonly errorRate: number;
  readonly laneChangeCooldown: number;
  readonly lookAheadSeconds: number;
  readonly reactionSeconds: number;
  readonly visionSeconds?: number;
}

export type SkillPresetId = "expert" | "novice" | "typical";

export const SKILL_PRESET_IDS: readonly SkillPresetId[] = ["novice", "typical", "expert"];

// Player models for the simulator, not game tuning: they say who plays, not how the game plays.
export const SKILL_PRESETS: Readonly<Record<SkillPresetId, Skill>> = {
  expert: {
    driftReactionSeconds: 0.2,
    errorRate: 0.01,
    laneChangeCooldown: 0,
    lookAheadSeconds: 4,
    reactionSeconds: 0.2,
  },
  novice: {
    driftReactionSeconds: 1.2,
    errorRate: 0.12,
    laneChangeCooldown: 0.25,
    lookAheadSeconds: 1.2,
    reactionSeconds: 0.55,
  },
  typical: {
    driftReactionSeconds: 0.85,
    errorRate: 0.05,
    laneChangeCooldown: 0.1,
    lookAheadSeconds: 2.2,
    reactionSeconds: 0.35,
  },
};
