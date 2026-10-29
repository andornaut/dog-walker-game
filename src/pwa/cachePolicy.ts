import type { CachePolicy } from "@andornaut/game-kit/pwa/cachePolicy";

// The game's caching rules (the kit's pwa/cachePolicy), which the service worker and the precache
// build share. Content-hashed build output, the hashed art included, is under /assets/. The art
// manifest, the web app manifest and the site nav's script and stylesheet are unhashed and fetched
// network-first, so a deploy shows on the next load: a page fetched from the network must not get
// the nav of the deploy the running worker precached.
export const CACHE_POLICY: CachePolicy = {
  cacheNamePrefix: "dog-walker-",
  hashedAssetPrefix: "/assets/",
  revalidatedUrls: ["/art/manifest.json", "/manifest.webmanifest", "/nav.css", "/nav.js"],
};
