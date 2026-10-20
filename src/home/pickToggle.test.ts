import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { DogId, GearId, WalkerId } from "../data/types";
import type { Owned } from "../save/schema";
import { TEST_TUNING } from "../testing/tuning";
import { tapDog, tapGear, togglePick } from "./home";
import { homeSections, type SectionId, startReady } from "./sections";
import { tapWalker } from "./walkers";

const data = { ...gameData, tuning: TEST_TUNING };
const [dog] = Object.keys(gameData.dogs) as DogId[];
const [gear] = Object.keys(gameData.shopGear) as GearId[];
const [walker] = Object.keys(gameData.walkers) as WalkerId[];
if (dog === undefined || gear === undefined || walker === undefined) {
  throw new Error("The data needs a dog, a gear item and a walker");
}
const owned: Owned = { dogSlots: 1, dogs: [dog], gear: [gear], walkers: [walker] };

interface Picks {
  readonly dog: DogId | null;
  readonly gear: GearId | null;
  readonly walker: WalkerId | null;
}

type Kind = "dog" | "gear" | "walker";

const loadoutOf = (picks: Picks) => ({
  dogs: picks.dog === null ? [] : [picks.dog],
  gear: picks.gear,
});

// The picks after a tap on the one item of a kind.
const tap: Record<Kind, (picks: Picks) => Picks> = {
  dog: (picks) => {
    const result = tapDog(data, owned, dog, loadoutOf(picks));
    if (result.kind !== "loadout") {
      throw new Error("An owned dog toggles the loadout");
    }
    return { ...picks, dog: result.loadout.dogs[0] ?? null };
  },
  gear: (picks) => {
    const result = tapGear(owned, gear, loadoutOf(picks));
    if (result.kind !== "loadout") {
      throw new Error("Owned gear toggles the loadout");
    }
    return { ...picks, gear: result.loadout.gear };
  },
  walker: (picks) => {
    const result = tapWalker(data, owned, picks.walker, walker);
    return { ...picks, walker: result.kind === "pick" ? result.walker : null };
  },
};

const sectionsOf = (picks: Picks) =>
  homeSections(data, owned, { loadout: loadoutOf(picks), walker: picks.walker });

const none: Picks = { dog: null, gear: null, walker: null };
const all: Picks = { dog, gear, walker };

describe("a tap on the one item of a kind", () => {
  // Walker, dogs and Pocket toggle alike; the Pocket is optional for Start walk.
  it.each<{ after: Picks; kind: Kind; ready: boolean; start: Picks }>([
    { after: { ...none, dog }, kind: "dog", ready: false, start: none },
    { after: { ...all, dog: null }, kind: "dog", ready: false, start: all },
    { after: { ...none, dog, walker }, kind: "dog", ready: true, start: { ...none, walker } },
    { after: { ...none, gear }, kind: "gear", ready: false, start: none },
    { after: { ...all, gear: null }, kind: "gear", ready: true, start: all },
    { after: { ...none, walker }, kind: "walker", ready: false, start: none },
    { after: { ...all, walker: null }, kind: "walker", ready: false, start: all },
    { after: { ...none, dog, walker }, kind: "walker", ready: true, start: { ...none, dog } },
  ])("$kind from $start gives $after, ready $ready", ({ after, kind, ready, start }) => {
    const result = tap[kind](start);
    expect(result).toEqual(after);
    expect(startReady(sectionsOf(result))).toBe(ready);
  });

  it.each<{ kind: Kind; section: SectionId }>([
    { kind: "dog", section: "dogs" },
    { kind: "gear", section: "pocket" },
    { kind: "walker", section: "walker" },
  ])("leaves the $section section neutral once its pick is dropped", ({ kind, section }) => {
    expect(sectionsOf(tap[kind](all))[section].state).toBe("neutral");
  });
});

describe("togglePick", () => {
  it.each<{
    capacity: number;
    expected: ReturnType<typeof togglePick<string>>;
    id: string;
    picked: string[];
  }>([
    { capacity: 1, expected: { kind: "picked", picked: ["a"] }, id: "a", picked: [] },
    { capacity: 1, expected: { kind: "picked", picked: [] }, id: "a", picked: ["a"] },
    { capacity: 1, expected: { kind: "picked", picked: ["b"] }, id: "b", picked: ["a"] },
    { capacity: 2, expected: { kind: "picked", picked: ["a", "b"] }, id: "b", picked: ["a"] },
    { capacity: 2, expected: { kind: "picked", picked: ["b"] }, id: "a", picked: ["a", "b"] },
    { capacity: 2, expected: { kind: "full" }, id: "c", picked: ["a", "b"] },
  ])("capacity $capacity, picked $picked, tap $id", ({ capacity, expected, id, picked }) => {
    expect(togglePick(capacity, picked, id)).toEqual(expected);
  });
});
