import { describe, expect, it, vi } from "vitest";

import { AUDIO_UNLOCK_EVENTS, unlockAudioOnFirstGesture } from "./audioUnlock";
import { BACK_GUARD_STATE, guardBackNavigation, type HistoryLike } from "./backNavigation";
import { PHONE_EVENTS } from "./events";
import { relayVisibilityEvents, type VisibilitySource } from "./visibility";
import { createScreenWakeLock, type WakeLockLike, type WakeLockSentinelLike } from "./wakeLock";

class FakeDocument extends EventTarget implements VisibilitySource {
  visibilityState: DocumentVisibilityState = "visible";

  setVisibility(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

class FakeSentinel extends EventTarget implements WakeLockSentinelLike {
  released = false;

  release(): Promise<void> {
    this.released = true;
    this.dispatchEvent(new Event("release"));
    return Promise.resolve();
  }
}

class FakeWakeLock implements WakeLockLike {
  refuse = false;
  readonly sentinels: FakeSentinel[] = [];

  request(): Promise<WakeLockSentinelLike> {
    if (this.refuse) {
      return Promise.reject(new Error("NotAllowedError"));
    }
    const sentinel = new FakeSentinel();
    this.sentinels.push(sentinel);
    return Promise.resolve(sentinel);
  }

  held(): FakeSentinel[] {
    return this.sentinels.filter((sentinel) => !sentinel.released);
  }
}

const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

function recordEvents(target: EventTarget): string[] {
  const seen: string[] = [];
  for (const name of Object.values(PHONE_EVENTS)) {
    target.addEventListener(name, () => seen.push(name));
  }
  return seen;
}

describe("createScreenWakeLock", () => {
  it("holds one lock while started and visible, and releases it on stop", async () => {
    const wakeLock = new FakeWakeLock();
    const screen = createScreenWakeLock(wakeLock, new FakeDocument());
    screen.start();
    screen.start();
    await settle();
    expect(wakeLock.held()).toHaveLength(1);
    expect(screen.isHeld()).toBe(true);
    screen.stop();
    expect(wakeLock.held()).toHaveLength(0);
    expect(screen.isHeld()).toBe(false);
  });

  it("requests a new lock each time the page becomes visible again", async () => {
    const wakeLock = new FakeWakeLock();
    const page = new FakeDocument();
    createScreenWakeLock(wakeLock, page).start();
    await settle();
    page.setVisibility("hidden");
    // The browser releases the lock itself when the page is hidden.
    await wakeLock.sentinels[0]?.release();
    page.setVisibility("visible");
    await settle();
    expect(wakeLock.sentinels).toHaveLength(2);
    expect(wakeLock.held()).toHaveLength(1);
  });

  it("does not request while the page is hidden", async () => {
    const wakeLock = new FakeWakeLock();
    const page = new FakeDocument();
    page.visibilityState = "hidden";
    createScreenWakeLock(wakeLock, page).start();
    await settle();
    expect(wakeLock.sentinels).toHaveLength(0);
  });

  it("releases a lock that arrives after stop", async () => {
    const wakeLock = new FakeWakeLock();
    const screen = createScreenWakeLock(wakeLock, new FakeDocument());
    screen.start();
    screen.stop();
    await settle();
    expect(wakeLock.sentinels).toHaveLength(1);
    expect(wakeLock.held()).toHaveLength(0);
  });

  it("stays quiet when the browser refuses or has no API", async () => {
    const wakeLock = new FakeWakeLock();
    wakeLock.refuse = true;
    const refused = createScreenWakeLock(wakeLock, new FakeDocument());
    refused.start();
    await settle();
    expect(refused.isHeld()).toBe(false);

    const unsupported = createScreenWakeLock(undefined, new FakeDocument());
    unsupported.start();
    expect(unsupported.isHeld()).toBe(false);
  });
});

class FakeHistory extends EventTarget implements HistoryLike {
  private readonly entries: unknown[] = [null];
  private index = 0;

  get length(): number {
    return this.entries.length;
  }

  get state(): unknown {
    return this.entries[this.index];
  }

  back(): void {
    this.index -= 1;
    this.dispatchEvent(new Event("popstate"));
  }

  pushState(data: unknown): void {
    this.entries.splice(this.index + 1, Infinity, data);
    this.index += 1;
  }
}

describe("guardBackNavigation", () => {
  it("pushes a guard entry, then turns each back into back-pressed and stays", () => {
    const history = new FakeHistory();
    const seen = recordEvents(history);
    guardBackNavigation(history, history);
    expect(history.state).toEqual(BACK_GUARD_STATE);
    history.back();
    history.back();
    expect(seen).toEqual([PHONE_EVENTS.backPressed, PHONE_EVENTS.backPressed]);
    expect(history.state).toEqual(BACK_GUARD_STATE);
    expect(history.length).toBe(2);
  });

  it("does not push a second guard when the page reloads on one", () => {
    const history = new FakeHistory();
    guardBackNavigation(history, history);
    guardBackNavigation(history, history);
    expect(history.length).toBe(2);
  });

  it("ignores a popstate that lands on the guard entry, as going forward does", () => {
    const history = new FakeHistory();
    const seen = recordEvents(history);
    guardBackNavigation(history, history);
    history.dispatchEvent(new Event("popstate"));
    expect(seen).toEqual([]);
  });
});

describe("relayVisibilityEvents", () => {
  it("dispatches app-hidden and app-visible once per change", () => {
    const page = new FakeDocument();
    const window = new EventTarget();
    const seen = recordEvents(window);
    relayVisibilityEvents(window, page);
    page.setVisibility("hidden");
    window.dispatchEvent(new Event("pagehide"));
    page.setVisibility("visible");
    page.setVisibility("visible");
    expect(seen).toEqual([PHONE_EVENTS.appHidden, PHONE_EVENTS.appVisible]);
  });

  it("treats pagehide as hidden and pageshow as a recheck", () => {
    const page = new FakeDocument();
    const window = new EventTarget();
    const seen = recordEvents(window);
    relayVisibilityEvents(window, page);
    window.dispatchEvent(new Event("pagehide"));
    window.dispatchEvent(new Event("pageshow"));
    expect(seen).toEqual([PHONE_EVENTS.appHidden, PHONE_EVENTS.appVisible]);
  });
});

describe("unlockAudioOnFirstGesture", () => {
  const suspendedContext = () => {
    const context = {
      resume: vi.fn(() => {
        context.state = "running";
        return Promise.resolve();
      }),
      state: "suspended",
    };
    return context;
  };

  it("resumes on the first gesture and then stops listening", async () => {
    const page = new EventTarget();
    const context = suspendedContext();
    unlockAudioOnFirstGesture(page, context);
    expect(context.resume).not.toHaveBeenCalled();
    page.dispatchEvent(new Event("touchend"));
    await settle();
    page.dispatchEvent(new Event("keydown"));
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.state).toBe("running");
  });

  it("resumes on each gesture", () => {
    for (const type of AUDIO_UNLOCK_EVENTS) {
      const page = new EventTarget();
      const context = suspendedContext();
      unlockAudioOnFirstGesture(page, context);
      page.dispatchEvent(new Event(type));
      expect(context.resume).toHaveBeenCalledTimes(1);
    }
  });

  it("keeps listening while the browser refuses to resume", async () => {
    const page = new EventTarget();
    const context = {
      resume: vi.fn(() => Promise.reject(new Error("no gesture"))),
      state: "suspended",
    };
    unlockAudioOnFirstGesture(page, context);
    page.dispatchEvent(new Event("pointerup"));
    await settle();
    page.dispatchEvent(new Event("pointerup"));
    expect(context.resume).toHaveBeenCalledTimes(2);
  });
});
