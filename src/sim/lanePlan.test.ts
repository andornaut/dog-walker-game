import { describe, expect, it } from "vitest";

import { type LanePlanConfig, planLanes, type PlanStart } from "./lanePlan";

const MOVE = 0.18;
const CONFIG: LanePlanConfig = {
  gridSeconds: 0.05,
  horizon: 5,
  laneCount: 5,
  moveSeconds: MOVE,
  moveStep: MOVE,
  slackSeconds: 0.02,
};
const IN_LANE_2: PlanStart = { lane: 2, movableAt: 0, readyAt: 0 };

const lanes = (...indexes: number[]) => indexes.reduce((mask, lane) => mask | (1 << lane), 0);

describe("planLanes", () => {
  it("stays in its lane with nothing ahead", () => {
    expect(planLanes(CONFIG, IN_LANE_2, [], [], [])).toEqual([]);
  });

  it("steers out of a hazard's lane in time", () => {
    const moves = planLanes(CONFIG, IN_LANE_2, [{ from: 1, lanes: lanes(2), to: 1.5 }], [], []);

    expect(moves).toHaveLength(1);
    expect(moves[0]?.at).toBeLessThanOrEqual(1 - MOVE);
  });

  it("crosses two lanes in a gap only just long enough, from the moment it opens", () => {
    const opens = 1;
    const moves = planLanes(
      CONFIG,
      { lane: 0, movableAt: 0, readyAt: 0 },
      [
        { from: 0, lanes: lanes(1, 2), to: opens },
        { from: opens + 2 * MOVE + 0.001, lanes: lanes(0, 1), to: 3 },
      ],
      [],
      [],
    );

    expect(moves).toEqual([
      { at: opens, direction: 1 },
      { at: opens + MOVE, direction: 1 },
    ]);
  });

  it("goes for a tip only when that is safe", () => {
    const tip = { at: 1, lanes: lanes(3), value: 1 };

    expect(planLanes(CONFIG, IN_LANE_2, [], [tip], [])).toHaveLength(1);
    expect(
      planLanes(CONFIG, IN_LANE_2, [{ from: 0.9, lanes: lanes(3), to: 1.4 }], [tip], []),
    ).toEqual([]);
  });

  // The tip is in lane 3 at 1 and a hazard follows it there. On this grid, the earliest the pack
  // can leave lane 3 and still meet the tip is 0.85, so it is clear of lane 3 at 0.85 + MOVE.
  it.each([
    { moves: 0, spare: CONFIG.slackSeconds / 2, takes: "leaves it" },
    { moves: 2, spare: CONFIG.slackSeconds * 2, takes: "takes it" },
  ])(
    "$takes when going for a tip would clear the next hazard with $spare seconds to spare",
    ({ moves, spare }) => {
      const tip = { at: 1, lanes: lanes(3), value: 1 };
      const hazard = { from: 0.85 + MOVE + spare, lanes: lanes(3), to: 2 };

      expect(planLanes(CONFIG, IN_LANE_2, [hazard], [tip], [])).toHaveLength(moves);
    },
  );

  it("steers before a pull it sees coming, so the pull lands clear of a hazard", () => {
    const moves = planLanes(
      CONFIG,
      IN_LANE_2,
      [{ from: 0.6, lanes: lanes(3), to: 1.5 }],
      [],
      [{ at: 0.5, direction: 1, reactSeconds: 0.3 }],
    );

    expect(moves[0]).toEqual({ at: expect.any(Number), direction: -1 });
    expect(moves[0]?.at).toBeLessThanOrEqual(0.5 - MOVE);
  });
});
