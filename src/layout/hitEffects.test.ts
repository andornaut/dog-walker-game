import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { Effect, MinorObstacleId } from "../data/types";
import { applyInstantEncounter, applyMinorContact } from "../rules/choices";
import type { RunState } from "../state/runState";
import { testState } from "../testing/runState";
import {
  contactDebuffBatch,
  contactDebuffEffects,
  ContactImpactFrame,
  dogReaction,
  type FlashCue,
  HIT_ART,
  hitEffects,
  type HitKind,
  type MotionStep,
  OBSTACLE_HITS,
  obstacleMotion,
  splashEffect,
  type StruckDog,
  whiteFlash,
} from "./hitEffects";

const TOP = { x: 151, y: 402 };
const struck = (kind: HitKind, obstacle: MinorObstacleId | null): StruckDog => ({
  kind,
  obstacle,
  top: TOP,
});
const STANDING_HAZARD = keysOf(gameData.minorObstacles).find(
  (id) => "movement" in gameData.minorObstacles[id] && OBSTACLE_HITS[id] === undefined,
);

const CONTACTS = [
  ...keysOf(gameData.minorObstacles).flatMap((id) => {
    const { contact } = gameData.minorObstacles[id];
    return contact === undefined
      ? []
      : [
          {
            apply: (state: RunState) => applyMinorContact(gameData, state, id, ["archie"]),
            effects: contact.effects,
            name: id,
          },
        ];
  }),
  ...keysOf(gameData.encounters).flatMap((id) => {
    const { resolution } = gameData.encounters[id];
    return resolution.kind !== "contact"
      ? []
      : [
          {
            apply: (state: RunState) => applyInstantEncounter(gameData, state, id, ["archie"]),
            effects: resolution.effects,
            name: id,
          },
        ];
  }),
];

const debuffsIn = (effects: readonly Effect[]) =>
  effects.flatMap((effect) => (effect.kind === "debuff" ? [effect.debuff] : []));

// Which of the obstacle's angle, dx and dy its motion moves, and the angle it ends at.
function motionOf(steps: readonly MotionStep[]): { ends: number; moves: string[] } {
  const moves = [...new Set(steps.flatMap((step) => Object.keys(step)))]
    .filter((key) => key === "angle" || key === "dx" || key === "dy")
    .sort();
  const angles = steps.flatMap(({ angle }) => (angle === undefined ? [] : [angle]));
  const ends = angles.at(-1) ?? 0;
  return { ends, moves };
}

describe("hit effects", () => {
  it("bursts over every hit with its effects", () => {
    for (const [, kind, obstacle, keys] of [
      ["an iron fence", "plain", "ironFence3", [HIT_ART.bump.key]],
      ["a bench", "plain", "bench", [HIT_ART.bump.key]],
      [
        "a trash can, with litter",
        "plain",
        "trashCan",
        [HIT_ART.bump.key, HIT_ART.debris.litter.key],
      ],
      ["a hedge, with leaves", "plain", "hedge", [HIT_ART.bump.key, HIT_ART.debris.leaves.key]],
      ["a standing hazard", "plain", STANDING_HAZARD ?? null, [HIT_ART.bump.key]],
      ["a mover", "moving", "car", [HIT_ART.bumpBig.key]],
    ] satisfies readonly [string, HitKind, MinorObstacleId | null, string[]][]) {
      const effects = hitEffects(false, struck(kind, obstacle));
      expect(effects.map(({ key }) => key)).toEqual(keys);
      expect(effects.map(({ above }) => above)).toEqual(keys.map((__, index) => index));
      expect(effects.every(({ frame }) => frame === null)).toBe(true);
    }
  });

  it("centres a hit's effects on the struck dog's column, just over its top row", () => {
    for (const effect of hitEffects(false, struck("plain", "hedge"))) {
      expect(effect.at.x).toBe(TOP.x);
      expect(effect.at.y).toBeLessThan(TOP.y);
    }
  });

  it("puts the splash's ground row on the touching dog's feet", () => {
    const feet = { x: 140, y: 470 };
    const { at } = splashEffect(false, feet);
    const { groundRow, height } = HIT_ART.splash;
    expect(at.x).toBe(feet.x);
    expect(at.y - height / 2 + groundRow).toBe(feet.y);
  });

  // One obstacle for each motion OBSTACLE_HITS gives, and one with none.
  it.each<[string, HitKind, MinorObstacleId | null, string[]]>([
    ["a market stall shakes sideways", "plain", "marketStall2", ["dx"]],
    ["a trash can rocks back upright", "plain", "trashCan", ["angle"]],
    ["a fallen log shakes sideways", "plain", "fallenLog", ["dx"]],
    ["a standing hazard keeps still", "plain", STANDING_HAZARD ?? null, []],
    ["a mover jolts up the road and back", "moving", "car", ["dy"]],
  ])("%s", (_, kind, obstacle, moves) => {
    const steps = obstacleMotion(false, struck(kind, obstacle));
    const motion = motionOf(steps);
    expect(motion.moves).toEqual(moves);
    expect(motion.ends).toBe(0);
    expect(steps.at(-1)?.dx ?? 0).toBe(0);
    expect(steps.at(-1)?.dy ?? 0).toBe(0);
  });

  it("jolts a mover back up the road, up the screen", () => {
    const [jolt] = obstacleMotion(false, struck("moving", "car"));
    expect(jolt?.dy).toBeLessThan(0);
  });

  it("has the struck dog react, and every dog react and shake off on a splash", () => {
    expect(dogReaction(false, "hit")).toEqual(["react"]);
    expect(dogReaction(false, "splash")).toEqual(["react", "shake"]);
  });
});

describe("hit effects with reduced motion", () => {
  it("holds each splash's peak frame, with no debris", () => {
    for (const [, effects, peak] of [
      ["a plain hit's bump", () => hitEffects(true, struck("plain", "hedge")), HIT_ART.bump.peak],
      ["a mover's bump", () => hitEffects(true, struck("moving", "car")), HIT_ART.bumpBig.peak],
      ["the splash", () => [splashEffect(true, TOP)], HIT_ART.splash.peak],
    ] satisfies readonly [string, () => { frame: number | null; key: string }[], number][]) {
      expect(effects().map(({ frame }) => frame)).toEqual([peak]);
    }
  });

  // Reduced motion stops a mover's jolt and a standing obstacle's motion.
  it.each<[HitKind, MinorObstacleId]>([
    ["moving", "car"],
    ["plain", "fallenLog"],
  ])("keeps a %s %s still, with no dog reaction", (kind, obstacle) => {
    expect(obstacleMotion(true, struck(kind, obstacle))).toEqual([]);
    expect(dogReaction(true, "hit")).toEqual([]);
    expect(dogReaction(true, "splash")).toEqual([]);
  });
});

describe("physical contact render frames", () => {
  it("coalesces acquisition groups and their sound by debuff kind in the same frame", () => {
    const muddy = { debuff: "muddy", frame: null, key: HIT_ART.debuffs.muddy.key } as const;
    const stinky = { debuff: "stinky", frame: null, key: HIT_ART.debuffs.stinky.key } as const;
    const frame = new ContactImpactFrame();
    expect(frame.takeDebuffs(10, [muddy])).toEqual([muddy]);
    frame.take(10, []);
    expect(frame.takeDebuffs(10, [muddy, stinky])).toEqual([stinky]);
    expect(frame.takeDebuffs(11, [muddy])).toEqual([muddy]);
  });

  it("coalesces repeated callbacks by kind until the next visual frame", () => {
    const puddle = {
      dog: "kilo",
      item: { height: 32, id: 1, kind: "puddle", lane: 2, laneSpan: 1, y: 440 },
      source: { encounter: "puddle", kind: "encounter" },
    } as const;
    const pothole = {
      ...puddle,
      item: { ...puddle.item, id: 2, kind: "pothole" },
      source: { encounter: "pothole", kind: "encounter" },
    } as const;
    const frame = new ContactImpactFrame();
    expect(frame.take(10, [puddle])).toEqual([puddle]);
    expect(frame.take(10, [puddle, pothole])).toEqual([pothole]);
    expect(frame.take(11, [puddle])).toEqual([puddle]);
  });
});

describe("contact debuff bursts", () => {
  it.each(CONTACTS)("shows the applied debuffs for $name", ({ apply, effects }) => {
    const before = testState({ archie: 3 });
    const { state: after } = apply(before);
    const bursts = contactDebuffEffects(false, before, { after, effects });
    expect(bursts.map(({ key }) => key)).toEqual(
      debuffsIn(effects).map((debuff) => HIT_ART.debuffs[debuff].key),
    );
    expect(bursts.every(({ frame }) => frame === null)).toBe(true);
  });

  it.each(CONTACTS)("shows an unchanged-duration refresh for $name", ({ apply, effects }) => {
    const { state: before } = apply(testState({ archie: 3 }));
    const { state: after } = apply(before);
    expect(after.debuffs).toEqual(before.debuffs);
    expect(contactDebuffEffects(false, before, { after, effects }).map(({ key }) => key)).toEqual(
      debuffsIn(effects).map((debuff) => HIT_ART.debuffs[debuff].key),
    );
  });

  it.each(CONTACTS)("shows no debuff burst when $name applies nothing", ({ apply, effects }) => {
    const { state: before } = apply(testState({ archie: 3 }));
    expect(contactDebuffEffects(false, before, { after: before, effects })).toEqual([]);
  });

  it.each(CONTACTS)(
    "holds the applied debuff peaks with reduced motion for $name",
    ({ apply, effects }) => {
      const before = testState({ archie: 3 });
      const { state: after } = apply(before);
      const bursts = contactDebuffEffects(true, before, { after, effects });
      expect(bursts.map(({ frame }) => frame)).toEqual(
        debuffsIn(effects).map((debuff) => HIT_ART.debuffs[debuff].peak),
      );
    },
  );

  it("does not attribute another effect's application to a contact", () => {
    const first = CONTACTS[0];
    const other = CONTACTS.find(
      ({ effects }) => debuffsIn(effects)[0] !== debuffsIn(first?.effects ?? [])[0],
    );
    expect(first).toBeDefined();
    expect(other).toBeDefined();
    if (first === undefined || other === undefined) {
      return;
    }
    const before = testState({ archie: 3 });
    const { state: after } = first.apply(before);
    expect(contactDebuffEffects(false, before, { after, effects: other.effects })).toEqual([]);
  });
});

describe("contact debuff batches", () => {
  it("coalesces repeated applications across dogs without changing application counts", () => {
    const before = testState({ archie: 3 });
    const effects = [{ debuff: "muddy", kind: "debuff" }] as const;
    const first = { debuffsGot: { muddy: 1 } };
    const second = { debuffsGot: { muddy: 2 } };
    expect(
      contactDebuffBatch(false, before, [
        { after: first, effects },
        { after: second, effects },
      ]).map(({ debuff }) => debuff),
    ).toEqual(["muddy"]);
    expect(second.debuffsGot.muddy).toBe(2);
    expect(contactDebuffBatch(false, second, [{ after: second, effects }])).toEqual([]);
  });
});

describe("white flash", () => {
  // How long the tint is on each time.
  const onSpans = (cues: readonly FlashCue[]) =>
    cues.flatMap((cue, index) =>
      cue.on ? [(cues[index + 1]?.ms ?? Number.POSITIVE_INFINITY) - cue.ms] : [],
    );

  it("blinks from the hit, alternating and ending off", () => {
    for (const [, still, flashes] of [
      ["flashes twice in motion", false, 2],
      ["blinks once with reduced motion", true, 1],
    ] satisfies readonly [string, boolean, number][]) {
      const cues = whiteFlash(still);
      expect(cues[0]).toEqual({ ms: 0, on: true });
      expect(cues.map(({ on }) => on)).toEqual(cues.map((__, index) => index % 2 === 0));
      expect(cues.at(-1)?.on).toBe(false);
      expect(cues.map(({ ms }) => ms)).toEqual(cues.map(({ ms }) => ms).sort((a, b) => a - b));
      expect(onSpans(cues)).toHaveLength(flashes);
    }
  });

  it("holds the reduced-motion blink longer than either flash in motion", () => {
    const [blink = 0] = onSpans(whiteFlash(true));
    expect(blink).toBeGreaterThan(Math.max(...onSpans(whiteFlash(false))));
  });
});
