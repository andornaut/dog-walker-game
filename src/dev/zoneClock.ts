// Where a zone's wall-clock time went. roadMs is simulated time with the road moving, heldMs
// simulated time in a hit stop or a firing plus wall-clock time under a card or the pause
// menu. What is left of wallMs is time the fixed-step loop fell behind.
export interface ZoneClock {
  readonly heldMs: number;
  readonly roadMs: number;
  readonly wallMs: number;
  readonly zoneIndex: number;
}

// The current zone's clock, and the previous zone's as it ended.
export interface ZoneClocks {
  readonly current: ZoneClock;
  readonly last: ZoneClock | null;
}

// One frame. frameMs is its wall-clock time; roadMs and stoppedMs the simulated time it
// stepped with the road moving and standing still in a hit stop; halted whether a card or the
// pause menu held the walk as it began. zoneIndex is the zone as it began, so the frame that
// ends a zone counts toward that zone.
export interface ClockFrame {
  readonly frameMs: number;
  readonly halted: boolean;
  readonly roadMs: number;
  readonly stoppedMs: number;
  readonly zoneIndex: number;
}

function emptyClock(zoneIndex: number): ZoneClock {
  return { heldMs: 0, roadMs: 0, wallMs: 0, zoneIndex };
}

export function startZoneClocks(zoneIndex: number): ZoneClocks {
  return { current: emptyClock(zoneIndex), last: null };
}

// A frame in another zone than the current clock's closes that clock as the last zone's.
export function tickZoneClocks(frame: ClockFrame, clocks: ZoneClocks): ZoneClocks {
  const changed = frame.zoneIndex !== clocks.current.zoneIndex;
  const clock = changed ? emptyClock(frame.zoneIndex) : clocks.current;
  return {
    current: {
      heldMs: clock.heldMs + frame.stoppedMs + (frame.halted ? frame.frameMs : 0),
      roadMs: clock.roadMs + frame.roadMs,
      wallMs: clock.wallMs + frame.frameMs,
      zoneIndex: clock.zoneIndex,
    },
    last: changed ? clocks.current : clocks.last,
  };
}

// Wall-clock time neither on the road nor held: the loop running behind real time.
export function lagMs(clock: ZoneClock): number {
  return Math.max(0, clock.wallMs - clock.roadMs - clock.heldMs);
}

// The road time a whole zone takes at speed, in pixels per second.
export function expectedRoadMs(zoneLength: number, speed: number): number {
  return speed > 0 ? (zoneLength / speed) * 1000 : Infinity;
}
