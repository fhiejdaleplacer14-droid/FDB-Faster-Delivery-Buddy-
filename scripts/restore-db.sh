#!/bin/sh
# Replaces the production database with a dump made by backup-db.sh. This destroys current data.
# Usage: sh scripts/restore-db.sh backups/fdb-YYYYMMDDTHHMMSSZ.dump
set -eu

FILE="${1:?Give the dump file to restore}"
COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml --env-file backend/.env.production}"

[ -f "$FILE" ] || { echo "No such file: $FILE" >&2; exit 1; }
$COMPOSE exec -T postgres pg_restore --list < "$FILE" > /dev/null

echo "This replaces ALL current data with $FILE."
printf 'Type RESTORE to continue: '
read -r answer
[ "$answer" = "RESTORE" ] || { echo "Cancelled."; exit 1; }

# Stop writers first so nothing changes mid-restore.
$COMPOSE stop web queue scheduler app
$COMPOSE exec -T postgres sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < "$FILE"
$COMPOSE start app queue scheduler web
echo "Restored $FILE"
