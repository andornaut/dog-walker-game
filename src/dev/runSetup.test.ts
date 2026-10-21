import { describe, expect, it } from "vitest";

import {
  MAX_SEED,
  parseRunSetup,
  type RunSetup,
  type RunSetupLimits,
  runSetupLink,
  runSetupToQuery,
} from "./runSetup";

const limits: RunSetupLimits<"bo" | "koda" | "rex" | "zip", "collar" | "shoes"> = {
  dogIds: ["bo", "koda", "rex", "zip"],
  gearIds: ["collar", "shoes"],
  maxPackSize: 3,
  speed: { max: 10, min: 0.1 },
  walkerIds: ["ada", "casey"],
  zoneCount: 4,
  zoneIds: ["street", "park", "shops", "homeStretch", "pawsPromenade"],
};
const NEW_SEED = 777;
const parse = (search: string) => parseRunSetup(limits, () => NEW_SEED, search);
const defaults: RunSetup = { dev: false, seed: NEW_SEED, speed: 1, zone: 1 };

describe("parseRunSetup", () => {
  const every: RunSetup = {
    dev: true,
    gear: "shoes",
    money: 1250,
    pack: ["koda", "bo"],
    seed: 42,
    speed: 1.5,
    walker: "ada",
    zone: 3,
  };
  const query = "seed=42&pack=koda,bo&gear=shoes&walker=ada&zone=3&money=1250&speed=1.5&dev=1";

  const valid: { name: string; search: string; setup: RunSetup }[] = [
    { name: "uses a new seed and the defaults for an empty query", search: "", setup: defaults },
    { name: "reads every parameter", search: query, setup: every },
    { name: "reads every parameter after a leading ?", search: `?${query}`, setup: every },
    { name: "accepts the lowest seed", search: "seed=0", setup: { ...defaults, seed: 0 } },
    {
      name: "accepts the highest unsigned 32-bit seed",
      search: `seed=${MAX_SEED}`,
      setup: { ...defaults, seed: MAX_SEED },
    },
    {
      name: "reads gear=none as walking with no gear",
      search: "gear=none",
      setup: { ...defaults, gear: null },
    },
    { name: "reads dev=0 as off", search: "dev=0", setup: defaults },
  ];

  it("reads each valid query, with a new seed and the defaults for what it leaves out", () => {
    for (const { name, search, setup } of valid) {
      expect(parse(search), name).toEqual({ setup, warnings: [] });
    }
  });

  it("calls newSeed only when the URL has no valid seed", () => {
    let calls = 0;
    const counting = () => {
      calls++;
      return NEW_SEED;
    };
    parseRunSetup(limits, counting, "seed=5");
    expect(calls).toBe(0);
    expect(parseRunSetup(limits, counting, "seed=x").setup.seed).toBe(NEW_SEED);
    expect(calls).toBe(1);
  });

  const invalid = [
    ["seed", "-1"],
    ["seed", "1.5"],
    ["seed", `${MAX_SEED + 1}`],
    ["pack", ""],
    ["pack", "koda,nobody"],
    ["pack", "koda,koda"],
    ["pack", "koda,bo,rex,zip"],
    ["gear", "cape"],
    ["walker", "bob"],
    ["zone", "0"],
    ["zone", "5"],
    ["zone", "2.5"],
    ["money", "-100"],
    ["money", "99999999999999999999"],
    ["speed", "0"],
    ["speed", "11"],
    ["speed", "fast"],
    ["speed", ""],
    ["dev", "yes"],
  ] as const;

  it("warns about and ignores each invalid value", () => {
    for (const [name, value] of invalid) {
      const { setup, warnings } = parse(`${name}=${encodeURIComponent(value)}`);
      expect(setup, `${name}=${value}`).toEqual(defaults);
      expect(warnings, `${name}=${value}`).toEqual([expect.stringContaining(`Invalid ${name}`)]);
    }
  });

  it("warns about unknown and repeated parameters and keeps the rest", () => {
    const { setup, warnings } = parse("seed=9&color=red&zone=2&zone=3");
    expect(setup).toEqual({ ...defaults, seed: 9 });
    expect(warnings).toEqual([
      'Unknown parameter "color"',
      'Parameter "zone" appears 2 times; ignored',
    ]);
  });

  it("never throws on malformed input", () => {
    for (const search of ["%", "?&&==&", "seed=%ZZ", "=1", "pack=%2C%2C"]) {
      expect(() => parse(search)).not.toThrow();
    }
  });
});

describe("the route parameter", () => {
  it("reads the zones walked up to the starting zone", () => {
    expect(parse("route=street,park,shops&zone=2").setup.route).toEqual([
      "street",
      "park",
      "shops",
    ]);
  });

  it("ignores a route of unknown or repeated zones, or one that doesn't reach the zone, with a warning", () => {
    for (const search of ["route=street,bogus", "route=street,street", "route=street&zone=3"]) {
      const { setup, warnings } = parse(search);
      expect(setup.route, search).toBeUndefined();
      expect(warnings, search).toHaveLength(1);
    }
  });
});

describe("runSetupToQuery", () => {
  it("round-trips setups through parseRunSetup", () => {
    const setups: RunSetup[] = [
      defaults,
      { ...defaults, gear: null },
      { dev: true, gear: "collar", money: 0, pack: ["zip"], seed: 0, speed: 0.1, zone: 4 },
      { ...defaults, route: ["street", "pawsPromenade"], walker: "casey", zone: 2 },
      { ...defaults, speed: 0.1 + 0.2 },
    ];
    for (const setup of setups) {
      expect(parse(runSetupToQuery(setup))).toEqual({ setup, warnings: [] });
    }
  });
});

describe("runSetupLink", () => {
  it("replaces the page's query and drops its hash", () => {
    const setup: RunSetup = { ...defaults, pack: ["koda", "bo"], seed: 12 };
    expect(runSetupLink("https://example.com/play/?seed=1&dev=1#top", setup)).toBe(
      "https://example.com/play/?seed=12&pack=koda,bo",
    );
  });
});
