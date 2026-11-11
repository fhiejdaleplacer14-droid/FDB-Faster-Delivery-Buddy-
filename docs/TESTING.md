# Testing

## Backend

Pest 5 on PHPUnit 13. Tests run against the real PostgreSQL `fdb_testing` database and Redis, not SQLite, so constraints, locking, and decimal handling behave the same as in production.

```sh
docker compose exec app ./vendor/bin/pest
docker compose exec app ./vendor/bin/pest --filter=HealthCheck
```

- `tests/Feature` uses `RefreshDatabase`, so each test runs inside a rolled-back transaction.
- `tests/Unit` is for logic that needs no database.

## Frontend

Vitest with React Testing Library on jsdom.

```sh
cd frontend
npm test            # single run
npm run test:watch
npm run typecheck
npm run lint
npm run build
```

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request:

- **Backend:** `composer install`, `composer audit`, then Pest against PostgreSQL 18 and Redis 8 service containers.
- **Frontend:** `npm ci`, `npm audit --audit-level=high`, type check, lint, tests, and build.
- **Production images:** after both pass, `scripts/smoke-prod.sh` builds the production images, runs them with random secrets, and checks the site, API, security headers, uploads, and that debug mode is off. Nothing is pushed or deployed.

All third-party actions are pinned to exact commits.

## End-to-end tests

Browser tests (Playwright) will be added with the first complete customer-to-seller flow in Phase 4.
