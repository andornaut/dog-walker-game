// The service worker, built to /sw.js by precachePlugin. It runs in a ServiceWorkerGlobalScope,
// which the project's DOM typings do not describe, so the few members it uses are declared here.
// It imports only cachePolicy.ts, so the build emits it as one classic script with no imports.
import {
  cacheKeyFor,
  cacheNameFor,
  type FetchStrategy,
  staleCacheNames,
  strategyFor,
} from "./cachePolicy";
import type { PrecacheManifest } from "./precacheList";

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
  readonly location: Location;
}

// Replaced with the precache manifest's JSON when the build writes sw.js.
declare const DOG_WALKER_PRECACHE_MANIFEST: PrecacheManifest;

const worker = self as unknown as WorkerScope;
const { urls, version } = DOG_WALKER_PRECACHE_MANIFEST;
const cacheName = cacheNameFor(version);
const precachedUrls = new Set(urls);

async function precache(): Promise<void> {
  const cache = await caches.open(cacheName);
  // reload skips the HTTP cache, so the new version's copies are stored, not stale ones.
  await cache.addAll(urls.map((url) => new Request(url, { cache: "reload" })));
}

async function deleteStaleCaches(): Promise<void> {
  const stale = staleCacheNames(cacheName, await caches.keys());
  await Promise.all(stale.map((name) => caches.delete(name)));
}

async function networkFirst(request: Request, key: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(key, response.clone());
    }
    return response;
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
  if (cached !== undefined) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(key, response.clone());
  }
  return response;
}

const RESPONDERS: Record<
  Exclude<FetchStrategy, "network-only">,
  (request: Request, key: string) => Promise<Response>
> = {
  "cache-first": cacheFirst,
  "network-first": networkFirst,
};

// No skipWaiting: a new worker waits until every page the old one controls has closed, so a
// running game never has its cache deleted or its code swapped. It takes over on the next launch.
worker.addEventListener("install", (event) => event.waitUntil(precache()));
worker.addEventListener("activate", (event) => event.waitUntil(deleteStaleCaches()));

worker.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== worker.location.origin) {
    return;
  }
  const strategy = strategyFor(precachedUrls, {
    isNavigation: request.mode === "navigate",
    pathname: url.pathname,
  });
  if (strategy !== "network-only") {
    event.respondWith(RESPONDERS[strategy](request, cacheKeyFor(url.pathname)));
  }
});
