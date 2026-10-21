import { afterEach, describe, expect, it, vi } from "vitest";

import { whenSettled } from "./generatedFilesPlugin";

afterEach(() => {
  vi.useRealTimers();
});

describe("whenSettled", () => {
  it("starts a run that comes due during another once that one ends, never alongside it", async () => {
    vi.useFakeTimers();
    const ends: (() => void)[] = [];
    let running = 0;
    let most = 0;
    const call = whenSettled(10, () => {
      running += 1;
      most = Math.max(most, running);
      return new Promise<void>((resolve) => {
        ends.push(() => {
          running -= 1;
          resolve();
        });
      });
    });
    call();
    await vi.advanceTimersByTimeAsync(10);
    call();
    await vi.advanceTimersByTimeAsync(10);
    call();
    await vi.advanceTimersByTimeAsync(10);
    expect(ends).toHaveLength(1);
    ends[0]?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(ends).toHaveLength(2);
    ends[1]?.();
    await vi.advanceTimersByTimeAsync(0);
    expect({ most, runs: ends.length }).toEqual({ most: 1, runs: 2 });
  });
});
