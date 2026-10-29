import type { Scene } from "phaser";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { animationKey, animationSpecs } from "../assets/asepriteAnimations";
import { splitDepthKey, stepSize } from "../assets/depthSteps";
import { debuffIconKey, SQUIRREL_ICON_KEY } from "../assets/iconKeys";
import { parseManifest } from "../assets/manifest";
import {
  AMBIENT_VARIANTS,
  CARD_FRAME_KEY,
  cardFrameTag,
  depthVariantKey,
  DIFFICULTY_KEY,
  dogCardTag,
  dogFaceKey,
  dogPortraitKey,
  dogSpriteKey,
  encounterSpriteKey,
  gearDropSpriteKey,
  minorObstacleSpriteKey,
  MOVER_SPRITE_KEYS,
  moverBodyTag,
  MOVING_TAGS,
  ownerCardFaceKey,
  ownerFaceKey,
  prizeMoverTag,
  PULL_ART,
  SKUNK_CLOUD_KEY,
  STANDING_TAGS,
  ZONE_CELEBRATION_ART,
  ZONE_PIPS_KEY,
} from "../assets/spriteKeys";
import { musicKeysOf } from "../audio/music";
import { hitCue, SOUND_KEYS, soundKeyFor, soundKeysOf } from "../audio/sound";
import { gameData } from "../data";
import type { CardSource, EncounterId, ZoneId } from "../data/types";
import { helpPicture, TOUCH_DRAG } from "../help/helpPictures";
import { badgeWall } from "../home/badgesView";
import { HOME_LAYOUT } from "../home/homeLayout";
import { effectIconKey, type EffectItem, walkBarIconKey } from "../hud/effectIcons";
import { type PipState, pipTag } from "../hud/hudView";
import { MESSAGE_ICONS } from "../hud/messageStrip";
import { cardOwnerMood } from "../hud/moments";
import { DOG_REACTIONS, HIT_ART } from "../layout/hitEffects";
import { SCALE_STEPS } from "../layout/projection";
import { keysOf } from "../lib/records";
import { clampHearts } from "../lib/units";
import { cardFor } from "../rules/choices";
import { hitLabel } from "../rules/encounters";
import { faceMood } from "../rules/treats";
import type { PullPose } from "../runner/pulls";
import { testState } from "../testing/runState";
import { FEEDBACK_ART } from "./feedbackArt";
import { hitBurstKey, hitLook } from "./hitMoment";
import { DETAIL_WELL_KEY } from "./homePanels";
import { BADGE_KEYS, SHOP_ART } from "./itemArt";

const manifest = parseManifest(shippedManifest);
const images = new Set(manifest.images.map(({ key }) => key));
const sprites = new Map(manifest.sprites.map((entry) => [entry.key, entry]));
const hasSprite = (key: string) => sprites.has(key);
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
  return keys.filter((key) => !images.has(key));
}

// The keys of a record typed over a union, so a new member is a compile error until listed.
function members<K extends string>(record: Readonly<Record<K, true>>): K[] {
  return keysOf(record);
}

const DEBUFFS = keysOf(gameData.debuffs);
const DOGS = keysOf(gameData.dogs);
const ENCOUNTERS = keysOf(gameData.encounters);
const MINOR_OBSTACLES = keysOf(gameData.minorObstacles);
const PULL_TAGS = members<PullPose["tag"]>({ pull: true, tell: true });
// Every depth step below full size.
const SMALLER_STEPS = SCALE_STEPS.filter((step) => step < 1);
// The steps below 1 at which any of keys has a variant. Art adds a step to a whole family of
// sprites at once, so each of them must then have it.
function variantSteps(keys: readonly string[]): number[] {
  return SCALE_STEPS.filter(
    (step) => step < 1 && keys.some((key) => sprites.has(depthVariantKey(key, step) ?? "")),
  );
}

// Every mood a face can show, at every max up to well past any size's and each hearts up to it.
const MOODS = [
  ...new Set(
    Array.from({ length: 21 }, (_, max) =>
      Array.from({ length: max + 1 }, (__, hearts) => faceMood(gameData, max, hearts)),
    ).flat(),
  ),
];

// Every mood an owner's face on a dog card can show: a walking dog's at every max up to well
// past any size's and each hearts up to it, and a fired dog's.
const CARD_OWNER_MOODS = [
  ...new Set(
    Array.from({ length: 21 }, (_, max) => [
      ...Array.from({ length: max + 1 }, (__, hearts) =>
        cardOwnerMood(gameData, max, {
          dog: "kilo",
          hearts: clampHearts(max, hearts),
          status: "walking",
        }),
      ),
      cardOwnerMood(gameData, max, { dog: "kilo", status: "fired", zoneIndex: 0 }),
    ]).flat(),
  ),
];

// A scene that has loaded exactly the shipped art.
const loadedScene = {
  textures: { exists: (key: string) => images.has(key) || sprites.has(key) },
} as unknown as Scene;

describe("dog art", () => {
  it("names a road sprite with every pose, pull and hit tag for every dog", () => {
    const reactions = Object.values(DOG_REACTIONS).flat();
    const tags = [...new Set(["idle", "walk", ...reactions, ...PULL_TAGS])];
    expect(DOGS.flatMap((dog) => missingTags(dogSpriteKey(gameData, dog), tags))).toEqual([]);
  });

  it("names a hand-drawn depth variant for every dog at every depth step", () => {
    const keys = DOGS.map((dog) => dogSpriteKey(gameData, dog));
    const missing = keys.flatMap((key) =>
      SMALLER_STEPS.map((step) => depthVariantKey(key, step) ?? "").filter(
        (variant) => !sprites.has(variant),
      ),
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

  it("names an owner's card face with every mood the card shows for every dog", () => {
    const missing = DOGS.flatMap((dog) =>
      missingTags(ownerCardFaceKey(gameData, dog), CARD_OWNER_MOODS),
    );
    expect(CARD_OWNER_MOODS).toEqual(expect.arrayContaining([...MOODS, "fired", "worried"]));
    expect(missing).toEqual([]);
  });

  it("names a dog card for every dog, the empty card and the heart-loss flash", () => {
    const tags = [...DOGS.map((dog) => dogCardTag(gameData, dog)), dogCardTag(gameData, null)];
    expect(missingTags("ui-dog-card", [...tags, "heart-loss"])).toEqual([]);
  });
});

describe("walker art", () => {
  it("names a road sprite and a picker face with their tags for every walker", () => {
    const missing = Object.values(gameData.walkers).flatMap(({ portraitKey, spriteKey }) => [
      ...missingTags(spriteKey, ["idle", "walk", "stumble"]),
      ...missingTags(portraitKey, ["happy", "neutral"]),
    ]);
    expect(missing).toEqual([]);
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
  it.each([
    [
      "the faces and the glint the Start screen plays",
      SHOP_ART.petShop,
      ["glint", "normal", "pressed"],
    ],
    ["the dog slot sign's faces", HOME_LAYOUT.slotSign.key, ["normal", "pressed"]],
  ])("names %s", (_, key, tags) => {
    expect(missingTags(key, tags)).toEqual([]);
  });
});

describe("image art", () => {
  it("names a portrait, message icon, badge, well, effect icon and section fill for each use", () => {
    const lists: [string, () => string[]][] = [
      ["a portrait for every dog", () => DOGS.map((dog) => dogPortraitKey(gameData, dog))],
      ["an icon for every message strip line", () => Object.values(MESSAGE_ICONS)],
      ["an icon for every badge", () => Object.values(BADGE_KEYS)],
      ["a detail card well", () => [DETAIL_WELL_KEY]],
      [
        "an effect icon for every upgrade, gear item and walker perk",
        () => [
          ...keysOf(gameData.upgrades).map((upgrade) =>
            effectIconKey({ kind: "upgrade", upgrade }),
          ),
          ...keysOf(gameData.shopGear).map((gear) => effectIconKey({ gear, kind: "gear" })),
          ...keysOf(gameData.walkerPerks).map((perk) => effectIconKey({ kind: "perk", perk })),
        ],
      ],
      [
        "a 20x20 walk bar icon for every perk, gear item and upgrade",
        () =>
          [
            ...keysOf(gameData.walkerPerks).map((perk): EffectItem => ({
              kind: "perk",
              perk,
            })),
            ...keysOf(gameData.shopGear).map((gear): EffectItem => ({
              gear,
              kind: "gear",
            })),
            ...keysOf(gameData.upgrades).map((upgrade): EffectItem => ({
              kind: "upgrade",
              upgrade,
            })),
          ].map(walkBarIconKey),
      ],
      [
        "every section's fill and the Pocket's stitch",
        () => [...Object.values(HOME_LAYOUT.sectionFillKeys), "ui-stitch-h", "ui-stitch-v"],
      ],
    ];
    expect(lists.flatMap(([, keys]) => missingImages(keys()))).toEqual([]);
  });
});

describe("help art", () => {
  it("tags ui-touch-drag with the drag frame the lanes page shows", () => {
    const { key, tag } = TOUCH_DRAG;
    const frame = helpPicture(gameData, "lanes").touch?.frame ?? -1;
    const drag = animationSpecs(key, sheetOf(key)).find(
      (spec) => spec.key === animationKey(key, tag),
    );
    expect(missingTags(key, [tag])).toEqual([]);
    expect(frame).toBeLessThan(drag?.frames.length ?? 0);
  });
});

describe("icon art", () => {
  it("names a debuff bar icon for every debuff", () => {
    expect(missingImages(DEBUFFS.map(debuffIconKey))).toEqual([]);
  });

  it("names a badge with earned and locked for every achievement", () => {
    const badges = badgeWall(gameData, { achievements: {} });
    expect(badges).toHaveLength(Object.keys(gameData.achievements).length);
    expect(badges.flatMap(({ art }) => missingTags(art, ["earned", "locked"]))).toEqual([]);
  });

  it("tags ui-zone-pips with every route pip, for every zone", () => {
    const states: readonly PipState[] = ["current", "done", "todo"];
    const tags = gameData.world.zones.flatMap((zone) =>
      states.map((state) => pipTag(gameData, { state, zone: zone.id as ZoneId })),
    );
    const drawn = gameData.world.zones.flatMap(({ art }) => [art, `${art}-done`]);
    expect(tags).toEqual(expect.arrayContaining(["todo", ...drawn]));
    expect(missingTags(ZONE_PIPS_KEY, [...new Set(tags)])).toEqual([]);
  });

  it("tags ui-difficulty with every zone's paws, and ui-fires, an option's firing marker", () => {
    const tags = gameData.world.zones.map(({ difficulty }) => String(difficulty));
    expect([
      ...missingTags(DIFFICULTY_KEY, ["1", "2", "3", "4", "5", ...tags]),
      ...missingTags("ui-fires", ["static", "pulse"]),
    ]).toEqual([]);
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

  it("names a card preview for every zone, as a fork's path card shows it", () => {
    const zones = gameData.world.zones.map(({ id }) => id as ZoneId);
    const arts = [zones.slice(0, 3), zones.slice(3)].flatMap((paths) =>
      cardFor(gameData, testState({ kilo: 4 }), {
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
  it("tags the pull bubble and fail effect, and names the blocked mark and squirrel icon", () => {
    expect(missingTags(PULL_ART.bubble, ["idle", "show"])).toEqual([]);
    expect(sprites.has(PULL_ART.pullBlocked)).toBe(true);
    expect([
      ...missingImages([SQUIRREL_ICON_KEY]),
      ...missingTags(PULL_ART.pullFail, ["play"]),
    ]).toEqual([]);
  });
});

describe("feedback art", () => {
  it("names the heart pops and the card's heart loss with their tags", () => {
    const { cardLoss, heartGain, heartLoss } = FEEDBACK_ART;
    const missing = [
      ...missingTags(cardLoss.key, [cardLoss.tag]),
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
        ...(look.flash === null ? [] : missingTags(look.flash, ["play"])),
      ];
    });
    expect(hits).toEqual(expect.arrayContaining(["otherDog", "skunk"]));
    expect(missing).toEqual([]);
    // fx-bump stands in for a hit moment without its own burst; none goes without.
    expect(missingTags("fx-bump", ["play"])).toEqual([]);
    expect(hits.filter((id) => hitBurstKey(loadedScene, lookOf(id)) === "fx-bump")).toEqual([]);
  });

  it("flashes the edges for every obstacle, and for no lucky find", () => {
    const flashed = hits.filter((id) => lookOf(id).flash !== null);
    expect(flashed).toEqual(hits.filter((id) => gameData.encounters[id].kind === "obstacle"));
  });
});

describe("plain and moving hit art", () => {
  const effects = [HIT_ART.bump, HIT_ART.bumpBig, HIT_ART.splash, ...Object.values(HIT_ART.debris)];
  const framesOf = (key: string) =>
    animationSpecs(key, sheetOf(key)).find((spec) => spec.key === animationKey(key, HIT_ART.tag))
      ?.frames.length ?? 0;

  it("plays every hit effect's tag", () => {
    expect(effects.flatMap(({ key }) => missingTags(key, [HIT_ART.tag]))).toEqual([]);
  });

  it("holds a peak frame inside its effect's tag for reduced motion", () => {
    const peaks = [HIT_ART.bump, HIT_ART.bumpBig, HIT_ART.splash];
    expect(peaks.filter(({ key, peak }) => peak >= framesOf(key)).map(({ key }) => key)).toEqual(
      [],
    );
  });

  it("sets the splash's ground row inside its frame, as tall as the art", () => {
    const { groundRow, height, key } = HIT_ART.splash;
    const sheet = sheetOf(key) as { frames: Record<string, { sourceSize: { h: number } }> };
    const heights = Object.values(sheet.frames).map(({ sourceSize }) => sourceSize.h);
    expect(new Set(heights)).toEqual(new Set([height]));
    expect(groundRow).toBeLessThan(height);
  });
});

describe("road object art", () => {
  it("names a road sprite for every encounter, at every depth step", () => {
    const keys = ENCOUNTERS.map(encounterSpriteKey);
    const missing = keys.flatMap((key) =>
      SCALE_STEPS.map((step) => depthVariantKey(key, step) ?? key).filter(
        (key) => !sprites.has(key),
      ),
    );
    expect(missing).toEqual([]);
  });

  it("names a gear drop sprite with an idle tag for every gear item, at every depth step", () => {
    const keys = keysOf(gameData.shopGear).map(gearDropSpriteKey);
    const missing = keys.flatMap((key) =>
      SCALE_STEPS.map((step) => depthVariantKey(key, step) ?? key).filter(
        (variant) => !sprites.has(variant) || !tagsOf(variant).includes("idle"),
      ),
    );
    expect(missing).toEqual([]);
  });

  // Every obstacle or lucky find kind that moves and some zone draws, or a lucky find any zone
  // counts, plays one of its movement's tags at each step it has.
  const drawn = (kind: string) =>
    ((gameData.tuning.counts.luckyFindsPerZone as Readonly<Record<string, number>>)[kind] ?? 0) >
      0 ||
    gameData.world.zones.some(({ weights }) =>
      [weights.obstacles, weights.minorObstacles].some(
        (table) => ((table as Readonly<Record<string, number>>)[kind] ?? 0) > 0,
      ),
    );
  const roadKinds = [
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
  ];
  const isLucky = (kind: string) =>
    Object.hasOwn(gameData.encounters, kind) &&
    gameData.encounters[kind as EncounterId].kind === "lucky";
  it("tags every moving road item's sprite with a tag of its movement, at every step", () => {
    const moving = roadKinds.flatMap(({ art, entry, kind }) => {
      if (!drawn(kind)) {
        return [];
      }
      const movement = "movement" in entry ? entry.movement : undefined;
      return movement === undefined
        ? []
        : [{ key: MOVER_SPRITE_KEYS[art] ?? art, tags: MOVING_TAGS[movement.kind] }];
    });
    const missing = moving.flatMap(({ key, tags }) =>
      [1, ...variantSteps([key])].flatMap((step) => {
        const variant = depthVariantKey(key, step) ?? key;
        return tags.some((tag) => tagsOf(variant).includes(tag)) ? [] : [variant];
      }),
    );
    expect(missing).toEqual([]);
  });

  // Every road item's sprite, standing and as a mover, with any owner and spray cloud beside it,
  // plays a tag it has, of more than one frame where it has one: standing halted and walking,
  // and a mover moving and stopped, at every step it has.
  it("animates every road item's sprite, standing and moving, at every step", () => {
    const items = roadKinds.flatMap(({ art, entry, kind }) => {
      const arts = [art].filter(hasSprite);
      const clouds = kind === "skunk" ? [SKUNK_CLOUD_KEY] : [];
      const standing = [...arts, ...arts.map((shown) => `${shown}-owner`), ...clouds]
        .filter(hasSprite)
        .map((key) => ({ key, kind, movement: null, role: "standing" }));
      const movement = "movement" in entry ? entry.movement : undefined;
      const movers = arts.map((shown) => {
        const body = MOVER_SPRITE_KEYS[shown];
        return {
          key: body !== undefined && hasSprite(body) ? body : shown,
          kind,
          movement: movement?.kind ?? null,
          role: `a ${movement?.kind ?? ""} mover`,
        };
      });
      return movement === undefined ? standing : [...standing, ...movers];
    });
    const unanimated = items.flatMap((item) =>
      [1, ...variantSteps([item.key])].flatMap((step) => {
        const variant = depthVariantKey(item.key, step) ?? item.key;
        const frames = new Map(
          animationSpecs(variant, sheetOf(variant)).map((spec) => [
            spec.key.slice(variant.length + 1),
            spec.frames.length,
          ]),
        );
        const least = Math.min(2, Math.max(...frames.values()));
        const has = (tag: string) => frames.has(tag);
        const { movement } = item;
        const played =
          movement === null
            ? { halted: STANDING_TAGS.halted.find(has), walking: STANDING_TAGS.walking.find(has) }
            : isLucky(item.kind)
              ? {
                  moving: prizeMoverTag(has, movement, true, false),
                  stopped: prizeMoverTag(has, movement, false, false),
                }
              : {
                  moving: moverBodyTag(has, movement, true),
                  stopped: moverBodyTag(has, movement, false),
                };
        return Object.entries(played).flatMap(([state, tag]) =>
          tag !== undefined && (frames.get(tag) ?? 0) >= least
            ? []
            : [`${variant} ${state}: ${tag}`],
        );
      }),
    );
    expect(unanimated).toEqual([]);
  });

  it("draws every zone's ambient movers and their variants, with its tag at every step", () => {
    const movers = Object.values(gameData.ambient).flat();
    const missing = movers.flatMap(({ key, tag }) => {
      const variants = (AMBIENT_VARIANTS[key] ?? []).filter((variant) => sprites.has(variant));
      return [key, ...variants].flatMap((art) =>
        [1, ...variantSteps([art])].flatMap((step) =>
          missingTags(depthVariantKey(art, step) ?? art, [tag]),
        ),
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

  it("plays a manifest sound for every cue", () => {
    const loaded = (key: string) => sounds.has(key);
    expect(keysOf(SOUND_KEYS).filter((cue) => soundKeyFor(loaded, cue) === undefined)).toEqual([]);
  });

  it("plays a looping music in every zone", () => {
    const silent = gameData.world.zones.filter((zone) => {
      const key = musicKeysOf(zone).find((candidate) => sounds.has(candidate)) ?? "";
      return sounds.get(key)?.loop !== true;
    });
    expect(silent.map(({ art }) => art)).toEqual([]);
  });

  it("has its own hit sound for every encounter with a hit moment", () => {
    const hits = ENCOUNTERS.filter((id) => hitLabel(gameData.encounters[id]) !== null);
    const keys = hits.map((id) => soundKeysOf(hitCue(gameData.encounters[id].kind, id))[0] ?? "");
    expect(keys.filter((key) => !sounds.has(key))).toEqual([]);
  });
});
