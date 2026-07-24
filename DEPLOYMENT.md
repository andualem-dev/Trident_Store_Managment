# Trident Store — Deployment

Production deployment checklist for Phase 11.

## Deployment target

Choose one:

- **Vercel** — serverless Next.js; cron jobs via `vercel.json`; **customer photo uploads must use external object storage** (local disk is not persistent).
- **VPS** — persistent disk; current local `uploads/` directory works as-is.

See [Customer photo uploads](#customer-photo-uploads) below.

---

## Required environment variables

Set these in the Vercel project (or on your VPS). Copy `.env.example` as a template.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for production |
| `SESSION_SECRET` | iron-session cookie encryption (minimum 32 characters) |
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_ADMIN_CHAT_ID` | Chat ID allowed to receive reports and run bot commands |
| `TELEGRAM_WEBHOOK_SECRET` | Random string passed to Telegram `setWebhook` as `secret_token` |
| `CRON_SECRET` | Bearer token for scheduled report routes (see [Cron jobs](#cron-jobs)) |
| `R2_ACCOUNT_ID` | Cloudflare account ID (R2 S3 endpoint) |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET_NAME` | R2 bucket for customer ID/profile photos |

When all `R2_*` variables are set, photos upload to R2. If they are omitted (local dev), files are stored under `./uploads/` instead.

Optional for local development only: none of the above should be committed. `.env` is gitignored.

---

## Production database migration

Use **`prisma migrate deploy`**, not `migrate dev`, against production.

`migrate dev` is for local development (creates migrations, may reset data).  
`migrate deploy` applies existing migrations from `prisma/migrations/` without prompts.

### One-time (recommended before first deploy)

With production `DATABASE_URL` set:

```bash
npm run db:migrate:deploy
```

Or:

```bash
npx prisma migrate deploy
```

### On Vercel

The build runs `prisma generate` (via `postinstall` and `build`). **Migration is not run automatically** — run `db:migrate:deploy` manually once when provisioning the database, then again after each release that adds new migrations.

Optional: add `prisma migrate deploy &&` to the Vercel **Build Command** if you want migrations on every deploy (only when you trust zero-downtime migrations).

---

## Seed admin / operators (fresh database)

After migrations, seed default operators and settings:

```bash
npm run db:seed
```

This creates:

| Code | Default password | Role |
| --- | --- | --- |
| `ADMIN` | `admin123` | Admin |
| `OP1` | `op1pass` | Operator |
| `OP2` | `op2pass` | Operator |

Also sets grace period to 20 minutes.

**Change these passwords immediately in production** (update hashes in the database or re-seed only on a fresh DB before go-live).

Re-seeding on a database that already has data **deletes all operators** (`deleteMany`) and recreates the three defaults — use only on a fresh install or when intentionally resetting access.

---

## Cron jobs

`vercel.json` defines:

| Path | Schedule (UTC) | Purpose |
| --- | --- | --- |
| `/api/reports/daily` | `0 21 * * *` (21:00 daily) | End-of-day Telegram summary |

**Vercel Hobby plan:** only one cron job per project (daily). The hourly overdue route is **not** in `vercel.json` on Hobby — use an external scheduler (e.g. [cron-job.org](https://cron-job.org)) to `GET https://YOUR_DOMAIN/api/reports/overdue-check` every hour with header `Authorization: Bearer CRON_SECRET`. On **Vercel Pro**, you can add the hourly entry back to `vercel.json`:

```json
{
  "path": "/api/reports/overdue-check",
  "schedule": "0 * * * *"
}
```

Both routes require:

```http
Authorization: Bearer <CRON_SECRET>
```

Set `CRON_SECRET` in Vercel environment variables. Vercel Cron sends this header automatically when the variable is present.

To test manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR_DOMAIN/api/reports/daily"
```

Cron schedules use **UTC**. Adjust the daily time in `vercel.json` if you need a different local timezone.

---

## Telegram webhook (production)

After deploy, register the webhook so on-demand commands (`/report`, `/overdue`, `/top`, `/help`) work.

Replace placeholders with your values:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://YOUR_DOMAIN/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Requirements:

- Production URL must be HTTPS.
- `TELEGRAM_WEBHOOK_SECRET` in env must match `secret_token` above.
- Incoming messages are only handled when `message.chat.id` matches `TELEGRAM_ADMIN_CHAT_ID`.

Verify:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

---

## Customer photo uploads

Photos are stored as object keys like `customers/{customerId}/id-card-{hash}.jpg` in the database. They are served through `/api/uploads/...` (session-protected).

| Environment | Storage |
| --- | --- |
| **Vercel (production)** | Cloudflare R2 — set all `R2_*` env vars |
| **Local dev** | `./uploads/` on disk when `R2_*` is not set |

### Cloudflare R2 setup (Vercel)

1. In Cloudflare dashboard: **R2 → Create bucket** (e.g. `trident-store-uploads`).
2. **Manage R2 API tokens → Create API token** with Object Read & Write on that bucket.
3. Set in Vercel:
   - `R2_ACCOUNT_ID` — from Cloudflare dashboard URL / overview
   - `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — from the token
   - `R2_BUCKET_NAME` — bucket name
4. No public bucket URL is required; the app reads objects server-side via the S3 API.

Existing local files in `./uploads/` are **not** migrated automatically. Re-upload customer photos or copy objects into the bucket with the same key paths if migrating from a local install.

---

## Production build check

Before deploying:

```bash
npm run build
```

Fix any TypeScript or build errors locally first. The build runs `prisma generate` then `next build`.

---

## Vercel deploy (summary)

1. Create a managed PostgreSQL database (Vercel Postgres, Neon, Supabase, etc.) and set `DATABASE_URL`.
2. Set all env vars from the table above.
3. Run `npm run db:migrate:deploy` against production.
4. Run `npm run db:seed` on a fresh DB if needed; change default passwords.
5. Deploy the repo to Vercel.
6. Register the Telegram webhook (see above).
7. Confirm cron jobs appear under **Settings → Cron Jobs** on Vercel.

---

## Step-by-step first deploy (Vercel + Neon + R2)

Follow these in order. Total time: roughly 30–45 minutes.

### Step A — Push code to GitHub

Your repo remote is `https://github.com/andualem-dev/Trident_Store_Managment.git`.

Commit and push all app code (never commit `.env`):

```bash
git add .
git commit -m "Prepare Trident Store for production deploy"
git push origin main
```

### Step B — Production PostgreSQL (Neon recommended)

1. Open [https://neon.tech](https://neon.tech) and create a project (e.g. `trident-store`).
2. Copy the **pooled** connection string (`postgresql://...?sslmode=require`).
3. Keep this as your production `DATABASE_URL` — you will paste it into Vercel and use it locally for migration.

Apply migrations **before** the first Vercel deploy:

```bash
export DATABASE_URL="postgresql://..."
npm run deploy:migrate
```

Seed a fresh database (optional, first time only):

```bash
npm run db:seed
```

Sign in with `ADMIN` / `admin123` once live, then change that password.

### Step C — Cloudflare R2 (customer photos)

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2 Object Storage**.
2. **Create bucket** → name it e.g. `trident-store-uploads` → Create.
3. Open **Manage R2 API Tokens** → **Create API token**:
   - Permission: **Object Read & Write**
   - Scope: this bucket only
   - Create token → copy **Access Key ID** and **Secret Access Key** (shown once).
4. Find your **Account ID** (R2 overview page or URL: `dash.cloudflare.com/<account-id>/r2`).

Save these four values for Vercel:

| Vercel env var | Value |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | From API token |
| `R2_SECRET_ACCESS_KEY` | From API token |
| `R2_BUCKET_NAME` | e.g. `trident-store-uploads` |

No public bucket domain is needed — the app reads files server-side.

### Step D — Generate secrets

Run locally and save the output for Vercel env vars:

```bash
openssl rand -hex 32    # SESSION_SECRET (32+ chars)
openssl rand -hex 32    # TELEGRAM_WEBHOOK_SECRET
openssl rand -hex 32    # CRON_SECRET
```

Reuse your existing `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_CHAT_ID` from local `.env` (or create a new bot via [@BotFather](https://t.me/BotFather)).

### Step E — Create the Vercel project

1. Open [https://vercel.com/new](https://vercel.com/new).
2. **Import** `andualem-dev/Trident_Store_Managment` from GitHub.
3. Framework preset: **Next.js** (auto-detected).
4. Before deploying, open **Environment Variables** and add **Production**:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Neon connection string |
| `SESSION_SECRET` | from Step D |
| `TELEGRAM_BOT_TOKEN` | from BotFather |
| `TELEGRAM_ADMIN_CHAT_ID` | your chat ID |
| `TELEGRAM_WEBHOOK_SECRET` | from Step D |
| `CRON_SECRET` | from Step D |
| `R2_ACCOUNT_ID` | from Step C |
| `R2_ACCESS_KEY_ID` | from Step C |
| `R2_SECRET_ACCESS_KEY` | from Step C |
| `R2_BUCKET_NAME` | from Step C |

5. Click **Deploy** and wait for the build to finish.
6. Note your production URL (e.g. `https://trident-store-managment.vercel.app`).

Cron jobs from `vercel.json` appear automatically on Pro; on Hobby, verify cron support for your plan under **Settings → Cron Jobs**.

### Step F — Register Telegram webhook

Set your live URL and run (uses env vars, does not print secrets):

```bash
export PRODUCTION_URL="https://YOUR-APP.vercel.app"
export TELEGRAM_BOT_TOKEN="..."
export TELEGRAM_WEBHOOK_SECRET="..."
npm run deploy:webhook
```

You should see `"ok": true`. Test in Telegram: send `/help` to your bot from the admin chat.

### Step G — Smoke-test cron routes

```bash
export PRODUCTION_URL="https://YOUR-APP.vercel.app"
export CRON_SECRET="..."
npm run deploy:test-cron
```

Expect JSON with `"ok": true`. A Telegram message may arrive if there is report data.

### Step H — Verify the app

1. Open `https://YOUR-APP.vercel.app/login` → sign in as `ADMIN` / `admin123`.
2. Create a test customer with a photo → confirms R2 upload works.
3. Run a test rental flow.
4. Check Vercel **Logs** if anything fails.

### Troubleshooting

| Problem | Fix |
| --- | --- |
| Build fails on Prisma | Ensure `DATABASE_URL` is set in Vercel; build only needs `prisma generate`. |
| Login works locally but not prod | `SESSION_SECRET` must be set in Vercel; redeploy after adding env vars. |
| Photos fail on customer create | All four `R2_*` vars must be set; check Vercel function logs for S3 errors. |
| Telegram commands ignored | Webhook `secret_token` must match `TELEGRAM_WEBHOOK_SECRET`; chat ID must match `TELEGRAM_ADMIN_CHAT_ID`. |
| Cron 401 | `CRON_SECRET` in Vercel must match; header is `Authorization: Bearer <secret>`. |
| Daily report wrong time | Cron uses UTC; `0 21 * * *` = 21:00 UTC (midnight EAT). Edit `vercel.json` if needed. |

### Daily report timezone note

You are on UTC+3 (East Africa Time). The current schedule `0 21 * * *` UTC = **midnight EAT**. To send at 21:00 EAT instead, change `vercel.json` to `0 18 * * *` (18:00 UTC).
