/* Rise Again — service worker
   Makes the app installable and work offline. Strategy is chosen so that
   YOUR updates always reach people fast:
     • HTML/navigation  -> network-first (online users always get the
                           freshest index.html; falls back to cache offline)
     • icons/manifest   -> cache-first (small, rarely change, instant load)
     • anything else / cross-origin (e.g. analytics) -> straight to network
   Bump CACHE_VERSION whenever you want to guarantee a clean cache sweep. */

const CACHE_VERSION = "rise-again-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./logo-mark-white.png"
];

// Install: pre-cache the app shell so the very first offline load works.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove any older caches from previous versions.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET; never interfere with anything else.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Let cross-origin requests (analytics, external links) go straight to
  // the network — we don't cache or block them.
  if (url.origin !== self.location.origin) return;

  const isHTML =
    req.mode === "navigate" ||
    req.destination === "document" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/");

  if (isHTML) {
    // Network-first so a freshly uploaded index.html is served immediately
    // when online, with the cached copy as an offline fallback.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("./index.html"))
        )
    );
    return;
  }

  // Everything else same-origin (icons, manifest): cache-first, then network,
  // caching the result for next time.
  event.respondWith(
    caches.match(req).then((hit) => {
      return (
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        }).catch(() => hit)
      );
    })
  );
});
