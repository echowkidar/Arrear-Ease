/// <reference lib="webworker" />
// Service worker (built by @serwist/next, Serwist = maintained Workbox fork with the same
// precaching/routing API). Precaches only the app shell; API responses are never cached.
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NavigationRoute, NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = '/~offline';

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  // No runtimeCaching: everything not precached (API calls, Firebase, large lazy chunks)
  // goes straight to the network, so data can never go stale silently.
});

// Pages are server-rendered by Next.js (no single index.html), so navigations always hit the
// network and fall back to the precached offline page only when the network fails.
serwist.registerRoute(
  new NavigationRoute(
    new NetworkOnly({
      plugins: [{ handlerDidError: async () => (await serwist.matchPrecache(OFFLINE_URL)) ?? Response.error() }],
    }),
    { denylist: [/^\/api\//, /^\/__\//] },
  ),
);

serwist.addEventListeners();
