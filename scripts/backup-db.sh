#!/bin/sh
# Dumps the production database to backups/ and keeps the newest $KEEP dumps.
# Usage: sh scripts/backup-db.sh   (run from the repository root on the server, e.g. daily from cron)
set -eu

COMPOSE="${COMPOSE:-docker compose -f docker-compose.prod.yml --env-file backend/.env.production}"
KEEP="${KEEP:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p backups
FILE="backups/fdb-${STAMP}.dump"

# Custom format is compressed and restores selectively with pg_restore.
$COMPOSE exec -T postgres sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$FILE.partial"
mv "$FILE.partial" "$FILE"
chmod 600 "$FILE"

# Refuse to keep an empty or unreadable dump.
$COMPOSE exec -T postgres pg_restore --list < "$FILE" > /dev/null

ls -1t backups/fdb-*.dump | tail -n +"$((KEEP + 1))" | xargs -r rm --
echo "Saved $FILE"
