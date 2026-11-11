// Runs only for /api, /sanctum and /storage (see run_worker_first in wrangler.jsonc).
// Everything else is served straight from the built app in dist/.
// The browser only ever talks to this origin, so Sanctum's session cookies need no CORS.

const json = (status, message) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

const THIRTY_DAYS = 60 * 60 * 24 * 30

// Product photos live in a public bucket (MEDIA_ORIGIN is its address including the bucket name).
// Photo names are random and never reused, so Cloudflare and browsers can keep them for a month.
async function servePhoto(request, env, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return json(405, 'Method not allowed.')

  const key = url.pathname.slice('/storage'.length)
  let decoded
  try {
    decoded = decodeURIComponent(key)
  } catch {
    return json(404, 'Not found.')
  }
  // Keep every request inside the photo bucket.
  if (decoded.split('/').includes('..') || decoded.includes('\\')) return json(404, 'Not found.')

  let upstream
  try {
    upstream = await fetch(env.MEDIA_ORIGIN.replace(/\/+$/, '') + key, {
      method: request.method,
      cf: { cacheEverything: true, cacheTtl: THIRTY_DAYS },
    })
  } catch {
    return json(502, 'We could not load this photo. Please try again in a moment.')
  }
  if (!upstream.ok) return json(404, 'Not found.')

  const headers = new Headers()
  headers.set('Content-Type', upstream.headers.get('Content-Type') ?? 'application/octet-stream')
  headers.set('Cache-Control', `public, max-age=${THIRTY_DAYS}, immutable`)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox")
  headers.set('Cross-Origin-Resource-Policy', 'same-origin')
  return new Response(upstream.body, { status: 200, headers })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (env.MEDIA_ORIGIN && url.pathname.startsWith('/storage/')) return servePhoto(request, env, url)

    const backend = env.BACKEND_ORIGIN
    if (!backend) return json(503, 'FDB is not available right now. Please try again later.')

    const target = new URL(url.pathname + url.search, backend)

    const headers = new Headers(request.headers)
    // The backend sees the public address, not its own, and the real visitor's IP for rate limits.
    headers.set('X-Forwarded-Host', url.host)
    headers.set('X-Forwarded-Proto', 'https')
    const ip = request.headers.get('CF-Connecting-IP')
    if (ip) headers.set('X-Forwarded-For', ip)

    try {
      return await fetch(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
      })
    } catch {
      return json(502, 'We could not reach FDB. Please try again in a moment.')
    }
  },
}
