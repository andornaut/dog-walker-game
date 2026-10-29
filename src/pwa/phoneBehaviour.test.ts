import { describe, expect, it, vi } from "vitest";

import { AUDIO_UNLOCK_EVENTS, unlockAudioOnFirstGesture } from "./audioUnlock";

const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
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
