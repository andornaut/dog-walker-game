import type { DogId, Modifier } from "../data/types";
import {
  type ActiveModifier,
  blankRun,
  type ModifierSource,
  type Pack,
  type PackSlot,
  type RunState,
} from "../state/runState";
import { clampHearts } from "../units";

// A run state for tests: one pack slot per entry, walking at the given hearts or fired
// in zone 0, the default walker without its effects, and everything else empty.
export function testState(
  slots: Readonly<Partial<Record<DogId, number | "fired">>>,
  overrides: Partial<RunState> = {},
): RunState {
  const pack = Object.entries(slots).map(([dog, value]): PackSlot =>
    value === "fired"
      ? { dog: dog as DogId, status: "fired", zoneIndex: 0 }
      : { dog: dog as DogId, hearts: clampHearts(Infinity, value ?? 0), status: "walking" },
  );
  if (pack.length < 1 || pack.length > 3) {
    throw new Error(`A pack has 1 to 3 dogs, not ${pack.length}`);
  }
  return {
    ...blankRun({
      gear: null,
      pack: pack as readonly PackSlot[] as Pack,
      route: ["distilleryDistrict"],
      walker: "casey",
    }),
    ...overrides,
  };
}

// The hearts of every walking dog, keyed by dog, for comparing in a test.
export function heartsByDog(state: RunState): Partial<Record<DogId, number>> {
  return Object.fromEntries(
    state.pack.flatMap((slot) => (slot.status === "walking" ? [[slot.dog, slot.hearts]] : [])),
  );
}

// A modifier as the run state holds it, with the source a change names it by.
export function activeModifier(source: ModifierSource, modifier: Modifier): ActiveModifier {
  return { ...modifier, source };
}
