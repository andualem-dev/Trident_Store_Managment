#!/usr/bin/env bash
# Smoke-test cron report routes on production (or preview).
set -euo pipefail

: "${CRON_SECRET:?Set CRON_SECRET}"
: "${PRODUCTION_URL:?Set PRODUCTION_URL (e.g. https://trident-store.vercel.app)}"

BASE="${PRODUCTION_URL%/}"
AUTH="Authorization: Bearer ${CRON_SECRET}"

echo "=== Daily report ==="
curl -sS -H "${AUTH}" "${BASE}/api/reports/daily" | python3 -m json.tool 2>/dev/null || true

echo ""
echo "=== Overdue check ==="
curl -sS -H "${AUTH}" "${BASE}/api/reports/overdue-check" | python3 -m json.tool 2>/dev/null || true
