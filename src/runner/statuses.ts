import { splitDepthKey } from "../assets/depthSteps";
import { kebabCase } from "../assets/spriteKeys";
import type { DebuffId, DogId, Effect, EncounterId, GameData, ZoneId } from "../data/types";
import { type ScaleStep, snapScale } from "../layout/projection";
import type { Choice } from "../rules/choices";
import { encounterLook, type HasArt } from "../rules/skins";
import { packDogs } from "../state/pack";
import type { CardSource, RunState } from "../state/runState";

// What a dog shows over its head on the road and as an icon on its doghouse slot: each debuff,
// shown on the dogs the card that applied it affected, and Soaked, which is visual only.
export type DogStatusId = DebuffId | "soaked";

// A status a card's outcome put on a dog, at startMs of run time in zone zoneIndex. art is the
// statusArt of the encounter's skin that started it, drawn in place of the status's overlay.
export interface StatusMark {
  readonly art?: string;
  readonly dog: DogId;
  readonly startMs: number;
  readonly status: DogStatusId;
  readonly zoneIndex: number;
}

// The visual-only statuses, by the encounter card option that starts them on the dogs it
// affected; options "any" means every option but Skip.
const VISUAL_STATUSES: readonly {
  encounter: EncounterId;
  options: readonly number[] | "any";
  status: Exclude<DogStatusId, DebuffId>;
}[] = [
  // Splash through.
  { encounter: "puddle", options: [0], status: "soaked" },
];

export type StatusData = Pick<GameData, "encounters" | "forcedStops" | "needCards">;

// The effects of the option chosen on a card that has options in the data.
function optionEffects(data: StatusData, source: CardSource, option: number): readonly Effect[] {
  switch (source.kind) {
    case "encounter": {
      const { resolution } = data.encounters[source.encounter];
      return resolution.kind === "card" ? (resolution.options[option]?.effects ?? []) : [];
    }
    case "forcedStop":
      return data.forcedStops[source.stop].options[option]?.effects ?? [];
    case "need":
      return data.needCards[source.card].options[option]?.effects ?? [];
    default:
      return [];
  }
}

function startedBy(data: StatusData, source: CardSource, option: number): DogStatusId[] {
  const debuffs = optionEffects(data, source, option).flatMap((effect) =>
    effect.kind === "debuff" ? [effect.debuff] : [],
  );
  const visual = VISUAL_STATUSES.filter(
    (entry) =>
      source.kind === "encounter" &&
      entry.encounter === source.encounter &&
      (entry.options === "any" || entry.options.includes(option)),
  ).map((entry) => entry.status);
  return [...debuffs, ...visual];
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

// Every status ends with the zone it started in. A debuff shows as long as the pack has it;
// Soaked shows for visibleSeconds of run time. Fired dogs show nothing.
// Newest first: marks are kept in the order they started, so of two started at the same
// time, the later card's comes first.
export function activeStatuses(
  visibleSeconds: number,
  run: Pick<RunState, "debuffs" | "pack" | "zoneIndex">,
  timeMs: number,
  marks: readonly StatusMark[],
): StatusMark[] {
  const walking = packDogs(run);
  const held = new Set<DogStatusId>(run.debuffs.map(({ debuff }) => debuff));
  const shows = (status: DogStatusId, startMs: number) =>
    status === "soaked" ? timeMs - startMs < visibleSeconds * 1000 : held.has(status);
  return [...marks]
    .reverse()
    .filter(
      (mark) =>
        walking.includes(mark.dog) &&
        mark.zoneIndex === run.zoneIndex &&
        shows(mark.status, mark.startMs),
    )
    .sort((a, b) => b.startMs - a.startMs);
}

// A dog's active statuses, newest first. The doghouse slot shows as many as it has room for.
export function statusesOf(active: readonly StatusMark[], dog: DogId): DogStatusId[] {
  return active.filter((mark) => mark.dog === dog).map((mark) => mark.status);
}

// The status a dog shows on the road: with two or more, each in turn for a second, starting
// from the most recent when it starts.
export function shownStatus(
  active: readonly StatusMark[],
  timeMs: number,
  dog: DogId,
): StatusMark | undefined {
  const marks = active.filter((mark) => mark.dog === dog);
  const newest = marks[0];
  if (newest === undefined) {
    return undefined;
  }
  const turn = Math.floor(Math.max(0, timeMs - newest.startMs) / 1000) % marks.length;
  return marks[turn];
}

// A key for the active statuses, so a scene redraws only when they change.
export function statusesKey(active: readonly StatusMark[]): string {
  return active.map((mark) => `${mark.dog}:${mark.status}`).join();
}

// The loop drawn over a dog with the status, before picking its depth variant.
export function statusOverlayKey(status: DogStatusId): string {
  return `fx-status-${kebabCase(status)}`;
}

// The loop drawn for a mark: its skin's art, or the status's own while that art is missing.
export function markOverlayKey(has: HasArt, mark: StatusMark): string {
  return mark.art !== undefined && has(mark.art) ? mark.art : statusOverlayKey(mark.status);
}

// The depth step a dog shows at: its sprite's variant (dog-koda@62 is 0.625) times the scale
// it is drawn at. Its status loop is drawn at the same step.
export function dogDepthStep(dogKey: string, scale: number): ScaleStep {
  return snapScale(splitDepthKey(dogKey).step.scale * scale);
}

// How far below the dog's top opaque row, in screen pixels, a status loop's bottom-centre sits
// at a depth step, so its lower rows overlap the head: STATUS_OVERLAY_LIFT at full size, scaled
// and rounded down.
export const STATUS_OVERLAY_LIFT = 8;

export function statusOverlayLift(step: ScaleStep): number {
  return Math.floor(STATUS_OVERLAY_LIFT * step);
}
