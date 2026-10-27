// Independent checks of the spawn planner, for tests; they share no code with it.
// lanesReachedAtEnd checks that the lane-blocking spawns can be steered around from a lane. It
// walks the zone a pixel of scroll at a time: the pack may stay in a lane, or take a lane move
// that lasts laneMoveSeconds and spans both lanes while it lasts, and is caught by any span it
// overlaps. pathShortfalls checks that a pack following a zone's guaranteed path passes every
// lane-blocking spawn with full margins.

// A lane-blocking spawn: lanes lane to lane + laneSpan - 1, overlapping the pack from distance
// to distance + length (the hit box's length plus the pack's).
export interface BlockingSpan {
  distance: number;
  lane: number;
  laneSpan: number;
  length: number;
}

interface Walkway {
  laneCount: number;
  laneMoveSeconds: number;
  scrollSpeed: number;
  zoneLength: number;
}

// A lane-blocking spawn as the pack meets it: the lanes it covers, the distance at which its hit
// box first overlaps the pack's, and the far edge of the road behind it that the pack cannot step
// into while it passes: its hit box's far edge, or a mover's contact end less the pack's length.
export interface Contact {
  end: number;
  label: string;
  lanes: ReadonlySet<number>;
  start: number;
}

// A row of a guaranteed path: the row's distance and the lane the path holds on it.
interface PathPoint {
  distance: number;
  lane: number;
}

// What keeps a pack that follows the path from passing every contact with full margins, as
// messages, empty when nothing does. The pack holds each row's lane from halfway after the row
// before to halfway before the next, and no contact may overlap its hit boxes, packLength long,
// in that lane then. Where the path changes lane between two rows, take any contact met before
// halfway between them and any met after: as the nearer one passes, the pack is still short of
// the first lane on its way that the nearer one covers; as the farther one meets it, it is past
// the last lane on its way that the farther one covers. The road between them is at least
// gap(moves) for the lane moves that leaves.
export function pathShortfalls(
  packLength: number,
  gap: (moves: number) => number,
  path: readonly PathPoint[],
  contacts: readonly Contact[],
): string[] {
  const halfway = (row: number) => {
    const here = path[row];
    const next = path[row + 1];
    if (here === undefined) {
      return Number.NEGATIVE_INFINITY;
    }
    return next === undefined ? Number.POSITIVE_INFINITY : (here.distance + next.distance) / 2;
  };
  const shortfalls: string[] = [];
  path.forEach(({ distance, lane }, row) => {
    const [from, to] = [halfway(row - 1), halfway(row)];
    for (const contact of contacts) {
      if (contact.lanes.has(lane) && contact.start < to && contact.end + packLength > from) {
        shortfalls.push(`${contact.label} in the path's lane ${lane} on the row at ${distance}`);
      }
    }
    const next = path[row + 1];
    if (next === undefined || next.lane === lane) {
      return;
    }
    // The lanes on the way, in the order the pack crosses them.
    const way = Array.from({ length: Math.abs(next.lane - lane) + 1 }, (_, i) =>
      next.lane > lane ? lane + i : lane - i,
    );
    const at = halfway(row);
    for (const near of contacts.filter(({ start }) => start < at)) {
      const first = way.findIndex((onWay, i) => i > 0 && near.lanes.has(onWay));
      if (first < 0) {
        continue;
      }
      for (const far of contacts.filter(({ start }) => start >= at)) {
        const last = Math.max(
          -1,
          ...way.slice(0, -1).flatMap((onWay, i) => (far.lanes.has(onWay) ? [i] : [])),
        );
        const moves = last - first + 2;
        if (last >= 0 && moves > 0 && far.start - near.end < gap(moves)) {
          shortfalls.push(
            `${near.label} then ${far.label}: ${far.start - near.end} of road for ${moves} moves`,
          );
        }
      }
    }
  });
  return shortfalls;
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
