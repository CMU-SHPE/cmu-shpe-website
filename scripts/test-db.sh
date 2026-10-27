#!/usr/bin/env bash
# Runs the *.pg.test files against a throwaway Postgres 17 behind a local Neon HTTP proxy, so
# queries go through the real @neondatabase/serverless driver. Postgres is reachable only from the
# proxy, the proxy only on 127.0.0.1, and both are removed afterwards. Never point this at a real database.
set -euo pipefail

cd "$(dirname "$0")/.."
PREFIX="cmu-shpe-test-db-$$"
NETWORK="$PREFIX-net"
PROXY_IMAGE="ghcr.io/timowilhelm/local-neon-http-proxy:main"

cleanup() {
  docker rm -f "$PREFIX-proxy" "$PREFIX-pg" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$NETWORK" >/dev/null
docker run -d --name "$PREFIX-pg" --network "$NETWORK" \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=main \
  postgres:17 >/dev/null
until docker exec "$PREFIX-pg" pg_isready -U postgres -d main -q; do sleep 1; done
# pg_isready can pass during the init restart; wait for a real query to succeed.
until docker exec "$PREFIX-pg" psql -U postgres -d main -qtAc 'select 1' >/dev/null 2>&1; do sleep 1; done

for migration in drizzle/0*.sql; do
  sed 's/--> statement-breakpoint//' "$migration" |
    docker exec -i "$PREFIX-pg" psql -q -v ON_ERROR_STOP=1 -U postgres -d main >/dev/null
done

docker run -d --name "$PREFIX-proxy" --network "$NETWORK" \
  -e "PG_CONNECTION_STRING=postgres://postgres:postgres@$PREFIX-pg:5432/main" \
  -p 127.0.0.1::4444 "$PROXY_IMAGE" >/dev/null
# Docker picks a free host port, so overlapping runs don't collide.
PROXY_PORT=$(docker port "$PREFIX-proxy" 4444/tcp | head -n 1 | sed 's/.*://')

export TEST_DATABASE_URL="postgres://postgres:postgres@db.localtest.me:5432/main"
export TEST_NEON_FETCH_ENDPOINT="http://127.0.0.1:$PROXY_PORT/sql"
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "http://127.0.0.1:$PROXY_PORT/sql"; then break; fi
  sleep 1
done
sleep 2

npx vitest run -c vitest.db.config.ts "$@"
