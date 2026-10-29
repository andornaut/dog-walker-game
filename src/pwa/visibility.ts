import type { VisibilitySource } from "@andornaut/game-kit/pwa/wakeLock";

import { dispatchPhoneEvent, PHONE_EVENTS } from "./events";

// Relays the page's visibility as app-hidden and app-visible on eventTarget, each once per
// change. pagehide and pageshow count too, for a page leaving or returning from the back-forward
// cache without a visibilitychange.
export function relayVisibilityEvents(
  eventTarget: EventTarget,
  visibilitySource: VisibilitySource,
): void {
  let lastHidden = visibilitySource.visibilityState === "hidden";
  const report = (hidden: boolean) => {
    if (hidden === lastHidden) {
      return;
    }
    lastHidden = hidden;
    dispatchPhoneEvent(eventTarget, hidden ? PHONE_EVENTS.appHidden : PHONE_EVENTS.appVisible);
  };
  const onVisibilityChange = () => report(visibilitySource.visibilityState === "hidden");
  const onPageHide = () => report(true);
  visibilitySource.addEventListener("visibilitychange", onVisibilityChange);
  eventTarget.addEventListener("pagehide", onPageHide);
  eventTarget.addEventListener("pageshow", onVisibilityChange);
}
