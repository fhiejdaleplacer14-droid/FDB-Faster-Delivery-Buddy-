#!/bin/sh
set -e

# Config is cached at start, not at build, so the image never contains secrets.
php artisan config:cache
php artisan route:cache
php artisan event:cache

exec "$@"
