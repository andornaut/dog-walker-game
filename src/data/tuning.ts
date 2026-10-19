import type { Tuning } from "./types";

// Every number the game is tuned by, grouped by unit. Starting values, to be tuned by playing.
// Cards, gear and debuffs name these keys rather than repeating the numbers, and the
// running game picks up an edit here without a page reload.
export const TUNING = {
  // Plain counts.
  counts: {
    biscuitNeighbourTreatsPerDog: 1,
    loadoutMax: 1,
    luckyEncountersPerZone: 2,
    obstaclesFirstZone: 23,
    obstaclesGainPerZone: 4,
    packSizeMax: 3,
    packSizeMin: 1,
    poopBagsSkipsPerRun: 1,
    tipsFirstZone: 60,
    tipsGainPerZone: 8,
    treatCarryMax: 3,
    treatMagnetReachLanes: 1,
    treatsPerZone: 5,
    upgradeChoiceCount: 3,
  },
  // Owner happiness. A meter is always held within 0 and its dog's max.
  hearts: {
    // A face looks happy at this many hearts or more, and upset below faceNeutralFrom.
    faceHappyFrom: 6,
    faceNeutralFrom: 3,
    luckyCollarMax: 1,
    luckyCollarStart: 1,
    maxBySize: { big: 10, medium: 8, small: 6 },
    startByTemperament: { dramatic: 5, fussy: 4, laidBack: 5 },
    treat: 1,
  },
  // Dollars. The game counts money in cents, so $1.50 is exact.
  money: {
    chattyNeighbourTip: 25,
    encounterHigh: 20,
    encounterLow: 10,
    fannyPackStart: 15,
    feeByTemperament: { dramatic: 20, fussy: 30, laidBack: 20 },
    lostWalletKeep: 30,
    missedTips: 10,
    photoOpTip: 10,
    prices: {
      // The second and third dog slots; every player starts with one.
      dogSlot2: 800,
      dogSlot3: 1800,
      fannyPack: 400,
      lockedDog: 600,
      luckyCollar: 1000,
      poopBags: 700,
      runningShoes: 800,
      whistle: 600,
    },
    squirrelChase: 10,
    sweetTalkerCostPerDog: -4,
    thiefLetGo: 20,
    tip: 0.5,
  },
  // Factors: 1 changes nothing, 0.75 is 25% less, 2 is double. The "change" values are
  // added per dog instead: 0.25 is 25% more.
  multipliers: {
    bigTipperTip: 1.5,
    goodLeashSquirrelPull: 0,
    heartsByTemperament: { dramatic: 2, fussy: 1, laidBack: 1 },
    otherDogChangePerBigDog: -0.25,
    otherDogChangePerSmallDog: 0.25,
    runningShoesInputLock: 0,
    rushHourObstacles: 1.5,
    rushHourTips: 2,
    scrollSpeedGainPerZone: 0.15,
    shortcutFees: 0.75,
    shortcutZoneLength: 0.75,
    steadyHandsPullFrequency: 0.5,
    stinkyTip: 0.5,
    // By the number of dogs in the pack.
    tipByPackSize: { 1: 1.5, 2: 1.25, 3: 1 },
  },
  // Screen pixels at the 360x640 render size, or pixels per second for a speed.
  pixels: {
    roadScrollSpeed: 120,
    // Road distance between rows of spawns; a row is all spawns at one distance.
    spawnRowSpacing: 160,
    // A horizontal drag this long is a swipe.
    swipeMinDistance: 32,
    // A press that drifts further than this is no longer a tap.
    tapMaxDistance: 10,
  },
  // Chances from 0 to 1.
  probability: {
    // Each dog rolls once when the pack hits a skunk or puddle.
    catchBySize: { big: 0.5, medium: 0.5, small: 0.25 },
  },
  seconds: {
    // After a hit, obstacles are ignored this long; pickups still count.
    collisionGrace: 1,
    // A held finger starts repeating lane moves after holdDelay, then every holdRepeat.
    holdDelay: 0.3,
    holdRepeat: 0.15,
    inputLockBySize: { big: 0.5, medium: 0.25, small: 0 },
    laneMove: 0.18,
    pullIntervalByEnergy: { calm: 60, hyper: 15, steady: 30 },
    // How long a dog leans and barks before it pulls.
    pullTell: 1,
    // Every zone is the same distance: zone 1 takes this long, later zones less as speed rises.
    zoneAtBaseSpeed: 216,
  },
} satisfies Tuning;
