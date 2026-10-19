import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { AchievementId } from "../data/types";
import { countBump } from "../rules/achievements";
import { cents } from "../rules/units";
import { finishZone, headHome } from "../runner/walk";
import { newRun, type RunState } from "../state/runState";
import {
  type AchievementPreview,
  earnedIfBanked,
  NOTHING_PREVIEWED,
  previewAchievements,
} from "./achievementPreview";
import { earnedSince } from "./achievements";
import { recordCheckpoint, recordRunEnd } from "./checkpoint";
import { newPlayerSave, testAwards } from "./fixtures";
import { checkpointOf, runResultOf } from "./runSlices";

const start = newRun(gameData, 2, { dogs: ["duchess", "koda"], gear: null });
const zoneDone = (run: RunState) => finishZone(gameData, run).run;

// Previews the run against the save as it stands, counting how often the bank is looked at.
function previewer(save = newPlayerSave) {
  let looks = 0;
  const earned = (result: Parameters<typeof earnedIfBanked>[2]) => {
    looks += 1;
    return earnedIfBanked(testAwards, save, result);
  };
  return {
    looks: () => looks,
    preview: (preview: AchievementPreview, run: RunState) =>
      previewAchievements(gameData, earned, preview, run),
  };
}

describe("previewAchievements", () => {
  it("toasts what heading home now would earn: the pack at the start, zones as they end", () => {
    const { preview } = previewer();
    const atStart = preview(NOTHING_PREVIEWED, start);
    expect(atStart.earned).toEqual(["doubleLeash"]);
    const afterZone = preview(atStart.preview, zoneDone(start));
    expect(afterZone.earned).toEqual(["firstSteps", "cleanPaws"]);
  });

  it("toasts a badge once a walk, and looks again only when the facts change", () => {
    const { looks, preview } = previewer();
    const first = preview(NOTHING_PREVIEWED, start);
    const walked = { ...start, zoneDistance: start.zoneDistance + 100 } as RunState;
    expect(preview(first.preview, walked)).toEqual({ earned: [], preview: first.preview });
    expect(looks()).toBe(1);
    const zone1 = zoneDone(start);
    const second = preview(first.preview, zone1);
    const third = preview(second.preview, zoneDone(zone1));
    expect(third.earned).toEqual([]);
    expect(third.preview.shown).toEqual(["doubleLeash", "firstSteps", "cleanPaws"]);
  });

  it("toasts Big Payday as the money reaches it mid-zone", () => {
    const { preview } = previewer();
    const first = preview(NOTHING_PREVIEWED, start);
    const rich = preview(first.preview, { ...start, money: cents(50_000) });
    expect(rich.earned).toEqual(["bigPayday"]);
  });

  it("does not toast Clean Paws for a zone with a bump", () => {
    const { preview } = previewer();
    const bumped = zoneDone(countBump(start));
    expect(preview(NOTHING_PREVIEWED, bumped).earned).not.toContain("cleanPaws");
  });

  it("leaves an ended walk to the end screen", () => {
    const { looks, preview } = previewer();
    expect(preview(NOTHING_PREVIEWED, headHome(start)).earned).toEqual([]);
    expect(looks()).toBe(0);
  });

  it("awards nothing itself: the walk's end awards each toasted badge once", () => {
    const { preview } = previewer();
    const zone1 = zoneDone(start);
    const toasted = preview(preview(NOTHING_PREVIEWED, start).preview, zone1).preview.shown;
    // The save mid-walk holds only the checkpoint, as the run scene writes it.
    const midWalk = recordCheckpoint(newPlayerSave, checkpointOf(gameData, zone1));
    expect(midWalk.achievements).toEqual({});
    const ended = recordRunEnd(testAwards, midWalk, runResultOf(gameData, headHome(zone1)));
    const celebrated: AchievementId[] = earnedSince(gameData, midWalk, ended);
    expect(celebrated).toEqual(expect.arrayContaining([...toasted]));
    expect(new Set(celebrated).size).toBe(celebrated.length);
    expect(earnedIfBanked(testAwards, ended, runResultOf(gameData, headHome(zone1)))).toEqual([]);
  });
});
