import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { MinorObstacleId } from "../data/types";
import {
  dogReaction,
  type FlashCue,
  HIT_ART,
  hitEffects,
  type HitKind,
  type MotionStep,
  OBSTACLE_HITS,
  obstacleMotion,
  shakesRoad,
  splashEffect,
  type StruckDog,
  tipSide,
  whiteFlash,
} from "./hitEffects";

const TOP = { x: 151, y: 402 };
const struck = (kind: HitKind, obstacle: MinorObstacleId | null): StruckDog => ({
  kind,
  obstacle,
  top: TOP,
});
const STANDING_HAZARD = (Object.keys(gameData.minorObstacles) as MinorObstacleId[]).find(
  (id) => "movement" in gameData.minorObstacles[id] && OBSTACLE_HITS[id] === undefined,
);

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
      ["a barrier", "plain", "barrier3", [HIT_ART.bump.key]],
      ["a bench", "plain", "bench", [HIT_ART.bump.key]],
      [
        "a trash can, with litter",
        "plain",
        "trashCan",
        [HIT_ART.bump.key, HIT_ART.debris.litter.key],
      ],
      ["a cone", "plain", "cone", [HIT_ART.bump.key]],
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

  it.each<[string, HitKind, MinorObstacleId | null, string[], "tipped" | "upright"]>([
    ["a barrier shakes sideways", "plain", "barrier2", ["dx"], "upright"],
    ["a bench shakes sideways", "plain", "bench", ["dx"], "upright"],
    ["a trash can rocks back upright", "plain", "trashCan", ["angle"], "upright"],
    ["a cone rocks and stays tipped", "plain", "cone", ["angle"], "tipped"],
    ["a hedge shakes sideways", "plain", "hedge", ["dx"], "upright"],
    ["a standing hazard keeps still", "plain", STANDING_HAZARD ?? null, [], "upright"],
    ["a mover jolts up the road and back", "moving", "car", ["dy"], "upright"],
  ])("%s", (_, kind, obstacle, moves, rests) => {
    const steps = obstacleMotion(false, struck(kind, obstacle), 1);
    const motion = motionOf(steps);
    expect(motion.moves).toEqual(moves);
    expect(motion.ends !== 0).toBe(rests === "tipped");
    expect(steps.at(-1)?.dx ?? 0).toBe(0);
    expect(steps.at(-1)?.dy ?? 0).toBe(0);
  });

  it("jolts a mover back up the road, up the screen", () => {
    const [jolt] = obstacleMotion(false, struck("moving", "car"), 1);
    expect(jolt?.dy).toBeLessThan(0);
  });

  it("tips a cone away from the pack, whichever side it is hit from", () => {
    for (const [, coneX, sign] of [
      ["right of the pack falls right", 200, 1],
      ["left of the pack falls left", 100, -1],
    ] satisfies readonly [string, number, number][]) {
      const side = tipSide(coneX, 150);
      const { ends } = motionOf(obstacleMotion(false, struck("plain", "cone"), side));
      expect(Math.sign(ends)).toBe(sign);
    }
  });

  it("shakes the road for a mover's hit only", () => {
    expect(shakesRoad(false, "moving")).toBe(true);
    expect(shakesRoad(false, "plain")).toBe(false);
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

  it.each<[HitKind, MinorObstacleId]>([
    ["moving", "car"],
    ["plain", "trashCan"],
    ["plain", "cone"],
    ["plain", "hedge"],
  ])("keeps a %s %s still, with no road shake or dog reaction", (kind, obstacle) => {
    expect(obstacleMotion(true, struck(kind, obstacle), 1)).toEqual([]);
    expect(shakesRoad(true, kind)).toBe(false);
    expect(dogReaction(true, "hit")).toEqual([]);
    expect(dogReaction(true, "splash")).toEqual([]);
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
