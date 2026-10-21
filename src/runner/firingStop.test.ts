import { describe, expect, it } from "vitest";

import type { DogId } from "../data/types";
import type { CardSource } from "../state/runState";
import { type FiringHold, holdForFiring } from "./firingStop";
import type { HitStop } from "./hitStop";

const SKUNK: CardSource = { affected: ["koda"], encounter: "skunk", kind: "encounter" };
const STOP: CardSource = { affected: ["koda"], encounter: "thief", kind: "encounter" };
const NOTHING = { cards: [], zoneEnded: false };

describe("holdForFiring", () => {
  const RUNNING: HitStop = { cards: [SKUNK], firing: false, seconds: 0.4, zoneEnded: true };

  it.each<{
    expected: FiringHold;
    fired: DogId[];
    name: string;
    running: HitStop | null;
    seconds: number;
  }>([
    {
      expected: { queued: { cards: [STOP], zoneEnded: true }, stop: null },
      fired: [],
      name: "changes nothing when nobody was fired",
      running: null,
      seconds: 1,
    },
    {
      expected: { queued: { cards: [STOP], zoneEnded: true }, stop: null },
      fired: ["koda"],
      name: "changes nothing for a hold of no length",
      running: null,
      seconds: 0,
    },
    {
      expected: {
        queued: NOTHING,
        stop: { cards: [STOP], firing: true, seconds: 1, zoneEnded: true },
      },
      fired: ["koda"],
      name: "holds the queued cards and the zone end for the firing's length",
      running: null,
      seconds: 1,
    },
    {
      expected: {
        queued: NOTHING,
        stop: { cards: [SKUNK, STOP], firing: true, seconds: 1, zoneEnded: true },
      },
      fired: ["koda"],
      name: "keeps a longer firing over a running stop, holding what both hold",
      running: RUNNING,
      seconds: 1,
    },
    {
      expected: {
        queued: NOTHING,
        stop: { cards: [SKUNK, STOP], firing: true, seconds: 1.5, zoneEnded: true },
      },
      fired: ["koda"],
      name: "keeps a longer running stop over the firing",
      running: { ...RUNNING, seconds: 1.5 },
      seconds: 1,
    },
  ])("$name", ({ expected, fired, running, seconds }) => {
    const queued = { cards: [STOP], zoneEnded: running === null };
    expect(holdForFiring(seconds, fired, queued, running)).toEqual(expected);
  });
});
