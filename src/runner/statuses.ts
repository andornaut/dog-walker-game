import type { DogId, EncounterId, GameData } from "../data/types";
import { type ScaleStep, snapScale } from "../layout/projection";
import type { Choice } from "../rules/choices";
import { packDogs } from "../state/pack";
import type { CardSource, RunState } from "../state/runState";

// What a dog shows over its head on the road and as an icon on its doghouse slot. Stinky is the
// rules' debuff, shown on the dogs the skunk caught; Soaked and Spooked are visual only.
export type DogStatusId = "soaked" | "spooked" | "stinky";

// A status a card's outcome put on a dog, at startMs of run time in zone zoneIndex.
export interface StatusMark {
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
  status: Exclude<DogStatusId, "stinky">;
}[] = [
  // Splash through.
  { encounter: "puddle", options: [0], status: "soaked" },
  { encounter: "thief", options: "any", status: "spooked" },
];

export type StatusData = Pick<GameData, "encounters">;

function startedBy(data: StatusData, source: CardSource, option: number): DogStatusId[] {
  if (source.kind !== "encounter") {
    return [];
  }
  const { resolution } = data.encounters[source.encounter];
  const effects = resolution.kind === "card" ? (resolution.options[option]?.effects ?? []) : [];
  const stinky = effects.some((effect) => effect.kind === "debuff" && effect.debuff === "stinky");
  const visual = VISUAL_STATUSES.filter(
    (entry) =>
      entry.encounter === source.encounter &&
      (entry.options === "any" || entry.options.includes(option)),
  ).map((entry) => entry.status);
  return stinky ? ["stinky", ...visual] : visual;
}

// The marks after a card's choice: each status the chosen option starts is put on every dog the
// card affected, replacing that dog's earlier mark for it. Skip starts nothing, and marks from
// earlier zones are dropped.
export function startStatuses(
  data: StatusData,
  card: { readonly affected: readonly DogId[]; readonly source: CardSource },
  at: { readonly timeMs: number; readonly zoneIndex: number },
  choice: Choice,
  marks: readonly StatusMark[],
): StatusMark[] {
  const statuses = choice === "skip" ? [] : startedBy(data, card.source, choice);
  const started = statuses.flatMap((status) =>
    card.affected.map((dog): StatusMark => ({
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

// Every status ends with the zone it started in. Stinky lasts as long as the pack has the
// debuff; Soaked and Spooked show for visibleSeconds of run time. Fired dogs show nothing.
// Newest first: marks are kept in the order they started, so of two started at the same
// time, the later card's comes first.
export function activeStatuses(
  visibleSeconds: number,
  run: Pick<RunState, "debuffs" | "pack" | "zoneIndex">,
  timeMs: number,
  marks: readonly StatusMark[],
): StatusMark[] {
  const walking = packDogs(run);
  const stinky = run.debuffs.some(({ debuff }) => debuff === "stinky");
  return [...marks]
    .reverse()
    .filter(
      (mark) =>
        walking.includes(mark.dog) &&
        mark.zoneIndex === run.zoneIndex &&
        (mark.status === "stinky" ? stinky : timeMs - mark.startMs < visibleSeconds * 1000),
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
): DogStatusId | undefined {
  const marks = active.filter((mark) => mark.dog === dog);
  const newest = marks[0];
  if (newest === undefined) {
    return undefined;
  }
  const turn = Math.floor(Math.max(0, timeMs - newest.startMs) / 1000) % marks.length;
  return marks[turn]?.status;
}

// A key for the active statuses, so a scene redraws only when they change.
export function statusesKey(active: readonly StatusMark[]): string {
  return active.map((mark) => `${mark.dog}:${mark.status}`).join();
}

// The loop drawn over a dog with the status, before picking its depth variant.
export function statusOverlayKey(status: DogStatusId): string {
  return `fx-status-${status}`;
}

// The depth step a dog shows at: its sprite's variant (dog-koda@75 is 0.75) times the scale
// it is drawn at. Its status loop is drawn at the same step.
export function dogDepthStep(dogKey: string, scale: number): ScaleStep {
  const percent = /@(\d+)$/.exec(dogKey)?.[1];
  return snapScale((percent === undefined ? 1 : Number(percent) / 100) * scale);
}

// How far below the dog's top opaque row, in screen pixels, a status loop's bottom-centre sits
// at each depth step, so its lower rows overlap the head.
export const STATUS_OVERLAY_LIFT: Readonly<Record<ScaleStep, number>> = {
  0.5: 3,
  0.75: 4,
  1: 6,
};
