// Events dispatched on window for the scenes to act on. Each is a plain Event with no detail.
export const PHONE_EVENTS = {
  // The tab or app went to the background: pause the run and checkpoint the save.
  appHidden: "app-hidden",
  // The tab or app is in front again.
  appVisible: "app-visible",
  // The Android back gesture or button, or the browser's Back. The page stays on the game, so
  // the scenes decide what back means (pause, close a card, leave a menu).
  backPressed: "back-pressed",
  // The home screen's update plate shows or hides: updatePlateShown says which.
  updatePlate: "update-plate",
} as const;

type PhoneEventName = (typeof PHONE_EVENTS)[keyof typeof PHONE_EVENTS];

export function dispatchPhoneEvent(target: EventTarget, name: PhoneEventName): void {
  target.dispatchEvent(new Event(name));
}
