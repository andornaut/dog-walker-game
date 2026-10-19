import type { DogId, Modifier } from "../data/types";
import { cents, clampHearts, pixels } from "../rules/units";
import type { ActiveModifier, ModifierSource, Pack, PackSlot, RunState } from "../state/runState";

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
    bumpsByZone: [],
    debuffZones: {},
    debuffs: [],
    firstZone: 0,
    gear: null,
    immunities: [],
    modifiers: [],
    money: cents(0),
    needSeconds: {},
    pack: pack as readonly PackSlot[] as Pack,
    phase: { kind: "walking" },
    route: ["street"],
    skipsLeft: 0,
    squirrelChases: 0,
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

// A modifier as the run state holds it, with the source a change names it by.
export function activeModifier(source: ModifierSource, modifier: Modifier): ActiveModifier {
  return { ...modifier, source };
}
