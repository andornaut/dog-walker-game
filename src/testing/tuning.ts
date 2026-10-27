import { TUNING } from "../data/tuning";
import type { LiveTuning } from "../data/types";

// tuning with every walker's perk changing nothing, so a test that is not about walkers walks
// with any of them alike.
export function withNeutralWalkers(tuning: LiveTuning): LiveTuning {
  return {
    ...tuning,
    counts: { ...tuning.counts, longReachLanes: 0 },
    hearts: { ...tuning.hearts, kindWordsForgiven: 0 },
    multipliers: {
      ...tuning.multipliers,
      quickRecoveryDebuffFactor: 1,
      treatFinderSpawns: 1,
      treatFinderTipSpawns: 1,
    },
  };
}

const PINNED_TUNING: LiveTuning = {
  ...TUNING,
  hearts: {
    ...TUNING.hearts,
    luckyCollarMax: 1,
    maxBySize: { large: 10, medium: 8, small: 6 },
    // Above every pinned max, gear and pack-size bonus included, so no test hits it by chance.
    maxOwnerHearts: 12,
    treat: 1,
  },
  money: {
    ...TUNING.money,
    bigTipperTipBonus: 1,
    encounterHigh: 15,
    encounterLow: 5,
    fannyPackStart: 15,
    missedTips: 5,
    payPerDog: 10,
    prices: { ...TUNING.money.prices, biscuit: 600, dogSlot2: 800, dogSlot3: 1800, reggie: 600 },
    tip: 1,
  },
  multipliers: {
    ...TUNING.multipliers,
    scrollSpeedGainPerZone: 0.2,
    stinkyTipValue: 0,
  },
  pixels: { ...TUNING.pixels, roadScrollSpeed: 80 },
  probability: { ...TUNING.probability, smallDodgeChance: 0, whistleDodgeChance: 0 },
  seconds: {
    ...TUNING.seconds,
    pullReactionWindow: 0.6,
    zoneAtBaseSpeed: 240,
  },
};

// The live tuning with the values rule tests assert on pinned, and neutral walkers, so a
// tuning edit does not break a rules test. Integrity tests read the real tuning instead.
export const TEST_TUNING: LiveTuning = withNeutralWalkers(PINNED_TUNING);
