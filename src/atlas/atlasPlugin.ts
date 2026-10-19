import type { Logger, Plugin } from "vite";

import { ART_DIR, ART_MANIFEST, artManifestText, generateArtManifest } from "../tools/artManifest";
import { nodeArtFiles, writeIfChanged } from "../tools/files";
import { buildAtlases } from "./atlasBuild";
import { ATLAS_MANIFEST_PATH } from "./atlasManifest";
import type { RgbaImage } from "./atlasPixels";

// Writes /art/manifest.json from the files under public/art/ first, so the build copies and
// packs what is on disk. Then packs every image and sprite frame it lists into a few atlas
// pages at /art/atlas/, with /art/atlas-manifest.json mapping each key and frame to its page
// and rect. The files under public/art/ are copied as they are: the dev server and the art
// gallery load them, and so does a build for any key the atlas leaves out.
export function atlasPlugin(): Plugin {
  let publicDir = "";
  let logger: Logger | undefined;
  return {
    apply: "build",
    async buildStart() {
      const artDir = `${publicDir}/${ART_DIR}`;
      const decoded = new Map<string, RgbaImage>();
      const art = await generateArtManifest(nodeArtFiles(artDir), decoded);
      if (await writeIfChanged(`${artDir}/${ART_MANIFEST}`, artManifestText(art))) {
        this.info(`wrote ${ART_DIR}/${ART_MANIFEST} from the files on disk`);
      }
      const { manifest, pngs, warnings } = await buildAtlases(
        async (path) => this.fs.readFile(`${artDir}/${path}`),
        { decoded, manifest: art },
      );
      for (const warning of warnings) {
        this.warn(`atlas: ${warning}, so it loads from its own files`);
      }
      for (const { bytes, group, height, png, width } of manifest.pages) {
        logger?.info(
          `atlas: ${png} ${width}x${height}, ${(bytes / 1024).toFixed(1)} kB (${group})`,
        );
      }
      for (const [png, source] of pngs) {
        this.emitFile({ fileName: `${ART_DIR}/${png}`, source, type: "asset" });
      }
      this.emitFile({
        fileName: `${ART_DIR}/${ATLAS_MANIFEST_PATH}`,
        source: JSON.stringify(manifest),
        type: "asset",
      });
    },
    configResolved(config) {
      ({ logger, publicDir } = config);
    },
    name: "dog-walker-atlas",
  };
}
