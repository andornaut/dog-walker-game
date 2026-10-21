// A run's starting conditions, read from the page's URL search params so a link reproduces a
// run. The known ids and limits come in as parameters, so this module needs no game data.

export interface RunSetupLimits<
  DogId extends string,
  GearId extends string,
  WalkerId extends string = string,
> {
  readonly dogIds: readonly DogId[];
  readonly gearIds: readonly GearId[];
  readonly maxPackSize: number;
  // Former dog ids and the id each one is now.
  readonly renamedDogIds: ReadonlyMap<string, DogId>;
  readonly speed: { readonly max: number; readonly min: number };
  readonly walkerIds: readonly WalkerId[];
  // The zones a walk visits.
  readonly zoneCount: number;
  readonly zoneIds: readonly string[];
}

// Optional fields are overrides: absent means the run uses its normal value. gear null means
// the run walks with no gear (gear=none).
export interface RunSetup<
  DogId extends string = string,
  GearId extends string = string,
  WalkerId extends string = string,
> {
  readonly dev: boolean;
  readonly gear?: GearId | null;
  readonly money?: number;
  readonly pack?: readonly DogId[];
  // The zones walked from the first up to the starting zone, by id; at least zone of them.
  // Without it, a later start walked the pre-fork route.
  readonly route?: readonly string[];
  readonly seed: number;
  // Multiplies the road's scroll speed.
  readonly speed: number;
  readonly walker?: WalkerId;
  // 1-based, as the URL writes it.
  readonly zone: number;
}

// A warning is a value ignored; a notice is a value used after a change, such as a renamed
// dog id replaced by its new one.
export interface ParsedRunSetup<
  DogId extends string,
  GearId extends string,
  WalkerId extends string = string,
> {
  readonly notices: readonly string[];
  readonly setup: RunSetup<DogId, GearId, WalkerId>;
  readonly warnings: readonly string[];
}

// seededRandom reads its seed as an unsigned 32-bit integer, so any other number would be
// silently changed and the reported seed would not be the one used.
export const MAX_SEED = 0xffffffff;

export const NO_GEAR = "none";

const PARAM_NAMES = [
  "dev",
  "gear",
  "money",
  "pack",
  "route",
  "seed",
  "speed",
  "walker",
  "zone",
] as const;
type ParamName = (typeof PARAM_NAMES)[number];

const DIGITS = /^\d+$/;

// A seed for a URL without one: uniform over the seeds seededRandom distinguishes.
export function randomSeed(): number {
  return Math.floor(Math.random() * (MAX_SEED + 1));
}

function isParamName(name: string): name is ParamName {
  return (PARAM_NAMES as readonly string[]).includes(name);
}

function includes<Id extends string>(ids: readonly Id[], value: string): value is Id {
  return (ids as readonly string[]).includes(value);
}

function wholeNumber(text: string): number | undefined {
  return DIGITS.test(text) ? Number(text) : undefined;
}

// Never throws: every unknown or invalid value becomes a warning and is ignored, and every
// renamed dog id becomes a notice and is replaced. newSeed is called only when the URL has no
// valid seed.
export function parseRunSetup<DogId extends string, GearId extends string, WalkerId extends string>(
  limits: RunSetupLimits<DogId, GearId, WalkerId>,
  newSeed: () => number,
  search: string,
): ParsedRunSetup<DogId, GearId, WalkerId> {
  const params = new URLSearchParams(search);
  const notices: string[] = [];
  const warnings: string[] = [];
  const values = new Map<ParamName, string>();
  for (const name of new Set(params.keys())) {
    const all = params.getAll(name);
    if (!isParamName(name)) {
      warnings.push(`Unknown parameter "${name}"`);
    } else if (all.length > 1) {
      warnings.push(`Parameter "${name}" appears ${all.length} times; ignored`);
    } else {
      values.set(name, all[0] ?? "");
    }
  }
  const invalid = (name: ParamName, value: string, expected: string): undefined => {
    warnings.push(`Invalid ${name} "${value}": expected ${expected}; ignored`);
    return undefined;
  };
  const read = <T>(name: ParamName, parse: (value: string) => T | undefined): T | undefined => {
    const value = values.get(name);
    return value === undefined ? undefined : parse(value);
  };

  const seed = read("seed", (value) => {
    const number = wholeNumber(value);
    return number !== undefined && number <= MAX_SEED
      ? number
      : invalid("seed", value, `an integer from 0 to ${MAX_SEED}`);
  });
  const pack = read("pack", (value) => {
    const ids = (value === "" ? [] : value.split(",")).map((id) => {
      const renamed = limits.renamedDogIds.get(id);
      if (renamed === undefined) {
        return id;
      }
      notices.push(`Dog "${id}" is now "${renamed}"; used "${renamed}"`);
      return renamed;
    });
    const known = ids.filter((id) => includes(limits.dogIds, id));
    if (known.length < ids.length) {
      const unknown = ids.filter((id) => !includes(limits.dogIds, id));
      return invalid("pack", value, `known dog ids, not ${unknown.join(", ")}`);
    }
    if (ids.length === 0 || ids.length > limits.maxPackSize || new Set(ids).size < ids.length) {
      return invalid("pack", value, `1 to ${limits.maxPackSize} different dog ids`);
    }
    return known;
  });
  const gear = read("gear", (value) => {
    if (value === NO_GEAR) {
      return null;
    }
    return includes(limits.gearIds, value)
      ? value
      : invalid("gear", value, `a known gear id or "${NO_GEAR}"`);
  });
  const walker = read("walker", (value) =>
    includes(limits.walkerIds, value) ? value : invalid("walker", value, "a known walker id"),
  );
  const zone = read("zone", (value) => {
    const number = wholeNumber(value);
    return number !== undefined && number >= 1 && number <= limits.zoneCount
      ? number
      : invalid("zone", value, `an integer from 1 to ${limits.zoneCount}`);
  });
  const money = read("money", (value) => {
    const number = wholeNumber(value);
    return number !== undefined && Number.isSafeInteger(number)
      ? number
      : invalid("money", value, "a whole number of cents");
  });
  const speed = read("speed", (value) => {
    const number = value.trim() === "" ? Number.NaN : Number(value);
    return number >= limits.speed.min && number <= limits.speed.max
      ? number
      : invalid("speed", value, `a number from ${limits.speed.min} to ${limits.speed.max}`);
  });
  const dev = read("dev", (value) => {
    if (value === "1") {
      return true;
    }
    return value === "0" ? false : invalid("dev", value, "1 or 0");
  });
  const startZone = zone ?? 1;
  const route = read("route", (value) => {
    const ids = value === "" ? [] : value.split(",");
    const expected = `${startZone} to ${limits.zoneCount} different zone ids`;
    const unknown = ids.filter((id) => !includes(limits.zoneIds, id));
    if (unknown.length > 0) {
      return invalid("route", value, `known zone ids, not ${unknown.join(", ")}`);
    }
    return ids.length < startZone || ids.length > limits.zoneCount || new Set(ids).size < ids.length
      ? invalid("route", value, expected)
      : ids;
  });

  return {
    notices,
    setup: {
      dev: dev ?? false,
      ...(gear === undefined ? {} : { gear }),
      ...(money === undefined ? {} : { money }),
      ...(pack === undefined ? {} : { pack }),
      ...(route === undefined ? {} : { route }),
      seed: seed ?? newSeed(),
      speed: speed ?? 1,
      ...(walker === undefined ? {} : { walker }),
      zone: zone ?? 1,
    },
    warnings,
  };
}

// The inverse of parseRunSetup, without a leading "?". The seed is always written; values at
// their defaults are left out.
export function runSetupToQuery(setup: RunSetup): string {
  const parts: string[] = [`seed=${setup.seed}`];
  if (setup.pack !== undefined) {
    parts.push(`pack=${setup.pack.map(encodeURIComponent).join(",")}`);
  }
  if (setup.gear !== undefined) {
    parts.push(`gear=${encodeURIComponent(setup.gear ?? NO_GEAR)}`);
  }
  if (setup.walker !== undefined) {
    parts.push(`walker=${encodeURIComponent(setup.walker)}`);
  }
  if (setup.zone !== 1) {
    parts.push(`zone=${setup.zone}`);
  }
  if (setup.route !== undefined) {
    parts.push(`route=${setup.route.map(encodeURIComponent).join(",")}`);
  }
  if (setup.money !== undefined) {
    parts.push(`money=${setup.money}`);
  }
  if (setup.speed !== 1) {
    parts.push(`speed=${setup.speed}`);
  }
  if (setup.dev) {
    parts.push("dev=1");
  }
  return parts.join("&");
}

// pageUrl with its query replaced by the setup's and its hash dropped.
export function runSetupLink(pageUrl: string, setup: RunSetup): string {
  const url = new URL(pageUrl);
  url.search = runSetupToQuery(setup);
  url.hash = "";
  return url.toString();
}
