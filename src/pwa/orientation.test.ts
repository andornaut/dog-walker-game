import { describe, expect, it } from "vitest";

import { PHONE_EVENTS } from "./events";
import { isSidewaysPhone, relayOrientationEvents, type Viewport } from "./orientation";

const IPHONE_13_PORTRAIT: Viewport = { coarsePointer: true, height: 844, width: 390 };
const IPHONE_13_LANDSCAPE: Viewport = { coarsePointer: true, height: 390, width: 844 };

describe("isSidewaysPhone", () => {
  // Only a touch screen in landscape with a short viewport.
  it.each<[string, Viewport, boolean]>([
    ["an iPhone 13 in landscape", IPHONE_13_LANDSCAPE, true],
    ["a small phone in landscape", { coarsePointer: true, height: 320, width: 568 }, true],
    ["a large phone in landscape", { coarsePointer: true, height: 500, width: 900 }, true],
    ["an iPhone 13 upright", IPHONE_13_PORTRAIT, false],
    ["a tablet in landscape", { coarsePointer: true, height: 820, width: 1180 }, false],
    ["a short desktop window", { coarsePointer: false, height: 400, width: 1280 }, false],
    ["a desktop", { coarsePointer: false, height: 800, width: 1280 }, false],
    ["a square viewport", { coarsePointer: true, height: 400, width: 400 }, false],
  ])("for %s is %s", (_, viewport, expected) => {
    expect(isSidewaysPhone(viewport)).toBe(expected);
  });
});

function relay(start: Viewport) {
  let viewport = start;
  const window = new EventTarget();
  const seen: string[] = [];
  window.addEventListener(PHONE_EVENTS.turnedSideways, () => seen.push("sideways"));
  window.addEventListener(PHONE_EVENTS.turnedUpright, () => seen.push("upright"));
  const { sideways, stop } = relayOrientationEvents(() => viewport, window);
  const resize = (next: Viewport) => {
    viewport = next;
    window.dispatchEvent(new Event("resize"));
  };
  return { resize, seen, sideways, stop };
}

describe("relayOrientationEvents", () => {
  it("dispatches turned-sideways and turned-upright once per change", () => {
    const { resize, seen } = relay(IPHONE_13_PORTRAIT);
    resize(IPHONE_13_LANDSCAPE);
    resize({ ...IPHONE_13_LANDSCAPE, height: 380 });
    resize(IPHONE_13_PORTRAIT);
    resize(IPHONE_13_PORTRAIT);
    expect(seen).toEqual(["sideways", "upright"]);
  });

  it("dispatches turned-sideways at once for a page that starts sideways", () => {
    expect(relay(IPHONE_13_LANDSCAPE).seen).toEqual(["sideways"]);
    expect(relay(IPHONE_13_PORTRAIT).seen).toEqual([]);
  });

  it("reports the orientation it last relayed, for a walk that starts after the event", () => {
    expect(relay(IPHONE_13_LANDSCAPE).sideways()).toBe(true);
    const { resize, sideways } = relay(IPHONE_13_PORTRAIT);
    expect(sideways()).toBe(false);
    resize(IPHONE_13_LANDSCAPE);
    expect(sideways()).toBe(true);
    resize(IPHONE_13_PORTRAIT);
    expect(sideways()).toBe(false);
  });

  it("stops relaying when disposed", () => {
    const { resize, seen, stop } = relay(IPHONE_13_PORTRAIT);
    stop();
    resize(IPHONE_13_LANDSCAPE);
    expect(seen).toEqual([]);
  });
});
