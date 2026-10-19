import { describe, expect, it } from "vitest";

import { HINTS } from "../data/hints";
import type { HintId } from "../data/types";
import {
  dismissHint,
  EMPTY_HINT_QUEUE,
  hintAlpha,
  type HintQueue,
  stepHintQueue,
} from "./hintQueue";

const TIMING = { fadeMs: 400, holdMs: 4500, staleMs: 5000 };

// One frame: how long it took, what was on screen (walking, a card or menu up, or walking with
// the strip's bubble open) and the hints raised in it.
type Step = readonly [number, "blocked" | "hold" | "walk", readonly HintId[]];

function run(steps: readonly Step[]): HintQueue {
  return steps.reduce(
    (state, [dtMs, mode, ids]) =>
      stepHintQueue(
        TIMING,
        {
          blocked: mode === "blocked",
          dtMs,
          held: mode === "hold",
          raised: ids.map((id) => ({ id, text: HINTS[id].text })),
        },
        state,
      ),
    EMPTY_HINT_QUEUE,
  );
}

describe("stepHintQueue", () => {
  it.each<[string, Step[], HintId | null, HintId[]]>([
    ["shows a hint at once", [[16, "walk", ["tip"]]], "tip", []],
    [
      "keeps one id once however often raised",
      [
        [0, "walk", ["tip", "tip"]],
        [16, "walk", ["tip"]],
      ],
      "tip",
      [],
    ],
    [
      "shows the next when the first has had its time",
      [
        [0, "walk", ["tip", "treat"]],
        [4900, "walk", []],
      ],
      "treat",
      [],
    ],
    [
      "drops a queued hint older than staleMs",
      [
        [0, "walk", ["tip", "treat", "pull"]],
        [4900, "walk", []],
        [4900, "walk", []],
      ],
      null,
      [],
    ],
    [
      "shows a card's hint over a walk hint, which waits",
      [
        [0, "walk", ["pull"]],
        [16, "hold", ["squirrel"]],
      ],
      "squirrel",
      ["pull"],
    ],
    [
      "drops a card's hint when the card closes",
      [
        [0, "hold", ["card"]],
        [1000, "walk", []],
      ],
      null,
      [],
    ],
    [
      "drops a card's queued hints when the card closes",
      [
        [0, "hold", ["squirrel", "card"]],
        [1000, "walk", []],
      ],
      null,
      [],
    ],
    [
      "resumes a walk hint after a long hold, and ages the one behind it only while walking",
      [
        [0, "walk", ["tip", "treat"]],
        [16, "hold", []],
        [60000, "hold", []],
        [16, "walk", []],
      ],
      "tip",
      ["treat"],
    ],
    ["starts nothing while the strip's bubble is open", [[0, "blocked", ["tip"]]], null, ["tip"]],
    [
      "lets a hint go stale while the strip's bubble is open",
      [
        [0, "blocked", ["tip"]],
        [5100, "blocked", []],
        [16, "walk", []],
      ],
      null,
      [],
    ],
  ])("%s", (_, steps, shown, queued) => {
    const state = run(steps);
    expect(state.shown?.id ?? null).toBe(shown);
    expect(state.queue.map(({ id }) => id)).toEqual(queued);
  });

  it("resumes a walk hint with the time it had left before the hold", () => {
    const state = run([
      [0, "walk", ["tip"]],
      [1000, "walk", []],
      [100, "hold", []],
      [60000, "hold", []],
      [6000, "walk", []],
    ]);
    expect(state.shown).toMatchObject({ id: "tip", leftMs: 3900 });
  });
});

describe("dismissHint and hintAlpha", () => {
  it("closes the hint on screen and keeps the queue", () => {
    const state = run([[0, "walk", ["tip", "treat"]]]);
    expect(dismissHint(state)).toEqual({ queue: state.queue, shown: null });
  });

  it.each([
    [4900, 1],
    [400, 1],
    [200, 0.5],
  ])("with %i ms left is %f opaque", (leftMs, alpha) => {
    const hint = { ageMs: 0, context: "walk", id: "tip", leftMs, text: "" } as const;
    expect(hintAlpha(TIMING, hint)).toBe(alpha);
  });
});
