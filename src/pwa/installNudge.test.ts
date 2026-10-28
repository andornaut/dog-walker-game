import { describe, expect, it } from "vitest";

import type { SaveStorage } from "../save/storage";
import { createInstallNudge, INSTALL_NUDGE_KEY } from "./installNudge";
import type { InstallState } from "./installState";

class FakeStorage implements SaveStorage {
  failReads = false;
  failWrites = false;
  readonly values = new Map<string, string>();

  async read(key: string): Promise<string | null> {
    if (this.failReads) {
      throw new Error("blocked");
    }
    return this.values.get(key) ?? null;
  }

  async write(key: string, value: string): Promise<void> {
    if (this.failWrites) {
      throw new Error("quota");
    }
    this.values.set(key, value);
  }
}

describe("createInstallNudge", () => {
  it.each<[InstallState, boolean]>([
    ["prompt", true],
    ["installed", false],
  ])("is due for %s on a device that has not seen it: %s", async (state, expected) => {
    const nudge = createInstallNudge(new FakeStorage());
    await nudge.ready;
    expect(nudge.due(state)).toBe(expected);
  });

  it("shows once per device, remembered across launches", async () => {
    const storage = new FakeStorage();
    const first = createInstallNudge(storage);
    expect(first.due("prompt")).toBe(false);
    await first.ready;
    first.markShown();
    expect(first.due("prompt")).toBe(false);
    await Promise.resolve();
    expect(storage.values.has(INSTALL_NUDGE_KEY)).toBe(true);
    const next = createInstallNudge(storage);
    await next.ready;
    expect(next.due("prompt")).toBe(false);
  });

  it("never shows when the flag cannot be read, and stays shown when it cannot be written", async () => {
    const unreadable = new FakeStorage();
    unreadable.failReads = true;
    const blocked = createInstallNudge(unreadable);
    await blocked.ready;
    expect(blocked.due("prompt")).toBe(false);

    const unwritable = new FakeStorage();
    unwritable.failWrites = true;
    const once = createInstallNudge(unwritable);
    await once.ready;
    once.markShown();
    expect(once.due("prompt")).toBe(false);
  });
});
