import { describe, expect, it } from "vitest";

import { serviceWorkerUrl } from "./serviceWorkerUrl";

describe("serviceWorkerUrl", () => {
  it("names the page's sound format for the worker to precache", () => {
    expect(serviceWorkerUrl("/sw.js", "ogg")).toBe("/sw.js?sound=ogg");
    expect(serviceWorkerUrl("/sw.js", "m4a")).toBe("/sw.js?sound=m4a");
  });

  it("names none when the browser plays neither format", () => {
    expect(serviceWorkerUrl("/sw.js", undefined)).toBe("/sw.js");
  });
});
