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
| `FDB_SELLER_DOCUMENTS_REQUIRED` | `true` | Starting value of the **Admin > Settings** switch. Once an admin flips it, the saved value in the database wins |
| `FDB_SELLER_DOCUMENTS_DISK` | `seller_documents` | Private disk for verification files. Point it at a private S3 bucket in production |
| `FDB_LISTING_REQUIRES_REVIEW` | `true` | Listings need FDB approval before customers see them. Content edits to a live listing send it back for review. **Placeholder until the founders decide** |
| `FDB_MEDIA_DISK` | `media` | Disk for public product photos. Use a public S3-compatible bucket or CDN in production |
| `MEDIA_URL` | `/storage` | Base URL that product photo links are built from |
| `FDB_PAYMENT_METHODS` | `cash_on_delivery` | Comma-separated methods customers can actually select. GCash, Maya, and "Other" are always listed at checkout, but show as "Coming soon" and are refused by the server unless enabled here. Sellers collect payment directly; FDB only records the choice |
| `FDB_DISPUTE_WINDOW_DAYS` | `7` | How many days after delivery a customer may open a dispute. **Placeholder until the founders decide** |
| `FDB_REQUIRE_EMAIL_VERIFICATION` | `true` | A verified email is required to check out and to apply as a seller. The test site sets `false` because email is not connected yet; seller applications still need admin approval. **Turn back on before real customers** |
| `FDB_STORAGE_DRIVER` | `local` | `s3` moves product photos and seller documents to S3-compatible buckets (Supabase Storage on the live site). Needs `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, and `AWS_REGION`; buckets are `FDB_MEDIA_BUCKET` (default `fdb-media`, public read) and `FDB_DOCUMENTS_BUCKET` (default `fdb-documents`, private) |
| `FDB_EDGE_SECRET` | (unset) | When set, the API refuses requests without the matching `X-FDB-Edge` header that the Cloudflare Worker adds. Leave unset locally |
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

## Hosted database (Supabase)

The live site's database is Supabase PostgreSQL; the API runs on Render. Laravel reads `DB_URL` and `DB_SSLMODE`, so no application code depends on the host.

- **Your computer uses the local Docker database.** `backend/.env` has no `DB_URL`, so local testing never touches live data. `phpunit.xml` also blanks `DB_URL`.
- `backend/.env` keeps three live values the local app ignores: `SUPABASE_DB_URL` (owner login, for migrations), `SUPABASE_APP_DB_URL` (the limited `fdb_app` login that Render uses), and `RENDER_FDB_EDGE_SECRET`. Run migrations on Supabase with the owner login:
  ```sh
  docker compose exec -e DB_URL="<SUPABASE_DB_URL>" -e DB_SSLMODE=require app php artisan migrate --force
  docker compose exec -e DB_URL="<SUPABASE_DB_URL>" -e DB_SSLMODE=require app php artisan fdb:enforce-rls
  ```
- Use the **Session pooler** URI. The direct URI is IPv6 only (Render cannot reach it) and the transaction pooler (6543) breaks Laravel's prepared statements.
- `DB_PERSISTENT=true` on Render keeps connections open between requests.
- The `search_path` is `public,extensions` because Supabase keeps `pg_trgm` in `extensions`; a missing schema is ignored locally.
- **Do not run** `migrate:fresh`, `migrate:rollback`, or `DemoMarketplaceSeeder` against Supabase. Those delete or replace live data.
- Files are not in the database. Locally they stay in `backend/storage/app`; live they are in Supabase Storage (`FDB_STORAGE_DRIVER=s3`, see [RENDER.md](RENDER.md)).
