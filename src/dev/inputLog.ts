import * as v from "valibot";

import type { LaneDirection } from "../layout/lanes";
import { parseRunSetup, type RunSetup, type RunSetupLimits, runSetupToQuery } from "./runSetup";

// A log of any other version is rejected.
export const INPUT_LOG_VERSION = 4;

// A card option's index in its source's data, or the Skip option, as chooseOption takes it.
export type CardChoice = number | "skip";

// timeMs is run time: the simulated milliseconds since the run started, not counting time
// paused, taken at the step that applied the input. Replaying an event at the same step then
// reproduces the run. Heading home, from the pause menu, ends the run between steps; its timeMs
// is the run time of the step it came before.
export type InputEvent =
  | { readonly choice: CardChoice; readonly kind: "card"; readonly timeMs: number }
  | { readonly direction: LaneDirection; readonly kind: "lane"; readonly timeMs: number }
  | { readonly kind: "home"; readonly timeMs: number };

export interface InputLog<DogId extends string = string, GearId extends string = string> {
  readonly events: readonly InputEvent[];
  readonly setup: RunSetup<DogId, GearId>;
}

type DecodedInputLog<DogId extends string, GearId extends string> =
  | { readonly errors: readonly string[]; readonly ok: false }
  | { readonly log: InputLog<DogId, GearId>; readonly ok: true };

export function startInputLog<DogId extends string, GearId extends string>(
  setup: RunSetup<DogId, GearId>,
): InputLog<DogId, GearId> {
  return { events: [], setup };
}

export function recordInput<DogId extends string, GearId extends string>(
  event: InputEvent,
  log: InputLog<DogId, GearId>,
): InputLog<DogId, GearId> {
  return { ...log, events: [...log.events, event] };
}

// Events in time order. Events at the same time keep the order they were recorded in, which
// is the order they were applied.
export function* replayInputs(log: InputLog): Generator<InputEvent, void, undefined> {
  yield* [...log.events].sort((a, b) => a.timeMs - b.timeMs);
}

// The inputs a simulation step applies before it walks: lane moves and heading home.
export type StepInput = Extract<InputEvent, { readonly kind: "home" | "lane" }>;

// The replayed step inputs due by timeMs, from events[next] on, and the index after them.
// They stop at a card choice, which waits for its card to open.
export function takeDueInputs(
  events: readonly InputEvent[],
  next: number,
  timeMs: number,
): { due: StepInput[]; next: number } {
  const due: StepInput[] = [];
  let index = next;
  for (let event = events[index]; event !== undefined; event = events[index]) {
    if (event.kind === "card" || event.timeMs > timeMs) {
      break;
    }
    due.push(event);
    index += 1;
  }
  return { due, next: index };
}

// The replayed choice for a card just opened, if events[next] is one, and the index after it.
export function takeCardChoice(
  events: readonly InputEvent[],
  next: number,
): { choice: CardChoice | undefined; next: number } {
  const event = events[next];
  return event?.kind === "card"
    ? { choice: event.choice, next: next + 1 }
    : { choice: undefined, next };
}

// Each event is a tuple, [timeMs, "l", direction], [timeMs, "c", choice] or [timeMs, "h"], and
// the setup is its URL query, which keeps a long replay small.
const timeMs = v.pipe(v.number(), v.finite(), v.minValue(0));
const index = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const laneTuple = v.tuple([timeMs, v.literal("l"), v.picklist([-1, 1])]);
const cardTuple = v.tuple([timeMs, v.literal("c"), v.union([index, v.literal("skip")])]);
const homeTuple = v.tuple([timeMs, v.literal("h")]);
const encodedSchema = v.object({
  events: v.array(v.union([laneTuple, cardTuple, homeTuple])),
  setup: v.string(),
  version: v.literal(INPUT_LOG_VERSION),
});
type EncodedEvent =
  | v.InferOutput<typeof cardTuple>
  | v.InferOutput<typeof homeTuple>
  | v.InferOutput<typeof laneTuple>;

function encodeEvent(event: InputEvent): EncodedEvent {
  switch (event.kind) {
    case "card":
      return [event.timeMs, "c", event.choice];
    case "home":
      return [event.timeMs, "h"];
    default:
      return [event.timeMs, "l", event.direction];
  }
}

function decodeEvent(event: EncodedEvent): InputEvent {
  switch (event[1]) {
    case "c":
      return { choice: event[2], kind: "card", timeMs: event[0] };
    case "h":
      return { kind: "home", timeMs: event[0] };
    default:
      return { direction: event[2], kind: "lane", timeMs: event[0] };
  }
}

export function encodeInputLog(log: InputLog): string {
  return JSON.stringify({
    events: log.events.map(encodeEvent),
    setup: runSetupToQuery(log.setup),
    version: INPUT_LOG_VERSION,
  });
}

// Fails, rather than warning, on any setup value the current game data rejects: a replay
// that starts from a different setup would not reproduce its run.
export function decodeInputLog<DogId extends string, GearId extends string>(
  limits: RunSetupLimits<DogId, GearId>,
  json: string,
): DecodedInputLog<DogId, GearId> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return { errors: [`Not JSON: ${String(error)}`], ok: false };
  }
  const parsed = v.safeParse(encodedSchema, raw);
  if (!parsed.success) {
    return {
      errors: parsed.issues.map((issue) => `${v.getDotPath(issue) ?? "log"}: ${issue.message}`),
      ok: false,
    };
  }
  let seedMissing = false;
  const { setup, warnings } = parseRunSetup(
    limits,
    () => {
      seedMissing = true;
      return 0;
    },
    parsed.output.setup,
  );
  const errors = seedMissing ? [...warnings, "The setup has no seed"] : warnings;
  if (errors.length > 0) {
    return { errors, ok: false };
  }
  return { log: { events: parsed.output.events.map(decodeEvent), setup }, ok: true };
}
