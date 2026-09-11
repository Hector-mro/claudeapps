/* Tâches — service worker.
 *
 * Réseau d'abord pour tout ce qui est du même domaine : la dernière version
 * publiée s'affiche dès qu'il y a du réseau, sans liste de fichiers à tenir
 * à jour à la main (les noms des fichiers buildés par Vite changent à
 * chaque build). Le cache ne sert que de repli hors ligne, rempli au fil
 * des visites.
 *
 * Changer CACHE modifie ce fichier : les apps restées ouvertes sur une
 * ancienne version voient alors un nouveau service worker et se rechargent
 * (voir src/main.tsx). v2 : l'arrivée de la synchronisation. v3 : les
 * notifications (les écouteurs `push` et `notificationclick` en bas).
 */
var CACHE = 'taches-v3'

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

/* Notifications, envoyées par le Worker (worker/notifications.ts) :
 * { title, body, tag, badge }. iOS exige qu'un push affiche toujours une
 * notification — sinon il finit par couper l'abonnement. */
self.addEventListener('push', function (event) {
  var data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    // Pas du JSON : une notification générique plutôt que rien.
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'Tâches', {
        body: data.body || '',
        tag: data.tag,
        icon: './favicon.svg',
      }),
      setBadge(data.badge),
    ]),
  )
})

// Le chiffre sur l'icône : les tâches du jour ou en retard (src/notify.ts).
function setBadge(count) {
  var nav = self.navigator
  if (typeof count !== 'number' || !nav.setAppBadge) return Promise.resolve()
  var done = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge()
  return done.catch(function () {})
}

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        if ('focus' in windows[i]) return windows[i].focus()
      }
      return self.clients.openWindow('./')
    }),
  )
})
