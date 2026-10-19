import type { Plugin } from "vite";

import { cacheKeyFor } from "./cachePolicy";
import {
  artManifestUrls,
  artReferencedUrls,
  bundleDependencies,
  type BundleFile,
  precacheFingerprint,
  type PrecacheManifest,
  rootRelativeUrls,
  webManifestIconUrls,
} from "./precacheList";

const ART_BASE_URL = "/art";
const ART_MANIFEST_URL = `${ART_BASE_URL}/manifest.json`;
const SERVICE_WORKER_FILE_NAME = "sw.js";
// The identifier serviceWorker.ts declares and the build replaces with the precache manifest.
const MANIFEST_PLACEHOLDER = "DOG_WALKER_PRECACHE_MANIFEST";

interface PrecachePluginOptions {
  // The game page's HTML build input, relative to the project root, e.g. "play/index.html".
  pageHtmlFile: string;
  // The service worker's source module, relative to the project root like the HTML inputs.
  serviceWorkerSource: string;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Builds the service worker to /sw.js with the game page's precache list written into it: the
// page, the build output it loads, the public files it links, the web app manifest's icons, and
// every file /art/manifest.json lists along with the images those files load.
export function precachePlugin({
  pageHtmlFile,
  serviceWorkerSource,
}: PrecachePluginOptions): Plugin {
  let publicDir = "";
  return {
    apply: "build",
    buildStart() {
      this.emitFile({ fileName: SERVICE_WORKER_FILE_NAME, id: serviceWorkerSource, type: "chunk" });
    },
    configResolved(config) {
      ({ publicDir } = config);
    },
    enforce: "post",
    generateBundle: {
      async handler(_options, bundle) {
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
          pageUrls.map((url) => url.slice(1)).filter((fileName) => fileName in bundle),
        ).map((fileName) => `/${fileName}`);
        const contents = new Map<string, Uint8Array>([[cacheKeyFor(`/${pageHtmlFile}`), pageHtml]]);
        for (const url of bundleUrls) {
          contents.set(url, bundleBytes(url) ?? new Uint8Array());
        }

        const publicUrls = [
          ...pageUrls.filter((url) => !(url.slice(1) in bundle)),
          ART_MANIFEST_URL,
        ];
        while (publicUrls.length > 0) {
          const url = publicUrls.shift() ?? "";
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
            publicUrls.push(...artManifestUrls(ART_BASE_URL, JSON.parse(decoder.decode(bytes))));
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
        const fingerprint = await sha256Hex(encoder.encode(precacheFingerprint(contentHashes)));
        const manifest: PrecacheManifest = {
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
