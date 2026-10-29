import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import { tapGuardMs } from "./tapGuard";

describe("tapGuardMs", () => {
  it("reads seconds.screenTapGuard, in milliseconds", () => {
    const seconds = { ...gameData.tuning.seconds, screenTapGuard: 2.5 };
    expect(tapGuardMs({ ...gameData.tuning, seconds })).toBe(2_500);
  });
});
