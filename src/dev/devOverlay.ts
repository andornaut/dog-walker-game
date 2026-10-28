import type { Cents } from "../lib/units";
import { formatDollars } from "../rules/effectText";
import type { RunSetup } from "./runSetup";
import { lagMs, type ZoneClock, type ZoneClocks } from "./zoneClock";

// Emitted on game.events with a DevState by whichever scene runs the road.
export const DEV_STATE_EVENT = "dev-state";

// The slice of a run the overlay shows. RunState fits it as it is.
interface DevRunView {
  readonly money: Cents;
  readonly pack: readonly (
    | { readonly dog: string; readonly hearts: number; readonly status: "walking" }
    | { readonly dog: string; readonly status: "fired" }
  )[];
}

export interface DevState {
  readonly run?: DevRunView;
  // Pixels per second, after the setup's speed multiplier.
  readonly scrollSpeed: number;
  readonly setup: RunSetup;
  // The zone's wall-clock breakdown, and the road time the whole zone takes at scrollSpeed.
  readonly time?: { readonly clocks: ZoneClocks; readonly expectedRoadMs: number };
  readonly zoneDistance: number;
  // 0-based, as RunState counts it.
  readonly zoneIndex: number;
}

function secondsText(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function clockLines(expectedRoadMs: number, current: ZoneClock, last: ZoneClock | null): string[] {
  const lines = [
    `road ${secondsText(current.roadMs)} of ${secondsText(expectedRoadMs)}`,
    `held ${secondsText(current.heldMs)}  wall ${secondsText(current.wallMs)}`,
    `lag ${secondsText(lagMs(current))}`,
  ];
  if (last !== null) {
    lines.push(
      `zone ${last.zoneIndex + 1} wall ${secondsText(last.wallMs)}`,
      ` road ${secondsText(last.roadMs)} held ${secondsText(last.heldMs)}`,
    );
  }
  return lines;
}

// The overlay's lines. status is a transient message, such as the result of copying the link.
export function devOverlayLines(
  fps: number,
  status: string | undefined,
  setup: RunSetup,
  state: DevState | undefined,
): string[] {
  const lines = [`seed ${setup.seed}  fps ${Math.round(fps)}`];
  if (state !== undefined) {
    lines.push(
      `zone ${state.zoneIndex + 1}  ${Math.floor(state.zoneDistance)}px`,
      `speed ${Math.round(state.scrollSpeed)}px/s x${setup.speed}`,
    );
    if (state.time !== undefined) {
      const { clocks, expectedRoadMs } = state.time;
      lines.push(...clockLines(expectedRoadMs, clocks.current, clocks.last));
    }
    if (state.run !== undefined) {
      lines.push(`money ${formatDollars(state.run.money)}`);
      for (const slot of state.run.pack) {
        lines.push(`${slot.dog} ${slot.status === "walking" ? `${slot.hearts}hp` : "fired"}`);
      }
    }
  }
  if (status !== undefined) {
    lines.push(status);
  }
  return lines;
}
