import type { DebuffId, DogId, Effect, GameData, ZoneId } from "../data/types";
import type { Choice } from "../rules/choices";
import { encounterLook } from "../rules/skins";
import { packDogs } from "../state/pack";
import type { CardSource, RunState } from "../state/runState";

// What a dog shows as a status: each debuff, shown on the dogs the card
// that applied it affected.
export type DogStatusId = DebuffId;

// A status a card's outcome put on a dog, at startMs of run time in zone zoneIndex. art is the
// statusArt of the encounter's skin that started it, drawn in place of the status's overlay.
export interface StatusMark {
  readonly art?: string;
  readonly dog: DogId;
  readonly startMs: number;
  readonly status: DogStatusId;
  readonly zoneIndex: number;
}

export type StatusData = Pick<GameData, "encounters">;

// The effects of the option chosen on an encounter's card; none for a fork.
function optionEffects(data: StatusData, source: CardSource, option: number): readonly Effect[] {
  if (source.kind !== "encounter") {
    return [];
  }
  const { resolution } = data.encounters[source.encounter];
  return resolution.kind === "card" ? (resolution.options[option]?.effects ?? []) : [];
}

function startedBy(data: StatusData, source: CardSource, option: number): DogStatusId[] {
  return optionEffects(data, source, option).flatMap((effect) =>
    effect.kind === "debuff" ? [effect.debuff] : [],
  );
}

// The marks after a card's choice: each status the chosen option starts is put on every dog the
// card affected, replacing that dog's earlier mark for it, with the art of the encounter's skin
// in the zone when it names one. Skip starts nothing, and marks from earlier zones are dropped.
export function startStatuses(
  data: StatusData,
  card: { readonly affected: readonly DogId[]; readonly source: CardSource },
  at: { readonly timeMs: number; readonly zone: ZoneId; readonly zoneIndex: number },
  choice: Choice,
  marks: readonly StatusMark[],
): StatusMark[] {
  const statuses = choice === "skip" ? [] : startedBy(data, card.source, choice);
  const { source } = card;
  const art =
    source.kind === "encounter" ? encounterLook(data, at.zone, source.encounter).statusArt : null;
  const started = statuses.flatMap((status) =>
    card.affected.map((dog): StatusMark => ({
      ...(art === null ? {} : { art }),
      dog,
      startMs: at.timeMs,
      status,
      zoneIndex: at.zoneIndex,
    })),
  );
  const kept = (mark: StatusMark) =>
    mark.zoneIndex === at.zoneIndex &&
    !started.some((next) => next.dog === mark.dog && next.status === mark.status);
  return [...marks.filter(kept), ...started];
}

// Every status ends with the zone it started in, and shows as long as the pack has its debuff.
// Fired dogs show nothing. Newest first: marks are kept in the order they started, so of two
// started at the same time, the later card's comes first.
export function activeStatuses(
  run: Pick<RunState, "debuffs" | "pack" | "zoneIndex">,
  marks: readonly StatusMark[],
): StatusMark[] {
  const walking = packDogs(run);
  const held = new Set<DogStatusId>(run.debuffs.map(({ debuff }) => debuff));
  return [...marks]
    .reverse()
    .filter(
      (mark) =>
        walking.includes(mark.dog) && mark.zoneIndex === run.zoneIndex && held.has(mark.status),
    )
    .sort((a, b) => b.startMs - a.startMs);
}

// A dog's active statuses, newest first.
export function statusesOf(active: readonly StatusMark[], dog: DogId): DogStatusId[] {
  return active.filter((mark) => mark.dog === dog).map((mark) => mark.status);
}

// A key for the active statuses, so a scene redraws only when they change.
export function statusesKey(active: readonly StatusMark[]): string {
  return active.map((mark) => `${mark.dog}:${mark.status}`).join();
}
