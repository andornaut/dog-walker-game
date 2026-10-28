import { join, relative, sep } from "node:path";

import { createServerModuleRunner, type Plugin, type ViteDevServer } from "vite";

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

// Runs run once calls settle for settleMs. Runs never overlap: one that comes due while another
// is under way starts when that one ends, so the last write is always from the newest sources.
// run reports its own errors.
export function whenSettled(settleMs: number, run: () => Promise<void>): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let runs = Promise.resolve();
  let waiting = false;
  const queue = () => {
    if (waiting) {
      return;
    }
    waiting = true;
    runs = runs.then(() => {
      waiting = false;
      return run();
    });
  };
  return () => {
    clearTimeout(timer);
    timer = setTimeout(queue, settleMs);
  };
}

interface GeneratedFilesPluginOptions {
  // The repository's root, which holds src/ and shared/export/. Vite's root is pages/.
  repoRoot: string;
}

// On the dev server, keeps the committed generated files in step as their sources change:
// public/art/manifest.json with the art files, and shared/export/ with src/, shared/'s tables and
// the fonts' .fnt files, which the export reads. The game's modules load through the server, never
// into this config, so editing a value file still updates the game without a restart. A build
// writes the art manifest in atlasPlugin and shared/export/ in npm's prebuild step.
export function generatedFilesPlugin({ repoRoot }: GeneratedFilesPluginOptions): Plugin {
  return {
    apply: (_config, { command, mode }) => command === "serve" && mode !== "test",
    configureServer(server: ViteDevServer) {
      const { logger, publicDir } = server.config;
      const srcDir = join(repoRoot, "src");
      const sharedDir = join(repoRoot, "shared");
      const artDir = `${publicDir}/${ART_DIR}`;
      const log = (message: string) => logger.info(message, { timestamp: true });
      const fail = (what: string, error: unknown) =>
        logger.warn(`${what} not regenerated: ${String(error)}`, { timestamp: true });

      const writeManifest = whenSettled(SETTLE_MS, async () => {
        try {
          const manifest = await generateArtManifest(nodeArtFiles(artDir));
          if (await writeIfChanged(`${artDir}/${ART_MANIFEST}`, artManifestText(manifest))) {
            log(`wrote ${ART_DIR}/${ART_MANIFEST}`);
          }
        } catch (error) {
          fail(`${ART_DIR}/${ART_MANIFEST}`, error);
        }
      });
      const writeExport = whenSettled(SETTLE_MS, async () => {
        try {
          // A fresh runner each time: a runner keeps every module it has evaluated.
          const runner = createServerModuleRunner(server.environments.ssr, { hmr: false });
          try {
            const module = (await runner.import("/src/tools/dataExport.ts")) as DataExportModule;
            for (const path of await writeFiles(repoRoot, module.currentDataExportFiles())) {
              log(`wrote ${path}`);
            }
          } finally {
            await runner.close();
          }
        } catch (error) {
          fail("shared/export", error);
        }
      });

      writeManifest();
      writeExport();
      // Vite watches pages/ and public/, not src/ or shared/.
      server.watcher.add([srcDir, sharedDir]);
      server.watcher.on("all", (_event, path) => {
        const inArt = relative(artDir, path).split(sep);
        const artFile =
          (inArt.length === 1 && inArt[0] === ART_MANIFEST_EXTRA) ||
          (inArt.length === 2 && ART_FOLDERS.includes(inArt[0] ?? ""));
        if (artFile) {
          writeManifest();
        }
        const inSrc = relative(srcDir, path).split(sep)[0] !== "..";
        const source = inSrc && path.endsWith(".ts") && !path.endsWith(".test.ts");
        // shared/'s own tables, not shared/export/, which the export writes.
        const sharedTable =
          relative(sharedDir, path).split(sep).length === 1 && path.endsWith(".json");
        const font = artFile && inArt[0] === "fonts" && path.endsWith(".fnt");
        if (source || sharedTable || font) {
          writeExport();
        }
      });
    },
    name: "dog-walker-generated-files",
  };
}
