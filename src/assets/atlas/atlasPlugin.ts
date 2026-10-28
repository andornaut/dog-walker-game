import type { Plugin } from "vite";

import {
  ART_DIR,
  ART_MANIFEST,
  artManifestText,
  generateArtManifest,
} from "../../tools/artManifest";
import { nodeArtFiles, writeIfChanged } from "../../tools/files";
import type { ArtFileMap } from "../artUrl";
import { buildAtlases } from "./atlasBuild";
import type { RgbaImage } from "./atlasPixels";
import { ART_FILES_MODULE, hashGameArt } from "./hashedArt";

// Vite's prefix for a module id that names no file.
const RESOLVED_ART_FILES_MODULE = `\0${ART_FILES_MODULE}`;

interface AtlasPluginApi {
  // The build's ArtFileMap, once buildStart has run.
  artFiles(): ArtFileMap;
}

// Writes /art/manifest.json from the files under public/art/ first, so the build copies and
// packs what is on disk. Then packs every image and sprite frame it lists into a few atlas
// pages, with an atlas manifest mapping each key and frame to its page and rect. Every file the
// game loads (both manifests, the pages, the fonts, the sounds and any key the atlas leaves
// out) goes to the build output under a content-hashed name (src/assets/atlas/hashedArt.ts),
// and the game reads the names from the ART_FILES_MODULE map. The dev server's map is empty.
// The files under public/art/ are also copied as they are, for the dev server, the art gallery
// and the site's pages.
export function atlasPlugin(): Plugin & { api: AtlasPluginApi } {
  let artFiles: ArtFileMap = new Map();
  return {
    api: { artFiles: () => artFiles },
    async buildStart() {
      const { config, logger } = this.environment;
      if (config.command !== "build") {
        return;
      }
      const artDir = `${config.publicDir}/${ART_DIR}`;
      const readArt = async (path: string) => this.fs.readFile(`${artDir}/${path}`);
      const decoded = new Map<string, RgbaImage>();
      const art = await generateArtManifest(nodeArtFiles(artDir), decoded);
      if (await writeIfChanged(`${artDir}/${ART_MANIFEST}`, artManifestText(art))) {
        this.info(`wrote ${ART_DIR}/${ART_MANIFEST} from the files on disk`);
      }
      const atlas = await buildAtlases(readArt, { decoded, manifest: art });
      for (const warning of atlas.warnings) {
        this.warn(`atlas: ${warning}, so it loads from its own files`);
      }
      for (const { bytes, group, height, png, width } of atlas.manifest.pages) {
        logger.info(`atlas: ${png} ${width}x${height}, ${(bytes / 1024).toFixed(1)} kB (${group})`);
      }
      const hashed = await hashGameArt(readArt, art, atlas);
      for (const { fileName, source } of hashed) {
        this.emitFile({ fileName, source, type: "asset" });
      }
      artFiles = new Map(hashed.map(({ fileName, path }) => [path, fileName]));
    },
    load(id) {
      return id === RESOLVED_ART_FILES_MODULE
        ? `export default new Map(${JSON.stringify([...artFiles])});`
        : undefined;
    },
    name: "dog-walker-atlas",
    resolveId(id) {
      return id === ART_FILES_MODULE ? RESOLVED_ART_FILES_MODULE : undefined;
    },
  };
}
