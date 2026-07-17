// Service worker for the installable PWA. Makes the app shell available offline
// so a home-screen launch works without a connection, while leaving the live
// sensor/weather data (cross-origin Adafruit IO + Open-Meteo) to always hit the
// network so readings never go stale from the cache.
const VERSION = "v1";
const CACHE = `cogapp-temp-${VERSION}`;

// Scope root, e.g. "/cogapp-temperature/". Everything the shell needs hangs off
// this, so precaching survives a repo-name / base-path change.
const ROOT = new URL(self.registration.scope).pathname;

const SHELL = [
  ROOT,
  `${ROOT}favicon.svg`,
  `${ROOT}icon-192.png`,
  `${ROOT}icon-512.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Let live data (Adafruit, Open-Meteo) and any other cross-origin request go
  // straight to the network, uncached.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first so a fresh shell is served when online, falling
  // back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((r) => r || caches.match(ROOT)),
        ),
    );
    return;
  }

  // Same-origin assets (hashed JS/CSS, fonts, icons): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
