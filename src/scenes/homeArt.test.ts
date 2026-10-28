import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json";
import { loadsFirst } from "../assets/atlas/atlasLayout";
import { parseManifest } from "../assets/manifest";
import * as spriteKeys from "../assets/spriteKeys";
import { type BaseCue, HOME_CUES, SOUND_KEYS } from "../audio/sound";
import { gameData } from "../data";
import { keysOf } from "../lib/records";
import { ownerSpriteKey } from "./ownerFigure";

// Boot loads only the loadsFirst art and the HOME_CUES sounds before the home screen shows.
// These tests read the source of the home screen and the menus it opens to check that every key
// they name is among them. Help is left out: the home screen opens it, and starts a walk, only
// once every asset has loaded.

const SRC = new URL("../", import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, SRC), "utf8");

// A module's path from src/, or undefined for a non-TypeScript import.
function resolveModule(from: string, specifier: string): string | undefined {
  const path = new URL(specifier, new URL(from, SRC)).pathname.slice(SRC.pathname.length);
  return [`${path}.ts`, `${path}/index.ts`].find((file) => existsSync(new URL(file, SRC)));
}

const IMPORT = /^import (?!type )[^;]*?from "(\.[^"]+)";/gms;
const OVERLAY = /openOverlay\(this, SCENE_KEYS\.(\w+)/g;
const HOME = "scenes/StartScene.ts";
const sceneFile = (key: string) => `scenes/${key[0]?.toUpperCase()}${key.slice(1)}Scene.ts`;

// The home screen and each menu it opens over itself.
const roots = [HOME, ...[...read(HOME).matchAll(OVERLAY)].map(([, key]) => sceneFile(key ?? ""))];

// Every module the roots import at run time, other than the game data and other scenes.
function reachable(): string[] {
  const seen = new Set<string>();
  const queue = [...roots];
  for (let path = queue.pop(); path !== undefined; path = queue.pop()) {
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);
    for (const [, specifier] of read(path).matchAll(IMPORT)) {
      const module = resolveModule(path, specifier ?? "");
      const otherScene = module?.endsWith("Scene.ts") === true && !roots.includes(module);
      if (module !== undefined && !module.startsWith("data/") && !otherScene) {
        queue.push(module);
      }
    }
  }
  return [...seen].sort();
}

// The modules that draw or name art. The rest name keys only as data, such as a cue's name.
const DRAWING = ["assets/iconKeys.ts", "home/", "hud/", "scenes/"];
const drawing = reachable().filter((path) => DRAWING.some((prefix) => path.startsWith(prefix)));

const manifest = parseManifest(shippedManifest);
const artKeys = new Set([...manifest.images, ...manifest.sprites].map(({ key }) => key));

const dogs = keysOf(gameData.dogs);
const gear = keysOf(gameData.shopGear);
const walkers = keysOf(gameData.walkers);

// Every art key that starts with prefix.
const keysStarting = (prefix: string) => () => [...artKeys].filter((key) => key.startsWith(prefix));
const none = () => [];

// The art keys each function a drawing module calls by a name ending in Key can return: each
// over its whole domain, or every key with the prefix it builds on. One that names no art key
// returns none: it takes a key and derives a texture from it, or it is not about art.
const KEY_FUNCTIONS: Readonly<Record<string, () => readonly string[]>> = {
  animationKey: none,
  badgeKey: keysStarting("badge-"),
  debuffIconKey: keysStarting("icon-"),
  // A depth step's variant, which falls back to the full-size key while it is not loaded.
  depthVariantKey: none,
  disabledTextureKey: none,
  dogFaceKey: () => dogs.map((dog) => spriteKeys.dogFaceKey(gameData, dog)),
  dogPortraitKey: () => dogs.map((dog) => spriteKeys.dogPortraitKey(gameData, dog)),
  dogSpriteKey: () => dogs.map((dog) => spriteKeys.dogSpriteKey(gameData, dog)),
  effectIconKey: keysStarting("icon-"),
  effectItemsKey: none,
  focusDirectionForKey: none,
  gearIconKey: () => gear.map((id) => spriteKeys.gearIconKey(id)),
  isConfirmKey: none,
  isMuteKey: none,
  isPauseKey: none,
  laneDirectionForKey: none,
  onKey: none,
  ownerFaceKey: () => dogs.map((dog) => spriteKeys.ownerFaceKey(gameData, dog)),
  ownerSpriteKey: () => dogs.map((dog) => ownerSpriteKey(gameData, dog)),
  perkIconKey: keysStarting("icon-perk-"),
  tileTextureKey: none,
  volumeStepForKey: none,
  walkBarIconKey: keysStarting("icon-"),
  walkerLineKey: none,
  walkerPortraitKey: () => walkers.map((walker) => spriteKeys.walkerPortraitKey(walker)),
  walkerSpriteKey: () => walkers.map((walker) => gameData.walkers[walker].spriteKey),
};

// The strings a sprite key constant holds, a record's values included.
const stringsOf = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : typeof value === "object" && value !== null
      ? Object.values(value).flatMap(stringsOf)
      : [];

const SPRITE_KEYS_IMPORT = /import \{([^}]*)\} from "[./]*assets\/spriteKeys";/g;

// Each art key a drawing module names, as a literal, a sprite key constant it imports or a key
// function it calls, with where it names it.
function namedKeys(): { key: string; where: string }[] {
  return drawing.flatMap((path) => {
    const source = read(path);
    const literals = [...source.matchAll(/"([a-z][\w@-]*)"/g)].map(([, key]) => key ?? "");
    const constants = [...source.matchAll(SPRITE_KEYS_IMPORT)]
      .flatMap(([, names]) => (names ?? "").split(","))
      .map((name) => name.replace(/^\s*type\s/, "").trim())
      .filter((name) => /^[A-Z][A-Z_]*$/.test(name))
      .flatMap((name) => stringsOf((spriteKeys as Record<string, unknown>)[name]));
    const called = [...source.matchAll(/\b([a-z]\w*Key)\(/g)].flatMap(
      ([, name]) => KEY_FUNCTIONS[name ?? ""]?.() ?? [],
    );
    return [...literals, ...constants, ...called]
      .filter((key) => artKeys.has(key))
      .map((key) => ({ key, where: path }));
  });
}

describe("the home screen's first load", () => {
  it("covers the home screen and the menus it opens, but not help", () => {
    expect([...roots].sort()).toEqual(
      [
        HOME,
        "scenes/CelebrationScene.ts",
        "scenes/SettingsScene.ts",
        "scenes/ShopScene.ts",
        "scenes/StatsScene.ts",
      ].sort(),
    );
  });

  it("knows every key function the home screen and its menus call", () => {
    const unknown = drawing.flatMap((path) =>
      [...read(path).matchAll(/\b([a-z]\w*Key)\(/g)]
        .map(([, name]) => name ?? "")
        .filter((name) => !Object.hasOwn(KEY_FUNCTIONS, name))
        .map((name) => `${path}: ${name}`),
    );
    expect(unknown).toEqual([]);
  });

  it("loads every art key the home screen and its menus name", () => {
    const named = namedKeys();
    expect(named.length).toBeGreaterThan(0);
    const late = named
      .filter(({ key }) => !loadsFirst(key))
      .map(({ key, where }) => `${where}: ${key}`);
    expect([...new Set(late)]).toEqual([]);
  });

  it("loads every sound the home screen and its menus play", () => {
    const cues = drawing.flatMap((path) =>
      [...read(path).matchAll(/\.play\("(\w+)"\)/g)].map(([, cue]) => cue as BaseCue),
    );
    expect(cues.length).toBeGreaterThan(0);
    expect(cues.filter((cue) => !HOME_CUES.includes(cue)).map((cue) => SOUND_KEYS[cue])).toEqual(
      [],
    );
  });
});
