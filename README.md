# WhatsApp SaaS Starter (Meta Cloud API)

A minimal Node.js/Express backend for a multi-tenant WhatsApp bulk
messaging SaaS, built directly on Meta's Cloud API (no third-party BSP).

## What's included

- `src/routes/auth.js` + `src/middleware/auth.js` — signup/login issuing
  JWTs, and middleware that protects every tenant-scoped route
- `src/routes/onboarding.js` — backend half of Embedded Signup, so your
  customers can connect their own WhatsApp Business number to your platform
- `src/routes/webhook.js` — receives delivery/read/failed statuses and
  inbound messages (including STOP/opt-out handling)
- `src/routes/campaigns.js` + `src/queue/` — create/list campaigns and
  enqueue a bulk send as one job per recipient (BullMQ/Redis), with a
  separate worker process that respects per-tenant rate limits
- `src/routes/contacts.js` — list/add contacts for the authenticated tenant
- `src/services/metaApi.js` — thin wrapper around the Graph API calls
  you'll use most (send template, send text, create/list templates,
  Embedded Signup token exchange)
- `frontend/` — a React (Vite) dashboard: log in/sign up, connect
  WhatsApp, manage contacts, create and send campaigns. See
  `frontend/README.md`.
- `Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` — containerized
  setup for local dev or a self-hosted deploy (Postgres, Redis, API,
  worker, and the frontend behind nginx)

## What's NOT included (on purpose, for a starter)

- Segment/list targeting, template-variable UI, and CSV import for
  contacts — see "What's simplified" in `frontend/README.md`
- Encryption of `whatsapp_accounts.access_token` at rest (see note below)
- TLS termination / a managed database — see "Deployment" below for what
  you'll still need to add depending on where you host this

## Setup

1. **Meta App**: create one at developers.facebook.com, add the WhatsApp
   product, and set up Embedded Signup (this gives you `META_CONFIG_ID`).
2. **System User token**: in Meta Business Manager, create a System User
   and generate a long-lived token with `whatsapp_business_messaging` and
   `whatsapp_business_management` permissions.
3. **Webhook**: deploy this app somewhere with a public HTTPS URL, then
   register `https://your-domain.com/api/webhook` in the Meta App
   dashboard along with your `META_WEBHOOK_VERIFY_TOKEN`.
4. Copy `.env.example` to `.env` and fill in the values.
5. `npm install`
6. `npm run dev` (API) and, in a separate terminal, `npm run worker`
   (campaign send worker).

## Deployment

### Option A: docker-compose (quickest path to a self-hosted deploy)

```
cp .env.example .env   # fill in real values, including PUBLIC_API_BASE_URL
docker compose up -d --build
```

This brings up Postgres, Redis, the API (port 3000), the campaign worker,
and the frontend behind nginx (port 8080). Migrations run automatically
via the one-shot `migrate` service before the API/worker start.

Things to change before this is production-ready:
- Remove the `postgres` port mapping in `docker-compose.yml` (`5432:5432`)
  unless you specifically need external DB access
- Put a reverse proxy in front of `api` and `frontend` that terminates
  TLS — e.g. **Caddy** (simplest: automatic HTTPS from just a domain
  name) or **nginx + certbot**. The Meta webhook requires HTTPS, so this
  isn't optional.
- Point `APP_BASE_URL` and `PUBLIC_API_BASE_URL` at your real domains,
  and rebuild the frontend image (Vite bakes `VITE_*` vars in at build
  time — changing `.env` alone won't update an already-built image)

### Option B: managed platforms (Railway, Render, Fly.io, etc.)

These containers work as-is on any platform that builds from a
Dockerfile. General shape:
- **Postgres + Redis**: use the platform's managed add-ons rather than
  running your own containers for these — one less thing to operate
- **api**: deploy `Dockerfile` (repo root) as a web service; set env vars
  from `.env.example`; most platforms give you HTTPS automatically,
  which is what you need for the Meta webhook
- **worker**: deploy the *same* `Dockerfile` as a background/worker
  service (no public port), with the command overridden to
  `node src/queue/campaignWorker.js`
- **migrations**: run `node scripts/migrate.js` as a release/deploy hook,
  or manually against the production `DATABASE_URL` after the first deploy
- **frontend**: either deploy `frontend/Dockerfile` as a static/web
  service, or skip Docker for it and use the platform's native static
  site hosting (build command `npm run build`, output dir `dist`) — set
  `VITE_API_BASE_URL` to wherever `api` ends up before building

### Scaling notes

- The worker is stateless and safe to run multiple replicas of — BullMQ
  handles distributing jobs across them
- The API can also run multiple replicas behind a load balancer; nothing
  in it holds in-memory state
- Postgres and Redis are the only stateful pieces — use managed services
  for these once you're past local dev

## Auth

`POST /api/auth/signup` — `{ tenantName, email, password }` creates a new
tenant plus its first (owner) user, and returns a JWT.

`POST /api/auth/login` — `{ email, password }` returns a JWT for an
existing user.

Every other route (`/api/embedded-signup/callback`, `/api/campaigns/send`)
requires `Authorization: Bearer <token>` and is protected by
`src/middleware/auth.js`. Handlers read `req.user.tenantId` from the
verified token rather than trusting a `tenantId` in the request body —
this is what stops one tenant from acting on another tenant's data.
Webhooks are intentionally left unauthenticated in the usual sense since
Meta calls them directly; they're protected instead by the
`X-Hub-Signature-256` check already in `webhook.js`.

Set a real `JWT_SECRET` in `.env` before deploying (`openssl rand -hex 32`
works well) — the app just warns and keeps running with an insecure
default if you forget, so don't skip this in production.

## Database

The schema is in `migrations/001_init.sql` (tenants, whatsapp_accounts,
contacts, contact_lists, message_templates, campaigns, campaign_sends).

Apply it with:

```
createdb whatsapp_saas   # or your provider's equivalent
npm run migrate
```

`scripts/migrate.js` is a minimal runner — it applies any new `.sql` file
in `/migrations` in order and tracks what's been applied in a
`schema_migrations` table. Good enough to start; swap for
`node-pg-migrate` or `knex` once you need rollbacks or more complex
schema changes.

`src/db/queries.js` has the repository functions the routes and worker
now use (previously these were TODO comments):
- `onboarding.js` persists the connected WABA/phone number on signup
- `webhook.js` persists delivery/read/failed statuses and opt-outs
- `campaigns.js` upserts contacts and creates a `campaign_sends` row per
  recipient before enqueueing — and now skips anyone already opted out
- `campaignWorker.js` marks each `campaign_sends` row sent/failed

**Security note:** `whatsapp_accounts.access_token` is stored as plain
text in this starter. Encrypt it at the application layer before writing
in production — see the note in the migration file.

## Important compliance notes

- You cannot send free-form promotional text to someone who hasn't
  messaged you in the last 24 hours — it must be an **approved template**.
- Every contact needs a recorded opt-in; handle STOP/unsubscribe keywords
  (already stubbed in `webhook.js`).
- Meta scales each phone number's messaging limit based on quality rating
  and complaint rate — a naive "blast everyone at once" approach will get
  a tenant's number throttled or banned. The queue's rate limiter is a
  starting point, not a guarantee — tune it per tenant.
