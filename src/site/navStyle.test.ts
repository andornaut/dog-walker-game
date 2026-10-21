import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const CSS = readFileSync(new URL("../../public/nav.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

// The innermost rules, so a rule inside an at-rule block reads as its own selector.
const RULES = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector = "", body = ""]) => ({
  body,
  selector: selector.trim(),
}));

// Rules whose selector ends on a link, so they style the nav's items, the current page among them.
const LINK_RULES = RULES.filter(({ selector }) =>
  selector.split(",").some((part) => /(^|\s)a([:[]|$)/.test(part.trim())),
);

const CURRENT = '.art-nav a[aria-current="page"]';

describe("the site nav's current page", () => {
  it.each([CURRENT, `${CURRENT}::before`])("is styled by %s", (selector) => {
    expect(LINK_RULES.map((rule) => rule.selector)).toContain(selector);
  });

  it.each(LINK_RULES.map(({ body, selector }) => [selector, body]))(
    "%s neither animates nor transitions",
    (_, body) => {
      expect(body).not.toMatch(/(^|[\s;])(animation|transition)[\w-]*\s*:/);
    },
  );

  it("has no keyframes to run", () => {
    expect(CSS).not.toContain("@keyframes");
  });
});
