// The sounds a walk step's bumps and pickups play: one cue per event. Every field of the step is
// named here, so a new kind of event does not compile until it has a cue or a stated reason to
// play none.

import type { EncounterId, GameData } from "../data/types";
import type { WalkStep } from "../runner/walk";
import { hitCue, type SoundCue } from "./sound";

type StepData = Pick<GameData, "encounters">;
type CuesOf = (data: StepData, step: WalkStep) => readonly SoundCue[];

const NONE: CuesOf = () => [];

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
