import { describe, expect, it } from "vitest";

import { hopShapes, laneAt, type StepShape } from "./movers";
import {
  awayHop,
  nextShyChoiceAt,
  type PackPlace,
  shyChoices,
  shyOutcomes,
  type ShyPath,
  takeHop,
} from "./shy";

const CELL = 50;
const LANES = 5;
const centreX = (lane: number) => (lane + 0.5) * CELL;

// The pack still in each lane, and moving between each pair of lanes side by side, half way.
const PACKS: readonly { name: string; pack: PackPlace }[] = [
  ...Array.from({ length: LANES }, (_, lane) => ({
    name: `still in lane ${lane}`,
    pack: { lanes: [lane], x: centreX(lane), y: 500 },
  })),
  ...Array.from({ length: LANES - 1 }, (_, lane) => [
    { from: lane, to: lane + 1 },
    { from: lane + 1, to: lane },
  ])
    .flat()
    .map(({ from, to }) => ({
      name: `moving from lane ${from} to ${to}`,
      pack: { lanes: [from, to], x: (centreX(from) + centreX(to)) / 2, y: 500 },
    })),
];

const HOPPERS: readonly { name: string; shapes: readonly StepShape[] }[] = [
  { name: "a hopper", shapes: hopShapes(2, false) },
  { name: "a sideways hopper", shapes: hopShapes(2, true) },
];

const onRoad = (lane: number, shapes: readonly StepShape[]) =>
  shapes.filter(({ lanes }) => lane + lanes >= 0 && lane + lanes < LANES);

describe("awayHop", () => {
  // From every lane, with the pack anywhere: the hop ends in neither the pack's lane nor one it
  // is moving into, and no nearer it across the road. Standing in the pack's lane, a hopper
  // always has a way out sideways.
  it.each(
    HOPPERS.flatMap(({ name, shapes }) =>
      PACKS.map(({ name: packName, pack }) => ({ name, pack, packName, shapes })),
    ),
  )("hops $name away with the pack $packName", ({ pack, shapes }) => {
    for (let lane = 0; lane < LANES; lane++) {
      const centre = { x: centreX(lane), y: 300 };
      const hop = awayHop(CELL, centre, pack, onRoad(lane, shapes), CELL);
      if (pack.lanes.includes(lane)) {
        expect(hop, `from lane ${lane}`).not.toBeNull();
      }
      if (hop === null) {
        continue;
      }
      const x = centre.x + hop.lanes * CELL;
      expect(pack.lanes, `from lane ${lane}`).not.toContain(laneAt(x / CELL - 0.5));
      expect(Math.abs(x - pack.x)).toBeGreaterThanOrEqual(Math.abs(centre.x - pack.x));
      expect(hop.travel).toBeLessThanOrEqual(0);
    }
  });
});

describe("shy paths", () => {
  const path: ShyPath = {
    burst: CELL,
    lane: 2,
    length: 30,
    motion: "shy",
    movement: "hop",
    pending: [200, 330],
    reach: { count: 3, first: 1 },
    rise: 1,
    shapes: hopShapes(2, false),
    steps: [],
    stopTravel: 400,
    warning: 100,
  };

  // Its choices keep it within its reach of lanes and its rise of rows up the road.
  it("chooses only hops within its lanes and rise", () => {
    const choices = shyChoices(path);
    expect(choices.length).toBeGreaterThan(0);
    for (const { lanes, travel } of choices) {
      expect(path.lane + lanes).toBeGreaterThanOrEqual(1);
      expect(path.lane + lanes).toBeLessThan(4);
      expect(travel).toBeGreaterThanOrEqual(-1);
    }
  });

  // Each hop starts at its pending scroll. Only the first is cued, so it is chosen as its cue
  // begins; a later one, with no cue, is chosen as it starts.
  it("takes each hop at its pending scroll, cueing the first only, and stops with none to take", () => {
    expect(nextShyChoiceAt(path)).toBe(200 - path.warning);
    const first = takeHop(path, { lanes: 1, travel: 0 });
    expect(first.steps).toEqual([{ at: 200, lanes: 1, length: 30, travel: 0 }]);
    expect(first.pending).toEqual([330]);
    expect(nextShyChoiceAt(first)).toBe(330);
    const second = takeHop(first, { lanes: 0, travel: -1 });
    expect(second.steps.at(-1)).toEqual({
      at: 330,
      lanes: 0,
      length: 30,
      travel: -CELL,
      uncued: true,
    });
    expect(nextShyChoiceAt(second)).toBeNull();
    expect(takeHop(first, null).pending).toEqual([]);
  });

  // The bot and the pull rule read every way it may go, stopping early included.
  it("gives every way its hops may go, stopping early included", () => {
    const outcomes = shyOutcomes(path);
    const counts = new Set(outcomes.map(({ steps }) => steps.length));
    expect([...counts].sort()).toEqual([0, 1, 2]);
    for (const outcome of outcomes) {
      expect(outcome.pending).toEqual([]);
    }
  });
});
