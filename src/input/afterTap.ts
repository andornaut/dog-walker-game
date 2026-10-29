// What a scene's tap gate reads from the scene.
export interface TapBurstWatch {
  // Calls ended once, later, when the scene's running tap burst ends, completed or torn down,
  // and returns true; returns false, calling nothing, while no burst runs.
  awaitBurst(ended: () => void): boolean;
  // Whether the scene has kept running since the wait began: not paused, slept or shut down.
  stayed(): boolean;
}

export type TapGateOutcome = "dropped" | "opened" | "waiting";

export type TapGate = (watch: TapBurstWatch, open: () => void) => TapGateOutcome;

// One scene's gate for what a tap opens over it: open runs at once while no tap burst runs,
// else once the burst ends, and only if the scene has kept running meanwhile. While one open
// waits, another is dropped, so a second tap never queues a second card or overlay.
export function tapGate(): TapGate {
  let waiting = false;
  return (watch, open) => {
    if (waiting) {
      return "dropped";
    }
    waiting = watch.awaitBurst(() => {
      waiting = false;
      if (watch.stayed()) {
        open();
      }
    });
    if (waiting) {
      return "waiting";
    }
    open();
    return "opened";
  };
}
