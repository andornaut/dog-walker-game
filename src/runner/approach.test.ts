import { describe, expect, it } from "vitest";

import {
  approachChoices,
  approachOutcomes,
  type ApproachPath,
  nearestStep,
  nextChoiceAt,
  takeStep,
} from "./approach";
import { moverTell, stepsTaken } from "./movers";

const CELL = 64;
// A stalker in lane 2 that may step within lanes 1 to 3 and a row down, its one step pending
// at a scroll of 300 since it spawned, well before its stop travel.
const stalker = (overrides: Partial<ApproachPath> = {}): ApproachPath => ({
  burst: CELL,
  lane: 2,
  lengths: [100, 100, 100],
  motion: "approach",
  movement: "approach",
  pending: [{ at: 300, kind: "after" }],
  reach: { count: 3, first: 1 },
  rows: 1,
  steps: [],
  stopTravel: 600,
  warning: 200,
  ...overrides,
});
const ORIGIN = { x: 0, y: 0 };
// The pack, lanes across and rows down from the stalker.
const packAt = (lanes: number, rows: number) => ({ x: lanes * CELL, y: rows * CELL });
const choose = (path: ApproachPath, pack: { x: number; y: number }) =>
  nearestStep(CELL, path.burst, ORIGIN, pack, approachChoices(path));

describe("a stalker's step", () => {
  // Wherever the pack is, the step nearest it, never up the road: beside or behind it, the
  // stalker steps across, the left on a tie.
  it.each([
    { lanes: 0, name: "below", rows: 3, want: { lanes: 0, travel: 1 } },
    { lanes: -2, name: "below and left", rows: 3, want: { lanes: -1, travel: 1 } },
    { lanes: 2, name: "below and right", rows: 3, want: { lanes: 1, travel: 1 } },
    { lanes: -2, name: "to the left", rows: 0, want: { lanes: -1, travel: 0 } },
    { lanes: 2, name: "to the right", rows: 0, want: { lanes: 1, travel: 0 } },
    { lanes: -2, name: "above and left", rows: -3, want: { lanes: -1, travel: 0 } },
    { lanes: 0, name: "above", rows: -3, want: { lanes: -1, travel: 0 } },
    { lanes: 2, name: "above and right", rows: -3, want: { lanes: 1, travel: 0 } },
  ])("steps toward a pack $name in reach", ({ lanes, rows, want }) => {
    expect(choose(stalker(), packAt(lanes, rows))).toEqual(want);
  });

  // A step outside the lanes and rows the planner left it falls back to the nearest one left.
  it.each([
    {
      name: "with only its own lane",
      path: stalker({ reach: { count: 1, first: 2 } }),
      want: { lanes: 0, travel: 1 },
    },
    {
      name: "with no lane to the left",
      path: stalker({ reach: { count: 2, first: 2 } }),
      want: { lanes: 0, travel: 1 },
    },
    {
      name: "with its row down taken",
      path: stalker({
        pending: [{ kind: "near", travel: 400 }],
        steps: [{ at: 100, lanes: 0, length: 100, travel: CELL }],
      }),
      want: { lanes: -1, travel: 0 },
    },
  ])("falls back $name when it cannot step toward the pack", ({ path, want }) => {
    expect(choose(path, packAt(-2, 3))).toEqual(want);
  });

  // Once its step would start at or past the pack's rows, it takes no step, nor any later one.
  it("drops its steps once it would start them at the pack's rows", () => {
    const late = stalker({
      pending: [
        { at: 600, kind: "after" },
        { kind: "near", travel: 700 },
      ],
    });
    expect(approachChoices(late)).toEqual([]);
    expect(takeStep(late, choose(late, packAt(0, 3)))).toEqual({ ...late, pending: [] });
  });

  // Its second step waits until it is near the pack and its first step has ended. It has no
  // cue of its own: it is chosen as it starts, and only the first step shows the wander mark.
  it.each([
    { name: "near the pack", near: 450, want: 450 - CELL },
    { name: "right after its first step", near: 100, want: 200 },
  ])("takes its second step $name with no cue", ({ near, want }) => {
    const path = stalker({
      pending: [
        { at: 100, kind: "after" },
        { kind: "near", travel: near },
      ],
      rows: 2,
    });
    expect(nextChoiceAt(path)).toBe(100 - path.warning);
    const first = takeStep(path, { lanes: 0, travel: 1 });
    expect(nextChoiceAt(first)).toBe(want);
    const second = takeStep(first, { lanes: 1, travel: 1 });
    expect(second.steps.map(({ at }) => at)).toEqual([100, want]);
    const cued = (since: number) => moverTell(second, since)?.kind ?? null;
    expect(cued(100 - path.warning)).toBe("wander");
    expect(cued(want - 1)).toBeNull();
  });

  // Every way it may choose its steps stays within its lanes and rows, never steps up, and
  // takes each step once.
  it("may take every step its lanes and rows allow, and no other", () => {
    const path = stalker({
      pending: [
        { at: 100, kind: "after" },
        { kind: "near", travel: 400 },
      ],
      rows: 2,
    });
    const outcomes = approachOutcomes(path);
    const ends = outcomes.map((outcome) => {
      const { lanes, rows } = stepsTaken(outcome);
      return { lane: outcome.lane + lanes, rows };
    });
    expect(outcomes.every(({ pending, steps }) => pending.length === 0 && steps.length === 2)).toBe(
      true,
    );
    expect(outcomes.flatMap(({ steps }) => steps).every(({ travel }) => travel >= 0)).toBe(true);
    expect(ends.every(({ lane }) => lane >= 1 && lane <= 3)).toBe(true);
    expect([...new Set(ends.map(({ lane, rows }) => `${lane},${rows}`))].sort()).toEqual([
      "1,1",
      "1,2",
      "2,0",
      "2,1",
      "2,2",
      "3,1",
      "3,2",
    ]);
  });
});
