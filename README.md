# Faster Delivery Buddy (FDB)

*Your Favorite Finds, Closer Than Ever.*

A local marketplace connecting customers with independent sellers in Vallehermoso, Guihulngan, and San Carlos City, Negros Oriental. FDB coordinates discovery, ordering, and commission records; sellers own their stock, set prices, collect payment, and deliver.

## Stack

| Layer | Technology |
| --- | --- |
| Backend | PHP 8.5, Laravel 13, Sanctum (cookie SPA auth), Pest |
| Frontend | React 19, TypeScript 6 (strict), Vite 8, Tailwind CSS 4, React Router 8 |
| Data | PostgreSQL 18, Redis 8 (cache, sessions, queues) |
| Local runtime | Docker Compose |

## Requirements

- Docker Desktop (or Docker Engine with Compose v2)
- Node 24 for running frontend tools outside Docker (optional)

PHP does not need to be installed on your machine. All backend commands run in the `app` container.

## First-time setup

```sh
sh scripts/dev-setup.sh
docker compose up -d
```

| URL | What |
| --- | --- |
| http://localhost:5173 | Web app (Vite dev server; proxies `/api` and `/sanctum` to the API) |
| http://localhost:8000/api/v1/health | API health check |

## Everyday commands

```sh
docker compose up -d                                   # start everything
docker compose down                                    # stop (data is kept in volumes)
docker compose logs -f app queue                       # follow backend logs

docker compose exec app php artisan migrate            # run migrations
docker compose exec app ./vendor/bin/pest              # backend tests
docker compose exec app php artisan fdb:create-admin   # create an administrator (interactive)
docker compose run --rm --user root app composer require vendor/package

cd frontend
npm run typecheck && npm run lint && npm test && npm run build
```

## Repository layout

```
backend/     Laravel API
frontend/    React SPA (customer, seller, and admin interfaces)
docker/      Images and service config
docs/        Architecture, environment, testing, and brand references
scripts/     Developer setup scripts
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Database](docs/DATABASE.md)
- [Security](docs/SECURITY.md)
- [Environment variables](docs/ENVIRONMENT.md)
- [Testing](docs/TESTING.md)

## Status

- Phase 1 (engineering foundation): done
- Phase 2 (identity and access): accounts, email verification, password reset, roles and permissions, seller applications, admin review, audit log

No marketplace listings or orders exist yet. FDB must not process real transactions until the founders have reviewed the legal and operational launch checklist.
