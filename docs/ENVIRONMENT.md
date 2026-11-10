# Environment variables

The backend reads `backend/.env`. Start from `backend/.env.example`. Never commit `.env` files or put real secrets in documentation.

Frontend variables prefixed with `VITE_` are bundled into public JavaScript. Never put secrets in them.

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
| `TRUSTED_PROXIES` | `127.0.0.1` | IP addresses or ranges of the load balancer or proxy in front of the app |
| `DB_*` | `pgsql` on `postgres:5432` | PostgreSQL connection |
| `REDIS_CLIENT` | `predis` | Redis client library |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | `redis`, `6379`, none | Set a password in every shared environment |
| `CACHE_STORE`, `SESSION_DRIVER`, `QUEUE_CONNECTION` | `redis` | |
| `SESSION_DOMAIN` | `localhost` | The SPA's domain |
| `SESSION_SECURE_COOKIE` | `false` | Must be `true` on HTTPS |
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
