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

// public/art/manifest.json: every asset the art agent exports, paths relative to public/art/.
export interface AssetManifest {
  fonts: FontAsset[];
  images: ImageAsset[];
  sprites: SpriteAsset[];
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function requireEntries<T>(fields: (keyof T & string)[], listName: string, value: unknown): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`manifest.${listName} must be an array`);
  }
  return value.map((entry: unknown, index) => {
    for (const field of fields) {
      const fieldValue = (entry as Record<string, unknown> | null)?.[field];
      if (typeof fieldValue !== "string" || fieldValue === "") {
        throw new Error(`manifest.${listName}[${index}].${field} must be a non-empty string`);
      }
    }
    return entry as T;
  });
}

// Throws naming the offending entry, so a bad export fails at boot rather than as a missing texture.
export function parseManifest(value: unknown): AssetManifest {
  const record = (value ?? {}) as Record<string, unknown>;
  const manifest: AssetManifest = {
    fonts: requireEntries<FontAsset>(["key", "png", "fnt"], "fonts", record.fonts),
    images: requireEntries<ImageAsset>(["key", "png"], "images", record.images),
    sprites: requireEntries<SpriteAsset>(["key", "png", "json"], "sprites", record.sprites),
  };

  const seen = new Set<string>();
  for (const { key } of [...manifest.fonts, ...manifest.images, ...manifest.sprites]) {
    if (!KEBAB_CASE.test(key)) {
      throw new Error(`manifest key "${key}" must be kebab-case`);
    }
    if (seen.has(key)) {
      throw new Error(`manifest key "${key}" appears more than once`);
    }
    seen.add(key);
  }
  return manifest;
}

export function assetUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
