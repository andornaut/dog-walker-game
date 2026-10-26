import type { Tuning } from "./types";

// Every number the game is tuned by, grouped by unit. Starting values, to be tuned by playing.
// Cards, gear and debuffs name these keys rather than repeating the numbers, and the
// running game picks up an edit here without a page reload.
export const TUNING = {
  // Plain counts.
  counts: {
    // A darting mover crosses the road this many lanes a second.
    dartLanesPerSecond: 3,
    // A dart that stops does so in a lane drawn per dart, between these many lanes from the edge
    // it enters from.
    dartStopLanesMax: 4,
    dartStopLanesMin: 2,
    loadoutMax: 1,
    // Long reach grabs tips and treats this many lanes beside the pack.
    longReachLanes: 1,
    luckyEncountersPerZone: 1,
    // At most this many movers are on screen at once, of them at most maxDartMovers darting
    // and maxSlowVehicles in-lane slower than the road.
    maxDartMovers: 6,
    // At most this many spawn rows in a row come on screen with no lane-blocking obstacle in view.
    maxEmptyRows: 3,
    maxMovers: 10,
    maxSlowVehicles: 4,
    // Obstacles that open no card, on top of obstaclesFirstZone.
    minorObstaclesFirstZone: 83,
    minorObstaclesGainPerZone: 1,
    obstaclesFirstZone: 24,
    obstaclesGainPerZone: 3,
    // Every row of spawns leaves at least this many lanes free of obstacles.
    openLanesPerRowMin: 2,
    packSizeMax: 3,
    // Sweet talker makes this many encounter cards each zone cost no money.
    sweetTalkerFreeCards: 1,
    tipsFirstZone: 28,
    tipsGainPerZone: -3,
    treatsPerZone: 2,
  },
  // Owner happiness. A meter is always held within 0 and its dog's max.
  hearts: {
    // The hearts a minor bump costs the owner of the dog that touched it.
    bump: 1,
    // A face at its max looks happy. Below it, a face looks upset below faceNeutralFrom hearts,
    // neutral at faceNeutralFrom or more than faceHappyWithin hearts below its max, and happy
    // otherwise.
    faceHappyWithin: 1,
    faceNeutralFrom: 2,
    // Second chance forgives this many hearts lost in each zone, the first ones lost.
    kindWordsForgiven: 1,
    luckyCollarMax: 1,
    maxBySize: { big: 4, medium: 3, small: 2 },
    // No owner's max goes above this, whatever the dog's size, the pack's size and the gear add.
    maxOwnerHearts: 6,
    // Added to the lead dog's owner's max, whatever its size, by how many dogs the walk set out
    // with.
    packSizeBonus: { 1: 2, 2: 1, 3: 0 },
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
    // Each walking dog's pay for a zone, the same in every zone.
    payPerDog: 20,
    prices: {
      archie: 250,
      // The second and third dog slots; every player starts with one.
      dogSlot2: 1000,
      dogSlot3: 2500,
      dogWhistle: 1500,
      duchess: 150,
      fannyPack: 600,
      hallPass: 1200,
      koda: 300,
      luckyCollar: 1500,
      nugget: 800,
      penny: 600,
      pierre: 500,
      runningShoes: 800,
      snowball: 1000,
      zippy: 450,
    },
    // The cash every walk starts with, before gear.
    startPurse: 5,
    thiefLetGo: 10,
    tip: 1,
  },
  // Factors: 1 changes nothing, 0.75 is 25% less, 2 is double. The "change" values are
  // added per dog instead: 0.25 is 25% more.
  multipliers: {
    // Each of a stalker's steps after its first comes once the step before has ended and the
    // road between it and the pack is down to a share of the road's length drawn per stalker
    // between these.
    approachSecondRoadShareMax: 0.45,
    approachSecondRoadShareMin: 0.25,
    // Each big dog in the pack adds this to the walker's agility.
    bigDogAgility: -0.1,
    // How long a debuff lasts while Ada's Calm voice walks.
    calmVoiceDebuffFactor: 0.5,
    // Each dart's speed across the road is its kind's times a factor drawn per dart up to this
    // far from 1 either way, in place of moverSpeedJitter.
    dartSpeedJitter: 0.4,
    // Each dart sets off a share of the road ahead of the pack drawn per dart between these. The
    // planner raises the low end so the pack still has pathReactionMargin after the cue, at the
    // zone's pace and the dart's tilt; a tilted dart may then start above the high end, up to
    // where its cue still shows wholly on the road, and where even that is too low its drawn
    // tilt is cut to fit.
    dartStartRoadShareMax: 0.45,
    dartStartRoadShareMin: 0.15,
    // A dart that turns back does so once it has crossed a share of the road drawn per dart
    // between these, then crosses the whole road back.
    dartTurnAtShareMax: 1,
    dartTurnAtShareMin: 0.5,
    goodLeashSquirrelPull: 0,
    // Big dogs never take the pack's agility below this, or below the walker's own when lower.
    // The slowest pack's lane move sets the row spacing.
    minPackAgility: 0.9,
    // Each in-lane mover's speed is its kind's times a factor drawn per mover up to this far from
    // 1 either way.
    moverSpeedJitter: 0.25,
    // How many hearts a minor bump costs while the pack is Muddy.
    muddyBumpHearts: 2,
    // Running shoes add this much to the walker's agility.
    runningShoesAgility: 0.3,
    rushHourObstacles: 1.5,
    rushHourTips: 2,
    rushHourTreats: 2,
    scrollSpeedGainPerZone: 0.2,
    // What a tip pays while the pack is Stinky.
    stinkyTipValue: 0,
    // How many treats appear while Ben's Treat finder walks.
    treatFinderSpawns: 2,
    // How many tips appear while Ben's Treat finder walks.
    treatFinderTipSpawns: 1.25,
  },
  // Screen pixels at the 360x560 render size, or pixels per second for a speed.
  pixels: {
    roadScrollSpeed: 200,
    // Road distance between rows of spawns; a row is all spawns at one distance.
    spawnRowSpacing: 213,
    // A drag takes its first lane step at this much horizontal travel, and its Nth at N
    // lane-widths; travelling back this far from its furthest point turns it around.
    swipeStartDistance: 16,
    // A press that drifts further than this is no longer a tap.
    tapMaxDistance: 10,
  },
  // Chances from 0 to 1.
  probability: {
    // With the Dog whistle, a hit that would land on a medium or big dog misses it this often,
    // costing nothing.
    dogWhistleDodgeChance: 0.125,
    // About this share of the movers of a shy hopping kind hop shy, drawn per mover.
    shyHopperShare: 0.5,
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
    collisionGrace: 0.7,
    // A still press held this long on the walk HUD's effect icons, debuff bars or dog cards
    // opens a detail card with what it explains, pausing the walk until a tap closes it.
    explainHoldSeconds: 0.3,
    // An owner who fires you holds the walk still this long while their moment plays.
    firingHoldSeconds: 3,
    // An obstacle encounter holds the road and the pack still this long before its card.
    hitStopSeconds: 1,
    laneMove: 0.11,
    // Road in view ahead of the walker at the base scroll speed. Read once at load.
    lookAheadSeconds: 3.6,
    // A minor bump holds the road and the pack still this long.
    minorHitStopSeconds: 0.3,
    // A hopping mover's jump lasts this long.
    moverHopSeconds: 0.3,
    // Each step and hop lasts its moverStepSeconds or moverHopSeconds times a factor drawn per
    // move up to this far from 1 either way.
    moverMoveSecondsJitter: 0.35,
    // Each step of a stepping mover takes this long.
    moverStepSeconds: 0.4,
    // Each step and hop comes up to this long after its soonest moment, drawn per move.
    moverTimingJitter: 0.6,
    // A mover's cue shows this long before each move.
    moverWarningSeconds: 0.6,
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
    // A shy hopper's first hop's cue begins once the road between it and the pack's rows is down
    // to this long of the road's travel: its cue, its longest hop, pathReactionMargin and a lane
    // move all fit in it, so it clears the pack's lane before the pack must react.
    shyHopNearSeconds: 1.65,
    // How long the Stinky debuff lasts, in walking time.
    stinkySeconds: 30,
    // Every zone is the same distance: zone 1 takes this long, later zones less as speed rises.
    zoneAtBaseSpeed: 148,
    // While the pack has the Zoomies, it drifts a lane every this many seconds of walking.
    zoomiesDriftSeconds: 1,
    // How long the Zoomies debuff lasts, in walking time.
    zoomiesSeconds: 20,
  },
} satisfies Tuning;
