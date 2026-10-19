// An independent check that every lane-blocking spawn can be steered around, for tests. It
// walks the zone a pixel of scroll at a time: the pack may stay in a lane, or take a lane move
// that lasts laneMoveSeconds and spans both lanes while it lasts, and is caught by any span it
// overlaps. It shares no code with the spawn planner.

// A lane-blocking spawn: lanes lane to lane + laneSpan - 1, overlapping the pack from distance
// to distance + length (the hit box's length plus the pack's).
export interface BlockingSpan {
  distance: number;
  lane: number;
  laneSpan: number;
  length: number;
}

export interface Walkway {
  laneCount: number;
  laneMoveSeconds: number;
  scrollSpeed: number;
  zoneLength: number;
}

// The lanes the pack can be in at the end of the zone, starting in startLane.
export function lanesReachedAtEnd(
  walkway: Walkway,
  spans: readonly BlockingSpan[],
  startLane: number,
): number[] {
  const { laneCount, zoneLength } = walkway;
  const ticks = Math.ceil(zoneLength);
  // blockedBefore[lane][t]: how many of the ticks 0..t-1 are blocked in lane.
  const blockedBefore = Array.from({ length: laneCount }, (_, lane) => {
    const blocked = new Uint8Array(ticks + 1);
    for (const span of spans) {
      if (lane < span.lane || lane >= span.lane + span.laneSpan) {
        continue;
      }
      const first = Math.max(0, Math.floor(span.distance));
      const last = Math.min(ticks, Math.ceil(span.distance + span.length));
      blocked.fill(1, first, last + 1);
    }
    const before = new Uint32Array(ticks + 2);
    for (let t = 0; t <= ticks; t++) {
      before[t + 1] = (before[t] ?? 0) + (blocked[t] ?? 0);
    }
    return before;
  });
  const clear = (lane: number, from: number, to: number) => {
    const before = blockedBefore[lane];
    return before !== undefined && (before[to + 1] ?? 0) - (before[from] ?? 0) === 0;
  };

  const moveTicks = Math.max(1, Math.ceil(walkway.scrollSpeed * walkway.laneMoveSeconds));
  const arrivals = new Map<number, Set<number>>();
  let still = new Set<number>([startLane]);
  for (let t = 0; t < ticks; t++) {
    const next = arrivals.get(t + 1) ?? new Set<number>();
    arrivals.delete(t + 1);
    for (const lane of still) {
      if (clear(lane, t + 1, t + 1)) {
        next.add(lane);
      }
      for (const target of [lane - 1, lane + 1]) {
        const end = t + moveTicks;
        if (target >= 0 && target < laneCount && end <= ticks) {
          if (clear(lane, t, end) && clear(target, t, end)) {
            const landing = arrivals.get(end) ?? new Set<number>();
            landing.add(target);
            arrivals.set(end, landing);
          }
        }
      }
    }
    still = next;
  }
  return [...still].sort((a, b) => a - b);
}
