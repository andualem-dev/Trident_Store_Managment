#!/usr/bin/env bash
# Apply Prisma migrations to the database in DATABASE_URL.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to your production Postgres connection string}"

echo "Running prisma migrate deploy..."
npx prisma migrate deploy

echo "Done."
