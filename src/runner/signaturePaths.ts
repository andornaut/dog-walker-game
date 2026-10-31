import { easeProgress, type Easing, type Point, progressAt } from "@andornaut/game-kit/motion";

import type { MoveCount, SignatureProfile } from "../data/types";

export interface SignatureGeometry {
  readonly cellLength: number;
  readonly laneCount: number;
  readonly scrollSpeed: number;
  readonly sightLength: number;
}

// X is the leftmost lane centre; Y is road travel. Progress is cumulative road scroll.
export interface SignatureLeg {
  readonly at: number;
  readonly easing: Easing;
  readonly from: Point;
  readonly length: number;
  readonly to: Point;
}

export interface SignatureCue {
  readonly end: number;
  readonly start: number;
}

export interface SignaturePath {
  readonly complete: number;
  readonly componentDelays: readonly number[];
  readonly cues: readonly SignatureCue[];
  readonly entryEnd: number;
  readonly legs: readonly SignatureLeg[];
  readonly profile: SignatureProfile;
  readonly scrollSpeed: number;
  readonly tail: Point;
}

export interface SignatureSweep {
  readonly component: number;
  readonly end: number;
  readonly from: Point;
  readonly start: number;
  readonly to: Point;
}

const positive = (value: number) => Number.isFinite(value) && value > 0;

function validCount(range: MoveCount, min: number, max: number): boolean {
  return (
    Number.isInteger(range.min) &&
    Number.isInteger(range.max) &&
    range.min >= min &&
    range.max >= range.min &&
    range.max <= max
  );
}

// Invalid definitions fail before planning; lack of geometric room rejects only a candidate.
export function validateSignature(profile: SignatureProfile): void {
  let valid = positive(profile.finishAheadSeconds) && positive(profile.warningSeconds);
  switch (profile.kind) {
    case "alternatingArcs":
      valid &&=
        profile.laneStep === 1 &&
        validCount(profile.arcs, 2, 3) &&
        positive(profile.arcSeconds) &&
        positive(profile.downFactor);
      break;
    case "delayedTrail":
      valid &&=
        profile.laneStep === 1 &&
        validCount(profile.bends, 2, 3) &&
        positive(profile.bendSeconds) &&
        positive(profile.downFactor) &&
        positive(profile.straightSeconds) &&
        profile.followerDelays.length === 2 &&
        positive(profile.followerDelays[0]) &&
        profile.followerDelays[1] > profile.followerDelays[0] &&
        positive(profile.followerDelays[1]) &&
        positive(profile.frame.width) &&
        positive(profile.frame.height) &&
        Number.isFinite(profile.anchor.x) &&
        Number.isFinite(profile.anchor.y) &&
        profile.spriteKey.length > 0;
      break;
    case "rectangle":
      valid &&= profile.lanes === 1 && profile.rows === 1 && positive(profile.legSeconds);
      break;
    case "reflectingDiagonal":
      valid &&=
        validCount(profile.reflections, 1, Number.MAX_SAFE_INTEGER) &&
        positive(profile.lanesPerSecond) &&
        positive(profile.downFactor);
      break;
    case "successiveMerges":
      valid &&=
        profile.count === 2 &&
        profile.laneStep === 1 &&
        positive(profile.downFactor) &&
        positive(profile.mergeSeconds) &&
        positive(profile.straightSeconds) &&
        profile.straightSeconds >= profile.warningSeconds;
      break;
    case "turnExit":
      valid &&=
        profile.rows === 1 && positive(profile.downSeconds) && positive(profile.lanesPerSecond);
      break;
  }
  if (!valid) {
    throw new Error(`Invalid signature profile ${profile.kind}`);
  }
}

function countAt(range: MoveCount, draw: number): number {
  return Math.min(range.max, range.min + Math.floor(draw * (range.max - range.min + 1)));
}

// The whole group pauses during entry, including its walking-time history and animation phases.
export function signatureMotionProgress(path: SignaturePath, since: number): number {
  return Math.max(0, since - path.entryEnd);
}

// Walking-time history excludes the shared entry hold. Its straight pre-entry prefix stages
// followers at distinct positions and joins the first bend continuously when walking resumes.
export function signatureHistoryPlace(path: SignaturePath, progress: number): Point {
  const first = path.legs[1] ?? path.legs[0];
  const last = path.legs.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error("Missing signature route");
  }
  if (progress < 0) {
    const speed = path.profile.kind === "delayedTrail" ? path.profile.downFactor : 1;
    return { x: first.from.x, y: first.from.y + progress * speed };
  }
  const position = path.entryEnd + progress;
  for (const leg of path.legs) {
    if (position < leg.at + leg.length) {
      const progress = progressAt(leg.at, leg.length, position);
      return {
        x: leg.from.x + (leg.to.x - leg.from.x) * easeProgress(leg.easing, progress),
        y: leg.from.y + (leg.to.y - leg.from.y) * progress,
      };
    }
  }
  const after = position - last.at - last.length;
  return {
    x: path.tail.x === 0 ? last.to.x : last.to.x + path.tail.x * after,
    y: path.tail.y === 0 ? last.to.y : last.to.y + path.tail.y * after,
  };
}

export function signatureComponentProgress(
  path: SignaturePath,
  since: number,
  component = 0,
): number {
  const delay = path.componentDelays[component];
  if (delay === undefined) {
    throw new Error("Missing signature component");
  }
  return signatureMotionProgress(path, since) - delay;
}

export function signaturePlace(path: SignaturePath, since: number, component = 0): Point {
  return signatureHistoryPlace(path, signatureComponentProgress(path, since, component));
}

export function signatureAlive(
  bounds: { readonly laneCount: number; readonly roadLength: number },
  footprint: { readonly height: number; readonly span: number },
  route: SignaturePath,
  since: number,
): boolean {
  return route.componentDelays.some((_, component) => {
    const point = signaturePlace(route, since, component);
    return (
      point.x + footprint.span - 1 >= -1 &&
      point.x <= bounds.laneCount &&
      point.y - footprint.height <= bounds.roadLength
    );
  });
}

// Split at every actual turn, including delayed turns. Within each interval both axes are
// monotone, so endpoints bound each component's continuous swept footprint without sampling.
export function signatureSweeps(path: SignaturePath, from: number, to: number): SignatureSweep[] {
  if (to < from) {
    throw new Error("Signature sweep endpoints must be ordered");
  }
  return path.componentDelays.flatMap((delay, component) => {
    const cuts = [
      from,
      ...[
        path.entryEnd,
        ...path.legs.slice(1).flatMap((leg) => [leg.at + delay, leg.at + leg.length + delay]),
      ].filter((at) => at > from && at < to),
      to,
    ];
    const ordered = [...new Set(cuts)].sort((a, b) => a - b);
    return ordered.slice(1).map((end, index) => {
      const start = ordered[index] ?? from;
      return {
        component,
        end,
        from: signaturePlace(path, start, component),
        start,
        to: signaturePlace(path, end, component),
      };
    });
  });
}

// The component intervals inside a road-travel band. All defining legs and delayed legs
// precede complete; afterward each component has the same constant tail velocity.
export function signatureTravelSweeps(
  path: SignaturePath,
  from: number,
  to: number,
): SignatureSweep[] {
  const low = Math.min(
    ...path.componentDelays.map((_, index) => signaturePlace(path, path.complete, index).y),
  );
  const end = path.complete + (path.tail.y > 0 ? Math.max(0, to - low) / path.tail.y : 0);
  return signatureSweeps(path, 0, end).flatMap((sweep) => {
    const dy = sweep.to.y - sweep.from.y;
    if (dy === 0) {
      return sweep.from.y >= from && sweep.from.y < to ? [sweep] : [];
    }
    const fractions = [(from - sweep.from.y) / dy, (to - sweep.from.y) / dy].sort((a, b) => a - b);
    const startShare = Math.max(0, fractions[0] ?? 0);
    const endShare = Math.min(1, fractions[1] ?? 1);
    if (startShare >= endShare) {
      return [];
    }
    const start = sweep.start + (sweep.end - sweep.start) * startShare;
    const finish = sweep.start + (sweep.end - sweep.start) * endShare;
    return [
      {
        component: sweep.component,
        end: finish,
        from: signaturePlace(path, start, sweep.component),
        start,
        to: signaturePlace(path, finish, sweep.component),
      },
    ];
  });
}

// After the complete route, every component has this constant vertical velocity per unit
// of scroll. Zero or reversing tails cannot newly reach the pack from above its contact bound.
export function signatureFinishClearance(
  scrollSpeed: number,
  finishAheadSeconds: number,
  tailY: number,
): number {
  return finishAheadSeconds * scrollSpeed * Math.max(0, tailY);
}

export function compileSignature(
  geometry: SignatureGeometry,
  profile: SignatureProfile,
  draw: { readonly count: number; readonly direction: -1 | 1 },
  origin: {
    readonly at: number;
    readonly lane: number;
    readonly span: number;
    readonly travel: number;
  },
): SignaturePath | null {
  validateSignature(profile);
  const { cellLength, laneCount, scrollSpeed, sightLength } = geometry;
  const { direction } = draw;
  const warning = profile.warningSeconds * scrollSpeed;
  const legs: SignatureLeg[] = [];
  const cues: SignatureCue[] = [];
  let at = origin.at;
  let point: Point = { x: origin.lane, y: origin.travel };
  let tail: Point = { x: 0, y: 1 };
  legs.push({ at: 0, easing: "linear", from: point, length: origin.at, to: point });
  const add = (length: number, to: Point, cue: boolean, easing: Easing = "linear") => {
    if (cue) {
      cues.push({ end: at, start: at - warning });
    }
    legs.push({ at, easing, from: point, length, to });
    at += length;
    point = to;
  };
  const move = (seconds: number, dx: number, dy: number, cue: boolean, easing: Easing = "linear") =>
    add(seconds * scrollSpeed, { x: point.x + dx, y: point.y + dy }, cue, easing);
  switch (profile.kind) {
    case "rectangle":
      move(profile.legSeconds, direction * profile.lanes, 0, true);
      move(profile.legSeconds, 0, profile.rows * cellLength, true);
      move(profile.legSeconds, -direction * profile.lanes, 0, true);
      move(profile.legSeconds, 0, -profile.rows * cellLength, true);
      break;
    case "turnExit": {
      move(profile.downSeconds, 0, profile.rows * cellLength, true);
      const edge = direction < 0 ? -origin.span : laneCount;
      const dx = edge - point.x;
      move(Math.abs(dx) / profile.lanesPerSecond, dx, 0, true);
      tail = { x: (direction * profile.lanesPerSecond) / scrollSpeed, y: 0 };
      break;
    }
    case "delayedTrail":
    case "alternatingArcs": {
      const trail = profile.kind === "delayedTrail";
      const count = countAt(trail ? profile.bends : profile.arcs, draw.count);
      const seconds = trail ? profile.bendSeconds : profile.arcSeconds;
      const down = profile.downFactor;
      for (let index = 0; index < count; index++) {
        move(
          seconds,
          (index % 2 === 0 ? direction : -direction) * profile.laneStep,
          seconds * scrollSpeed * down,
          index === 0 || trail,
          "sineInOut",
        );
        if (trail && index + 1 < count) {
          move(profile.straightSeconds, 0, profile.straightSeconds * scrollSpeed * down, false);
        }
      }
      tail = { x: 0, y: down };
      break;
    }
    case "reflectingDiagonal": {
      const reflections = countAt(profile.reflections, draw.count);
      let heading = direction;
      for (let index = 0; index <= reflections; index++) {
        const edge = heading < 0 ? 0 : laneCount - origin.span;
        const dx = edge - point.x;
        if (dx === 0) {
          return null;
        }
        const seconds = Math.abs(dx) / profile.lanesPerSecond;
        move(seconds, dx, seconds * scrollSpeed * profile.downFactor, index === 0);
        if (index < reflections) {
          heading = heading === 1 ? -1 : 1;
        }
      }
      tail = { x: (heading * profile.lanesPerSecond) / scrollSpeed, y: profile.downFactor };
      break;
    }
    case "successiveMerges":
      for (let index = 0; index < profile.count; index++) {
        move(
          profile.mergeSeconds,
          direction * profile.laneStep,
          profile.mergeSeconds * scrollSpeed * profile.downFactor,
          true,
        );
        if (index + 1 < profile.count) {
          move(
            profile.straightSeconds,
            0,
            profile.straightSeconds * scrollSpeed * profile.downFactor,
            false,
          );
        }
      }
      tail = { x: 0, y: profile.downFactor };
      break;
  }
  const componentDelays =
    profile.kind === "delayedTrail"
      ? [0, ...profile.followerDelays.map((seconds) => seconds * scrollSpeed)]
      : [0];
  const complete = at + Math.max(...componentDelays);
  const path: SignaturePath = {
    complete,
    componentDelays,
    cues,
    entryEnd: origin.at,
    legs,
    profile,
    scrollSpeed,
    tail,
  };
  const clearance = signatureFinishClearance(scrollSpeed, profile.finishAheadSeconds, tail.y);
  const points = signatureSweeps(path, origin.at, complete).flatMap((sweep) => [
    sweep.from,
    sweep.to,
  ]);
  const onRoad = profile.kind !== "turnExit" && profile.kind !== "reflectingDiagonal";
  if (
    points.some(
      ({ x, y }) =>
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        y > sightLength - clearance ||
        (onRoad && (x < 0 || x + origin.span > laneCount)),
    )
  ) {
    return null;
  }
  return path;
}
