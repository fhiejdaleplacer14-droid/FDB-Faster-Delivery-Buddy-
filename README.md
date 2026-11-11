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

## Troubleshooting

- **Use http://localhost:5173.** The Docker frontend already runs there, so don't also run `npm run dev` on the host. Vite now refuses to start on another port rather than silently moving to 5174.
- **Changes don't show up in the browser.** The Docker frontend polls for file changes, because file-change events do not cross Windows bind mounts. After editing `vite.config.ts`, run `docker compose restart frontend`.
- **`Permission denied` writing `storage/` or `vendor/`.** Rerun `sh scripts/dev-setup.sh`.
- **Slow first request or test.** Windows bind mounts are slow for PHP. This is expected locally.

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
- Phase 3 (marketplace catalog): categories, listings with options, photo processing, search and filters, store pages, listing moderation
- Phase 4 (cart and orders): saved addresses, server-side cart, duplicate-safe checkout split into one order per seller, stock protection, seller order handling, customer cancellation, admin order view

- Phase 5 (commission and financial records): rate history with per-seller overrides, commission copied into each order at checkout, pending → due → collected tracking, adjustments, batch collections, and a financial report that separates GMV from FDB revenue
- Phase 6 (seller and admin tools): seller portal and admin console for orders, listings, commissions, and reports
- Phase 7 (customer trust, part A): in-app notifications with a header bell, verified-buyer reviews with seller replies and moderation, and a help center where customers, sellers, and FDB staff talk in one thread. Disputes are a ticket type with a configurable window.
- Phase 7 (part B, refunds): sellers and FDB admins record refunds on paid orders, optionally linked to a support request. Payment status shows partly refunded or refunded. FDB commission drops in proportion (configurable placeholder); if FDB already collected it, the difference is tracked as a credit owed to the seller until an admin marks it settled. The financial report shows refunds and credits owed
- Phase 8 (hardening, in progress): axios replaced by a small fetch client, rarely used pages load on demand, strict content security policy and security headers, a production guard against debug mode and insecure cookies, clean dependency audits

For a populated local site, run `docker compose exec app php artisan db:seed --class=DemoMarketplaceSeeder`. FDB must not process real transactions until the founders have reviewed the legal and operational launch checklist.
