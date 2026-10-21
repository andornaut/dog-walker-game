import type { PrecacheManifest } from "./precacheList";

// How the service worker answers a same-origin GET.
// network-first: pages, the manifests and the site nav's script and stylesheet, so a deploy shows
// on the next load; the cached copy answers offline. The nav files are unhashed, and a page
// fetched from the network must not get the nav of the deploy the running worker precached.
// cache-first: content-hashed build output, the precached art, icons and scripts, and the sound
// files of either format, so one the install did not store is stored on its first fetch.
// network-only: anything else, left to the browser.
export type FetchStrategy = "cache-first" | "network-first" | "network-only";

export const ART_BASE_URL = "/art";
export const ART_MANIFEST_URL = `${ART_BASE_URL}/manifest.json`;

const ALWAYS_REVALIDATED_URLS: ReadonlySet<string> = new Set([
  ART_MANIFEST_URL,
  "/manifest.webmanifest",
  "/nav.css",
  "/nav.js",
]);

// Content-hashed build output, safe to serve from cache for as long as it is referenced.
export function isHashedAssetUrl(url: string): boolean {
  return url.startsWith("/assets/");
}

// How the service worker fetches a URL to precache it. Hashed build output never changes under
// its name, so the HTTP cache may answer with the copy the page just loaded. Every other URL can,
// so no-cache has the server confirm the HTTP cache's copy, or send the new one, before it is
// stored.
export function precacheFetchOptions(url: string): RequestInit {
  return { cache: isHashedAssetUrl(url) ? "default" : "no-cache" };
}

const CACHE_NAME_PREFIX = "dog-walker-";

export function cacheNameFor(version: string): string {
  return `${CACHE_NAME_PREFIX}${version}`;
}

// Caches an earlier service worker left, to delete once this one activates.
export function staleCacheNames(currentCacheName: string, cacheNames: readonly string[]): string[] {
  return cacheNames.filter(
    (name) => name.startsWith(CACHE_NAME_PREFIX) && name !== currentCacheName,
  );
}

// The cache key for a path. Cloudflare and Vite serve /dir/index.html at /dir/, so both share
// one entry.
export function cacheKeyFor(pathname: string): string {
  return pathname.replace(/\/index\.html$/, "/");
}

// The URLs the service worker stores on install: the precache list and the sound files in the
// format the page named. An unknown or missing format stores no sounds.
export function installUrls(
  { sounds, urls }: PrecacheManifest,
  soundFormat: string | null,
): string[] {
  const chosen = Object.entries(sounds).find(([format]) => format === soundFormat)?.[1] ?? [];
  return [...urls, ...chosen];
}

// The URLs the service worker answers from its cache: the precache list and every sound file.
export function cachedUrlsOf({ sounds, urls }: PrecacheManifest): Set<string> {
  return new Set([...urls, ...Object.values(sounds).flat()]);
}

export function strategyFor(
  cachedUrls: ReadonlySet<string>,
  request: { isNavigation: boolean; pathname: string },
): FetchStrategy {
  const key = cacheKeyFor(request.pathname);
  if (request.isNavigation) {
    return cachedUrls.has(key) ? "network-first" : "network-only";
  }
  if (ALWAYS_REVALIDATED_URLS.has(key)) {
    return "network-first";
  }
  if (isHashedAssetUrl(key) || cachedUrls.has(key)) {
    return "cache-first";
  }
  return "network-only";
}
