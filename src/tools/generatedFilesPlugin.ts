import { relative, sep } from "node:path";

import type { Plugin, ViteDevServer } from "vite";

import {
  ART_DIR,
  ART_MANIFEST,
  ART_MANIFEST_EXTRA,
  artManifestText,
  generateArtManifest,
} from "./artManifest";
import { nodeArtFiles, writeFiles, writeIfChanged } from "./files";

const ART_FOLDERS = ["fonts", "images", "sounds", "sprites"];
// Edits arrive in bursts, as when art's tools export a set: regenerate once they settle.
const SETTLE_MS = 200;

type DataExportModule = typeof import("./dataExport");

function debounce(run: () => Promise<void>): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), SETTLE_MS);
  };
}

// On the dev server, keeps the committed generated files in step as their sources change:
// public/art/manifest.json with the art files, and shared/export/ with src/. The game's modules
// load through the server, never into this config, so editing a value file still updates the
// game without a restart. A build writes the art manifest in atlasPlugin and shared/export/ in
// npm's prebuild step.
export function generatedFilesPlugin(): Plugin {
  return {
    apply: (_config, { command, mode }) => command === "serve" && mode !== "test",
    configureServer(server: ViteDevServer) {
      const { logger, publicDir, root } = server.config;
      const artDir = `${publicDir}/${ART_DIR}`;
      const log = (message: string) => logger.info(message, { timestamp: true });
      const fail = (what: string, error: unknown) =>
        logger.warn(`${what} not regenerated: ${String(error)}`, { timestamp: true });

      const writeManifest = debounce(async () => {
        try {
          const manifest = await generateArtManifest(nodeArtFiles(artDir));
          if (await writeIfChanged(`${artDir}/${ART_MANIFEST}`, artManifestText(manifest))) {
            log(`wrote ${ART_DIR}/${ART_MANIFEST}`);
          }
        } catch (error) {
          fail(`${ART_DIR}/${ART_MANIFEST}`, error);
        }
      });
      const writeExport = debounce(async () => {
        try {
          const module = (await server.ssrLoadModule(
            "/src/tools/dataExport.ts",
          )) as DataExportModule;
          for (const path of await writeFiles(root, module.currentDataExportFiles())) {
            log(`wrote ${path}`);
          }
        } catch (error) {
          fail("shared/export", error);
        }
      });

      writeManifest();
      writeExport();
      server.watcher.on("all", (_event, path) => {
        const inArt = relative(artDir, path).split(sep);
        const artFile =
          (inArt.length === 1 && inArt[0] === ART_MANIFEST_EXTRA) ||
          (inArt.length === 2 && ART_FOLDERS.includes(inArt[0] ?? ""));
        if (artFile) {
          writeManifest();
        }
        const inRoot = relative(root, path).split(sep);
        if (inRoot[0] === "src" && path.endsWith(".ts") && !path.endsWith(".test.ts")) {
          writeExport();
        }
      });
    },
    name: "dog-walker-generated-files",
  };
}
