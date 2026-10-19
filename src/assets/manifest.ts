import * as v from "valibot";

import { issuePath, record } from "./jsonSchema";

export interface SpriteAsset {
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

// public/art/manifest.json: every asset the art agent exports, paths relative to public/art/.
export interface AssetManifest {
  fonts: FontAsset[];
  images: ImageAsset[];
  sounds: SoundAsset[];
  sprites: SpriteAsset[];
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
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
    // Optional so a manifest exported before sounds existed still loads.
    sounds: v.optional(
      list(
        record({
          key: keyField,
          loop: v.exactOptional(v.boolean("must be a boolean")),
          m4a: pathField,
          ogg: pathField,
        }),
      ),
      [],
    ),
    sprites: list(record({ json: pathField, key: keyField, png: pathField })),
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

// Throws naming the offending entry, so a bad export fails at boot rather than as a missing texture.
export function parseManifest(value: unknown): AssetManifest {
  const result = v.safeParse(manifestSchema, value, { abortPipeEarly: true });
  if (!result.success) {
    const [issue] = result.issues;
    throw new Error(`manifest${issuePath(issue)} ${issue.message}`);
  }
  return result.output;
}

export function assetUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
