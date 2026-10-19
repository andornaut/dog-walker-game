// An array item the caller knows is in range; throws rather than returning undefined.
export function itemAt<T>(items: readonly T[], index: number): T {
  if (!(index in items)) {
    throw new RangeError(`No item at index ${index} of ${items.length}`);
  }
  return items[index] as T;
}
