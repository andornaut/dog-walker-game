import type { Tuning } from "./types";

// Every number the game is tuned by, grouped by unit. Starting values, to be tuned by playing.
// Cards, gear and debuffs name these keys rather than repeating the numbers, and the
// running game picks up an edit here without a page reload.
export const TUNING = {
  // Plain counts.
  counts: {
    biscuitNeighbourTreatsPerDog: 1,
    // A darting mover crosses the road this many lanes a second.
    dartLanesPerSecond: 3,
    loadoutMax: 1,
    luckyEncountersPerZone: 2,
    // Obstacles that open no card, on top of obstaclesFirstZone.
    minorObstaclesFirstZone: 22,
    minorObstaclesGainPerZone: 4,
    // Spots that meet a dog's need, drawn from those the pack's needs match.
    needSpotsPerZone: 6,
    obstaclesFirstZone: 18,
    obstaclesGainPerZone: 4,
    // Every row of spawns leaves at least this many lanes free of obstacles.
    openLanesPerRowMin: 2,
    packSizeMax: 3,
    packSizeMin: 1,
    poopBagsSkipsPerRun: 1,
    // A scent hound in the pack picks up tips this many lanes beside the pack.
    scentHoundLanes: 1,
    tipsFirstZone: 52,
    tipsGainPerZone: 7,
    treatCarryMax: 3,
    treatMagnetReachLanes: 1,
    treatsPerZone: 2,
    upgradeChoiceCount: 3,
  },
  // Owner happiness. A meter is always held within 0 and its dog's max.
  hearts: {
    // A charmer walker's owners each start with this many more.
    charmerStart: 1,
    // A face looks happy at this many hearts or more, and upset below faceNeutralFrom.
    faceHappyFrom: 6,
    faceNeutralFrom: 3,
    luckyCollarMax: 1,
    luckyCollarStart: 1,
    maxBySize: { big: 10, medium: 8, small: 6 },
    // A treat given to a pampered dog's owner, in place of treat.
    pamperedTreatHearts: 2,
    // How many more hearts a messy card costs a show dog's owner, wherever it costs them any.
    showDogMessyHearts: 1,
    startByTemperament: { dramatic: 3, fussy: 2, laidBack: 3 },
    treat: 1,
  },
  // Whole dollars: $1 is the smallest amount, and an amount a multiplier changes is rounded to
  // the nearest dollar.
  money: {
    // A Regular dog's accident, cleaned up with a bag.
    accidentCleanUp: 20,
    // Added to each tip while Big tipper is on.
    bigTipperTipBonus: 1,
    chattyNeighbourTip: 100,
    // The tip when a crowd pleaser's need is met.
    crowdPleaserTip: 8,
    encounterHigh: 40,
    encounterLow: 20,
    fannyPackStart: 60,
    feeByTemperament: { dramatic: 80, fussy: 100, laidBack: 80 },
    lemonadeCup: 12,
    // The construction detour's long way, per dog: less than missedTips, since it also tires the pack.
    longWayMissedTips: 12,
    lostWalletKeep: 120,
    // The tips the pack drops on a minor obstacle, once for the pack.
    minorBump: 8,
    missedTips: 20,
    photoOpTip: 40,
    prices: {
      // The second and third dog slots; every player starts with one.
      dogSlot2: 3200,
      dogSlot3: 7200,
      fannyPack: 1600,
      lockedDog: 2400,
      luckyCollar: 4000,
      poopBags: 2800,
      runningShoes: 3200,
      whistle: 2400,
    },
    // Added to a show dog's fee each zone, before fee modifiers.
    showDogFee: 20,
    squirrelChase: 20,
    strangerTip: 40,
    sweetTalkerCostPerDog: -16,
    thiefLetGo: 40,
    tip: 1,
  },
  // Factors: 1 changes nothing, 0.75 is 25% less, 2 is double. The "change" values are
  // added per dog instead: 0.25 is 25% more.
  multipliers: {
    // A photo op's tip while a camera-ready dog walks.
    cameraReadyTip: 2,
    // How many tips appear for a charmer walker.
    charmerTipSpawns: 0.85,
    // How much more often stranger spots are drawn while a crowd pleaser walks.
    crowdPleaserStrangerWeight: 2,
    // A fast walker's fees, and the factor on its road speed, zone length and spawns.
    fastWalkerFees: 1.1,
    fastWalkerSpeed: 1.1,
    goodLeashSquirrelPull: 0,
    heartsByTemperament: { dramatic: 2, fussy: 1, laidBack: 1 },
    // How many tips appear for a hustler walker.
    hustlerTipSpawns: 1.2,
    // A nervous dog's need fills this much faster once firings leave her the only dog walking.
    nervousAloneUrgency: 2,
    otherDogChangePerBigDog: -0.25,
    otherDogChangePerSmallDog: 0.25,
    // The tips a squirrel chase drops when a ratter joins it.
    ratterChaseTips: 0,
    runningShoesInputLock: 0,
    rushHourObstacles: 1.5,
    rushHourTips: 2,
    scrollSpeedGainPerZone: 0.15,
    shortcutFees: 0.75,
    shortcutZoneLength: 0.75,
    // How much faster the pack changes lanes while a sled dog walks.
    sledDogLaneSpeed: 1.15,
    // A slow walker's fees, and the factor on its road speed, zone length and spawns.
    slowWalkerFees: 0.9,
    slowWalkerSpeed: 0.9,
    // How long a lane change takes while the pack is Spooked.
    spookedLaneMove: 1.25,
    // How many tips appear for the rest of the zone while the pack is Stinky.
    stinkyTipSpawns: 0.5,
    // How many tips appear in a zone, by the number of dogs in the pack at its start.
    tipSpawnsByPackSize: { 1: 1.2, 2: 1.1, 3: 1 },
    // How fast every dog's need fills toward urgent while the pack is Tuckered out.
    tuckeredUrgency: 1.5,
  },
  // Screen pixels at the 360x560 render size, or pixels per second for a speed.
  pixels: {
    roadScrollSpeed: 200,
    // Road distance between rows of spawns; a row is all spawns at one distance.
    spawnRowSpacing: 160,
    // A press that drifts further than this is no longer a tap.
    tapMaxDistance: 10,
  },
  // Chances from 0 to 1.
  probability: {
    // Meeting a need at a spot opens its payoff card instead of its plain reward.
    needPayoffCard: 0.25,
  },
  seconds: {
    // One hop of a bouncing ball, which is only drawn.
    ballBounceSeconds: 0.4,
    // After a hit, obstacles are ignored this long; pickups still count.
    collisionGrace: 1,
    // An owner who fires you holds the walk still this long while their moment plays.
    firingHoldSeconds: 2,
    // A first-time hint still waiting this long after its trigger is dropped unshown, to show
    // the next time it triggers. Time under a card or the pause menu does not count for a hint
    // raised while walking.
    hintStaleSeconds: 5,
    // An obstacle encounter holds the road and the pack still this long before its card.
    hitStopSeconds: 1,
    inputLockBySize: { big: 0.5, medium: 0.25, small: 0 },
    laneMove: 0.18,
    // Road in view ahead of the walker at the base scroll speed. Read once at load.
    lookAheadSeconds: 4.5,
    // A minor bump holds the road and the pack still this long.
    minorHitStopSeconds: 0.6,
    // Then lane input stays locked this long.
    minorStumble: 0.3,
    // Each step of a stepping mover takes this long.
    moverStepSeconds: 0.6,
    // A mover's cue shows this long before each move.
    moverWarningSeconds: 1,
    // An urgent need left this long goes wrong, then starts again.
    needGoneWrong: 20,
    // A need turns urgent after this much walking since it was last met or went wrong.
    needUrgentByEnergy: { calm: 90, hyper: 50, steady: 60 },
    // A pull never lands the pack where an obstacle reaches it sooner than the pull's lane
    // move, the dog's input lock, this and a lane move back.
    pullReactionWindow: 0.6,
    // How long a dog strains toward its target, with its bubble, before it pulls.
    pullTell: 1,
    // How long the Spooked debuff lasts, in walking time.
    spookedSeconds: 10,
    // How long Soaked shows on a dog; it changes nothing in the rules.
    statusVisualSeconds: 10,
    // While the pack is Tangled, lane input stays locked this long after each lane change.
    tangledLaneLock: 0.3,
    // How long the Tangled debuff lasts, in walking time.
    tangledSeconds: 10,
    // Every zone is the same distance: zone 1 takes this long, later zones less as speed rises.
    zoneAtBaseSpeed: 144,
  },
} satisfies Tuning;
