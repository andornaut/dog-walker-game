import { dispatchPhoneEvent, PHONE_EVENTS } from "./events";

// A landscape viewport at most this tall, under a touch screen, is a phone on its side. A
// tablet in landscape is taller and keeps playing letterboxed; a desktop has a fine pointer.
const SIDEWAYS_MAX_HEIGHT = 500;

// In CSS pixels.
export interface Viewport {
  coarsePointer: boolean;
  height: number;
  width: number;
}

export function isSidewaysPhone({ coarsePointer, height, width }: Viewport): boolean {
  return coarsePointer && width > height && height <= SIDEWAYS_MAX_HEIGHT;
}

export interface OrientationRelay {
  // Whether the phone is on its side as of the last event relayed: the state the turn-upright
  // notice shows, for a scene that starts after the event went out.
  sideways(): boolean;
}

// Relays the phone's orientation as turned-sideways and turned-upright on eventTarget, each once
// per change, rechecking on every resize of eventTarget. A page that starts sideways gets
// turned-sideways at once, so listeners that drive the notice must be added first.
export function relayOrientationEvents(
  readViewport: () => Viewport,
  eventTarget: EventTarget,
): OrientationRelay {
  let lastSideways = false;
  const check = () => {
    const sideways = isSidewaysPhone(readViewport());
    if (sideways === lastSideways) {
      return;
    }
    lastSideways = sideways;
    dispatchPhoneEvent(
      eventTarget,
      sideways ? PHONE_EVENTS.turnedSideways : PHONE_EVENTS.turnedUpright,
    );
  };
  check();
  eventTarget.addEventListener("resize", check);
  return { sideways: () => lastSideways };
}
