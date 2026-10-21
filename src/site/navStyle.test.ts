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
  it("is styled, and no link rule animates or transitions", () => {
    const selectors = LINK_RULES.map((rule) => rule.selector);
    expect(selectors).toContain(CURRENT);
    expect(selectors).toContain(`${CURRENT}::before`);
    const moving = LINK_RULES.filter(({ body }) =>
      /(^|[\s;])(animation|transition)[\w-]*\s*:/.test(body),
    );
    expect(moving.map(({ selector }) => selector)).toEqual([]);
    expect(CSS).not.toContain("@keyframes");
  });
});
