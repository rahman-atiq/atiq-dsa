/* ============================================================
   Service worker.

   The precache list is no longer typed out here. It comes from
   shared/catalog.js, which the hub and the chrome bar also read, so
   adding a module cannot leave the offline copy one page short.

   The cache name carries a build stamp. The repo keeps a placeholder
   and the Pages workflow rewrites it to the commit sha on the way to
   the artifact, so every deploy ships a sw.js whose bytes differ --
   the only thing that makes a browser re-fetch this file and notice
   there is a new version at all.

   The placeholder appears exactly once in this file, on the line
   below, and scripts/check.mjs holds it to that: the workflow stamps
   it with a plain sed, and a second copy in a comment would soak up
   the substitution and leave the cache name frozen while the bytes
   still changed -- an update prompt for a build that never lands.

   A new worker installs and then waits. It does NOT skipWaiting on
   its own: taking over a tab mid-slide would swap the stylesheet under
   a reader's feet. shared/chrome.js spots the waiting worker, offers a
   reload, and only then posts DSA_SKIP_WAITING back here.
   ============================================================ */
importScripts('shared/catalog.js');

const BUILD = '__BUILD__';
const CACHE = 'dsa-deck-' + BUILD;
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
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* The reader pressed "Reload" on the toast. */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'DSA_SKIP_WAITING') self.skipWaiting();
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
