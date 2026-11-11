// Runs only for /api, /sanctum and /storage (see run_worker_first in wrangler.jsonc).
// Everything else is served straight from the built app in dist/.
// The browser only ever talks to this origin, so Sanctum's session cookies need no CORS.

const json = (status, message) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

export default {
  async fetch(request, env) {
    const backend = env.BACKEND_ORIGIN
    if (!backend) return json(503, 'FDB is not available right now. Please try again later.')

    const url = new URL(request.url)
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
