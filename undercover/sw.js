/* Undercover — service worker.
 *
 * Stratégie « réseau d'abord » pour le code de l'application (page, styles,
 * scripts, manifeste) : dès qu'il y a du réseau, la dernière version publiée
 * s'affiche, sans dépendre d'un numéro de cache à incrémenter à la main. Le
 * cache sert de repli hors ligne. Les icônes, elles, ne changent pratiquement
 * jamais : cache d'abord, mise à jour en arrière-plan.
 */
var CACHE = 'undercover-v3';
var ASSETS = [
  './',
  './index.html',
  './assets/styles.css',
  './assets/words.js',
  './assets/store.js',
  './assets/game.js',
  './assets/app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .catch(function () { /* un fichier manquant ne doit pas bloquer l'installation */ })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function putInCache(request, response) {
  if (!response || !response.ok) return;
  var copy = response.clone();
  caches.open(CACHE).then(function (c) { c.put(request, copy); }).catch(function () {});
}

/* Réseau d'abord : on revalide auprès du serveur (no-cache → 304 si rien n'a
   changé), et on ne retombe sur le cache qu'en cas d'échec réseau. */
function networkFirst(request) {
  return fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' })
    .then(function (res) { putInCache(request, res); return res; })
    .catch(function () {
      return caches.match(request).then(function (hit) {
        if (hit) return hit;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    });
}

/* Cache d'abord, avec rafraîchissement silencieux derrière. */
function cacheFirst(request) {
  return caches.match(request).then(function (hit) {
    var network = fetch(request)
      .then(function (res) { putInCache(request, res); return res; })
      .catch(function () { return hit; });
    return hit || network;
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  if (req.destination === 'image' || url.pathname.indexOf('/icons/') !== -1) {
    e.respondWith(cacheFirst(req));
  } else {
    e.respondWith(networkFirst(req));
  }
});
