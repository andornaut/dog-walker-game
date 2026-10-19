import { TUNING } from "../data/tuning";
import type { LiveTuning } from "../data/types";

// The live tuning with the values rule tests assert on pinned, so a tuning edit does not
// break a rules test. Integrity tests read the real tuning instead.
export const TEST_TUNING: LiveTuning = {
  ...TUNING,
  counts: { ...TUNING.counts, biscuitNeighbourTreatsPerDog: 1, treatCarryMax: 3 },
  hearts: {
    ...TUNING.hearts,
    luckyCollarMax: 1,
    luckyCollarStart: 1,
    maxBySize: { big: 10, medium: 8, small: 6 },
    startByTemperament: { dramatic: 5, fussy: 4, laidBack: 6 },
  },
  money: {
    ...TUNING.money,
    encounterHigh: 15,
    encounterLow: 5,
    fannyPackStart: 15,
    feeByTemperament: { dramatic: 10, fussy: 13, laidBack: 10 },
    missedTips: 5,
    prices: { ...TUNING.money.prices, dogSlot2: 800, dogSlot3: 1800, lockedDog: 600 },
    squirrelChase: 10,
    sweetTalkerCostPerDog: -2,
    tip: 1,
  },
  multipliers: {
    ...TUNING.multipliers,
    bigTipperTip: 1.5,
    heartsByTemperament: { dramatic: 2, fussy: 1, laidBack: 1 },
    runningShoesInputLock: 0,
    scrollSpeedGainPerZone: 0.2,
    stinkyTip: 0.5,
    tipByPackSize: { 1: 1.5, 2: 1.25, 3: 1 },
  },
  pixels: { ...TUNING.pixels, roadScrollSpeed: 80 },
  probability: {
    catchBySize: { big: 0.5, medium: 0.5, small: 0.25 },
    moverShare: { homeStretch: 0, park: 0, shops: 0, street: 0 },
    needPayoffCard: 0.25,
  },
  seconds: {
    ...TUNING.seconds,
    inputLockBySize: { big: 0.5, medium: 0.25, small: 0 },
    needGoneWrong: 20,
    needUrgentByEnergy: { calm: 100, hyper: 45, steady: 70 },
    pullReactionWindow: 0.6,
    zoneAtBaseSpeed: 240,
  },
};
