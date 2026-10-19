import type { Scene } from "phaser";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { animationKey, animationSpecs } from "../assets/asepriteAnimations";
import { splitDepthKey, stepSize } from "../assets/depthSteps";
import {
  energyIconKey,
  needIconKey,
  statusIconKey,
  temperamentIconKey,
  traitIconKey,
} from "../assets/iconKeys";
import { parseManifest } from "../assets/manifest";
import {
  CARD_FRAME_KEY,
  cardFrameTag,
  depthVariantKey,
  DIFFICULTY_KEY,
  dogFaceKey,
  doghouseTag,
  dogPortraitKey,
  dogSpriteKey,
  encounterSpriteKey,
  kebabCase,
  MOVER_SPRITES,
  NEED_ART,
  needSpotSpriteKey,
  ownerFaceKey,
  ZONE_PIPS_KEY,
} from "../assets/spriteKeys";
import { hitCue, MUSIC_KEY, SOUND_KEYS, soundKeysOf } from "../audio/sound";
import { gameData } from "../data";
import type {
  DebuffId,
  DogId,
  EncounterId,
  Energy,
  ForcedStopId,
  GearId,
  NeedCardId,
  NeedId,
  NeedSpotId,
  Temperament,
  TraitId,
  UpgradeId,
  ZoneId,
} from "../data/types";
import { badgeWall } from "../home/badgesView";
import { pipLook, zonePips } from "../hud/hudView";
import { stripIconKey } from "../hud/stateStrip";
import { SCALE_STEPS } from "../layout/projection";
import { cardFor } from "../rules/choices";
import { hitLabel } from "../rules/encounters";
import { walkLength } from "../rules/route";
import { faceMood } from "../rules/treats";
import type { PullPose } from "../runner/pulls";
import { type DogStatusId, statusOverlayKey } from "../runner/statuses";
import type { CardSource } from "../state/runState";
import { testState } from "../testing/runState";
import { hitBurstKey, hitLook } from "./hitMoment";

const manifest = parseManifest(shippedManifest);
const images = new Set(manifest.images.map(({ key }) => key));
const sprites = new Map(manifest.sprites.map((entry) => [entry.key, entry]));
const sheets = import.meta.glob<unknown>("../../public/art/sprites/*.json", {
  eager: true,
  import: "default",
});

function sheetOf(key: string): unknown {
  const entry = sprites.get(key);
  return entry === undefined ? undefined : sheets[`../../public/art/${entry.json}`];
}

// Each wanted tag the sprite lacks as key:tag, or the bare key when there is no such sprite.
function missingTags(key: string, tags: readonly string[]): string[] {
  const sheet = sheetOf(key);
  if (sheet === undefined) {
    return [key];
  }
  const have = new Set(animationSpecs(key, sheet).map((spec) => spec.key));
  return tags.filter((tag) => !have.has(animationKey(key, tag))).map((tag) => `${key}:${tag}`);
}

function missingImages(keys: readonly string[]): string[] {
  return keys.filter((key) => !images.has(key));
}

// The keys of a record typed over a union, so a new member is a compile error until listed.
function members<K extends string>(record: Readonly<Record<K, true>>): K[] {
  return Object.keys(record) as K[];
}

const DOGS = Object.keys(gameData.dogs) as DogId[];
const ENCOUNTERS = Object.keys(gameData.encounters) as EncounterId[];
const STATUSES = members<DogStatusId>({ soaked: true, spooked: true, stinky: true });
const TEMPERAMENTS = members<Temperament>({ dramatic: true, fussy: true, laidBack: true });
const PULL_TAGS = members<PullPose["tag"]>({ pull: true, tell: true });
// The steps below 1 at which any of keys has a variant. Art adds a step to a whole family of
// sprites at once, so each of them must then have it.
function variantSteps(keys: readonly string[]): number[] {
  return SCALE_STEPS.filter(
    (step) => step < 1 && keys.some((key) => sprites.has(depthVariantKey(key, step) ?? "")),
  );
}

// Every mood a face can show, from no hearts up to well past any maximum.
const MOODS = [...new Set(Array.from({ length: 21 }, (_, hearts) => faceMood(gameData, hearts)))];

// A scene that has loaded exactly the shipped art.
const loadedScene = {
  textures: { exists: (key: string) => images.has(key) || sprites.has(key) },
} as unknown as Scene;

describe("dog art", () => {
  it("names a road sprite with every pose, pull and hit tag for every dog", () => {
    const tags = ["idle", "walk", "react", ...PULL_TAGS];
    expect(DOGS.flatMap((dog) => missingTags(dogSpriteKey(gameData, dog), tags))).toEqual([]);
  });

  it("names a hand-drawn depth variant for every dog at every step any dog has", () => {
    const keys = DOGS.map((dog) => dogSpriteKey(gameData, dog));
    const steps = variantSteps(keys);
    expect(steps).toEqual(expect.arrayContaining([0.75, 0.5]));
    const missing = keys.flatMap((key) =>
      steps
        .map((step) => depthVariantKey(key, step) ?? "")
        .filter((variant) => !sprites.has(variant)),
    );
    expect(missing).toEqual([]);
  });

  it("names a face with every mood for every dog, and its owner's with fired too", () => {
    const missing = DOGS.flatMap((dog) => [
      ...missingTags(dogFaceKey(gameData, dog), MOODS),
      ...missingTags(ownerFaceKey(gameData, dog), [...MOODS, "fired"]),
    ]);
    expect(MOODS).toEqual(expect.arrayContaining(["happy", "neutral", "upset"]));
    expect(missing).toEqual([]);
  });

  it("names a doghouse roof for every dog and the empty house", () => {
    const tags = [...DOGS.map((dog) => doghouseTag(gameData, dog)), doghouseTag(gameData, null)];
    expect(missingTags("ui-doghouse", tags)).toEqual([]);
  });

  it.todo("names owner-<dog> with idle and wave through ownerSpriteKey, once return home lands");
});

describe("walker art", () => {
  it("names a road sprite and a picker face with their tags for every walker", () => {
    const missing = Object.values(gameData.walkers).flatMap(({ portraitKey, spriteKey }) => [
      ...missingTags(spriteKey, ["idle", "walk", "stumble"]),
      ...missingTags(portraitKey, ["happy", "neutral"]),
    ]);
    expect(missing).toEqual([]);
  });

  it("has the default walker's sprite, which stands in for a walker whose art is missing", () => {
    expect(sprites.has(gameData.walkers[gameData.defaultWalker].spriteKey)).toBe(true);
  });
});

describe("image art", () => {
  it.each<[string, () => string[]]>([
    ["a portrait for every dog", () => DOGS.map((dog) => dogPortraitKey(gameData, dog))],
    [
      "a strip icon for every debuff, upgrade and gear item",
      () => [
        ...(Object.keys(gameData.debuffs) as DebuffId[]).map((debuff) =>
          stripIconKey({ debuff, kind: "debuff" }),
        ),
        ...(Object.keys(gameData.upgrades) as UpgradeId[]).map((upgrade) =>
          stripIconKey({ kind: "upgrade", upgrade }),
        ),
        ...(Object.keys(gameData.shopGear) as GearId[]).map((gear) =>
          stripIconKey({ gear, kind: "gear" }),
        ),
      ],
    ],
    [
      "an icon for every trait, energy and temperament",
      () => [
        ...members<TraitId>({ chaser: true, fancy: true, foodDriven: true }).map(traitIconKey),
        ...members<Energy>({ calm: true, hyper: true, steady: true }).map(energyIconKey),
        ...TEMPERAMENTS.map(temperamentIconKey),
      ],
    ],
    ["a help illustration for every help page", () => gameData.help.map(({ art }) => art)],
    [
      "card art for every option of every need card",
      () =>
        Object.values(gameData.needCards).flatMap(({ options }) => options.map(({ art }) => art)),
    ],
  ])("names %s", (_, keys) => {
    expect(missingImages(keys())).toEqual([]);
  });
});

describe("icon art", () => {
  it("names a slot icon and a looping overlay for every status at every step any overlay has", () => {
    const steps = [1, ...variantSteps(STATUSES.map(statusOverlayKey))];
    expect(steps).toEqual(expect.arrayContaining([0.75, 0.5]));
    const missing = STATUSES.flatMap((status) => {
      const overlay = statusOverlayKey(status);
      return [
        ...missingImages([statusIconKey(status)]),
        ...steps.flatMap((step) =>
          missingTags(depthVariantKey(overlay, step) ?? overlay, ["loop"]),
        ),
      ];
    });
    expect(missing).toEqual([]);
  });

  it("names a badge with earned and locked for every achievement", () => {
    const badges = badgeWall(gameData, { achievements: {} });
    expect(badges).toHaveLength(Object.keys(gameData.achievements).length);
    expect(badges.flatMap(({ art }) => missingTags(art, ["earned", "locked"]))).toEqual([]);
  });

  it("tags ui-zone-pips with every route pip, for every zone", () => {
    const length = walkLength(gameData);
    const tags = gameData.world.zones.flatMap((zone) => {
      const route = Array.from({ length }, () => zone.id as ZoneId);
      return Array.from({ length }, (_, index) =>
        zonePips(length, route.slice(0, index + 1), index, 0.5).map(
          (pip) => pipLook(gameData, pip).tag,
        ),
      ).flat();
    });
    expect(tags).toEqual(expect.arrayContaining(["todo", "woof-way", "woof-way-done"]));
    expect(missingTags(ZONE_PIPS_KEY, [...new Set(tags)])).toEqual([]);
  });

  it("tags ui-difficulty with the paws of every zone's difficulty", () => {
    const tags = gameData.world.zones.map(({ difficulty }) => String(difficulty));
    expect(missingTags(DIFFICULTY_KEY, ["1", "2", "3", "4", "5", ...tags])).toEqual([]);
  });

  it("tags ui-fired-plate with every owner temperament", () => {
    expect(missingTags("ui-fired-plate", TEMPERAMENTS.map(kebabCase))).toEqual([]);
  });

  it("tags ui-fires, the card marker for an option that fires an owner, static and pulse", () => {
    expect(missingTags("ui-fires", ["static", "pulse"])).toEqual([]);
  });
});

describe("card art", () => {
  it("tags both card frames with the frame of every card source", () => {
    const sources: CardSource[] = [
      ...ENCOUNTERS.map((encounter): CardSource => ({
        affected: [],
        encounter,
        kind: "encounter",
      })),
      ...(Object.keys(gameData.forcedStops) as ForcedStopId[]).map((stop): CardSource => ({
        kind: "forcedStop",
        stop,
      })),
      { kind: "upgradeOffer", offered: ["bellyRubs", "bigTipper", "raincoats"] },
      ...(Object.keys(gameData.needCards) as NeedCardId[]).map((card): CardSource => ({
        affected: [],
        card,
        kind: "need",
      })),
      { kind: "fork", paths: ["park"] },
    ];
    const tags = [...new Set(sources.map((source) => cardFrameTag(gameData, source)))];
    expect(tags).toHaveLength(5);
    const missing = [CARD_FRAME_KEY, "card-frame-large"].flatMap((key) => missingTags(key, tags));
    expect(missing).toEqual([]);
  });

  it("names a card preview for every zone, as a fork's path card shows it", () => {
    const zones = gameData.world.zones.map(({ id }) => id as ZoneId);
    const arts = [zones.slice(0, 3), zones.slice(3)].flatMap((paths) =>
      cardFor(gameData, testState({ koda: 4 }), { kind: "fork", paths }).options.map(
        ({ art }) => art,
      ),
    );
    expect(arts).toHaveLength(zones.length);
    expect(missingImages(arts)).toEqual([]);
  });
});

describe("need art", () => {
  const NEEDS = Object.keys(gameData.needs) as NeedId[];

  it("names an icon for every need", () => {
    expect(NEEDS.flatMap((need) => missingTags(needIconKey(need), ["normal"]))).toEqual([]);
  });

  it("tags the pull bubble with idle, show and urgent, and names the blocked mark", () => {
    expect(missingTags(NEED_ART.bubble, ["idle", "show", "urgent"])).toEqual([]);
    expect(sprites.has(NEED_ART.pullBlocked)).toBe(true);
  });

  it("names the pull fail, need met, accident and accident spot effects with their tags", () => {
    const missing = [
      ...missingTags(NEED_ART.pullFail, ["play"]),
      ...missingTags(NEED_ART.needMet, NEEDS),
      ...missingTags(NEED_ART.accident, ["play"]),
      ...missingTags(NEED_ART.accidentSpot, ["idle"]),
    ];
    expect(missing).toEqual([]);
  });

  // The other dog reuses its obstacle's art.
  it("names a road sprite for every need spot with its own art, at every step any spot has", () => {
    const spots = Object.keys(gameData.needSpots) as NeedSpotId[];
    const own = spots
      .map(needSpotSpriteKey)
      .filter((key) => key !== encounterSpriteKey("otherDog"));
    expect(own).toHaveLength(5);
    const steps = variantSteps(own);
    expect(steps).toEqual(expect.arrayContaining([0.75, 0.5]));
    const missing = own.flatMap((key) => {
      return [
        ...missingTags(key, ["idle"]),
        ...steps
          .map((step) => depthVariantKey(key, step) ?? "")
          .filter((variant) => !sprites.has(variant)),
      ];
    });
    expect(missing).toEqual([]);
    expect(missingTags(needSpotSpriteKey("stranger"), ["wave"])).toEqual([]);
  });
});

describe("hit moment art", () => {
  const hits = ENCOUNTERS.filter((id) => hitLabel(gameData.encounters[id]) !== null);
  const lookOf = (id: EncounterId) => hitLook(gameData.encounters[id].kind, id);

  it("names a burst with play, its plate's tag and any edge flash for every hit moment", () => {
    const missing = hits.flatMap((id) => {
      const look = lookOf(id);
      return [
        ...missingTags(look.burst, ["play"]),
        ...missingTags("ui-hit-label", [look.plate]),
        ...(look.flash === null ? [] : missingTags(look.flash, ["play"])),
      ];
    });
    expect(hits).toEqual(expect.arrayContaining(["goose", "lemonade", "otherDog"]));
    expect(missing).toEqual([]);
  });

  it("flashes the edges for every obstacle, and for no lucky find", () => {
    const flashed = hits.filter((id) => lookOf(id).flash !== null);
    expect(flashed).toEqual(hits.filter((id) => gameData.encounters[id].kind === "obstacle"));
    expect(lookOf("goose").flash).toBe("ui-hit-flash-white");
    expect(lookOf("lemonade")).toEqual({ burst: "fx-lemonade", flash: null, plate: "lucky" });
  });

  it("gives every hit moment its own burst, with fx-bump as the fallback for one without", () => {
    expect(missingTags("fx-bump", ["play"])).toEqual([]);
    expect(hits.filter((id) => hitBurstKey(loadedScene, lookOf(id)) === "fx-bump")).toEqual([]);
  });
});

describe("road object art", () => {
  it("names a road sprite for every encounter, at every step any encounter has", () => {
    const keys = ENCOUNTERS.map(encounterSpriteKey);
    const steps = [1, ...variantSteps(keys)];
    expect(steps).toEqual(expect.arrayContaining([0.75, 0.5]));
    const missing = keys.flatMap((key) =>
      steps.map((step) => depthVariantKey(key, step) ?? key).filter((key) => !sprites.has(key)),
    );
    expect(missing).toEqual([]);
  });

  it("tags every mover's sprite with its moving tag and any idle tag, at every step it has", () => {
    const missing = Object.values(MOVER_SPRITES).flatMap((sprite) => {
      const tags = "idle" in sprite ? [sprite.tag, sprite.idle] : [sprite.tag];
      return [1, ...variantSteps([sprite.key])].flatMap((step) =>
        missingTags(depthVariantKey(sprite.key, step) ?? sprite.key, tags),
      );
    });
    expect(missing).toEqual([]);
  });
});

describe("depth variants", () => {
  const frameSize = v.object({
    frames: v.record(
      v.string(),
      v.object({ sourceSize: v.object({ h: v.number(), w: v.number() }) }),
    ),
  });

  function sizeOf(key: string): { h: number; w: number } | undefined {
    return Object.values(v.parse(frameSize, sheetOf(key)).frames)[0]?.sourceSize;
  }

  function durationsByTag(key: string): Record<string, number[]> {
    return Object.fromEntries(
      animationSpecs(key, sheetOf(key)).map((spec) => [
        spec.key.slice(key.length + 1),
        spec.frames.map(({ duration }) => duration),
      ]),
    );
  }

  it("draw each variant at its step's exact scale of the base size, with the base's tags and timing", () => {
    const variants = [...sprites.keys()].filter((key) => key.includes("@"));
    expect(variants.length).toBeGreaterThan(0);
    for (const variant of variants) {
      const { base, step } = splitDepthKey(variant);
      expect(step.scale, variant).toBeLessThan(1);
      expect(durationsByTag(variant), variant).toEqual(durationsByTag(base));
      const full = sizeOf(base);
      expect(sizeOf(variant), variant).toEqual(
        full === undefined
          ? undefined
          : { h: stepSize(full.h, step.scale), w: stepSize(full.w, step.scale) },
      );
    }
  });
});

describe("sound art", () => {
  const sounds = new Map(manifest.sounds.map((sound) => [sound.key, sound]));

  it("names a manifest sound for every cue, and a looping walk music", () => {
    expect(Object.values(SOUND_KEYS).filter((key) => !sounds.has(key))).toEqual([]);
    expect(sounds.get(MUSIC_KEY)?.loop).toBe(true);
  });

  it("has its own hit sound for every encounter with a hit moment", () => {
    const hits = ENCOUNTERS.filter((id) => hitLabel(gameData.encounters[id]) !== null);
    const keys = hits.map((id) => soundKeysOf(hitCue(gameData.encounters[id].kind, id))[0] ?? "");
    expect(keys).toEqual(expect.arrayContaining(["sfx-hit-goose", "sfx-lemonade"]));
    expect(keys.filter((key) => !sounds.has(key))).toEqual([]);
  });
});
