import type { LiveTuning, Zone } from "../data/types";
import { type Pixels, pixels, read, type Seconds, seconds } from "./units";

export interface ZoneStats {
  // At base speed and before upgrades.
  readonly duration: Seconds;
  readonly luckyEncounters: number;
  // Obstacles that open no card, on top of obstacles.
  readonly minorObstacles: number;
  readonly obstacles: number;
  readonly scrollSpeed: Pixels;
  readonly tips: number;
  readonly treats: number;
}

// A zone walked at position zoneIndex, counting from 0. Speed and counts rise with the
// position, then the zone's own speed and density multiply them. Every zone is the same
// distance, so a faster zone takes less time.
export function zoneStats(
  tuning: LiveTuning,
  zone: Pick<Zone, "density" | "speed">,
  zoneIndex: number,
): ZoneStats {
  const speedFactor = zoneSpeedFactor(tuning, zone, zoneIndex);
  const { density } = zone;
  return {
    duration: seconds(read(tuning, "seconds", "zoneAtBaseSpeed") / speedFactor),
    luckyEncounters: Math.round(
      read(tuning, "counts", "luckyEncountersPerZone") * density.luckyFinds,
    ),
    minorObstacles: zoneCount(
      zoneIndex,
      tuning.counts.minorObstaclesFirstZone,
      tuning.counts.minorObstaclesGainPerZone,
      density.obstacles,
    ),
    obstacles: zoneCount(
      zoneIndex,
      tuning.counts.obstaclesFirstZone,
      tuning.counts.obstaclesGainPerZone,
      density.obstacles,
    ),
    scrollSpeed: zoneScrollSpeed(tuning, zone, zoneIndex),
    tips: zoneCount(
      zoneIndex,
      tuning.counts.tipsFirstZone,
      tuning.counts.tipsGainPerZone,
      density.tips,
    ),
    treats: read(tuning, "counts", "treatsPerZone"),
  };
}

// zoneStats' scrollSpeed alone.
export function zoneScrollSpeed(
  tuning: LiveTuning,
  zone: Pick<Zone, "speed">,
  zoneIndex: number,
): Pixels {
  return pixels(
    read(tuning, "pixels", "roadScrollSpeed") * zoneSpeedFactor(tuning, zone, zoneIndex),
  );
}

function zoneSpeedFactor(tuning: LiveTuning, zone: Pick<Zone, "speed">, zoneIndex: number): number {
  return (1 + read(tuning, "multipliers", "scrollSpeedGainPerZone") * zoneIndex) * zone.speed;
}

function zoneCount(zoneIndex: number, first: number, gain: number, density: number): number {
  return Math.round((first + gain * zoneIndex) * density);
}
