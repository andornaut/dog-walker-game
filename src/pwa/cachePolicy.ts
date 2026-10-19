// How the service worker answers a same-origin GET.
// network-first: pages and the art manifest, so a deploy shows on the next load; the cached copy
// answers offline.
// cache-first: content-hashed build output and the precached art, icons and scripts.
// network-only: anything else, left to the browser.
export type FetchStrategy = "cache-first" | "network-first" | "network-only";

export const ALWAYS_REVALIDATED_URLS: ReadonlySet<string> = new Set([
  "/art/manifest.json",
  "/manifest.webmanifest",
]);

// Content-hashed build output, safe to serve from cache for as long as it is referenced.
export function isHashedAssetUrl(url: string): boolean {
  return url.startsWith("/assets/");
}

export const CACHE_NAME_PREFIX = "dog-walker-";

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

export function strategyFor(
  precachedUrls: ReadonlySet<string>,
  request: { isNavigation: boolean; pathname: string },
): FetchStrategy {
  const key = cacheKeyFor(request.pathname);
  if (request.isNavigation) {
    return precachedUrls.has(key) ? "network-first" : "network-only";
  }
  if (ALWAYS_REVALIDATED_URLS.has(key)) {
    return "network-first";
  }
  if (isHashedAssetUrl(key) || precachedUrls.has(key)) {
    return "cache-first";
  }
  return "network-only";
}
