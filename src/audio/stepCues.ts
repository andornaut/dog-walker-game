// The sounds the walk's events play: a walk step's bumps and pickups, one cue per event, a pull
// step's tells and pulls, and a card choice's cost. Every field of a step is named here, so a
// new kind of event does not compile until it has a cue or a stated reason to play none.

import type { EncounterId, GameData } from "../data/types";
import { type Change, changeAmount } from "../rules/causes";
import type { PullStep } from "../runner/pulls";
import type { WalkStep } from "../runner/walk";
import { hitCue, type SoundCue } from "./sound";

type StepData = Pick<GameData, "encounters">;
type CuesOf = (data: StepData, step: WalkStep) => readonly SoundCue[];

const NONE = () => [];

// An encounter met on the road plays its hit sound: an obstacle's or a lucky find's.
function encounterCues(
  data: StepData,
  events: readonly { readonly encounter: EncounterId }[],
): SoundCue[] {
  return events.map(({ encounter }) => hitCue(data.encounters[encounter].kind, encounter));
}

const STEP_CUES: Readonly<Record<keyof WalkStep, CuesOf>> = {
  // A plain or moving bump that landed (a Spotlight bump and one Second chance forgives
  // included), or one its dog dodged.
  bumps: (_data, { bumps }) => bumps.map(({ dodged }): SoundCue => (dodged ? "dodge" : "bump")),
  // A card plays cardOpen as it shows; its obstacle's hit plays from encounterHits.
  cards: NONE,
  // Each pickup plays from its own list: tips, treats or found.
  collected: NONE,
  contacts: (data, { contacts }) => encounterCues(data, contacts),
  encounterHits: (data, { encounterHits }) => encounterCues(data, encounterHits),
  // A firing plays as its owner leaves (RunMoments), whatever fired them.
  fired: NONE,
  // A gear drop grabbed, fresh or swapping the found item.
  found: (_data, { found }) => found.map((): SoundCue => "gearFound"),
  instants: (data, { instants }) => encounterCues(data, instants),
  // A value a modifier changed pops over the event that changed it, which plays its own cue.
  modified: NONE,
  // A spare treat given back plays as it flies to its dog (RunMoments), whatever spent it.
  spareTreat: NONE,
  // A tip, a Stinky one included.
  tips: (_data, { tips }) => tips.map((): SoundCue => "tip"),
  // A treat to an owner, or stored as a spare treat.
  treats: (_data, { treats }) => treats.map((): SoundCue => "treat"),
  walk: NONE,
  zoneEnded: NONE,
};

export function stepCues(data: StepData, step: WalkStep): SoundCue[] {
  return Object.values(STEP_CUES).flatMap((cues) => cues(data, step));
}

const PULL_CUES: Readonly<Record<keyof PullStep, (step: PullStep) => readonly SoundCue[]>> = {
  // A strain that ends without a pull shows over its dog and plays nothing.
  failed: NONE,
  // A squirrel under Good leash draws no strain, so nothing to hear.
  leashed: NONE,
  // A pull that moved the pack a lane; one that could not move it plays nothing.
  pulled: ({ pulled }) => pulled.flatMap(({ moved }): SoundCue[] => (moved ? ["pull"] : [])),
  pulls: NONE,
  // A dog spots a squirrel and starts straining toward it, a moment before its pull.
  tells: ({ tells }) => tells.map((): SoundCue => "bark"),
  walk: NONE,
};

export function pullCues(step: PullStep): SoundCue[] {
  return Object.values(PULL_CUES).flatMap((cues) => cues(step));
}

// A card choice that costs any owner a heart, after what buffs forgave, plays the loss once.
export function choiceCues(changes: readonly Change[]): SoundCue[] {
  const lost = changes.some((change) => change.kind === "hearts" && changeAmount(change) < 0);
  return lost ? ["heartLost"] : [];
}
