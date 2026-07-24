#!/usr/bin/env bash
# Register the production Telegram webhook. Requires env vars below.
set -euo pipefail

: "${TELEGRAM_BOT_TOKEN:?Set TELEGRAM_BOT_TOKEN}"
: "${TELEGRAM_WEBHOOK_SECRET:?Set TELEGRAM_WEBHOOK_SECRET}"
: "${PRODUCTION_URL:?Set PRODUCTION_URL (e.g. https://trident-store.vercel.app)}"

BASE="${PRODUCTION_URL%/}"
WEBHOOK_URL="${BASE}/api/telegram/webhook"

echo "Registering webhook: ${WEBHOOK_URL}"

RESPONSE="$(curl -sS -G "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  --data-urlencode "url=${WEBHOOK_URL}" \
  --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}")"

echo "${RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${RESPONSE}"

echo ""
echo "Verifying webhook info:"
curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool 2>/dev/null
