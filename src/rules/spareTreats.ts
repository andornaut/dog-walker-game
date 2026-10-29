import type { GameData } from "../data/types";
import { heartsOf, packDogs } from "../state/pack";
import type { EffectSource, RunState } from "../state/runState";
import type { Change, HeartChange } from "./causes";
import { ownerMaxHearts } from "./dogs";
import { changeHearts } from "./effects";
import { modifiedStat } from "./modifiers";
import { read } from "./units";

// Spare treats: with a spareTreats modifier in effect, such as the Fanny pack's, a treat grabbed
// while every walking owner is at their max is held for later instead of paying cash, and the next
// heart lost is given back from it in the same step, before any owner fires you.

type SpareData = Pick<GameData, "dogs" | "tuning">;

// How many spare treats the pack holds, by its spareTreats modifiers.
export function spareTreatRoom(
  data: Pick<GameData, "tuning">,
  run: Pick<RunState, "modifiers">,
): number {
  return Math.max(0, Math.round(modifiedStat(data.tuning, run.modifiers, "spareTreats", 0)));
}

// The spare treats held cut to the room left, as when a found Fanny pack goes back and takes its
// spare treat with it.
export function holdSpareTreats(data: Pick<GameData, "tuning">, run: RunState): RunState {
  const room = spareTreatRoom(data, run);
  return run.spareTreats.held <= room
    ? run
    : { ...run, spareTreats: { ...run.spareTreats, held: room } };
}

// A treat grabbed held as a spare, or null when it goes to an owner as usual: some walking owner
// is below their max, or the pack holds no more spares, so a treat at every max pays cash
// (grabTreat in treats.ts).
export function storeSpareTreat(data: SpareData, run: RunState): RunState | null {
  if (run.spareTreats.held >= spareTreatRoom(data, run)) {
    return null;
  }
  const below = packDogs(run).some(
    (dog) => (heartsOf(run, dog) ?? 0) < ownerMaxHearts(data, run, dog),
  );
  if (below) {
    return null;
  }
  const { held, stored } = run.spareTreats;
  return { ...run, spareTreats: { ...run.spareTreats, held: held + 1, stored: stored + 1 } };
}

// What gave the pack its spare treats: the first spareTreats modifier's source.
export function spareTreatSource(run: Pick<RunState, "modifiers">): EffectSource | undefined {
  const source = run.modifiers.find((modifier) => modifier.stat === "spareTreats")?.source;
  return source === undefined || source.kind === "debuff" ? undefined : source;
}

// What gave a spare treat spendSpareTreat gave back: its change's base cause's source.
export function spareTreatGiver(change: HeartChange): EffectSource | undefined {
  const [base] = change.causes;
  return base?.kind === "effect" ? base.source : undefined;
}

// After changes made at once, such as a step's bumps or a card's hearts, a held spare treat goes
// to an owner whose meter they lowered and who is still walking below their max: the one left
// with the fewest hearts, ties to the dog nearer the front. Their owner gains hearts.treat back,
// up to their max, as a change from the spare treat's source. A loss Second chance forgave whole
// lowered no meter, so it spends none. change is null when none is spent.
export function spendSpareTreat(
  data: SpareData,
  changes: readonly Change[],
  run: RunState,
): { readonly change: HeartChange | null; readonly state: RunState } {
  const source = spareTreatSource(run);
  if (run.spareTreats.held === 0 || source === undefined) {
    return { change: null, state: run };
  }
  const lost = new Set(
    changes.flatMap((change) =>
      change.kind === "hearts" && change.after < change.before ? [change.dog] : [],
    ),
  );
  let recipient: HeartChange["dog"] | undefined;
  let fewest = Infinity;
  // The pack's slots are in pack order, so the first of a tie is nearer the front.
  for (const { dog } of run.pack) {
    const hearts = heartsOf(run, dog);
    if (
      lost.has(dog) &&
      hearts !== undefined &&
      hearts < fewest &&
      hearts < ownerMaxHearts(data, run, dog)
    ) {
      recipient = dog;
      fewest = hearts;
    }
  }
  if (recipient === undefined) {
    return { change: null, state: run };
  }
  const amount = read(data.tuning, "hearts", "treat");
  const given = changeHearts(data, [{ amount, kind: "effect", source }], recipient, run);
  const { held, spent } = run.spareTreats;
  return {
    change: given.change,
    state: {
      ...given.state,
      spareTreats: { ...given.state.spareTreats, held: held - 1, spent: spent + 1 },
    },
  };
}
