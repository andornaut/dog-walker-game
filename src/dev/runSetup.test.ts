import { describe, expect, it } from "vitest";

import {
  MAX_SEED,
  parseRunSetup,
  randomSeed,
  type RunSetup,
  type RunSetupLimits,
  runSetupLink,
  runSetupToQuery,
} from "./runSetup";

const limits: RunSetupLimits<"bo" | "koda" | "rex" | "zip", "collar" | "shoes"> = {
  dogIds: ["bo", "koda", "rex", "zip"],
  gearIds: ["collar", "shoes"],
  maxPackSize: 3,
  renamedDogIds: new Map([["dash", "rex"]]),
  speed: { max: 10, min: 0.1 },
  zoneCount: 4,
  zoneIds: ["street", "park", "shops", "homeStretch", "pawsPromenade"],
};
const NEW_SEED = 777;
const parse = (search: string) => parseRunSetup(limits, () => NEW_SEED, search);
const defaults: RunSetup = { dev: false, seed: NEW_SEED, speed: 1, zone: 1 };

describe("parseRunSetup", () => {
  it("uses a new seed and the defaults for an empty query", () => {
    expect(parse("")).toEqual({ notices: [], setup: defaults, warnings: [] });
  });

  it("reads every parameter, with or without a leading ?", () => {
    const expected = {
      notices: [],
      setup: {
        dev: true,
        gear: "shoes",
        money: 1250,
        pack: ["koda", "bo"],
        seed: 42,
        speed: 1.5,
        zone: 3,
      },
      warnings: [],
    };
    const query = "seed=42&pack=koda,bo&gear=shoes&zone=3&money=1250&speed=1.5&dev=1";
    expect(parse(query)).toEqual(expected);
    expect(parse(`?${query}`)).toEqual(expected);
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

  it("accepts the full unsigned 32-bit seed range", () => {
    expect(parse("seed=0").setup.seed).toBe(0);
    expect(parse(`seed=${MAX_SEED}`).setup.seed).toBe(MAX_SEED);
  });

  it("reads gear=none as walking with no gear", () => {
    expect(parse("gear=none")).toEqual({
      notices: [],
      setup: { ...defaults, gear: null },
      warnings: [],
    });
  });

  it("reads dev=0 as off", () => {
    expect(parse("dev=0")).toEqual({ notices: [], setup: defaults, warnings: [] });
  });

  it.each([
    ["seed", "-1"],
    ["seed", "1.5"],
    ["seed", "abc"],
    ["seed", `${MAX_SEED + 1}`],
    ["seed", ""],
    ["pack", ""],
    ["pack", "koda,nobody"],
    ["pack", "koda,koda"],
    ["pack", "koda,bo,rex,zip"],
    ["pack", "koda,"],
    ["gear", "cape"],
    ["gear", ""],
    ["zone", "0"],
    ["zone", "5"],
    ["zone", "2.5"],
    ["money", "-100"],
    ["money", "12.5"],
    ["money", "99999999999999999999"],
    ["speed", "0"],
    ["speed", "11"],
    ["speed", "fast"],
    ["speed", ""],
    ["dev", "yes"],
    ["dev", ""],
  ])("warns about and ignores %s=%j", (name, value) => {
    const { setup, warnings } = parse(`${name}=${encodeURIComponent(value)}`);
    expect(setup).toEqual(defaults);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(`Invalid ${name}`);
  });

  it("replaces a renamed dog id with its new one, with a notice", () => {
    expect(parse("pack=koda,dash")).toEqual({
      notices: ['Dog "dash" is now "rex"; used "rex"'],
      setup: { ...defaults, pack: ["koda", "rex"] },
      warnings: [],
    });
  });

  it("names the unknown dogs in its warning", () => {
    expect(parse("pack=koda,nobody,ghost").warnings[0]).toContain("not nobody, ghost");
  });

  it("warns about unknown and repeated parameters and keeps the rest", () => {
    const { setup, warnings } = parse("seed=9&color=red&zone=2&zone=3");
    expect(setup).toEqual({ ...defaults, seed: 9 });
    expect(warnings).toEqual([
      'Unknown parameter "color"',
      'Parameter "zone" appears 2 times; ignored',
    ]);
  });

  it("collects one warning per bad parameter", () => {
    expect(parse("seed=x&zone=9&speed=0&dev=2&gear=cape").warnings).toHaveLength(5);
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

  it.each([
    ["route=street,bogus", "known zone ids"],
    ["route=street,street", "different zone ids"],
    ["route=street&zone=3", "3 to 4 different zone ids"],
    ["route=street,park,shops,homeStretch,pawsPromenade", "1 to 4 different zone ids"],
  ])("ignores %s with a warning", (search, expected) => {
    const { setup, warnings } = parse(search);
    expect(setup.route).toBeUndefined();
    expect(warnings.join()).toContain(expected);
  });
});

describe("runSetupToQuery", () => {
  it("writes only the seed for a default setup", () => {
    expect(runSetupToQuery(defaults)).toBe(`seed=${NEW_SEED}`);
  });

  it("writes gear none for a setup with no gear", () => {
    expect(runSetupToQuery({ ...defaults, gear: null })).toBe(`seed=${NEW_SEED}&gear=none`);
  });

  it.each<RunSetup>([
    defaults,
    { ...defaults, gear: null },
    { dev: true, gear: "collar", money: 0, pack: ["zip"], seed: 0, speed: 0.1, zone: 4 },
    { dev: false, money: 99, pack: ["rex", "bo", "koda"], seed: MAX_SEED, speed: 0.3, zone: 2 },
    { ...defaults, route: ["street", "pawsPromenade"], zone: 2 },
    { ...defaults, speed: 0.1 + 0.2 },
  ])("round-trips through parseRunSetup: %j", (setup) => {
    expect(parse(runSetupToQuery(setup))).toEqual({ notices: [], setup, warnings: [] });
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

describe("randomSeed", () => {
  it("returns integers in the seed range", () => {
    for (let i = 0; i < 100; i++) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(MAX_SEED);
    }
  });
});
