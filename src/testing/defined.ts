// Narrows an indexed read in a test, failing with a clear message when the value is missing.
export function defined<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("Expected a value, got undefined");
  }
  return value;
}

// Narrows a nullable field in a test, failing with a clear message when it is null.
export function present<T>(value: T | null): T {
  if (value === null) {
    throw new Error("Expected a value, got null");
  }
  return value;
}
