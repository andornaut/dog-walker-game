import type { RunSetup } from "./runSetup";
import { lagMs, type ZoneClock, type ZoneClocks } from "./zoneClock";

// Emitted on game.events with a DevState by whichever scene runs the road.
export const DEV_STATE_EVENT = "dev-state";
// Emitted on game.events with the overlay's wanted visibility, to show or hide it.
export const DEV_OVERLAY_TOGGLE_EVENT = "dev-overlay-toggle";
// Game registry keys: whether the overlay shows, which the overlay scene keeps current, and
// whether the far end of the road fades into the backdrop band, which the dev panel sets.
export const DEV_OVERLAY_VISIBLE_KEY = "dev-overlay-visible";
export const DEV_ROAD_FADE_KEY = "dev-road-fade";

// The slice of a run the overlay shows. RunState fits it as it is.
export interface DevRunView {
  readonly money: number;
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

function moneyText(amountCents: number): string {
  const sign = amountCents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(amountCents) / 100).toFixed(2)}`;
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
  if (state === undefined) {
    lines.push("no dev-state yet");
  } else {
    lines.push(
      `zone ${state.zoneIndex + 1}  ${Math.floor(state.zoneDistance)}px`,
      `speed ${Math.round(state.scrollSpeed)}px/s x${setup.speed}`,
    );
    if (state.time !== undefined) {
      const { clocks, expectedRoadMs } = state.time;
      lines.push(...clockLines(expectedRoadMs, clocks.current, clocks.last));
    }
    if (state.run !== undefined) {
      lines.push(`money ${moneyText(state.run.money)}`);
      for (const slot of state.run.pack) {
        lines.push(`${slot.dog} ${slot.status === "walking" ? `${slot.hearts}hp` : "fired"}`);
      }
    }
  }
  lines.push(status ?? "C copy link  ` hide");
  return lines;
}
