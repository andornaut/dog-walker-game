import type { DogId } from "../data/types";
import { cents, clampHearts, pixels } from "../rules/units";
import type { Pack, PackSlot, RunState } from "../state/runState";

// A run state for tests: one pack slot per entry, walking at the given hearts or fired
// in zone 0, and everything else empty.
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
    debuffs: [],
    feesEarned: {},
    gear: null,
    immunities: [],
    modifiers: [],
    money: cents(0),
    pack: pack as readonly PackSlot[] as Pack,
    phase: { kind: "walking" },
    skipsLeft: 0,
    treats: 0,
    upgradesPicked: [],
    zoneDistance: pixels(0),
    zoneIndex: 0,
    ...overrides,
  };
}

// The hearts of every walking dog, keyed by dog, for comparing in a test.
export function heartsByDog(state: RunState): Partial<Record<DogId, number>> {
  return Object.fromEntries(
    state.pack.flatMap((slot) => (slot.status === "walking" ? [[slot.dog, slot.hearts]] : [])),
  );
}
