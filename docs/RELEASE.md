# Release and operations

How to put FDB on a server, update it, back it up, and what must be decided before real customers use it. Nothing here runs automatically: every deploy is a deliberate step by a person.

## What runs in production

`docker-compose.prod.yml` starts:

| Service | Image | Job |
| --- | --- | --- |
| `web` | `fdb-web` (`docker/web/Dockerfile`) | nginx. Serves the built React app, sends `/api` and `/sanctum` to PHP, serves product photos from `/storage`, and adds the security headers |
| `app` | `fdb-php` (production stage of `docker/php/Dockerfile`) | Laravel on PHP-FPM 8.5 |
| `queue` | `fdb-php` | Sends notifications in the background |
| `scheduler` | `fdb-php` | Laravel's scheduled tasks |
| `postgres` | `postgres:18.6-alpine` | Database (volume `postgres_data`) |
| `redis` | `redis:8.10.3-alpine` | Sessions, cache, and queue, password protected |

Uploaded product photos live in the `media` volume, seller documents in `seller_documents`. Back up both along with the database.

The `web` container listens on plain HTTP. Put it behind something that handles HTTPS (a load balancer, Caddy, or a reverse proxy with a certificate) and set `TRUSTED_PROXIES` to that proxy's address. The app forces `https` links and secure cookies in production.

## First deploy

1. Install Docker Engine with the Compose plugin on the server and clone the repository.
2. Create the settings file and fill in every `CHANGE_ME`:
   ```sh
   cp backend/.env.production.example backend/.env.production
   chmod 600 backend/.env.production
   ```
   Generate `APP_KEY` with:
   ```sh
   docker compose -f docker-compose.prod.yml --env-file backend/.env.production build app
   docker compose -f docker-compose.prod.yml --env-file backend/.env.production run --rm --no-deps --entrypoint php app artisan key:generate --show
   ```
   Use long random values for `DB_PASSWORD` and `REDIS_PASSWORD`. Keep a copy of the file somewhere safe outside the server: losing `APP_KEY` makes encrypted sessions and data unreadable.
3. Build and start:
   ```sh
   export FDB_RELEASE=2026-11-11   # any label; lets you roll back to an older build
   docker compose -f docker-compose.prod.yml --env-file backend/.env.production up -d --build --wait
   ```
4. Create the tables, roles, and the first commission rate:
   ```sh
   docker compose -f docker-compose.prod.yml --env-file backend/.env.production exec app php artisan migrate --force
   docker compose -f docker-compose.prod.yml --env-file backend/.env.production exec app php artisan db:seed --force
   ```
5. Create the first admin. Never use a shared or default password:
   ```sh
   docker compose -f docker-compose.prod.yml --env-file backend/.env.production exec app php artisan fdb:create-admin
   ```
6. Check it: `https://your-domain/api/v1/health` should return `{"status":"ok",...}`, and you should be able to sign in as the admin.

Never run `DemoMarketplaceSeeder` in production; it refuses to, but do not try.

## Updating to a new version

1. Back up first: `sh scripts/backup-db.sh`.
2. Pull the new code and build with a new label:
   ```sh
   git pull
   export FDB_RELEASE=2026-11-20
   docker compose -f docker-compose.prod.yml --env-file backend/.env.production up -d --build --wait
   docker compose -f docker-compose.prod.yml --env-file backend/.env.production exec app php artisan migrate --force
   docker compose -f docker-compose.prod.yml --env-file backend/.env.production exec app php artisan db:seed --force
   ```
   `db:seed` is safe to rerun and adds permissions that new versions introduce.
3. Check `/api/v1/health` and sign in.

**Rolling back:** set `FDB_RELEASE` to the previous label and run `up -d` again without `--build`. If the new version changed the database, restore the backup from step 1 as well.

## Backups

`scripts/backup-db.sh` saves a compressed dump to `backups/` (git-ignored, readable only by the owner), checks that it can be read back, and keeps the newest 14 (`KEEP=30 sh scripts/backup-db.sh` keeps more). Run it daily from cron, for example:

```cron
30 2 * * * cd /srv/fdb && sh scripts/backup-db.sh >> backups/backup.log 2>&1
```

A backup on the same server is not enough. Copy `backups/` and the `media` and `seller_documents` volumes to another location every day.

`scripts/restore-db.sh backups/<file>.dump` replaces **all** current data with the dump. It asks you to type `RESTORE`, stops the app while it works, and starts it again. Practise it on a test server before you need it. Both scripts were tested end to end on a throwaway copy of the production stack.

## Checking a build before it ships

`sh scripts/smoke-prod.sh` builds the production images, starts them as a separate stack with random secrets on port 8088, and checks the site, the API, the security headers, file uploads, and that debug mode is off. It then deletes that stack. CI runs it on every push after the tests pass. It never touches a real deployment.

## Before real customers use FDB

### Decisions still open

These run on placeholder values. Each one is a setting in `backend/.env.production` or a choice in the admin area:

| Decision | Current placeholder | Where |
| --- | --- | --- |
| Commission rate | 7.5% on product value, due on delivery | Admin → Commissions (`FDB_INITIAL_COMMISSION_RATE` only seeds the first rate) |
| What happens to commission on a refund | Reduced in proportion | `FDB_REFUND_COMMISSION` (`proportional` or `none`) |
| Dispute window | 7 days after delivery | `FDB_DISPUTE_WINDOW_DAYS` |
| Documents a seller must upload | Government ID only | `FDB_SELLER_REQUIRED_DOCUMENTS` |
| Listings checked before going live | Yes | `FDB_LISTING_REQUIRES_REVIEW` |
| Payment methods customers can choose | Cash on delivery only; GCash, Maya, Other show as "Coming soon" | `FDB_PAYMENT_METHODS` |
| Cancellation rules | Customer before the seller confirms; seller until out for delivery | Code (ask before changing) |
| Delivery fee | ₱0, arranged with the seller | Code (ask before changing) |
| Reviews | Go live immediately; moderators hide bad ones | Code (ask before changing) |
| Starting categories | None seeded | Admin → Categories |

### Waiting on an outside service

Deliberately left for last:

- **Email.** Messages (verification, password reset, order updates) are written to the log until a provider is chosen. Customers cannot verify their email or reset passwords until this is connected, so it is required before launch.
- **Photo storage.** Photos are on the server's disk (`media` volume). A bucket or CDN is recommended; set `VITE_MEDIA_ORIGIN` when building so the security policy allows it.
- **Virus scanning** of uploaded seller documents.
- **Error monitoring** (for example Sentry) and uptime alerts.
- **Real GCash or Maya payments.** Today sellers collect payment themselves; FDB only records it.

### Legal and privacy

- Terms of service and privacy policy written and linked, with acceptance at sign-up.
- Data Privacy Act review: registration with the National Privacy Commission if required, how long order and seller-document data is kept, and how a customer can have their account deleted or their data exported. Account deletion and export are not built yet because they depend on this review.
- Business registration and the agreement sellers accept, including commission terms.
