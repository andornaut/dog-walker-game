import { keysOf } from "@andornaut/game-kit/records";
import { encodeSave, loadSave, type SaveFormat } from "@andornaut/game-kit/save/versionedSave";
import { pixels } from "@andornaut/game-kit/units";
import * as v from "valibot";

import type {
  DebuffId,
  DogId,
  EncounterId,
  GameData,
  GearId,
  MinorObstacleId,
  Modifier,
  ProbabilityKey,
  Size,
  Stat,
  TallyId,
  UnitGroup,
  UpgradeId,
  WalkerId,
  ZoneId,
} from "../data/types";
import { walkLength } from "../rules/route";
import type { MoverPath } from "../runner/movers";
import type { Session, StreamDraws } from "../runner/session";
import type { WalkItemKind } from "../runner/walkItems";
import type { ActiveModifier, Pack } from "../state/runState";
import { type Cents, type Hearts } from "../units";
import { type Checkpoint, MAX_RUN_DOGS, TALLY_IDS } from "./schema";

// A walk saved where it can resume: at its start, at a fork, or as a zone starts, its zone not
// yet planned (src/runner/session.ts resumeSession). The session is as the walk left it, so the
// resumed walk plays as the walk would have from there; seed and draws take the run's streams up
// where they were (runStreams). Saved with the checkpoint, as text in its own versioned format
// (RESUME_VERSION), so a resume point this game cannot read leaves the rest of the save as it is.
export interface ResumeWalk {
  readonly draws: StreamDraws;
  readonly seed: number;
  readonly session: Session;
}

// Raise it when a stored resume point's shape changes; one at any other version banks as
// heading home.
export const RESUME_VERSION = 1;

// A stream draws a few numbers a card, so a count past this is a corrupt one, and would take
// too long to draw again.
const MAX_DRAWS = 1_000_000;

// The seeds seededRandom distinguishes.
const MAX_SEED = 0xffffffff;

type ResumeData = Pick<
  GameData,
  | "debuffs"
  | "dogs"
  | "encounters"
  | "minorObstacles"
  | "shopGear"
  | "tuning"
  | "upgrades"
  | "walkers"
  | "world"
>;

// Every stat a modifier changes, and the tuning group an add to it names its amount in; a
// multiply always names a multiplier. Records, so a new stat fails to compile until it is listed.
type AddStat = Extract<Modifier, { operation: "add" }>["stat"];
const ADD_GROUPS: Readonly<Record<AddStat, UnitGroup>> = {
  agility: "multipliers",
  forgivenHearts: "hearts",
  freeCards: "counts",
  maxHearts: "hearts",
  spareTreats: "counts",
  tipReach: "counts",
  tipValue: "money",
  treatReach: "counts",
};
const STATS: Readonly<Record<Stat, true>> = {
  agility: true,
  bumpHearts: true,
  bumpMoney: true,
  debuffSeconds: true,
  forgivenHearts: true,
  freeCards: true,
  maxHearts: true,
  obstacleSpawns: true,
  spareTreats: true,
  squirrelPulls: true,
  tipReach: true,
  tipSpawns: true,
  tipValue: true,
  treatReach: true,
  treatSpawns: true,
};
const SIZES: Readonly<Record<Size, true>> = { large: true, medium: true, small: true };
const MOTIONS = ["approach", "cross", "ride", "shy", "steps"] as const;

const finite = v.pipe(v.number(), v.finite());
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const integer = v.pipe(v.number(), v.safeInteger());
const money = v.pipe(
  integer,
  v.transform((value) => value as Cents),
);
const direction = v.picklist([-1, 1]);
const lasting = { untilZone: v.exactOptional(count) };

// A tuning key in group whose value is a number.
function tuningKey(tuning: GameData["tuning"], group: UnitGroup, key: string): boolean {
  return typeof (tuning[group] as Readonly<Record<string, unknown>>)[key] === "number";
}

function knownId<Id extends string>(what: string, ids: Iterable<Id>) {
  const known: ReadonlySet<string> = new Set(ids);
  return v.custom<Id>(
    (input) => typeof input === "string" && known.has(input),
    (issue) => `unknown ${what}: ${String(issue.input)}`,
  );
}

// The resume point's schema for the game's content: every id one the game has, every tuning key
// one it reads, and the session one that resumeSession can go on from.
function resumeSchema(data: ResumeData) {
  const dog = knownId<DogId>("dog", keysOf(data.dogs));
  const debuff = knownId<DebuffId>("debuff", keysOf(data.debuffs));
  const encounter = knownId<EncounterId>("encounter", keysOf(data.encounters));
  const gear = knownId<GearId>("gear", keysOf(data.shopGear));
  const minorObstacle = knownId<MinorObstacleId>("obstacle", keysOf(data.minorObstacles));
  const tally = knownId<TallyId>("tally", TALLY_IDS);
  const upgrade = knownId<UpgradeId>("upgrade", keysOf(data.upgrades));
  const walker = knownId<WalkerId>("walker", keysOf(data.walkers));
  const zone = knownId<ZoneId>(
    "zone",
    data.world.zones.map(({ id }) => id as ZoneId),
  );
  const itemKind = knownId<WalkItemKind>("road item", [
    ...keysOf(data.encounters),
    ...keysOf(data.minorObstacles),
    ...keysOf(data.shopGear),
    "tip",
    "treat",
  ]);
  const probabilityKey = v.custom<ProbabilityKey>(
    (input) => typeof input === "string" && tuningKey(data.tuning, "probability", input),
    "unknown probability key",
  );

  const effectSources = [
    v.object({ encounter, kind: v.literal("encounter"), option: count }),
    v.object({ found: v.exactOptional(v.literal(true)), gear, kind: v.literal("gear") }),
    v.object({ encounter, kind: v.literal("instant") }),
    v.object({ kind: v.literal("minor"), obstacle: minorObstacle }),
    v.object({ kind: v.literal("upgrade"), upgrade }),
    v.object({ kind: v.literal("walker"), walker }),
  ] as const;
  const effectSource = v.variant("kind", effectSources);
  const modifierSource = v.variant("kind", [
    ...effectSources,
    v.object({ debuff, kind: v.literal("debuff") }),
  ]);
  const modifier = v.pipe(
    v.object({
      by: v.string(),
      duration: v.exactOptional(v.picklist(["nextZone", "run"])),
      // A modifier applied from an effect keeps the effect's kind.
      kind: v.exactOptional(v.literal("modifier")),
      operation: v.picklist(["add", "multiply"]),
      source: modifierSource,
      stat: v.picklist(keysOf(STATS)),
      ...lasting,
    }),
    v.check(({ by, operation, stat }) => {
      const group = operation === "multiply" ? "multipliers" : ADD_GROUPS[stat as AddStat];
      return group !== undefined && tuningKey(data.tuning, group, by);
    }, "unknown modifier"),
    v.transform((value) => value as ActiveModifier),
  );
  const cardSource = v.variant("kind", [
    v.object({ affected: v.array(dog), encounter, kind: v.literal("encounter") }),
    v.object({ kind: v.literal("fork"), paths: v.array(zone), upgrades: v.array(upgrade) }),
  ]);
  const slot = v.variant("status", [
    v.object({
      dog,
      hearts: v.pipe(
        count,
        v.transform((value) => value as Hearts),
      ),
      status: v.literal("walking"),
    }),
    v.object({ dog, status: v.literal("fired"), zoneIndex: count }),
  ]);
  const pack = v.pipe(
    v.array(slot),
    v.minLength(1),
    v.maxLength(MAX_RUN_DOGS),
    v.check((slots) => new Set(slots.map((each) => each.dog)).size === slots.length, "a dog twice"),
    v.check((slots) => slots.some(({ status }) => status === "walking"), "no dog walking"),
    v.transform((slots) => slots as readonly unknown[] as Pack),
  );

  const run = v.object({
    bumpsByKind: v.record(minorObstacle, count),
    bumpsByZone: v.array(count),
    cardsThisZone: count,
    debuffs: v.array(v.object({ debuff, secondsLeft: finite, ...lasting })),
    debuffsGot: v.record(debuff, count),
    dodges: v.array(
      v.object({
        chance: probabilityKey,
        sizes: v.pipe(
          v.array(v.picklist(keysOf(SIZES))),
          v.minLength(1),
          v.transform((sizes) => sizes as readonly Size[] as readonly [Size, ...Size[]]),
        ),
        source: effectSource,
      }),
    ),
    firstZone: count,
    foundGear: v.nullable(gear),
    gear: v.nullable(gear),
    heartsForgiven: count,
    immunities: v.array(v.object({ encounter, source: effectSource, ...lasting })),
    modifiers: v.array(modifier),
    money,
    optionPicks: v.record(encounter, v.record(v.string(), count)),
    pack,
    // Only a walk between zones or at its start resumes, and its card, if any, is queued.
    phase: v.object({ kind: v.literal("walking") }),
    route: v.array(zone),
    skipPass: v.nullable(effectSource),
    skipUsed: v.boolean(),
    spareTreats: v.object({ held: count, spent: count, stored: count }),
    startMoney: money,
    tallies: v.record(tally, count),
    upgradesPicked: v.array(upgrade),
    walker,
    zoneDistance: v.pipe(finite, v.transform(pixels)),
    zoneEndMoney: money,
    zoneIndex: count,
  });

  // A mover's path is checked for its motion; its other fields are as the planner made them,
  // and RESUME_VERSION changes with their shape.
  const moverPath = v.pipe(
    v.looseObject({ motion: v.picklist(MOTIONS), movement: v.string(), warning: finite }),
    v.transform((path) => path as unknown as MoverPath),
  );
  const item = v.object({
    height: finite,
    id: count,
    kind: itemKind,
    lane: integer,
    laneSpan: count,
    mover: v.exactOptional(v.object({ path: moverPath, since: finite })),
    y: finite,
  });
  const motion = v.variant("kind", [
    v.object({ kind: v.literal("still"), lane: integer }),
    v.object({
      duration: finite,
      elapsed: finite,
      from: integer,
      kind: v.literal("moving"),
      to: integer,
    }),
  ]);
  const road = v.object({
    control: v.object({ heading: v.exactOptional(direction), motion, target: integer }),
    // What the next zone's plan replaces is stored empty, but for the path's last row, where
    // the next zone's path goes on from (storedWalk).
    herrings: v.tuple([]),
    hitStop: v.nullable(
      v.object({
        cards: v.array(cardSource),
        firing: v.boolean(),
        seconds: finite,
        zoneEnded: v.boolean(),
      }),
    ),
    invulnerableSeconds: finite,
    items: v.array(item),
    nextItemId: count,
    path: v.pipe(v.array(v.object({ distance: finite, lane: integer })), v.maxLength(1)),
    pending: v.tuple([]),
    planned: v.tuple([]),
    speedFactor: v.pipe(finite, v.minValue(Number.MIN_VALUE)),
  });
  const squirrel = v.literal("squirrel");
  const pulls = v.object({
    clock: finite,
    last: v.nullable(v.object({ at: finite, direction, dog, kind: squirrel })),
    spent: v.array(integer),
    strain: v.nullable(
      v.object({
        blocked: v.boolean(),
        direction,
        dog,
        fromLane: integer,
        itemId: integer,
        kind: squirrel,
        pullsLeft: count,
        tellSeconds: finite,
      }),
    ),
  });
  const session = v.object({
    card: v.null(),
    distanceBeforeZone: finite,
    needsZonePlan: v.literal(true),
    pulls,
    queue: v.pipe(v.array(cardSource), v.maxLength(1)),
    timeMs: v.pipe(finite, v.minValue(0)),
    walk: v.object({ road, run }),
    zoneEndPending: v.literal(false),
    zoomiesSeconds: finite,
  });
  const draws = v.pipe(count, v.maxValue(MAX_DRAWS));
  return v.pipe(
    v.object({
      draws: v.object({ cards: draws, forks: draws }),
      seed: v.pipe(count, v.maxValue(MAX_SEED)),
      session,
    }),
    v.check(({ session: { queue, walk } }) => {
      const { firstZone, route, zoneIndex } = walk.run;
      // At a fork the route has no zone at the zone index yet; as a zone starts it has.
      const atFork = queue[0]?.kind === "fork";
      const walked = atFork ? zoneIndex : zoneIndex + 1;
      return (
        zoneIndex < walkLength(data) &&
        firstZone <= zoneIndex &&
        route.length === walked &&
        queue.every((card) => card.kind === "fork")
      );
    }, "the walk is not between zones"),
  );
}

// The resume point as stored: the road's plan for the zone before, which the next plan
// replaces, left out but for the path's last row. The schema leaves out the dev panel's
// invincibility, which the walk sets again from the panel.
function storedWalk(walk: ResumeWalk): ResumeWalk {
  const { session } = walk;
  const { road } = session.walk;
  return {
    ...walk,
    session: {
      ...session,
      walk: {
        ...session.walk,
        road: { ...road, herrings: [], path: road.path.slice(-1), pending: [], planned: [] },
      },
    },
  };
}

// The resume point format for the game's content. It has no migrations: one from another
// version banks as heading home.
export function resumeFormat(data: ResumeData): SaveFormat<ResumeWalk | null> {
  const schema = resumeSchema(data);
  const checked = (stored: unknown) => {
    const result = v.safeParse(schema, stored);
    return result.success
      ? { ok: true as const, value: result.output }
      : { ok: false as const, reason: v.summarize(result.issues) };
  };
  return {
    decode: (stored) => checked(stored),
    encode: (walk) =>
      walk === null ? { ok: false, reason: "no walk" } : checked(storedWalk(walk)),
    fresh: () => null,
    migrations: {},
    version: RESUME_VERSION,
  };
}

// The text the checkpoint stores for a resume point, or undefined when it cannot be stored,
// which the next launch banks as heading home.
export function encodeResume(data: ResumeData, walk: ResumeWalk): string | undefined {
  const encoded = encodeSave(resumeFormat(data), walk);
  if (!encoded.ok) {
    console.error(`The walk's resume point was not saved: ${encoded.reason}`);
    return undefined;
  }
  return encoded.value;
}

// What a launch does with the checkpoint left by a walk that never ended: nothing without one;
// resume the walk from its resume point; or bank it as heading home (bankCheckpoint), with why,
// and the stored text to keep as a backup when it could not be read.
export type LaunchWalk =
  | { readonly kind: "bank"; readonly backup?: string; readonly reason: string }
  | { readonly kind: "none" }
  | { readonly kind: "resume"; readonly walk: ResumeWalk };

// Whether the walk the resume point holds is the one the checkpoint banks: the same dogs, in pack
// order, the same route and the same first zone.
function sameWalk(checkpoint: Checkpoint, walk: ResumeWalk): boolean {
  const { firstZone, pack, route } = walk.session.walk.run;
  const same = <T>(a: readonly T[], b: readonly T[]) =>
    a.length === b.length && a.every((each, i) => each === b[i]);
  return (
    checkpoint.counters.firstZone === firstZone &&
    same(
      checkpoint.dogs.map(({ id }) => id),
      pack.map(({ dog }) => dog),
    ) &&
    same(checkpoint.route, route)
  );
}

// A checkpoint resumes when resuming is allowed (a dev link's walk never resumes one) and its
// resume point reads at this version, names only content the game has and is the checkpoint's
// own walk; any other banks as heading home.
export function launchWalk(
  data: ResumeData,
  allowed: boolean,
  checkpoint: Checkpoint | null,
): LaunchWalk {
  if (checkpoint === null) {
    return { kind: "none" };
  }
  if (!allowed) {
    return { kind: "bank", reason: "a dev link starts its own walk" };
  }
  if (checkpoint.resume === undefined) {
    return { kind: "bank", reason: "the checkpoint has no resume point" };
  }
  const loaded = loadSave(resumeFormat(data), checkpoint.resume);
  if (loaded.status === "corrupt") {
    return { backup: loaded.raw, kind: "bank", reason: loaded.reason };
  }
  if (loaded.status === "newer") {
    return { kind: "bank", reason: loaded.reason };
  }
  if (loaded.save === null || !sameWalk(checkpoint, loaded.save)) {
    return { kind: "bank", reason: "the resume point is not the checkpoint's walk" };
  }
  return { kind: "resume", walk: loaded.save };
}
