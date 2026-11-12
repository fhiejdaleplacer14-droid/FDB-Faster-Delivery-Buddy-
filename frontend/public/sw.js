// FDB service worker: makes the site installable and shows an offline page.
// It never caches the API, sign-in, or pages, so people always see live prices, stock, and orders.
const SHELL = 'fdb-shell-v1'
const ASSETS = 'fdb-assets-v1'
const MAX_ASSETS = 80

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(['/offline.html', '/icons/icon-192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== ASSETS).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (/^\/(api|sanctum|storage)\//.test(url.pathname)) return

  // Pages: always from the network; the offline page only when there is no connection.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }

  // Built files have a content hash in their name, so a cached copy can never be out of date.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        // Only keep real files: a page returned in place of a missing file must never be cached.
        const type = response.headers.get('Content-Type') || ''
        if (response.ok && !type.includes('text/html')) {
          await cache.put(request, response.clone())
          const keys = await cache.keys()
          if (keys.length > MAX_ASSETS) await Promise.all(keys.slice(0, keys.length - MAX_ASSETS).map((key) => cache.delete(key)))
        }
        return response
      }),
    )
  }
})
