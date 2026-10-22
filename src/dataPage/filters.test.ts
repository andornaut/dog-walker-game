import { describe, expect, it } from "vitest";

import {
  type Facet,
  facetStates,
  facetValues,
  filterRows,
  type Filters,
  parseFilters,
  type Row,
  serializeFilters,
  toggleFilter,
} from "./filters";

const filters = (entries: Record<string, string[]>): Filters =>
  new Map(Object.entries(entries).map(([key, values]) => [key, new Set(values)]));

const plain = (value: Filters): Record<string, string[]> =>
  Object.fromEntries([...value].map(([key, values]) => [key, [...values]]));

describe("parseFilters", () => {
  it.each([
    ["", {}],
    ["?tables=dogs,owner-quips", { tables: ["dogs", "owner-quips"] }],
    ["?dogs-size=Small&dogs-size=big", { "dogs-size": ["small", "big"] }],
    ["?dogs-size=&tables=,,zones", { tables: ["zones"] }],
    ["?Dogs%20Size=small&seed=4", { seed: ["4"] }],
  ])("%j", (search, expected) => {
    expect(plain(parseFilters(search))).toEqual(expected);
  });
});

describe("serializeFilters", () => {
  it.each([
    [{}, ""],
    [{ tables: [] }, ""],
    [{ "dogs-size": ["small", "big"], tables: ["dogs"] }, "?dogs-size=small,big&tables=dogs"],
  ])("%j", (entries, expected) => {
    expect(serializeFilters(filters(entries))).toBe(expected);
  });

  it.each([{ tables: ["dogs", "zones"] }, { "dogs-size": ["big"], "upgrades-kind": ["boost"] }])(
    "round-trips %j",
    (entries) => {
      expect(plain(parseFilters(serializeFilters(filters(entries))))).toEqual(entries);
    },
  );
});

describe("toggleFilter", () => {
  it.each([
    [{}, "small", { "dogs-size": ["small"] }],
    [{ "dogs-size": ["small"] }, "big", { "dogs-size": ["small", "big"] }],
    [{ "dogs-size": ["small"] }, "small", {}],
  ])("%j toggling %s", (entries, value, expected) => {
    expect(plain(toggleFilter("dogs-size", value, filters(entries)))).toEqual(expected);
  });
});

// Two dogs' quips, grouped: a continuation row leaves the dog and owner blank.
const QUIPS: Row[] = [
  ["Koda", "Sam", "happier", "a"],
  ["", "", "upset", "b"],
  ["Penny", "Ari", "happier", "c"],
  ["", "", "upset", "d"],
];
const MOMENT: Facet = { column: 2, key: "quips-moment" };
const DOG: Facet = { column: 0, key: "quips-dog" };

describe("filterRows", () => {
  it.each([
    ["nothing selected", {}, QUIPS],
    ["a value no row has", { "quips-moment": ["fired"] }, QUIPS],
    [
      "a continuation row, given its group's cells",
      { "quips-moment": ["upset"] },
      [
        ["Koda", "Sam", "upset", "b"],
        ["Penny", "Ari", "upset", "d"],
      ],
    ],
    ["a grouped column, matched by its head", { "quips-dog": ["penny"] }, QUIPS.slice(2)],
    [
      "two facets, each matched",
      { "quips-dog": ["koda"], "quips-moment": ["happier"] },
      [["Koda", "Sam", "happier", "a"]],
    ],
  ])("%s", (_name, entries, expected) => {
    const facets = facetStates([DOG, MOMENT], filters(entries), 2, QUIPS);
    expect(filterRows(facets, 2, QUIPS)).toEqual(expected);
  });
});

describe("facetValues", () => {
  it.each([
    [0, 2, ["koda", "penny"]],
    [2, 2, ["happier", "upset"]],
    [0, 0, ["koda", "penny"]],
  ])("column %i with %i grouped columns", (column, grouped, expected) => {
    expect(facetValues(column, grouped, QUIPS).map((value) => value.id)).toEqual(expected);
  });
});
