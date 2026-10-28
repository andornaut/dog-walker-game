import * as v from "valibot";

import { DEPTH_STEPS } from "./depthSteps";
import { parseOrThrow, record } from "./jsonSchema";

// Where a road sprite stands, measured from frame 0 by the art pipeline, in frame pixels.
export interface SpriteAnchor {
  feetY: number;
  opaqueWidth: number;
}

export interface SpriteAsset {
  anchor?: SpriteAnchor;
  json: string;
  key: string;
  png: string;
}

export interface FontAsset {
  fnt: string;
  key: string;
  png: string;
}

export interface ImageAsset {
  key: string;
  png: string;
}

// Each sound ships as Ogg Vorbis plus AAC, since iOS Safari cannot play Ogg.
export interface SoundAsset {
  key: string;
  loop?: boolean;
  m4a: string;
  ogg: string;
}

// public/art/manifest.json: every asset under public/art/, derived from the files
// (src/tools/artManifest.ts), with paths relative to public/art/.
export interface AssetManifest {
  fonts: FontAsset[];
  images: ImageAsset[];
  sounds: SoundAsset[];
  sprites: SpriteAsset[];
}

// Kebab-case, with an optional depth step suffix for a sprite's hand-drawn smaller version.
const STEP_SUFFIXES = DEPTH_STEPS.flatMap(({ suffix }) => (suffix === "" ? [] : [suffix]));
const KEBAB_CASE = new RegExp(`^[a-z0-9]+(-[a-z0-9]+)*(${STEP_SUFFIXES.join("|")})?$`);
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const LIST_NAMES = ["fonts", "images", "sounds", "sprites"] as const;

function list<T extends v.GenericSchema>(entry: T) {
  return v.array(entry, "must be an array");
}

const text = v.pipe(
  v.string("must be a non-empty string"),
  v.nonEmpty("must be a non-empty string"),
);

const keyField = v.pipe(
  text,
  v.regex(KEBAB_CASE, (issue) => `"${issue.input}" must be kebab-case`),
);

const pathField = v.pipe(
  text,
  v.check((value) => !value.startsWith("/"), "must be relative, without a leading slash"),
  v.check((value) => !URL_SCHEME.test(value), "must be relative, without a scheme"),
  v.check((value) => !value.split("/").includes(".."), "must not have a .. segment"),
);

const manifestSchema = v.pipe(
  record({
    fonts: list(record({ fnt: pathField, key: keyField, png: pathField })),
    images: list(record({ key: keyField, png: pathField })),
    sounds: list(
      record({
        key: keyField,
        loop: v.exactOptional(v.boolean("must be a boolean")),
        m4a: pathField,
        ogg: pathField,
      }),
    ),
    sprites: list(
      record({
        anchor: v.exactOptional(
          record({
            feetY: v.pipe(v.number(), v.integer(), v.minValue(0, "must be 0 or more")),
            opaqueWidth: v.pipe(v.number(), v.integer(), v.minValue(1, "must be 1 or more")),
          }),
        ),
        json: pathField,
        key: keyField,
        png: pathField,
      }),
    ),
  }),
  v.rawCheck(({ addIssue, dataset }) => {
    if (!dataset.typed) {
      return;
    }
    const seen = new Map<string, string>();
    for (const listName of LIST_NAMES) {
      dataset.value[listName].forEach((entry, index) => {
        const at = `${listName}[${index}]`;
        const first = seen.get(entry.key);
        if (first === undefined) {
          seen.set(entry.key, at);
        } else {
          addIssue({ message: `key "${entry.key}" appears more than once, in ${first} and ${at}` });
        }
      });
    }
  }),
);

// Throws naming the offending entry, so a bad export fails at boot rather than as a missing
// texture.
export function parseManifest(value: unknown): AssetManifest {
  return parseOrThrow("manifest", manifestSchema, value);
}

export function assetUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
