# Environment variables

The backend reads `backend/.env`. Start from `backend/.env.example`. Production uses `backend/.env.production`, started from `backend/.env.production.example` (see [RELEASE.md](RELEASE.md)). Never commit `.env` files or put real secrets in documentation.

Frontend variables prefixed with `VITE_` are bundled into public JavaScript. Never put secrets in them.

| Frontend variable | Default | Purpose |
| --- | --- | --- |
| `VITE_PROXY_TARGET` | `http://localhost:8000` | Where the dev server sends `/api`, `/sanctum`, and `/storage`. Docker Compose sets it to `http://web` |
| `VITE_MEDIA_ORIGIN` | unset | Origin of product photos when they move to a CDN or bucket, e.g. `https://media.example.com`. Added to the built app's `img-src` policy |

## Backend

| Variable | Local default | Notes |
| --- | --- | --- |
| `APP_ENV` | `local` | `production` turns on stricter password checks and blocks destructive DB commands |
| `APP_DEBUG` | `true` | Must be `false` in staging and production |
| `APP_KEY` | generated | Created by `scripts/dev-setup.sh`. Use a separate key for each environment |
| `APP_URL` | `http://localhost:8000` | Public URL of the API |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |
| `APP_DISPLAY_TIMEZONE` | `Asia/Manila` | Timezone for showing times to people. Storage is always UTC |
| `FDB_SELLER_REQUIRED_DOCUMENTS` | `government_id` | Document types every seller application must include (comma-separated). **Placeholder until the founders decide** |
| `FDB_SELLER_DOCUMENTS_DISK` | `seller_documents` | Private disk for verification files. Point it at a private S3 bucket in production |
| `FDB_LISTING_REQUIRES_REVIEW` | `true` | Listings need FDB approval before customers see them. Content edits to a live listing send it back for review. **Placeholder until the founders decide** |
| `FDB_MEDIA_DISK` | `media` | Disk for public product photos. Use a public S3-compatible bucket or CDN in production |
| `MEDIA_URL` | `/storage` | Base URL that product photo links are built from |
| `FDB_PAYMENT_METHODS` | `cash_on_delivery` | Comma-separated methods customers can actually select. GCash, Maya, and "Other" are always listed at checkout, but show as "Coming soon" and are refused by the server unless enabled here. Sellers collect payment directly; FDB only records the choice |
| `FDB_DISPUTE_WINDOW_DAYS` | `7` | How many days after delivery a customer may open a dispute. **Placeholder until the founders decide** |
| `FDB_REQUIRE_EMAIL_VERIFICATION` | `true` | A verified email is required to check out and to apply as a seller. The test site sets `false` because email is not connected yet; seller applications still need admin approval. **Turn back on before real customers** |
| `FDB_STORAGE_DRIVER` | `local` | `s3` moves product photos and seller documents to S3-compatible buckets (Neon Object Storage). Needs `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, and `AWS_REGION`; buckets are `FDB_MEDIA_BUCKET` (default `fdb-media`, public read) and `FDB_DOCUMENTS_BUCKET` (default `fdb-documents`, private) |
| `FDB_REFUND_COMMISSION` | `proportional` | `proportional` lowers FDB's commission by the rate times the refunded item value (refunds count against items before the delivery fee); `none` keeps the commission. **Placeholder until the founders decide** |
| `FDB_INITIAL_COMMISSION_RATE` | `0.0750` | Used once, to create the first default commission rate when none exists. After that, admins change rates in the app. **Placeholder until the founders decide** |
| `DEMO_SELLER_PASSWORD` | unset | Local and staging only: password for the demo seller accounts the demo seeder creates. If unset, a random password is used |
| `TRUSTED_PROXIES` | `127.0.0.1` | IP addresses or ranges of the load balancer or proxy in front of the app |
| `DB_*` | `pgsql` on `postgres:5432` | PostgreSQL connection |
| `REDIS_CLIENT` | `predis` | Redis client library |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | `redis`, `6379`, none | Set a password in every shared environment |
| `CACHE_STORE`, `SESSION_DRIVER`, `QUEUE_CONNECTION` | `redis` | |
| `SESSION_DOMAIN` | `localhost` | The SPA's domain |
| `SESSION_SECURE_COOKIE` | `false` | Forced on in production regardless of this value |
| `SESSION_ENCRYPT` | `true` | |
| `SANCTUM_STATEFUL_DOMAINS` | `localhost:5173` | Host and port the SPA is served from |
| `MAIL_*` | `log` mailer | Set a transactional email provider in staging and production |
| `AWS_*` | empty | S3-compatible media storage, configured in a later phase |

## Docker Compose

These are read from your shell or a root `.env` file. All are optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `FDB_API_PORT` | `8000` | Host port for nginx |
| `FDB_WEB_PORT` | `5173` | Host port for the Vite dev server |
| `FDB_DB_PORT` | `5432` | Host port for PostgreSQL (bound to 127.0.0.1 only) |

The PostgreSQL container also creates a `<database>_testing` database on first start, which the backend tests use.

## Using Neon for the database

Neon hosts the PostgreSQL database; the app still runs where you run it. Laravel reads `DB_URL` and `DB_SSLMODE`, so no application code depends on it.

**Current setup (test and demo):** `backend/.env` holds `DB_URL` (Neon's *unpooled* URL), `DB_SSLMODE=require`, and `DB_PERSISTENT=true`. `DB_URL` wins over the local `DB_HOST`, `DB_USERNAME`, and `DB_PASSWORD` lines, which stay only so the tests can reach the local `fdb_testing` database. `phpunit.xml` blanks `DB_URL` and sets `DB_SSLMODE=prefer`, so the tests can never touch Neon.

- Get the URL with `neon login`, then `neon deploy` in the project root. It saves variables to `.env.local` (git-ignored). Use `DATABASE_URL_UNPOOLED`: migrations and the row locks used at checkout need real database sessions.
- `DB_PERSISTENT=true` keeps connections open between requests. Connecting to Neon from far away takes 1 to 2 seconds, so this matters. Leave it unset for a local database.
- **Go back to the local database:** copy `backend/.env.localdb` (a git-ignored copy of the old settings) over `backend/.env`, or delete the `DB_URL` line.
- To run one command against Neon while `.env` points elsewhere, use `--env=neon` with a `backend/.env.neon` file.
- **Two database logins.** The app connects as `fdb_app`, a limited login that can read and write rows but cannot create, alter, drop, or truncate tables, change or delete audit-log entries, or switch off the audit trigger. `neondb_owner` stays for schema changes: keep its address in `backend/.env.neon` and run migrations with `php artisan migrate --env=neon --force`. New tables created by the owner automatically get the same limited access for `fdb_app` (default privileges), except `audit_logs`, where the grants were narrowed by hand. `RUN_MIGRATIONS=true` on Render does not work with the limited login, on purpose.
- **Do not run** `migrate:fresh`, `migrate:rollback`, or `DemoMarketplaceSeeder` while `backend/.env` points at Neon. Those delete or replace data. Production already blocks the destructive commands.
- Product photos are not in the database. They stay in `backend/storage/app/public` (the `media` volume in production).
- In production, put the same `DB_URL` and `DB_SSLMODE=require` in `backend/.env.production` and remove the `postgres` service from `docker-compose.prod.yml`. Run the app close to Neon's region (this project is in Singapore): each query is a network trip.
