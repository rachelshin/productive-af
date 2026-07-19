/* Service worker for the LG Dashboard.
   Goal: the app shell loads offline. Data is already offline-first
   (localStorage cache + Firestore persistence in index.html), so all this
   needs to cache is the page itself and the three Firebase SDK scripts.

   Strategy:
     • Pages (navigations): network-first — always fresh when online,
       cached copy when offline. No stale-version problem.
     • Firebase SDK scripts: cache-first — the URLs are versioned
       (…/10.12.2/…) so the content never changes.
     • Everything else (Firestore/auth API calls): untouched — the SDK
       handles its own offline queueing. */

var CACHE = 'lg-dash-v1';

var FIREBASE_SDK = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(['./'].concat(FIREBASE_SDK)); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // Firebase SDK: cache-first (versioned URLs, immutable).
  if (FIREBASE_SDK.indexOf(req.url) !== -1) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
    return;
  }

  // Page loads: network-first, refresh the cache on every successful load,
  // fall back to the cached copy when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
  }
  // Anything else falls through to the network untouched.
});
