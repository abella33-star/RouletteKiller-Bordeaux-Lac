// RouletteKiller — Service Worker v2.0
// Strategy: Cache-First for static assets, Network-First for API routes

const CACHE_NAME = 'rk-alpha-v2'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/alpha-worker.js',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  // Skip non-GET and external requests
  if (request.method !== 'GET') return
  if (url.origin !== location.origin) return

  // Next.js _next/static: Cache-First (immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(request).then(cached => cached ?? fetch(request).then(res => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(c => c.put(request, clone))
        return res
      }))
    )
    return
  }

  // Pages: Network-First (always try to update), fallback to cache
  e.respondWith(
    fetch(request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(c => c.put(request, clone))
        return res
      })
      .catch(() => caches.match(request).then(cached => cached ?? new Response('Offline', { status: 503 })))
  )
})
