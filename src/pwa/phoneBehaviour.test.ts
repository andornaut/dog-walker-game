import { describe, expect, it, vi } from "vitest";

import { AUDIO_UNLOCK_EVENTS, unlockAudioOnFirstGesture } from "./audioUnlock";
import {
  BACK_GUARD_GESTURES,
  BACK_GUARD_STATE,
  guardBackNavigation,
  type HistoryLike,
  type LeaveHost,
} from "./backNavigation";
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

// The page's session history: the previous page's entry, if the game was opened from one, then
// the game's own entries. Going back past the game's first entry leaves the page, which hides it;
// going further than the history reaches does nothing, and the user's back there is the
// browser's own (an installed app closes), which systemBacks counts.
class FakeHistory extends EventTarget implements HistoryLike {
  systemBacks = 0;
  private readonly entries: { page: "game" | "previous"; state: unknown }[];
  private index: number;

  constructor(previous: boolean) {
    super();
    const game = { page: "game", state: null } as const;
    this.entries = previous ? [{ page: "previous", state: null }, game] : [game];
    this.index = this.entries.length - 1;
  }

  get gameEntries(): number {
    return this.entries.filter(({ page }) => page === "game").length;
  }

  get left(): boolean {
    return this.entries[this.index]?.page === "previous";
  }

  get state(): unknown {
    return this.entries[this.index]?.state;
  }

  // The user's back: the browser's own where the history reaches no further.
  back(): void {
    if (this.index === 0) {
      this.systemBacks += 1;
      return;
    }
    this.go(-1);
  }

  go(delta: number): void {
    const target = this.entries[this.index + delta];
    if (target === undefined) {
      return;
    }
    this.index += delta;
    this.dispatchEvent(new Event(target.page === "previous" ? "pagehide" : "popstate"));
  }

  pushState(data: unknown): void {
    this.entries.splice(this.index + 1, Infinity, { page: "game", state: data });
    this.index += 1;
  }
}

// Runs what leaving waits for when told to, and counts the window's closes.
class FakeLeaveHost implements LeaveHost {
  closes = 0;
  private readonly waiting: (() => void)[] = [];

  close(): void {
    this.closes += 1;
  }

  setTimeout(handler: () => void): void {
    this.waiting.push(handler);
  }

  wait(): void {
    this.waiting.splice(0).forEach((handler) => handler());
  }
}

describe("guardBackNavigation", () => {
  // A page whose player has given the first input that pushes the guard.
  function guarded(previous: boolean) {
    const history = new FakeHistory(previous);
    const host = new FakeLeaveHost();
    const seen = recordEvents(history);
    const guard = guardBackNavigation(history, host, history);
    history.dispatchEvent(new Event(BACK_GUARD_GESTURES[0]));
    return { guard, history, host, seen };
  }

  // A tab opened from another page, and with nothing before the game: an installed app, or a tab
  // opened on the game.
  it.each([true, false])(
    "with a previous page %s, stays on the game through each back",
    (previous) => {
      const { history, seen } = guarded(previous);
      history.back();
      history.back();
      expect(seen).toEqual([PHONE_EVENTS.backPressed, PHONE_EVENTS.backPressed]);
      expect(history.state).toEqual(BACK_GUARD_STATE);
      expect(history.gameEntries).toBe(2);
    },
  );

  // Back over the guard and past the game's own entry, or with nothing before them, a close the
  // browser may refuse, the game left on its own entry with no guard.
  it.each([
    { closes: 0, left: true, previous: true },
    { closes: 1, left: false, previous: false },
  ])("leaving with a previous page $previous leaves $left and closes $closes times", (row) => {
    const { guard, history, host, seen } = guarded(row.previous);
    guard.leave();
    host.wait();
    expect({ closes: host.closes, left: history.left, seen, state: history.state }).toEqual({
      closes: row.closes,
      left: row.left,
      seen: [],
      state: null,
    });
  });

  // An installed app's launch: the next back is the system's, which closes the app, unless an
  // input first pushes the guard again.
  it.each([
    { input: false, presses: [], systemBacks: 1 },
    { input: true, presses: [PHONE_EVENTS.backPressed], systemBacks: 0 },
  ])("after leaving finds no page, with input $input before the next back", (row) => {
    const { guard, history, host, seen } = guarded(false);
    guard.leave();
    host.wait();
    if (row.input) {
      history.dispatchEvent(new Event(BACK_GUARD_GESTURES[0]));
    }
    history.back();
    expect({ seen, systemBacks: history.systemBacks }).toEqual({
      seen: row.presses,
      systemBacks: row.systemBacks,
    });
  });

  it("pushes no guard before the player's first input", () => {
    const history = new FakeHistory(false);
    guardBackNavigation(history, new FakeLeaveHost(), history);
    expect(history.gameEntries).toBe(1);
  });

  it.each(BACK_GUARD_GESTURES)("pushes a missing guard on %s, and never a second", (type) => {
    const history = new FakeHistory(false);
    guardBackNavigation(history, new FakeLeaveHost(), history);
    history.dispatchEvent(new Event(type));
    expect(history.state).toEqual(BACK_GUARD_STATE);
    history.dispatchEvent(new Event(type));
    expect(history.gameEntries).toBe(2);
  });

  it("does not push a second guard when the page reloads on one", () => {
    const { history } = guarded(false);
    guardBackNavigation(history, new FakeLeaveHost(), history);
    history.dispatchEvent(new Event(BACK_GUARD_GESTURES[0]));
    expect(history.gameEntries).toBe(2);
  });

  it("ignores a popstate that lands on the guard entry, as going forward does", () => {
    const { history, seen } = guarded(false);
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
