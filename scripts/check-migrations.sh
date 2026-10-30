#!/usr/bin/env bash
# Fails when src/db/schema.ts has changes that no committed migration in drizzle/ covers. drizzle-kit generate
# runs against a scratch copy of drizzle/, so nothing in the repo changes and no database is needed.
set -euo pipefail

cd "$(dirname "$0")/.."
# drizzle-kit only accepts an --out path relative to the working directory.
SCRATCH="$(mktemp -d ./.migrations-check.XXXXXX)"
trap 'rm -rf "$SCRATCH"' EXIT

cp -R drizzle/. "$SCRATCH"
# A rename makes drizzle-kit ask a question it can't get answered here: it crashes, writes nothing and still
# exits 0. So only its own "No schema changes" counts as a pass, never the exit code or an empty diff.
OUTPUT="$(timeout 120 npx drizzle-kit generate --dialect postgresql --schema ./src/db/schema.ts --out "./${SCRATCH#./}" </dev/null 2>&1)" || true

if ! diff -rq drizzle "$SCRATCH" >/dev/null; then
  echo "src/db/schema.ts has changes with no migration in drizzle/. drizzle-kit would write:" >&2
  diff -rq drizzle "$SCRATCH" >&2 || true
  for migration in "$SCRATCH"/*.sql; do
    [ -e "drizzle/${migration##*/}" ] || { cat "$migration"; echo; } >&2
  done
  echo "Run npm run db:generate and commit the new drizzle/ files." >&2
  exit 1
fi
if ! grep -q "No schema changes" <<<"$OUTPUT"; then
  echo "$OUTPUT" >&2
  echo "drizzle-kit could not confirm drizzle/ matches src/db/schema.ts (a rename needs an answer). Run npm run db:generate and commit the migration." >&2
  exit 1
fi
echo "drizzle/ migrations match src/db/schema.ts."
