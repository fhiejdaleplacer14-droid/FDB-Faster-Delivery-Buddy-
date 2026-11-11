# Architecture

## Overview

FDB is a modular monolith: one Laravel API and one React single-page app, backed by PostgreSQL and Redis.

```
Browser ──► Vite dev server (5173) ──/api, /sanctum──► nginx (8000) ──► PHP-FPM (Laravel)
                                                                           │
                                                          PostgreSQL ◄─────┤
                                                          Redis ◄──────────┘ (cache, sessions, queue)
                                                          queue worker, scheduler
```

## Decisions

### Same-origin SPA authentication

The SPA uses Laravel Sanctum's cookie-based session authentication. The browser talks to a single origin: in development the Vite dev server proxies `/api` and `/sanctum` to nginx; in production the same web server should serve the built SPA and route `/api` and `/sanctum` to Laravel.

- No tokens are stored in `localStorage`.
- CSRF protection comes from the `XSRF-TOKEN` cookie, which the fetch client in `frontend/src/lib/http.ts` sends back as `X-XSRF-TOKEN`.
- CORS is restricted to `FRONTEND_URL` as a fallback if the SPA is ever hosted on a separate subdomain.

### API versioning

All endpoints live under `/api/v1`. Errors under `/api/*` are always JSON, in Laravel's standard shape:

```json
{ "message": "The given data was invalid.", "errors": { "email": ["..."] } }
```

Stack traces are only shown when `APP_DEBUG=true`, which must never be set in production.

### PHP 8.5 in Docker

The backend targets PHP 8.5.12. Laravel 13's CI runs on 8.3–8.5, and Sanctum 4.3 and Pest 5 both support 8.5. All backend commands run inside the `fdb-php` image so the host PHP version does not matter.

### Redis client

The app uses `predis/predis` instead of the `phpredis` C extension. PECL no longer serves the extension for this build, and at FDB's expected traffic the difference in speed is not significant. Switching back later is a config change (`REDIS_CLIENT=phpredis`) plus an image change.

### Safety defaults

Set in `AppServiceProvider`:

- Eloquent strict mode outside production: lazy loading (N+1 queries), silently discarded attributes, and missing attributes throw errors.
- Destructive database commands (`migrate:fresh`, `db:wipe`, and similar) are blocked in production.
- Passwords: at least 10 characters, letters and numbers; in production also checked against known breaches.
- API rate limit: 120 requests per minute per user, or per IP address for guests.

### Time

Timestamps are stored in UTC (`app.timezone`). Show them to people in `app.display_timezone` (default `Asia/Manila`).

## Planned module layout

Backend domain code will go under `app/Domain/{Identity,Sellers,Catalog,Orders,Payments,Commissions,Support}` as each phase begins. The frontend groups code by feature under `src/features/`.
