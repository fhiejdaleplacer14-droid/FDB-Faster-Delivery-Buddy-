# Hosting the website on Cloudflare

Cloudflare serves the website (the built React app) for free. It cannot run the Laravel backend, so the backend runs on a server of yours and Cloudflare forwards `/api`, `/sanctum`, and `/storage` to it. The browser only ever talks to the Cloudflare address, so sign-in cookies work without extra settings.

```
Browser -> <name>.workers.dev  --static files-->  built app (frontend/dist)
                               --/api /sanctum /storage-->  Worker  -->  your backend (BACKEND_ORIGIN)
```

The pieces are in `frontend/`: `wrangler.jsonc` (settings), `worker/index.js` (the forwarding code), and `public/_headers` (security headers for the static files).

## Cloudflare settings

In the Cloudflare dashboard, open the Worker (named `fdb-faster-delivery-buddy`, matching `wrangler.jsonc`):

| Setting | Value |
| --- | --- |
| Git repository | This repository |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Variable `BACKEND_ORIGIN` (Settings, Variables and Secrets) | The backend's public `https://` address, with no trailing path |

A blank page that logs "Failed to load module script ... MIME type" means Cloudflare is serving the source folder instead of the build. Check the root directory and build command above. Without `BACKEND_ORIGIN` the website loads and shows "FDB is not available right now".

Set a second secret, `MEDIA_ORIGIN`, to the public photo bucket's address (for example `https://<branch>.storage.c-1.ap-southeast-1.aws.neon.tech/fdb-media`). With it, `/storage/*` is served from the bucket and cached; without it, `/storage` is forwarded to the backend. See [RENDER.md](RENDER.md).

Deploys never overwrite `BACKEND_ORIGIN` (`keep_vars` is on). Refreshing any page such as `/orders/123` returns the app because `wrangler.jsonc` turns on single-page-app routing.

## Backend settings

The backend must know the public address. In `backend/.env` (or `.env.production`), with your own Worker address in place of the example:

```
APP_URL=https://fdb-faster-delivery-buddy.example.workers.dev
FRONTEND_URL=https://fdb-faster-delivery-buddy.example.workers.dev
SANCTUM_STATEFUL_DOMAINS=fdb-faster-delivery-buddy.example.workers.dev
SESSION_DOMAIN=null
SESSION_SECURE_COOKIE=true
TRUSTED_PROXIES=*
```

`SANCTUM_STATEFUL_DOMAINS` is the host without `https://`. `TRUSTED_PROXIES=*` lets Laravel read the real visitor IP the Worker forwards, which keeps sign-in rate limits per visitor. The catch: anyone who finds the backend's own address could send a fake IP, so treat that address as private and do not publish it.

## Making the backend reachable

The Worker needs a public `https://` address for the backend. Options with no budget:

- **Tailscale Funnel:** install Tailscale on the computer running the backend, then `tailscale funnel --bg 8000` (use `80` for the production stack). It prints a stable `https://<machine>.<tailnet>.ts.net` address. Use that as `BACKEND_ORIGIN`. Not tested here.
- **Cloudflare Tunnel:** needs a domain added to Cloudflare (a small yearly cost).
- A small paid server, later, with its own address.

If the backend computer is off or offline, the website still loads but shows "We could not reach FDB".

## Testing before you deploy

From `frontend/`:

```sh
npm run build
npx wrangler dev --port 8787 --var BACKEND_ORIGIN:http://localhost:8000
```

Then open `http://localhost:8787`. This runs the same Worker locally against your local backend. It was checked this way: the built script loads with the right type, deep links return the app, `/api` and product photos pass through, and sign-in and the session cookie work.
