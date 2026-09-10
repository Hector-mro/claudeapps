/* Tâches — service worker.
 *
 * Réseau d'abord pour tout ce qui est du même domaine : la dernière version
 * publiée s'affiche dès qu'il y a du réseau, sans liste de fichiers à tenir
 * à jour à la main (les noms des fichiers buildés par Vite changent à
 * chaque build). Le cache ne sert que de repli hors ligne, rempli au fil
 * des visites.
 */
var CACHE = 'taches-v1'

self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.map(function (key) {
            return key === CACHE ? null : caches.delete(key)
          }),
        )
      })
      .then(function () {
        return self.clients.claim()
      }),
  )
})

function putInCache(request, response) {
  if (!response || !response.ok) return
  var copy = response.clone()
  caches.open(CACHE).then(function (c) {
    c.put(request, copy)
  })
}

function networkFirst(request) {
  return fetch(request, { cache: 'no-cache' })
    .then(function (response) {
      putInCache(request, response)
      return response
    })
    .catch(function () {
      return caches.match(request).then(function (hit) {
        if (hit) return hit
        if (request.mode === 'navigate') return caches.match('./')
        return Response.error()
      })
    })
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return
  var url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  event.respondWith(networkFirst(event.request))
})
