import type { Plugin } from "vite";

import { assetUrl } from "../assets/manifest";
import { ATLAS_MANIFEST_PATH } from "../atlas/atlasManifest";
import { ART_BASE_URL, ART_MANIFEST_URL, cacheKeyFor } from "./cachePolicy";
import {
  artManifestUrls,
  artReferencedUrls,
  artSoundUrls,
  atlasUrls,
  bundleDependencies,
  type BundleFile,
  precacheFingerprint,
  type PrecacheManifest,
  rootRelativeUrls,
  webManifestIconUrls,
} from "./precacheList";

const SERVICE_WORKER_FILE_NAME = "sw.js";
// The identifier serviceWorker.ts declares and the build replaces with the precache manifest.
const MANIFEST_PLACEHOLDER = "DOG_WALKER_PRECACHE_MANIFEST";

interface PrecachePluginOptions {
  // The game page's file name in the build output, which is its path under Vite's root, e.g.
  // "play/index.html".
  pageHtmlFile: string;
  // The service worker's source module, as an absolute path.
  serviceWorkerSource: string;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Builds the service worker to /sw.js with the game page's precache list written into it: the
// page, the build output it loads, the public files it links, the web app manifest's icons, the
// atlas manifest and pages atlasPlugin writes, and every file /art/manifest.json lists that is
// not in an atlas, along with the images those files load. Sounds are listed apart, by format,
// for the worker to precache the one format the page plays.
export function precachePlugin({
  pageHtmlFile,
  serviceWorkerSource,
}: PrecachePluginOptions): Plugin {
  return {
    apply: "build",
    buildStart() {
      this.emitFile({ fileName: SERVICE_WORKER_FILE_NAME, id: serviceWorkerSource, type: "chunk" });
    },
    enforce: "post",
    generateBundle: {
      async handler(_options, bundle) {
        const { publicDir } = this.environment.config;
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        const bundleBytes = (url: string): Uint8Array | undefined => {
          const file = bundle[url.slice(1)];
          if (file === undefined) {
            return undefined;
          }
          const content = file.type === "chunk" ? file.code : file.source;
          return typeof content === "string" ? encoder.encode(content) : content;
        };
        const readPublicFile = async (url: string): Promise<Uint8Array | undefined> => {
          try {
            return await this.fs.readFile(`${publicDir}${url}`);
          } catch {
            this.warn(
              `precache: ${url} is linked but missing from ${publicDir}, so it is left out`,
            );
            return undefined;
          }
        };

        const pageHtml = bundleBytes(`/${pageHtmlFile}`);
        if (pageHtml === undefined) {
          this.error(`precache: ${pageHtmlFile} is not in the build output`);
        }
        const pageUrls = rootRelativeUrls(decoder.decode(pageHtml));
        const bundleUrls = bundleDependencies(
          bundle as Readonly<Record<string, BundleFile>>,
          pageUrls.map((url) => url.slice(1)),
        ).map((fileName) => `/${fileName}`);
        const contents = new Map<string, Uint8Array>([[cacheKeyFor(`/${pageHtmlFile}`), pageHtml]]);
        for (const url of bundleUrls) {
          contents.set(url, bundleBytes(url) ?? new Uint8Array());
        }

        const atlasJson = bundleBytes(assetUrl(ART_BASE_URL, ATLAS_MANIFEST_PATH));
        const atlas =
          atlasJson === undefined
            ? { keys: new Set<string>(), urls: [] }
            : atlasUrls(ART_BASE_URL, JSON.parse(decoder.decode(atlasJson)));
        for (const url of atlas.urls) {
          const bytes = bundleBytes(url);
          if (bytes === undefined) {
            this.error(`precache: ${url} is in the atlas manifest but not in the build output`);
          }
          contents.set(url, bytes);
        }

        const publicUrls = [
          ...pageUrls.filter((url) => !(url.slice(1) in bundle)),
          ART_MANIFEST_URL,
        ];
        let soundUrls: PrecacheManifest["sounds"] = { m4a: [], ogg: [] };
        // The loop also visits the URLs pushed onto publicUrls while it runs.
        for (const url of publicUrls) {
          if (contents.has(url)) {
            continue;
          }
          // Each file's references are only known once it is read, so reads run one at a time.
          // eslint-disable-next-line no-await-in-loop
          const bytes = await readPublicFile(url);
          if (bytes === undefined) {
            continue;
          }
          contents.set(url, bytes);
          if (url === ART_MANIFEST_URL) {
            const artManifest: unknown = JSON.parse(decoder.decode(bytes));
            publicUrls.push(...artManifestUrls(ART_BASE_URL, artManifest, atlas.keys));
            soundUrls = artSoundUrls(ART_BASE_URL, artManifest);
          } else if (url.endsWith(".webmanifest")) {
            publicUrls.push(...webManifestIconUrls(JSON.parse(decoder.decode(bytes))));
          } else if (url.startsWith(`${ART_BASE_URL}/`)) {
            publicUrls.push(...artReferencedUrls(url, decoder.decode(bytes)));
          }
        }

        const contentHashes = new Map(
          await Promise.all(
            [...contents].map(async ([url, bytes]) => [url, await sha256Hex(bytes)] as const),
          ),
        );
        const soundHashes = new Map<string, string>();
        await Promise.all(
          [...soundUrls.ogg, ...soundUrls.m4a].map(async (url) => {
            const bytes = await readPublicFile(url);
            if (bytes !== undefined) {
              soundHashes.set(url, await sha256Hex(bytes));
            }
          }),
        );
        const fingerprint = await sha256Hex(
          encoder.encode(precacheFingerprint(new Map([...contentHashes, ...soundHashes]))),
        );
        const manifest: PrecacheManifest = {
          sounds: {
            m4a: soundUrls.m4a.filter((url) => soundHashes.has(url)),
            ogg: soundUrls.ogg.filter((url) => soundHashes.has(url)),
          },
          urls: [...contentHashes.keys()].sort(),
          version: fingerprint.slice(0, 16),
        };

        const serviceWorker = bundle[SERVICE_WORKER_FILE_NAME];
        if (serviceWorker?.type !== "chunk" || !serviceWorker.code.includes(MANIFEST_PLACEHOLDER)) {
          this.error(
            `precache: ${SERVICE_WORKER_FILE_NAME} has no ${MANIFEST_PLACEHOLDER} to replace`,
          );
        }
        serviceWorker.code = serviceWorker.code.replaceAll(
          MANIFEST_PLACEHOLDER,
          JSON.stringify(manifest),
        );
      },
      order: "post",
    },
    name: "dog-walker-precache",
  };
}
