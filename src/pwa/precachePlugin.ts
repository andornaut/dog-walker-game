import { precachePlugin as kitPrecachePlugin } from "@andornaut/game-kit/pwa/vite/precachePlugin";
import type { Plugin } from "vite";

import type { ArtFileMap } from "../assets/artUrl";
import { CACHE_POLICY } from "./cachePolicy";
import { artHashedFiles } from "./precacheArt";

interface PrecachePluginOptions {
  // The game's art files, as atlasPlugin hashed them for this build.
  getArtFiles: () => ArtFileMap;
  // The game page's file name in the build output, which is its path under Vite's root, e.g.
  // "play/index.html".
  pageHtmlFile: string;
  // The service worker's entry module (serviceWorker.ts), as an absolute path.
  serviceWorkerSource: string;
}

// The kit's precache plugin with the game's cache policy and its hashed art: builds /sw.js with
// the game page's precache list written into it.
export function precachePlugin({
  getArtFiles,
  pageHtmlFile,
  serviceWorkerSource,
}: PrecachePluginOptions): Plugin {
  return kitPrecachePlugin({
    hashedFiles: artHashedFiles(getArtFiles),
    pageHtmlFile,
    policy: CACHE_POLICY,
    serviceWorkerSource,
  });
}
