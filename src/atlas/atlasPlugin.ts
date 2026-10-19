import type { Plugin } from "vite";

import { buildAtlases } from "./atlasBuild";
import { ATLAS_MANIFEST_PATH } from "./atlasManifest";

const ART_DIR = "art";

// Packs every image and sprite frame /art/manifest.json lists into a few atlas pages at
// /art/atlas/, with /art/atlas-manifest.json mapping each key and frame to its page and rect.
// The files under public/art/ are copied as they are: the dev server and the art gallery load
// them, and so does a build for any key the atlas leaves out.
export function atlasPlugin(): Plugin {
  let publicDir = "";
  return {
    apply: "build",
    async buildStart() {
      const { manifest, pngs, warnings } = await buildAtlases(async (path) =>
        this.fs.readFile(`${publicDir}/${ART_DIR}/${path}`),
      );
      for (const warning of warnings) {
        this.warn(`atlas: ${warning}, so it loads from its own files`);
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
      ({ publicDir } = config);
    },
    name: "dog-walker-atlas",
  };
}
