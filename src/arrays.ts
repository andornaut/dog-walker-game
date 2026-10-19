// An array item the caller knows is in range; throws rather than returning undefined.
export function itemAt<T>(items: readonly T[], index: number): T {
  if (!(index in items)) {
    throw new RangeError(`No item at index ${index} of ${items.length}`);
  }
  return items[index] as T;
}

// The nearest index in range for an array of length items, which must be at least 1.
export function clampIndex(length: number, index: number): number {
  return Math.min(length - 1, Math.max(0, index));
}
