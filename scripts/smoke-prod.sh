#!/bin/sh
# Builds the production images, starts them as a throwaway stack with random secrets, and checks
# that the SPA, the API, and the security headers work. Removes the stack and its volumes afterwards
# unless KEEP=1. Never touches the dev stack or a real production stack.
# Usage: sh scripts/smoke-prod.sh
set -eu

PORT="${SMOKE_PORT:-8088}"
ENV_FILE="backend/.env.smoke"
COMPOSE="docker compose -p fdb-smoke -f docker-compose.prod.yml --env-file $ENV_FILE"
export FDB_ENV_FILE="$ENV_FILE" FDB_HTTP_PORT="$PORT" FDB_RELEASE=smoke
BASE="http://localhost:$PORT"

random() { head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9'; }

sed -e "s|^APP_KEY=.*|APP_KEY=base64:$(head -c 32 /dev/urandom | base64)|" \
    -e "s|https://CHANGE_ME.example|$BASE|g" \
    -e "s|^SANCTUM_STATEFUL_DOMAINS=.*|SANCTUM_STATEFUL_DOMAINS=localhost:$PORT|" \
    -e "s|^TRUSTED_PROXIES=.*|TRUSTED_PROXIES=127.0.0.1|" \
    -e "s|^DB_PASSWORD=.*|DB_PASSWORD=$(random)|" \
    -e "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$(random)|" \
    -e "s|CHANGE_ME.example|localhost|g" \
    backend/.env.production.example > "$ENV_FILE"

cleanup() {
  if [ "${KEEP:-0}" != "1" ]; then
    $COMPOSE down -v --remove-orphans > /dev/null 2>&1 || true
    rm -f "$ENV_FILE"
  fi
}
trap cleanup EXIT

$COMPOSE up -d --build --wait --wait-timeout 300
$COMPOSE exec -T app php artisan migrate --force
$COMPOSE exec -T app php artisan db:seed --force

failures=0
check() {
  if eval "$2"; then echo "ok   $1"; else echo "FAIL $1"; failures=$((failures + 1)); fi
}
headers() { curl -s -o /dev/null -D - "$BASE$1" | tr -d '\r'; }

check "health endpoint is ok" "curl -sf $BASE/api/v1/health | grep -q '\"status\":\"ok\"'"
check "SPA loads with its CSP meta tag" "curl -sf $BASE/ | grep -q 'http-equiv=\"Content-Security-Policy\"'"
check "deep links fall back to the SPA" "curl -sf $BASE/products/anything | grep -q '<div id=\"root\">'"
check "SPA cannot be framed" "headers / | grep -qi \"^content-security-policy: frame-ancestors 'none'\""
check "HSTS is sent" "headers / | grep -qi '^strict-transport-security: max-age=31536000'"
check "API has a strict CSP" "headers /api/v1/health | grep -qi \"^content-security-policy: default-src 'none'\""
check "API hides PHP" "! headers /api/v1/health | grep -qi '^x-powered-by'"
check "build assets are cached for a year" "headers \$(curl -sf $BASE/ | grep -o '/assets/index-[^\"]*\\.js' | head -1) | grep -qi '^cache-control: public, immutable'"
check "dotfiles are blocked" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' $BASE/.env)\" = 403 ]"
check "debug mode is off" "! curl -s $BASE/api/v1/does-not-exist | grep -qi 'trace'"
check "catalog API answers" "curl -sf $BASE/api/v1/categories > /dev/null"
for dir in storage/app/public storage/app/seller-documents storage/framework/cache storage/logs bootstrap/cache; do
  check "app can write $dir" "$COMPOSE exec -T app sh -c 'touch $dir/.smoke && rm $dir/.smoke' 2> /dev/null"
done
check "uploaded photos are served" "$COMPOSE exec -T app sh -c 'echo smoke > storage/app/public/smoke.txt' && curl -sf $BASE/storage/smoke.txt | grep -q smoke"

[ "$failures" -eq 0 ] && echo "Smoke test passed." || { echo "$failures check(s) failed."; exit 1; }
