import {
  laneAt,
  type MoverPath,
  type RoadPoint,
  staysInReach,
  type StepShape,
  stepsTaken,
  takeMove,
} from "./movers";

// A shy hopper hops away from the pack as the pack draws near. Its first hop is chosen as its cue
// begins, and each later one, with no cue, as it starts, from where the pack is then: of the hops
// it may make, within the lanes and rows the planner left it, those that end no nearer the pack's
// centre across the road and in neither the pack's lane nor a lane it is moving into; of them,
// the one that ends farthest from the pack, the first of them in its shapes on a tie. With none,
// it makes no more hops. A hop that would start once the hopper has reached the pack's rows, and
// every hop after it, is dropped instead.

export type ShyPath = Extract<MoverPath, { motion: "shy" }>;

// The scroll since it spawned at which its next pending hop is chosen: the first as its cue
// begins, a later one as it starts. null with none.
export function nextShyChoiceAt(path: ShyPath): number | null {
  const [at] = path.pending;
  if (at === undefined) {
    return null;
  }
  return path.steps.length === 0 ? at - path.warning : at;
}

// The hops it may make next: those that keep it within its lanes and rows. None once its next
// hop would start at or past its stop travel, or with no hop pending.
export function shyChoices(path: ShyPath): StepShape[] {
  const [at] = path.pending;
  const { lanes, rows } = stepsTaken(path);
  if (at === undefined || at + rows * path.burst >= path.stopTravel) {
    return [];
  }
  const lane = path.lane + lanes;
  return path.shapes.filter(
    (shape) => staysInReach(path.reach, lane, shape) && rows + shape.travel >= -path.rise,
  );
}

// The path with its next pending hop taken as shape, or, with no shape, with every pending hop
// dropped.
export function takeHop(path: ShyPath, shape: StepShape | null): ShyPath {
  const [at] = path.pending;
  if (at === undefined) {
    return path;
  }
  if (shape === null) {
    return { ...path, pending: [] };
  }
  return takeMove(at, path.steps.length > 0, shape, path);
}

// Where the pack is as a hop is chosen: its centre, and the lanes it is in or moving into.
export interface PackPlace extends RoadPoint {
  readonly lanes: readonly number[];
}

// The hop away from the pack: centre is the hopper's centre now, and a hop moves it a cell per
// lane across and burst per row along the road.
export function awayHop(
  cellLength: number,
  centre: RoadPoint,
  pack: PackPlace,
  choices: readonly StepShape[],
  burst: number,
): StepShape | null {
  const across = Math.abs(centre.x - pack.x);
  let best: { readonly distance: number; readonly shape: StepShape } | null = null;
  for (const shape of choices) {
    const x = centre.x + shape.lanes * cellLength;
    const lane = laneAt(x / cellLength - 0.5);
    if (pack.lanes.includes(lane) || Math.abs(x - pack.x) < across) {
      continue;
    }
    const dy = centre.y + shape.travel * burst - pack.y;
    const distance = (x - pack.x) ** 2 + dy * dy;
    if (best === null || distance > best.distance) {
      best = { distance, shape };
    }
  }
  return best?.shape ?? null;
}

// Every path the hopper may yet take, wherever the pack is: each choice of each pending hop, or
// no more hops, where the pack leaves it none that move away.
export function shyOutcomes(path: ShyPath): ShyPath[] {
  if (path.pending.length === 0) {
    return [path];
  }
  return [
    takeHop(path, null),
    ...shyChoices(path).flatMap((shape) => shyOutcomes(takeHop(path, shape))),
  ];
}
