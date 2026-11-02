const CACHE = 'scriptorium-pwa-v2'
const CORE = ['./', './index.html', './manifest.webmanifest']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return

  // Prefer the deployed version so installed Android apps receive fixes.
  // Keep a local copy as an offline fallback.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    try {
      const response = await fetch(event.request)
      if (response.ok) await cache.put(event.request, response.clone())
      return response
    } catch {
      const cached = await cache.match(event.request)
      if (cached) return cached
      if (event.request.mode === 'navigate') {
        return (await cache.match('./index.html')) || Response.error()
      }
      return Response.error()
    }
  })())
})
