import { createHash } from "node:crypto";

import { ART_MANIFEST } from "../../tools/artManifest";
import type { AssetManifest } from "../manifest";
import type { AtlasBuild } from "./atlasBuild";
import { ATLAS_MANIFEST_PATH, type AtlasManifest } from "./atlasManifest";

// The module a build fills with the game's ArtFileMap (src/assets/artUrl.ts). The dev server's
// map is empty, so every file loads from its own path there.
export const ART_FILES_MODULE = "virtual:art-files";

// Where a build writes the hashed art: /art/'s layout, under the path the headers and the service
// worker treat as content-hashed build output.
const HASHED_ART_DIR = "assets/art";

// Vite's hash length, which the headers' check for an unhashed name expects.
const HASH_LENGTH = 8;

// Every file under /art/ a build's game loads: the art manifest, the atlas manifest and its
// pages, both files of each font and each sound (the page plays one format), and the files of
// the images and sprites the atlas leaves out. Sorted, each once.
function gameArtPaths(manifest: AssetManifest, atlas: AtlasManifest): string[] {
  const atlased = new Set(atlas.textures.map(({ key }) => key));
  const own = ({ key }: { key: string }) => !atlased.has(key);
  const paths = [
    ART_MANIFEST,
    ATLAS_MANIFEST_PATH,
    ...atlas.pages.map(({ png }) => png),
    ...manifest.fonts.flatMap(({ fnt, png }) => [fnt, png]),
    ...manifest.images.filter(own).map(({ png }) => png),
    ...manifest.sounds.flatMap(({ m4a, ogg }) => [m4a, ogg]),
    ...manifest.sprites.filter(own).flatMap(({ json, png }) => [json, png]),
  ];
  return [...new Set(paths)].sort();
}

// The first HASH_LENGTH characters of the bytes' SHA-256, in URL-safe base64, as Vite hashes.
export function contentHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("base64url").slice(0, HASH_LENGTH);
}

// A file's name in the build output: its path under /art/, in HASHED_ART_DIR, with a dash and
// the hash before its extension.
export function hashedArtFileName(path: string, hash: string): string {
  const dot = path.lastIndexOf(".");
  const [stem, ext] =
    dot > path.lastIndexOf("/") ? [path.slice(0, dot), path.slice(dot)] : [path, ""];
  return `${HASHED_ART_DIR}/${stem}-${hash}${ext}`;
}

export interface HashedArtFile {
  // Its name in the build output.
  fileName: string;
  // Its path under /art/.
  path: string;
  source: Uint8Array;
}

// Each file gameArtPaths names, with its hashed name and its bytes: the atlas manifest and pages
// from the atlas build, the rest read by readArt, by path relative to the art directory.
export async function hashGameArt(
  readArt: (path: string) => Promise<Uint8Array>,
  manifest: AssetManifest,
  { manifest: atlas, pngs }: Pick<AtlasBuild, "manifest" | "pngs">,
): Promise<HashedArtFile[]> {
  const built = new Map(pngs).set(
    ATLAS_MANIFEST_PATH,
    new TextEncoder().encode(JSON.stringify(atlas)),
  );
  return Promise.all(
    gameArtPaths(manifest, atlas).map(async (path) => {
      const source = built.get(path) ?? (await readArt(path));
      return { fileName: hashedArtFileName(path, contentHash(source)), path, source };
    }),
  );
}
