import * as v from "valibot";

// Shared pieces of the art JSON schemas, so their errors read alike.

// v.object and v.record accept arrays, so this check runs before either.
export function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// v.object reports a missing field with its own message, at the field's path.
export const objectMessage = (issue: v.ObjectIssue) =>
  issue.path === undefined ? "must be an object" : "is required";

// A plain object with these fields, rejecting null and arrays.
export function record<T extends v.ObjectEntries>(entries: T) {
  return v.pipe(
    v.unknown(),
    v.check(isPlainObject, "must be an object"),
    v.object(entries, objectMessage),
  );
}

// The issue's location, as .field and [index] segments.
export function issuePath(issue: v.BaseIssue<unknown>): string {
  return (issue.path ?? [])
    .map(({ key }) => (typeof key === "number" ? `[${key}]` : `.${String(key)}`))
    .join("");
}
