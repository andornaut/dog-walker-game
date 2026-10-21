import type { Tuning } from "./types";

// Every number the game is tuned by, grouped by unit. Starting values, to be tuned by playing.
// Cards, gear and debuffs name these keys rather than repeating the numbers, and the
// running game picks up an edit here without a page reload.
export const TUNING = {
  // Plain counts.
  counts: {
    // A darting mover crosses the road this many lanes a second.
    dartLanesPerSecond: 3,
    loadoutMax: 1,
    // Long reach grabs tips and treats this many lanes beside the pack.
    longReachLanes: 1,
    luckyEncountersPerZone: 2,
    // At most this many movers are on screen at once, of them at most maxDartMovers darting
    // and maxSlowVehicles in-lane slower than the road.
    maxDartMovers: 3,
    maxMovers: 6,
    maxSlowVehicles: 3,
    // Obstacles that open no card, on top of obstaclesFirstZone.
    minorObstaclesFirstZone: 32,
    minorObstaclesGainPerZone: 6,
    obstaclesFirstZone: 18,
    obstaclesGainPerZone: 4,
    // Every row of spawns leaves at least this many lanes free of obstacles.
    openLanesPerRowMin: 2,
    packSizeMax: 3,
    packSizeMin: 1,
    // Sweet talker makes this many encounter cards each zone cost no money.
    sweetTalkerFreeCards: 1,
    tipsFirstZone: 40,
    tipsGainPerZone: 5,
    treatsPerZone: 2,
    upgradeChoiceCount: 3,
  },
  // Owner happiness. A meter is always held within 0 and its dog's max.
  hearts: {
    // The hearts a minor bump costs the owner of the dog that touched it.
    bump: 1,
    // A face looks upset below faceNeutralFrom hearts, neutral at faceNeutralFrom or more than
    // faceHappyWithin hearts below its max, and happy otherwise.
    faceHappyWithin: 1,
    faceNeutralFrom: 2,
    // Second chance forgives this many hearts lost in each zone, the first ones lost.
    kindWordsForgiven: 1,
    luckyCollarMax: 1,
    maxBySize: { big: 5, medium: 4, small: 3 },
    treat: 1,
  },
  // Whole dollars: $1 is the smallest amount, and an amount a multiplier changes is rounded to
  // the nearest dollar.
  money: {
    // Added to each tip while Big tipper is on.
    bigTipperTipBonus: 1,
    encounterHigh: 10,
    encounterLow: 5,
    fannyPackStart: 20,
    // Paid into the bank per dog when every dog set out with gets home after the last zone.
    fullPackBonusPerDog: 10,
    lostWalletKeep: 20,
    missedTips: 8,
    // Each walking dog's pay for a zone, before the zone's pay multiplier.
    payPerDog: 10,
    prices: {
      archie: 150,
      // The second and third dog slots; every player starts with one.
      dogSlot2: 1000,
      dogSlot3: 2500,
      duchess: 100,
      fannyPack: 300,
      koda: 200,
      luckyCollar: 750,
      nugget: 150,
      penny: 250,
      pierre: 200,
      poopBags: 500,
      runningShoes: 400,
      snowball: 300,
      zippy: 125,
    },
    // The cash every walk starts with, before gear.
    startPurse: 5,
    thiefLetGo: 10,
    tip: 1,
  },
  // Factors: 1 changes nothing, 0.75 is 25% less, 2 is double. The "change" values are
  // added per dog instead: 0.25 is 25% more.
  multipliers: {
    // A stalker's second step comes once the road between it and the pack is down to a share
    // of the road's length drawn per stalker between these.
    approachSecondRoadShareMax: 0.45,
    approachSecondRoadShareMin: 0.25,
    // Each big dog in the pack adds this to the walker's agility.
    bigDogAgility: -0.1,
    // How long a debuff lasts while Ada's Calm voice walks.
    calmVoiceDebuffFactor: 0.5,
    goodLeashSquirrelPull: 0,
    // Each mover's speed, an in-lane mover's or a dart's, is its kind's times a factor drawn per
    // mover up to this far from 1 either way.
    moverSpeedJitter: 0.15,
    // How many hearts a minor bump costs while the pack is Muddy.
    muddyBumpHearts: 2,
    // Running shoes add this much to the walker's agility.
    runningShoesAgility: 0.1,
    rushHourObstacles: 1.5,
    rushHourTips: 2,
    rushHourTreats: 2,
    scrollSpeedGainPerZone: 0.15,
    // What a tip pays while the pack is Stinky.
    stinkyTipValue: 0,
    // How many treats appear while Ben's Treat finder walks.
    treatFinderSpawns: 2,
  },
  // Screen pixels at the 360x560 render size, or pixels per second for a speed.
  pixels: {
    roadScrollSpeed: 200,
    // Road distance between rows of spawns; a row is all spawns at one distance.
    spawnRowSpacing: 213,
    // A drag takes its first lane step at this much horizontal travel, and its Nth at N
    // lane-widths; travelling back this far from its furthest point turns it around.
    swipeStartDistance: 24,
    // A press that drifts further than this is no longer a tap.
    tapMaxDistance: 10,
  },
  // Chances from 0 to 1.
  probability: {
    // A hit that would land on a small dog misses it this often, costing nothing.
    smallDodgeChance: 0.25,
  },
  seconds: {
    // A stalker's first step's cue begins a delay drawn per stalker between these after it is
    // wholly on the road.
    approachFirstDelayMax: 0.5,
    approachFirstDelayMin: 0,
    // One hop of a bouncing ball, which is only drawn.
    ballBounceSeconds: 0.4,
    // After a hit, obstacles are ignored this long; pickups still count.
    collisionGrace: 1,
    // A still press held this long on the walk HUD's effect icons, debuff bars or dog cards
    // shows what it explains and pauses the walk until it lifts.
    explainHoldSeconds: 0.3,
    // An owner who fires you holds the walk still this long while their moment plays.
    firingHoldSeconds: 3,
    // A first-time hint still waiting this long after its trigger is dropped unshown, to show
    // the next time it triggers. Time under a card or the pause menu does not count for a hint
    // raised while walking.
    hintStaleSeconds: 5,
    // An obstacle encounter holds the road and the pack still this long before its card.
    hitStopSeconds: 1,
    laneMove: 0.18,
    // Road in view ahead of the walker at the base scroll speed. Read once at load.
    lookAheadSeconds: 3.6,
    // A minor bump holds the road and the pack still this long.
    minorHitStopSeconds: 0.3,
    // Each step of a stepping mover takes this long.
    moverStepSeconds: 0.6,
    // Each step, hop and dart comes up to this long after its soonest moment, drawn per move.
    moverTimingJitter: 0.3,
    // A mover's cue shows this long before each move.
    moverWarningSeconds: 1,
    // How long the Muddy debuff lasts, in walking time.
    muddySeconds: 20,
    // Wherever the path changes lanes between two obstacles, the road between them also leaves
    // the pack this long to react, on top of the pack's height and the lane moves.
    pathReactionMargin: 0.5,
    // A pull never lands the pack where an obstacle reaches it sooner than the pull's lane
    // move, this and a lane move back.
    pullReactionWindow: 0.6,
    // How long a dog strains toward its target, with its bubble, before it pulls.
    pullTell: 1,
    // How long the Stinky debuff lasts, in walking time.
    stinkySeconds: 20,
    // Every zone is the same distance: zone 1 takes this long, later zones less as speed rises.
    zoneAtBaseSpeed: 144,
    // While the pack has the Zoomies, it drifts a lane every this many seconds of walking.
    zoomiesDriftSeconds: 1,
    // How long the Zoomies debuff lasts, in walking time.
    zoomiesSeconds: 20,
  },
} satisfies Tuning;
