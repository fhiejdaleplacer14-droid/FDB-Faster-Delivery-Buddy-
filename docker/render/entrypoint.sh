#!/bin/sh
set -e

# nginx needs the port Render assigned; only ${PORT} is substituted so nginx's own $variables survive.
envsubst '${PORT}' < /etc/nginx/fdb.conf.template > /tmp/nginx.conf

# Config is cached at start, not at build, so the image never contains secrets.
php artisan config:cache
php artisan route:cache
php artisan event:cache

# Opt-in only: Render runs this on every start, and migrations should be a deliberate step.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  php artisan migrate --force
fi

exec "$@"
