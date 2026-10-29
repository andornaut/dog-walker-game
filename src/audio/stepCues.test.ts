import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { parseManifest } from "../assets/manifest";
import { DOGS } from "../data/dogs";
import { ENCOUNTERS } from "../data/encounters";
import { SHOP_GEAR } from "../data/shop";
import { TUNING } from "../data/tuning";
import type { GearId, WalkerId } from "../data/types";
import { WALKERS } from "../data/walkers";
import { seededRandom } from "../lib/random";
import { keysOf } from "../lib/records";
import { cents } from "../lib/units";
import { startRoad, stepWalk, type Walk } from "../runner/walk";
import type { WalkItem } from "../runner/walkItems";
import { newRun, type PackDogs } from "../state/runState";
import { atPack, data, geometry, tuning } from "../testing/walk";
import { hitCue, type SoundCue, soundKeyFor } from "./sound";
import { stepCues } from "./stepCues";

const sounds = new Set(parseManifest(shippedManifest).sounds.map(({ key }) => key));
const loaded = (key: string) => sounds.has(key);

// The test tuning pins the dodge chances and Second chance to 0; these walks take the game's.
const walkData = {
  ...data,
  tuning: {
    ...tuning,
    hearts: { ...tuning.hearts, secondChanceForgiven: TUNING.hearts.secondChanceForgiven },
    probability: TUNING.probability,
  },
};

const GEAR = keysOf(SHOP_GEAR);
const SMALL_DOG = keysOf(DOGS).find((id) => DOGS[id].size === "small") ?? "biscuit";
const SECOND_CHANCE: WalkerId =
  keysOf(WALKERS).find((id) => WALKERS[id].perk === "secondChance") ?? "casey";

interface Meeting {
  dogs?: PackDogs;
  // The walk's draws: 0 dodges every bump a dog may dodge, 1 none.
  draw?: number;
  gear?: GearId | null;
  run?: Partial<Walk["run"]>;
  walker?: WalkerId;
}

interface Case {
  cue: SoundCue;
  meeting: Meeting;
  name: string;
  item: WalkItem;
}

// The cues of the step in which the pack meets item.
function cuesMeeting(item: WalkItem, meeting: Meeting): SoundCue[] {
  const { dogs = ["kilo"], draw = 1, gear = null, run = {}, walker = "casey" } = meeting;
  const walk: Walk = {
    road: { ...startRoad(5), items: [item], nextItemId: 1 },
    run: { ...newRun(walkData, 3, { dogs, gear, walker }), ...run },
  };
  return stepCues(
    walkData,
    stepWalk(walkData, geometry, () => draw, 0.01, walk),
  );
}

const spotlight = {
  debuffs: [{ debuff: "spotlight", secondsLeft: 20, untilZone: 0 }],
  money: cents(10_000),
} as const;
const stinky = { debuffs: [{ debuff: "stinky", secondsLeft: 20, untilZone: 0 }] } as const;

// Every kind of bump and pickup the pack meets on the road. A pull obstacle passes through the
// pack, so the pack never meets one; its tell barks.
const CASES: readonly Case[] = [
  { cue: "bump", item: atPack("cone"), meeting: {}, name: "a minor obstacle's bump" },
  {
    cue: "bump",
    item: atPack("cone"),
    meeting: { walker: SECOND_CHANCE },
    name: "a bump Second chance forgives",
  },
  { cue: "bump", item: atPack("cone"), meeting: { run: spotlight }, name: "a Spotlight bump" },
  {
    cue: "dodge",
    item: atPack("cone"),
    meeting: { dogs: [SMALL_DOG], draw: 0 },
    name: "a dodged bump",
  },
  ...keysOf(ENCOUNTERS)
    .filter((id) => ENCOUNTERS[id].resolution.kind !== "pull")
    .map((id): Case => ({
      cue: hitCue(ENCOUNTERS[id].kind, id),
      item: atPack(id),
      meeting: {},
      name: `${ENCOUNTERS[id].resolution.kind} ${id}`,
    })),
  ...GEAR.map((gear): Case => ({
    cue: "gearFound",
    item: atPack(gear),
    meeting: {},
    name: `${gear} found`,
  })),
  ...GEAR.map((gear): Case => ({
    cue: "gearFound",
    item: atPack(gear),
    meeting: { run: { foundGear: GEAR.find((other) => other !== gear) ?? null } },
    name: `${gear} swapped for the found item`,
  })),
  { cue: "tip", item: atPack("tip"), meeting: {}, name: "a tip" },
  { cue: "tip", item: atPack("tip"), meeting: { run: stinky }, name: "a Stinky tip" },
  { cue: "treat", item: atPack("treat"), meeting: {}, name: "a treat" },
  {
    cue: "treat",
    item: atPack("treat"),
    meeting: { dogs: ["kilo", "biscuit"], gear: "fannyPack" },
    name: "a treat stored as a spare treat",
  },
];

describe("stepCues", () => {
  it.each(CASES)("plays $cue for $name, from a shipped sound", ({ cue, item, meeting }) => {
    const cues = cuesMeeting(item, meeting);
    expect(cues).toEqual([cue]);
    expect(soundKeyFor(loaded, cue)).toBeDefined();
  });

  it("plays nothing for a step that meets nothing", () => {
    const walk: Walk = {
      road: startRoad(5),
      run: newRun(walkData, 3, { dogs: ["kilo"], gear: null, walker: "casey" }),
    };
    expect(stepCues(walkData, stepWalk(walkData, geometry, seededRandom(1), 0.01, walk))).toEqual(
      [],
    );
  });
});
