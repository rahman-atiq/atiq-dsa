/* ============================================================
   Service worker.

   The precache list is no longer typed out here. It comes from
   shared/catalog.js, which the hub and the chrome bar also read, so
   adding a module cannot leave the offline copy one page short.
   ============================================================ */
importScripts('shared/catalog.js');

const CACHE = 'dsa-deck-v3';
const CAT = self.DSA_CATALOG;

/* Without these the app is broken rather than merely plain, so a failure
   here should fail the install and leave the previous worker in charge. */
const CRITICAL = CAT.pages().concat(CAT.shared);

/* Nice to have offline. One 404 in here should not cost us the whole
   worker, so they go in one at a time and failures are swallowed. */
const OPTIONAL = CAT.fonts.concat(CAT.icons);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CRITICAL);
    await Promise.all(OPTIONAL.map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
