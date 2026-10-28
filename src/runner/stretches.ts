// The stretches of a zone's rows the spawn planner spreads a quota's spawns over: a share of the
// zone from 0 to 1, as rows, split into one equal stretch per spawn.

// The share of the zone's rows a quota without within is spread over.
export const WHOLE_ZONE: readonly [number, number] = [0, 1];

// The share of a zone the ith of count like spawns placed apart stands in, such as a zone's gear
// drops or its lucky finds: every other one of 2 * count - 1 equal stretches, so a lone one may
// stand anywhere and two stand in the first and last thirds, at least a third of the zone apart.
export function spacedStretch(count: number, i: number): readonly [number, number] {
  const stretches = 2 * count - 1;
  return [(2 * i) / stretches, (2 * i + 1) / stretches];
}

// The rows of rowCount that a share of the zone covers, from the first to the end, exclusive.
export function rowsWithin(
  rowCount: number,
  share: readonly [number, number],
): readonly [number, number] {
  return [Math.floor(share[0] * rowCount), Math.floor(share[1] * rowCount)];
}

// The ith of count equal stretches of rows, from the first to the end, exclusive.
export function nthStretch(
  count: number,
  i: number,
  rows: readonly [number, number],
): readonly [number, number] {
  const [first, end] = rows;
  return [
    first + Math.floor((i * (end - first)) / count),
    first + Math.floor(((i + 1) * (end - first)) / count),
  ];
}
