#!/usr/bin/env bash
# Runs the *.db.test.ts files against a throwaway Postgres 17 behind a local Neon HTTP proxy, so the
# production @neondatabase/serverless + drizzle-orm/neon-http code runs unchanged. Postgres is never
# published to the host and the proxy only on a random loopback port, so parallel runs don't collide.
set -euo pipefail

cd "$(dirname "$0")/.."
PREFIX="cmu-shpe-db-test-$$"
NETWORK="$PREFIX-net"
PG="$PREFIX-pg"
PROXY="$PREFIX-proxy"

cleanup() {
  docker rm -f "$PROXY" "$PG" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

psql_in_pg() {
  docker exec -i "$PG" psql -q -v ON_ERROR_STOP=1 -U postgres -d main "$@"
}

docker network create "$NETWORK" >/dev/null
docker run -d --name "$PG" --network "$NETWORK" \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=main \
  postgres:17-alpine >/dev/null

# pg_isready can pass during the init restart, so wait for a real query instead.
for attempt in $(seq 1 60); do
  if psql_in_pg -tAc 'select 1' >/dev/null 2>&1; then break; fi
  if [ "$attempt" -eq 60 ]; then echo "Postgres did not become ready" >&2; exit 1; fi
  sleep 1
done

# The committed migrations are production's schema; pushPreviewSchema then brings it up to schema.ts
# exactly as a preview build does.
for migration in drizzle/[0-9]*.sql; do
  sed 's/--> statement-breakpoint//' "$migration" | psql_in_pg >/dev/null
done
psql_in_pg <scripts/test-db-seed.sql >/dev/null

docker run -d --name "$PROXY" --network "$NETWORK" \
  -e "PG_CONNECTION_STRING=postgres://postgres:postgres@$PG:5432/main" \
  -p 127.0.0.1::4444 ghcr.io/timowilhelm/local-neon-http-proxy:main >/dev/null
PROXY_PORT="$(docker port "$PROXY" 4444/tcp | head -n 1 | sed 's/.*://')"

export DATABASE_URL="postgres://postgres:postgres@db.localtest.me:5432/main"
export TEST_DB_FETCH_ENDPOINT="http://127.0.0.1:$PROXY_PORT/sql"

npx tsx scripts/test-db-prepare.ts
npx vitest run -c vitest.db.config.ts "$@"
