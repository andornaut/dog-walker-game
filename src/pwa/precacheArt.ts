import type { HashedFiles } from "@andornaut/game-kit/pwa/vite/precachePlugin";

import type { ArtFileMap } from "../assets/artUrl";
import { parseManifest } from "../assets/manifest";
import type { SoundFormat } from "../audio/soundFormat";
import { ART_MANIFEST } from "../tools/artManifest";

// The art the game loads, as the URLs of its hashed files: the sound files by format, for the
// worker to store the one the page plays, and every other file. Only the map's files are listed,
// so no unhashed art is precached.
export function hashedArtUrls(
  artFiles: ArtFileMap,
  manifestJson: unknown,
): { sounds: Record<SoundFormat, string[]>; urls: string[] } {
  const { sounds } = parseManifest(manifestJson);
  const url = (fileName: string) => `/${fileName}`;
  const soundUrls = (format: SoundFormat) =>
    sounds.flatMap((sound) => artFiles.get(sound[format]) ?? []).map(url);
  const soundPaths = new Set(sounds.flatMap(({ m4a, ogg }) => [m4a, ogg]));
  return {
    sounds: { m4a: soundUrls("m4a"), ogg: soundUrls("ogg") },
    urls: [...artFiles]
      .filter(([path]) => !soundPaths.has(path))
      .map(([, fileName]) => url(fileName)),
  };
}

// The precache plugin's hashed files: the art in getArtFiles' map, read from the hashed art
// manifest in the build output.
export function artHashedFiles(
  getArtFiles: () => ArtFileMap,
): (bundleFile: (url: string) => Uint8Array | undefined) => HashedFiles {
  return (bundleFile) => {
    const artFiles = getArtFiles();
    const manifestFile = artFiles.get(ART_MANIFEST);
    const manifest = manifestFile === undefined ? undefined : bundleFile(`/${manifestFile}`);
    if (manifest === undefined) {
      throw new Error(`the hashed ${ART_MANIFEST} is not in the build output`);
    }
    return hashedArtUrls(artFiles, JSON.parse(new TextDecoder().decode(manifest)));
  };
}
