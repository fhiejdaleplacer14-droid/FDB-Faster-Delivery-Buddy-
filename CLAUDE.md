# FDB working notes

- The host PHP is 8.2; the project targets 8.5. Run every PHP, artisan, composer, and pest command inside Docker:
  - `docker compose exec app php artisan ...`
  - `docker compose exec app ./vendor/bin/pest`
  - `docker compose run --rm --user root app composer ...`, then rerun `sh scripts/dev-setup.sh` if `vendor/pestphp` permissions break
- Frontend checks: `cd frontend && npm run typecheck && npm run lint && npm test && npm run build`
- Keep code comments short. No large comment blocks.
- Money uses DECIMAL columns and string or integer-centavo arithmetic, never floats.
- Never trust client-sent prices, totals, roles, or seller IDs.
