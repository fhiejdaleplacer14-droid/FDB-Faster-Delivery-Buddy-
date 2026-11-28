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
   | `DB_URL` | Supabase **Session pooler** URI (Connect button, port 5432). Not the direct URI (IPv6 only) or the transaction pooler (6543). |
   | `APP_URL`, `FRONTEND_URL` | The website address, e.g. `https://fdb-faster-delivery-buddy.<account>.workers.dev` |
   | `SANCTUM_STATEFUL_DOMAINS` | The same address without `https://` |
   | `AWS_*` | Supabase Storage S3 keys, see below |

   Check `https://<service>.onrender.com/api/v1/health` returns `{"status":"ok","checks":{"database":"ok"}}`.
4. **Point Cloudflare at it:** set the Worker variable `BACKEND_ORIGIN` to the Render address.

To run migrations from Render, set `RUN_MIGRATIONS=true` for one deploy and then remove it. Each migration run is followed by `php artisan fdb:enforce-rls`.

## Row level security

Supabase publishes the `public` schema through its Data API. FDB never uses that API, so `fdb:enforce-rls` turns RLS on for every table with no policies and removes all grants from the `anon` and `authenticated` roles. Laravel connects as the table owner, which bypasses RLS. Check with `php artisan fdb:enforce-rls --check` or Supabase's Security Advisor.

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

- `TRUSTED_PROXIES=*` lets Laravel read the visitor IP the Worker forwards. Keep the Render address private: requests sent to it directly can fake their IP. Sign-in also limits attempts per account, so a faked IP does not help guess passwords.
- `SESSION_SECURE_COOKIE=true`: sessions only travel over HTTPS.
- Tests always run on a local test database, never on the hosted one.
