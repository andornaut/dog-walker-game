import type { LiveTuning, LuckyEncounterId, Zone } from "../data/types";
import { type Pixels, pixels, read, type Seconds, seconds } from "./units";

interface ZoneStats {
  // At base speed and before upgrades.
  readonly duration: Seconds;
  // How many of each kind of lucky find the zone places on average, which chanceRound rounds.
  readonly luckyFinds: Readonly<Record<LuckyEncounterId, number>>;
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
    luckyFinds: Object.fromEntries(
      Object.entries(tuning.counts.luckyFindsPerZone).map(([id, count]) => [
        id,
        count * density.luckyFinds,
      ]),
    ) as Record<LuckyEncounterId, number>,
    minorObstacles: zoneCount(
      zoneIndex,
      read(tuning, "counts", "minorObstaclesFirstZone"),
      read(tuning, "counts", "minorObstaclesGainPerZone"),
      density.minorObstacles,
    ),
    obstacles: zoneCount(
      zoneIndex,
      read(tuning, "counts", "obstaclesFirstZone"),
      read(tuning, "counts", "obstaclesGainPerZone"),
      density.cards,
    ),
    scrollSpeed: zoneScrollSpeed(tuning, zone, zoneIndex),
    tips: zoneCount(
      zoneIndex,
      read(tuning, "counts", "tipsFirstZone"),
      read(tuning, "counts", "tipsGainPerZone"),
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
