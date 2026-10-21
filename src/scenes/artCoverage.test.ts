import type { Scene } from "phaser";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { animationKey, animationSpecs } from "../assets/asepriteAnimations";
import { splitDepthKey, stepSize } from "../assets/depthSteps";
import { SQUIRREL_ICON_KEY, statusIconKey } from "../assets/iconKeys";
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
  minorObstacleSpriteKey,
  MOVER_SPRITE_KEYS,
  MOVING_TAGS,
  ownerFaceKey,
  PULL_ART,
  SKUNK_CLOUD_KEY,
  ZONE_CELEBRATION_ART,
  ZONE_PIPS_KEY,
} from "../assets/spriteKeys";
import { hitCue, MUSIC_KEY, SOUND_KEYS, soundKeysOf } from "../audio/sound";
import { gameData } from "../data";
import type { DogId, EncounterId, GearId, MinorObstacleId, UpgradeId, ZoneId } from "../data/types";
import { badgeWall } from "../home/badgesView";
import { HOME_LAYOUT } from "../home/homeLayout";
import { pipLook, zonePips } from "../hud/hudView";
import { MESSAGE_ICONS } from "../hud/messageStrip";
import { stripIconKey } from "../hud/stateStrip";
import { SCALE_STEPS } from "../layout/projection";
import { cardFor } from "../rules/choices";
import { hitLabel } from "../rules/encounters";
import { walkLength } from "../rules/route";
import { baseCardArtPrefix } from "../rules/skins";
import { faceMood } from "../rules/treats";
import type { PullPose } from "../runner/pulls";
import type { DogStatusId } from "../runner/statuses";
import type { CardSource } from "../state/runState";
import { testState } from "../testing/runState";
import { FEEDBACK_ART } from "./feedbackArt";
import { hitBurstKey, hitFlashKey, hitLook } from "./hitMoment";
import { SHOP_ART } from "./itemArt";

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

// Every tag the sprite plays.
function tagsOf(key: string): string[] {
  const sheet = sheetOf(key);
  return sheet === undefined
    ? []
    : animationSpecs(key, sheet).map((spec) => spec.key.slice(key.length + 1));
}

function missingImages(keys: readonly string[]): string[] {
  return keys.filter((key) => !images.has(key) && !PENDING_ART.has(key));
}

// The keys of a record typed over a union, so a new member is a compile error until listed.
function members<K extends string>(record: Readonly<Record<K, true>>): K[] {
  return Object.keys(record) as K[];
}

const DOGS = Object.keys(gameData.dogs) as DogId[];
const ENCOUNTERS = Object.keys(gameData.encounters) as EncounterId[];
const MINOR_OBSTACLES = Object.keys(gameData.minorObstacles) as MinorObstacleId[];
const STATUSES = members<DogStatusId>({ muddy: true, stinky: true, zoomies: true });
// CLEANUP (added 2026-10-21): icon-zoomies lands with the walk HUD art; drop this set once
// the manifest has it.
const PENDING_ART = new Set(["icon-zoomies"]);
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

  it("has the zone celebration's cheer for every walker, its burst, tail and confetti colours", () => {
    const { burst, confettiBit, confettiBitTags, tailUp, walkerTags } = ZONE_CELEBRATION_ART;
    const missing = [
      ...Object.values(gameData.walkers).flatMap(({ spriteKey }) =>
        missingTags(spriteKey, walkerTags),
      ),
      ...missingImages([burst, tailUp]),
      ...missingTags(confettiBit, confettiBitTags),
    ];
    expect(missing).toEqual([]);
  });
});

describe("Pet shop art", () => {
  it("names the faces and the glint the Start screen plays", () => {
    expect(missingTags(SHOP_ART.petShop, ["glint", "normal", "pressed"])).toEqual([]);
  });
});

describe("image art", () => {
  it.each<[string, () => string[]]>([
    ["a portrait for every dog", () => DOGS.map((dog) => dogPortraitKey(gameData, dog))],
    ["an icon for every message strip line", () => Object.values(MESSAGE_ICONS)],
    [
      "an effect icon for every upgrade and gear item",
      () => [
        ...(Object.keys(gameData.upgrades) as UpgradeId[]).map((upgrade) =>
          stripIconKey({ kind: "upgrade", upgrade }),
        ),
        ...(Object.keys(gameData.shopGear) as GearId[]).map((gear) =>
          stripIconKey({ gear, kind: "gear" }),
        ),
      ],
    ],
    [
      "every section's fill and the Pocket's stitch",
      () => [...Object.values(HOME_LAYOUT.sectionFillKeys), "ui-stitch-h", "ui-stitch-v"],
    ],
    ["a help illustration for every help page", () => gameData.help.map(({ art }) => art)],
  ])("names %s", (_, keys) => {
    expect(missingImages(keys())).toEqual([]);
  });
});

describe("icon art", () => {
  it("names a doghouse icon for every status", () => {
    expect(missingImages(STATUSES.map(statusIconKey))).toEqual([]);
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
      { kind: "fork", paths: ["park"], upgrades: ["bellyRubs"] },
    ];
    const tags = [...new Set(sources.map((source) => cardFrameTag(source)))];
    expect(tags).toHaveLength(2);
    const missing = [CARD_FRAME_KEY, "card-frame-large"].flatMap((key) => missingTags(key, tags));
    expect(missing).toEqual([]);
  });

  it("names every option's illustration for a skin's card prefix once any of them is listed", () => {
    const missing = ENCOUNTERS.flatMap((id) => {
      const { resolution, skins } = gameData.encounters[id];
      const arts = resolution.kind === "card" ? resolution.options.map(({ art }) => art) : [];
      return Object.values(skins ?? {}).flatMap((skin) => {
        const prefix = skin?.cardArtPrefix;
        if (prefix === undefined) {
          return [];
        }
        const keys = arts.map((art) => prefix + art.slice(baseCardArtPrefix(id).length));
        return keys.some((key) => images.has(key)) ? missingImages(keys) : [];
      });
    });
    expect(missing).toEqual([]);
  });

  it("names a card preview for every zone, as a fork's path card shows it", () => {
    const zones = gameData.world.zones.map(({ id }) => id as ZoneId);
    const arts = [zones.slice(0, 3), zones.slice(3)].flatMap((paths) =>
      cardFor(gameData, testState({ koda: 4 }), {
        kind: "fork",
        paths,
        upgrades: paths.map(() => "bellyRubs"),
      }).options.map(({ art }) => art),
    );
    expect(arts).toHaveLength(zones.length);
    expect(missingImages(arts)).toEqual([]);
  });
});

describe("pull art", () => {
  it("tags the pull bubble with idle and show, and names the blocked mark and squirrel icon", () => {
    expect(missingTags(PULL_ART.bubble, ["idle", "show"])).toEqual([]);
    expect(sprites.has(PULL_ART.pullBlocked)).toBe(true);
    expect(missingImages([SQUIRREL_ICON_KEY])).toEqual([]);
  });

  it("tags the pull fail effect with play", () => {
    expect(missingTags(PULL_ART.pullFail, ["play"])).toEqual([]);
  });
});

describe("feedback art", () => {
  it("names the heart pops and doghouse loss with their tags", () => {
    const { doghouseLoss, heartGain, heartLoss } = FEEDBACK_ART;
    const missing = [
      ...missingTags(doghouseLoss.key, [doghouseLoss.tag]),
      ...[heartGain, heartLoss].flatMap((heart) => missingTags(heart.key, [heart.pop, heart.fly])),
    ];
    expect(missing).toEqual([]);
  });
});

describe("hit moment art", () => {
  const hits = ENCOUNTERS.filter((id) => hitLabel(gameData.encounters[id]) !== null);
  const lookOf = (id: EncounterId) => hitLook(gameData.encounters[id].kind, id);

  it("names a burst with play, its plate's tag and any edge flash or its fallback for every hit moment", () => {
    const missing = hits.flatMap((id) => {
      const look = lookOf(id);
      return [
        ...missingTags(look.burst, ["play"]),
        ...missingTags("ui-hit-label", [look.plate]),
        ...(look.flash === null ? [] : missingTags(hitFlashKey(loadedScene, look.flash), ["play"])),
      ];
    });
    expect(hits).toEqual(expect.arrayContaining(["otherDog", "skunk"]));
    expect(missing).toEqual([]);
  });

  it("flashes the edges for every obstacle, and for no lucky find", () => {
    const flashed = hits.filter((id) => lookOf(id).flash !== null);
    expect(flashed).toEqual(hits.filter((id) => gameData.encounters[id].kind === "obstacle"));
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

  // A Stink skin's own cloud, once drawn, plays what skunk-cloud does at every step it has.
  it("draws every listed skin cloud with skunk-cloud's tags at each of its steps", () => {
    const skins = ENCOUNTERS.flatMap((id) => Object.values(gameData.encounters[id].skins ?? {}));
    const pairs = skins.flatMap((skin) => [
      ...(skin?.cloudArt !== undefined && sprites.has(skin.cloudArt)
        ? [{ art: skin.cloudArt, bases: [SKUNK_CLOUD_KEY], tags: tagsOf(SKUNK_CLOUD_KEY) }]
        : []),
    ]);
    const missing = pairs.flatMap(({ art, bases, tags }) =>
      [1, ...variantSteps(bases)].flatMap((step) =>
        missingTags(depthVariantKey(art, step) ?? art, tags),
      ),
    );
    expect(missing).toEqual([]);
  });

  // A skin may name art not drawn yet, which falls back to the base; once drawn, it must do
  // all its base does, and stand with its own owner where its base has one (<art>-owner).
  it("draws every listed skin's sprite, and owner, with its base's tags at each base step", () => {
    const pairs = [
      ...ENCOUNTERS.map((id) => ({
        base: encounterSpriteKey(id),
        skins: gameData.encounters[id].skins,
      })),
      ...MINOR_OBSTACLES.map((id) => ({
        base: minorObstacleSpriteKey(id),
        skins: gameData.minorObstacles[id].skins,
      })),
    ].flatMap(({ base, skins }) =>
      Object.values(skins ?? {}).flatMap((skin) => {
        if (skin === undefined || !sprites.has(skin.art)) {
          return [];
        }
        const tags = tagsOf(base);
        const owner = sprites.has(`${base}-owner`)
          ? [{ art: `${skin.art}-owner`, base: `${base}-owner`, tags: tagsOf(`${base}-owner`) }]
          : [];
        return [{ art: skin.art, base, tags }, ...owner];
      }),
    );
    const missing = pairs.flatMap(({ art, base, tags }) =>
      [1, ...variantSteps([base])].flatMap((step) =>
        missingTags(depthVariantKey(art, step) ?? art, tags),
      ),
    );
    expect(missing).toEqual([]);
  });

  // Every kind that moves and some zone draws plays one of its movement's tags at each step it
  // has.
  const drawn = (kind: string) =>
    gameData.world.zones.some(({ weights }) =>
      [weights.obstacles, weights.minorObstacles, weights.luckyFinds].some(
        (table) => ((table as Readonly<Record<string, number>>)[kind] ?? 0) > 0,
      ),
    );
  it.each(
    [
      ...ENCOUNTERS.map((kind) => ({
        art: encounterSpriteKey(kind),
        entry: gameData.encounters[kind],
        kind,
      })),
      ...MINOR_OBSTACLES.map((kind) => ({
        art: minorObstacleSpriteKey(kind),
        entry: gameData.minorObstacles[kind],
        kind,
      })),
    ].flatMap(({ art, entry, kind }) => {
      if (!drawn(kind)) {
        return [];
      }
      const movement = "movement" in entry ? entry.movement : undefined;
      return movement === undefined || movement.kind === "still"
        ? []
        : [{ key: MOVER_SPRITE_KEYS[art] ?? art, kind, tags: MOVING_TAGS[movement.kind] }];
    }),
  )("tags the moving $kind's sprite with a tag of its movement, at every step", ({ key, tags }) => {
    const missing = [1, ...variantSteps([key])].flatMap((step) => {
      const variant = depthVariantKey(key, step) ?? key;
      return tags.some((tag) => tagsOf(variant).includes(tag)) ? [] : [variant];
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
    expect(keys.filter((key) => !sounds.has(key))).toEqual([]);
  });
});
