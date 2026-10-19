// The service worker, built to /sw.js by precachePlugin. It runs in a ServiceWorkerGlobalScope,
// which the project's DOM typings do not describe, so the few members it uses are declared here.
// It imports only cachePolicy.ts, so the build emits it as one classic script with no imports.
import {
  cachedUrlsOf,
  cacheKeyFor,
  cacheNameFor,
  type FetchStrategy,
  installUrls,
  precacheFetchOptions,
  staleCacheNames,
  strategyFor,
} from "./cachePolicy";
import type { PrecacheManifest } from "./precacheList";
import type { SoundFormatParam } from "./serviceWorkerUrl";
import type { SkipWaitingMessage } from "./updateReady";

interface LifecycleEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchRequestEvent extends LifecycleEvent {
  readonly request: Request;
  respondWith(response: Promise<Response>): void;
}

interface WorkerScope {
  addEventListener(type: "activate" | "install", listener: (event: LifecycleEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: FetchRequestEvent) => void): void;
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  readonly location: Location;
  skipWaiting(): Promise<void>;
}

// Replaced with the precache manifest's JSON when the build writes sw.js.
declare const DOG_WALKER_PRECACHE_MANIFEST: PrecacheManifest;

const SOUND_FORMAT_PARAM: SoundFormatParam = "sound";

const worker = self as unknown as WorkerScope;
// Read once, so the build writes the manifest's JSON into sw.js once.
const manifest = DOG_WALKER_PRECACHE_MANIFEST;
const cacheName = cacheNameFor(manifest.version);
const cachedUrls = cachedUrlsOf(manifest);

async function precache(): Promise<void> {
  const soundFormat = new URL(worker.location.href).searchParams.get(SOUND_FORMAT_PARAM);
  const urls = installUrls(manifest, soundFormat);
  const cache = await caches.open(cacheName);
  await cache.addAll(urls.map((url) => new Request(url, precacheFetchOptions(url))));
}

async function deleteStaleCaches(): Promise<void> {
  const stale = staleCacheNames(cacheName, await caches.keys());
  await Promise.all(stale.map((name) => caches.delete(name)));
}

// Only a whole response is stored: Cache.put rejects a 206, which an audio element's range
// request can get.
async function fetchAndStore(cache: Cache, key: string, request: Request): Promise<Response> {
  const response = await fetch(request);
  if (response.status === 200) {
    await cache.put(key, response.clone());
  }
  return response;
}

async function networkFirst(request: Request, key: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  try {
    return await fetchAndStore(cache, key, request);
  } catch (error) {
    const cached = await cache.match(key);
    if (cached === undefined) {
      throw error;
    }
    return cached;
  }
}

async function cacheFirst(request: Request, key: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(key);
  return cached ?? fetchAndStore(cache, key, request);
}

const RESPONDERS: Record<
  Exclude<FetchStrategy, "network-only">,
  (request: Request, key: string) => Promise<Response>
> = {
  "cache-first": cacheFirst,
  "network-first": networkFirst,
};

const SKIP_WAITING: SkipWaitingMessage = "skip-waiting";

// No skipWaiting on install: a new worker waits until every page the old one controls has closed,
// so a running game never has its cache deleted or its code swapped. It takes over on the next
// launch, or when the page posts SKIP_WAITING and reloads once this worker controls it: at once on
// a load the player has not interacted with, otherwise from Reload on the home screen's notice.
worker.addEventListener("install", (event) => event.waitUntil(precache()));
worker.addEventListener("activate", (event) => event.waitUntil(deleteStaleCaches()));
worker.addEventListener("message", (event) => {
  if (event.data === SKIP_WAITING) {
    void worker.skipWaiting();
  }
});

worker.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== worker.location.origin) {
    return;
  }
  const strategy = strategyFor(cachedUrls, {
    isNavigation: request.mode === "navigate",
    pathname: url.pathname,
  });
  if (strategy !== "network-only") {
    event.respondWith(RESPONDERS[strategy](request, cacheKeyFor(url.pathname)));
  }
});
