#!/usr/bin/env bash
# Fails when src/db/schema.ts has changes that no committed migration in drizzle/ covers. drizzle-kit generate
# runs against a scratch copy of drizzle/, so nothing in the repo changes and no database is needed.
set -euo pipefail

cd "$(dirname "$0")/.."
# drizzle-kit only accepts an --out path relative to the working directory.
SCRATCH="$(mktemp -d ./.migrations-check.XXXXXX)"
trap 'rm -rf "$SCRATCH"' EXIT

cp -R drizzle/. "$SCRATCH"
# A rename prompt needs a person to answer it, which is itself a missing migration.
if ! timeout 120 npx drizzle-kit generate --dialect postgresql --schema ./src/db/schema.ts --out "./${SCRATCH#./}" </dev/null; then
  echo "drizzle-kit generate failed or asked a question. Run npm run db:generate and commit the migration." >&2
  exit 1
fi

if ! diff -rq drizzle "$SCRATCH" >/dev/null; then
  echo "src/db/schema.ts has changes with no migration in drizzle/. drizzle-kit would write:" >&2
  diff -rq drizzle "$SCRATCH" >&2 || true
  for migration in "$SCRATCH"/*.sql; do
    [ -e "drizzle/${migration##*/}" ] || { cat "$migration"; echo; } >&2
  done
  echo "Run npm run db:generate and commit the new drizzle/ files." >&2
  exit 1
fi
echo "drizzle/ migrations match src/db/schema.ts."
