// Narrows an indexed read in a test, failing with a clear message when the value is missing.
export function defined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected a value, got undefined");
  }
  return value;
}
