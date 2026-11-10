#!/usr/bin/env sh
# One-time local setup. Safe to re-run.
set -eu

cd "$(dirname "$0")/.."

[ -f backend/.env ] || cp backend/.env.example backend/.env

docker compose build app
docker compose up -d postgres redis

# Composer runs as root so it can write vendor/ on any host filesystem; the app itself runs as www-data.
docker compose run --rm --no-deps --user root app sh -c '
  composer install --no-interaction --no-progress &&
  chmod -R a+rwX storage bootstrap/cache vendor/pestphp /tmp/composer-cache &&
  chmod a+rw .env
'

docker compose run --rm --no-deps app sh -c '
  grep -q "^APP_KEY=base64:" .env || php artisan key:generate --no-interaction
  php artisan migrate --no-interaction
  php artisan db:seed --no-interaction
'

echo "Setup complete. Start everything with: docker compose up -d"
