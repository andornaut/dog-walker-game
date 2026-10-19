import { describe, expect, it } from "vitest";

import { serviceWorkerUrl } from "./serviceWorkerUrl";

describe("serviceWorkerUrl", () => {
  // The page's sound format for the worker to precache, or none when the browser plays neither.
  it.each([
    ["ogg", "/sw.js?sound=ogg"],
    ["m4a", "/sw.js?sound=m4a"],
    [undefined, "/sw.js"],
  ] as const)("names the format %s as %s", (format, url) => {
    expect(serviceWorkerUrl("/sw.js", format)).toBe(url);
  });
});
