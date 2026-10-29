import { describe, expect, it } from "vitest";

import { gameData } from "../data";
import type { AchievementCondition, AchievementId } from "../data/types";
import { countBump, countLandedBump } from "../rules/achievements";
import { walkLength } from "../rules/route";
import { finishZone, headHome } from "../runner/walk";
import { newRun, type RunState } from "../state/runState";
import { earningsGoal, packOf, runFactsFor } from "../testing/achievements";
import { newPlayerSave, testAwards } from "../testing/saves";
import {
  type AchievementPreview,
  earnedIfBanked,
  NOTHING_PREVIEWED,
  previewAchievements,
} from "./achievementPreview";
import { earnedSince } from "./achievements";
import { recordCheckpoint, recordRunEnd } from "./checkpoint";
import { checkpointOf, runResultOf } from "./runSlices";

const start = newRun(gameData, 2, { dogs: ["ginger", "kilo"], gear: null, walker: "casey" });
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

// The badges a clean walk earns from its pack and zones alone, each with the step that first
// meets its goal: 0 at the start, then each zone finished.
const ZONE_BADGE_KINDS: readonly AchievementCondition["kind"][] = [
  "cleanZones",
  "packSize",
  "zonesFinished",
];
const ZONE_BADGES = gameData.achievements
  .filter(({ conditions }) => conditions.every(({ kind }) => ZONE_BADGE_KINDS.includes(kind)))
  .map(({ id }) => {
    const { packSize, zonesFinished } = runFactsFor(gameData, [id]);
    return { id, packSize, step: zonesFinished };
  });
const LAST_STEP = walkLength(gameData);

// Each badge that counts bumps, with the first kind it names and a save one bump short of it.
const BUMP_BADGES = gameData.achievements.flatMap(({ conditions, id }) =>
  conditions.flatMap((condition) => {
    if (condition.kind !== "bumps") {
      return [];
    }
    const [kind] = condition.kinds;
    const stats = { ...newPlayerSave.stats, bumpsByKind: { [kind]: condition.count - 1 } };
    return [{ id, kind, short: { ...newPlayerSave, stats } }];
  }),
);

// The run at the start, then after each zone until the walk ends, with a bump in every zone or
// none.
function walkOf(packSize: number, bumped = false): RunState[] {
  let run = newRun(gameData, packSize, {
    dogs: packOf(gameData, packSize),
    gear: null,
    walker: "casey",
  });
  const runs = [run];
  for (let zone = 0; zone < LAST_STEP; zone++) {
    run = zoneDone(bumped ? countBump(run) : run);
    runs.push(run);
  }
  return runs;
}

// What each look over a walk toasts, and what the walk has shown by its end.
function previewWalk(runs: readonly RunState[]) {
  const { preview } = previewer();
  let previewed = NOTHING_PREVIEWED;
  const toasts = runs.map((run) => {
    const looked = preview(previewed, run);
    previewed = looked.preview;
    return looked.earned;
  });
  return { shown: previewed.shown, toasts };
}

describe("previewAchievements", () => {
  it.each(ZONE_BADGES)(
    "toasts $id as heading home would earn it: the pack at the start, zones as they end",
    ({ id, packSize, step }) => {
      const { toasts } = previewWalk(walkOf(packSize));
      const toastedAt = toasts.flatMap((earned, at) => (earned.includes(id) ? [at] : []));
      // A goal met only by the whole walk is left to the end screen.
      expect(toastedAt).toEqual(step < LAST_STEP ? [step] : []);
    },
  );

  it("toasts a badge once a walk, and looks again only when the facts change", () => {
    const { looks, preview } = previewer();
    const first = preview(NOTHING_PREVIEWED, start);
    const walked = { ...start, zoneDistance: start.zoneDistance + 100 } as RunState;
    expect(preview(first.preview, walked)).toEqual({ earned: [], preview: first.preview });
    expect(looks()).toBe(1);
    const { shown, toasts } = previewWalk(
      walkOf(Math.max(...ZONE_BADGES.map(({ packSize }) => packSize))),
    );
    const midWalk = ZONE_BADGES.filter(({ step }) => step < LAST_STEP).map(({ id }) => id);
    expect(toasts.flat()).toEqual(expect.arrayContaining(midWalk));
    expect(new Set(toasts.flat()).size).toBe(toasts.flat().length);
    expect(shown).toEqual(toasts.flat());
  });

  it("never toasts Big Payday mid-walk, which waits for the banked total", () => {
    const { preview } = previewer();
    const rich = { ...zoneDone(start), money: earningsGoal("bigPayday") };
    expect(preview(NOTHING_PREVIEWED, rich).earned).not.toContain("bigPayday");
  });

  it.each(BUMP_BADGES)(
    "looks again on a landed bump, toasting $id on the bump that meets it",
    ({ id, kind, short }) => {
      const { looks, preview } = previewer(short);
      const first = preview(NOTHING_PREVIEWED, start);
      expect(first.earned).not.toContain(id);
      expect(preview(first.preview, countLandedBump(kind, start)).earned).toContain(id);
      expect(looks()).toBe(2);
    },
  );

  it("does not toast Clean Paws for a walk with a bump in every zone", () => {
    const { toasts } = previewWalk(walkOf(runFactsFor(gameData, ["cleanPaws"]).packSize, true));
    expect(toasts.flat()).not.toContain("cleanPaws");
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
    expect(midWalk.achievements).toEqual([]);
    const ended = recordRunEnd(testAwards, midWalk, runResultOf(gameData, headHome(zone1)));
    const celebrated: AchievementId[] = earnedSince(gameData, midWalk, ended);
    expect(celebrated).toEqual(expect.arrayContaining([...toasted]));
    expect(new Set(celebrated).size).toBe(celebrated.length);
    expect(earnedIfBanked(testAwards, ended, runResultOf(gameData, headHome(zone1)))).toEqual([]);
  });
});
