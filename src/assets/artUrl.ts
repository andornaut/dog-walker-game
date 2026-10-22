import { assetUrl } from "./manifest";

// The art files a build's game loads, each by its path under /art/ (as the art and atlas
// manifests name it), mapped to its content-hashed file in the build output. The build compiles
// the map into the game's code, so each version's code loads the art its build packed.
export type ArtFileMap = ReadonlyMap<string, string>;

// The folder under the base URL that serves the art files at their own paths.
const ART_FOLDER = "art";

// The URL of an art file by its path under /art/: its hashed file when the map has one, else the
// file at its own path, as the dev server serves it.
export function artFileUrl(baseUrl: string, artFiles: ArtFileMap, path: string): string {
  const hashed = artFiles.get(path);
  return hashed === undefined
    ? assetUrl(assetUrl(baseUrl, ART_FOLDER), path)
    : assetUrl(baseUrl, hashed);
}
