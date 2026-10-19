import type { LiveTuning } from "../data/types";
import { type Pixels, pixels, read, type Seconds, seconds } from "./units";

export interface ZoneStats {
  // At base speed and before upgrades.
  readonly duration: Seconds;
  readonly luckyEncounters: number;
  readonly obstacles: number;
  readonly scrollSpeed: Pixels;
  readonly tips: number;
  readonly treats: number;
}

// zoneIndex counts from 0 for the first zone. Every zone is the same distance, so a faster
// zone takes less time.
export function zoneStats(tuning: LiveTuning, zoneIndex: number): ZoneStats {
  const speedFactor = 1 + read(tuning, "multipliers", "scrollSpeedGainPerZone") * zoneIndex;
  const counts = (first: number, gain: number) => first + gain * zoneIndex;
  return {
    duration: seconds(read(tuning, "seconds", "zoneAtBaseSpeed") / speedFactor),
    luckyEncounters: read(tuning, "counts", "luckyEncountersPerZone"),
    obstacles: counts(tuning.counts.obstaclesFirstZone, tuning.counts.obstaclesGainPerZone),
    scrollSpeed: pixels(read(tuning, "pixels", "roadScrollSpeed") * speedFactor),
    tips: counts(tuning.counts.tipsFirstZone, tuning.counts.tipsGainPerZone),
    treats: read(tuning, "counts", "treatsPerZone"),
  };
}
