// The x coordinate of each lane's centre, for lanes that split the width evenly.
export function laneCenters(laneCount: number, width: number): number[] {
  const laneWidth = width / laneCount;
  return Array.from({ length: laneCount }, (_, i) => laneWidth * (i + 0.5));
}
