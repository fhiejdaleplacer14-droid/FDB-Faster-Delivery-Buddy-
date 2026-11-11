# Backend on Render, database on Neon, website on Cloudflare

```
Browser -> Cloudflare Worker (website + forwards /api) -> Render (Laravel API, Singapore) -> Neon (PostgreSQL, Singapore)
```

Render runs only the API, in one container (`docker/render/Dockerfile`: nginx and PHP-FPM, running as an unprivileged user). Sessions, cache, and the queue use the Neon database, so there is no Redis and no worker. The Cloudflare Worker in `frontend/` forwards `/api`, `/sanctum`, and `/storage` to Render (see [CLOUDFLARE.md](CLOUDFLARE.md)).

## Setup

1. **Push the repository to GitHub** (including `render.yaml` and `docker/render/`).
2. **Generate an app key.** In the project folder:
   ```sh
   docker compose exec app php artisan key:generate --show
   ```
   Keep the `base64:...` value private.
3. **Create the service on Render.** Sign in with GitHub, choose **New, Blueprint**, pick this repository, and approve `render.yaml`. Render asks for the values marked `sync: false`:

   | Variable | Value |
   | --- | --- |
   | `APP_KEY` | The key from step 2 |
   | `DB_URL` | Neon's **unpooled** connection string (`DATABASE_URL_UNPOOLED` in `.env.local`) |
   | `APP_URL`, `FRONTEND_URL` | The website address, e.g. `https://fdb-faster-delivery-buddy.<account>.workers.dev` |
   | `SANCTUM_STATEFUL_DOMAINS` | The same address without `https://` |

   Render builds the image and gives the service an address like `https://fdb-api.onrender.com`. Check `https://fdb-api.onrender.com/api/v1/health` returns `{"status":"ok","checks":{"database":"ok"}}`.
4. **Point Cloudflare at it.** In the Worker's settings add the variable `BACKEND_ORIGIN` set to the Render address.
5. Open the website and sign in.

The database is already migrated and seeded on Neon. To run migrations from Render later, set `RUN_MIGRATIONS=true` for one deploy and then remove it.

## What to expect on the free plan

- **It sleeps after about 15 minutes without traffic.** The next visitor waits roughly a minute while it wakes up. A free uptime pinger (for example UptimeRobot, checking `/api/v1/health` every 5 minutes) keeps it awake; Render's free hours are enough for one always-on service, but check their current terms.
- **Small machine.** About 512 MB of memory and a shared CPU. Fine for a demo; very large photo uploads can run it out of memory.
- **The instance's disk is erased on every restart and deploy,** so photos and seller documents live in Neon Object Storage instead (see below).
- **Email is not connected,** so sign-up verification and password reset do not send anything yet.

## Photos and documents (Neon Object Storage)

Two buckets are declared in `neon.ts` and created with `neon deploy`:

| Bucket | Access | Holds |
| --- | --- | --- |
| `fdb-media` | Public read, write only with the credential | Product photos |
| `fdb-documents` | Private | Seller verification documents, downloaded only through the backend by admins |

`neon deploy` also saves the storage credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`) to `.env.local`. Set these on Render, together with `FDB_STORAGE_DRIVER=s3`, `FDB_MEDIA_BUCKET=fdb-media`, and `FDB_DOCUMENTS_BUCKET=fdb-documents`. With `FDB_STORAGE_DRIVER` unset the backend keeps using local disks, as in development.

The backend still saves photos under the disk name `media` and documents under `seller_documents`, so existing rows keep working. Photo links stay `/storage/...` on the website's own address: the Worker fetches them from the public bucket (secret `MEDIA_ORIGIN` = the storage address plus `/fdb-media`) and Cloudflare caches them for a month. Neon rejects ACL calls, so no per-file visibility is set; the bucket's access level decides who can read.

The free plan includes 5 GB of object storage per project. Product photos are resized to under 1600 px, so this goes a long way.

## Settings that matter

- `TRUSTED_PROXIES=*` lets Laravel read the real visitor IP the Worker forwards (for sign-in rate limits). Treat the Render address as private: anyone who finds it could send a fake IP directly to the API.
- `SESSION_SECURE_COOKIE=true`: sessions only travel over HTTPS. The website and API share one origin (through the Worker), so cookies work without extra settings.
- The tests always run on a local test database, never on Neon.
