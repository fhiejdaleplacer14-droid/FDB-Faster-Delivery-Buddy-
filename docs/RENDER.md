# Backend on Render, database and files on Supabase, website on Cloudflare

```
Browser -> Cloudflare Worker (website + forwards /api) -> Render (Laravel API, Singapore) -> Supabase (PostgreSQL + Storage, Singapore)
```

Render runs only the API, in one container (`docker/render/Dockerfile`: nginx and PHP-FPM, running as an unprivileged user). Sessions, cache, and the queue use the database, so there is no Redis and no worker. The Cloudflare Worker in `frontend/` forwards `/api`, `/sanctum`, and `/storage` to Render (see [CLOUDFLARE.md](CLOUDFLARE.md)).

## Setup

1. **Push the repository to GitHub** (including `render.yaml` and `docker/render/`).
2. **Generate an app key:** `docker compose exec app php artisan key:generate --show`. Keep the `base64:...` value private.
3. **Create the service on Render** (**New, Blueprint**, pick this repository). Render asks for the values marked `sync: false`:

   | Variable | Value |
   | --- | --- |
   | `APP_KEY` | The key from step 2 |
   | `DB_URL` | Session pooler URI for the limited `fdb_app` login (`SUPABASE_APP_DB_URL` in `backend/.env`). Use the pooler on port 5432, not the direct URI (IPv6 only) or the transaction pooler (6543) |
   | `FDB_EDGE_SECRET` | The same value as the Worker secret `EDGE_SECRET` (`RENDER_FDB_EDGE_SECRET` in `backend/.env`) |
   | `APP_URL`, `FRONTEND_URL` | The website address, e.g. `https://fdb-faster-delivery-buddy.<account>.workers.dev` |
   | `SANCTUM_STATEFUL_DOMAINS` | The same address without `https://` |
   | `AWS_*` | Supabase Storage S3 keys, see below |

   Check `https://<service>.onrender.com/api/v1/health` returns `{"status":"ok","checks":{"database":"ok"}}`.
4. **Point Cloudflare at it:** set the Worker variable `BACKEND_ORIGIN` to the Render address.

Run migrations from your computer with the owner login (see [ENVIRONMENT.md](ENVIRONMENT.md)), then `php artisan fdb:enforce-rls`. `RUN_MIGRATIONS=true` on Render fails with the limited login, on purpose.

## Row level security

Supabase publishes the `public` schema through its Data API. FDB never uses that API, so `fdb:enforce-rls` turns RLS on for every table with no policies and removes all grants from the `anon` and `authenticated` roles. The app's `fdb_app` login bypasses RLS but cannot change tables or the audit log; see [SECURITY.md](SECURITY.md). Check with `php artisan fdb:enforce-rls --check` or Supabase's Security Advisor.

## Photos and documents (Supabase Storage)

| Bucket | Access | Holds |
| --- | --- | --- |
| `fdb-media` | Public read | Product photos |
| `fdb-documents` | Private | Seller verification documents, downloaded only through the backend by admins |

Create S3 keys in Supabase (**Storage, S3 Configuration, New access key**) and set on Render:

| Variable | Value |
| --- | --- |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | The S3 key pair |
| `AWS_ENDPOINT_URL_S3` | `https://<project-ref>.storage.supabase.co/storage/v1/s3` |
| `AWS_REGION` | The project's region, e.g. `ap-southeast-1` |
| `FDB_STORAGE_DRIVER` | `s3` |

Photo links stay `/storage/...` on the website's address: the Worker fetches them from the public bucket (secret `MEDIA_ORIGIN` = `https://<project-ref>.supabase.co/storage/v1/object/public/fdb-media`) and Cloudflare caches them for a month.

## What to expect on the free plans

- **Render sleeps after about 15 minutes without traffic;** the next visitor waits about a minute. An uptime pinger on `/api/v1/health` keeps it awake.
- **Render's disk is erased on every deploy,** which is why files live in Supabase Storage.
- **Supabase pauses a project after 7 days with no activity.** Normal traffic or the pinger prevents that.
- **Email is not connected,** so verification and password reset emails are not sent yet.

## Settings that matter

- `TRUSTED_PROXIES=*` lets Laravel read the visitor IP the Worker forwards. `FDB_EDGE_SECRET` makes the backend refuse requests that skip the Worker, so that IP cannot be faked.
- `SESSION_SECURE_COOKIE=true`: sessions only travel over HTTPS.
- Tests always run on a local test database, never on the hosted one.

## Private repository

The repository can be private. Cloudflare, Render, and Supabase deploy through their GitHub apps, which keep working as long as each app has access to this repository (GitHub, Settings, Applications, Configure). GitHub Actions on a private repository uses the free plan's monthly minutes; this CI needs a few minutes per push. Code scanning in "Security and quality" needs a paid plan on private repositories, but Dependabot alerts and the `composer audit` step in CI still work.
