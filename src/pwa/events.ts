// Events dispatched on window for the scenes to act on. Each is a plain Event with no detail.
export const PHONE_EVENTS = {
  // The tab or app went to the background: pause the run and checkpoint the save.
  appHidden: "app-hidden",
  // The tab or app is in front again.
  appVisible: "app-visible",
  // The Android back gesture or button, or the browser's Back. The page stays on the game, so
  // the scenes decide what back means (pause, close a card, leave a menu).
  backPressed: "back-pressed",
  // A phone turned on its side: the turn-upright notice covers the game, so pause the run.
  turnedSideways: "turned-sideways",
  // The phone is upright again and the notice is gone.
  turnedUpright: "turned-upright",
} as const;

type PhoneEventName = (typeof PHONE_EVENTS)[keyof typeof PHONE_EVENTS];

export function dispatchPhoneEvent(target: EventTarget, name: PhoneEventName): void {
  target.dispatchEvent(new Event(name));
}
