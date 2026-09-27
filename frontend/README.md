# Dashboard frontend

A small React (Vite) dashboard: log in/sign up, connect a WhatsApp number,
manage contacts, and create/send campaigns against the backend in `../src`.

## Setup

```
cd frontend
npm install
cp .env.example .env   # fill in VITE_META_APP_ID / VITE_META_CONFIG_ID
npm run dev
```

Runs at `http://localhost:5173` by default, talking to the backend at
`VITE_API_BASE_URL` (defaults to `http://localhost:3000`).

## Pages

- **Login / Signup** — `src/pages/Login.jsx`, `Signup.jsx`. Signup creates
  a new tenant plus its first (owner) user in one call.
- **Dashboard** — shows whether a WhatsApp number is connected; if not,
  renders the Embedded Signup button.
- **Contacts** — list + a simple add-one-contact form. Opted-out contacts
  are visibly flagged and excluded when a campaign is sent.
- **Campaigns** — create a draft campaign (name + approved template name),
  then "Send to all contacts" sends it to every currently opted-in contact.

## What's simplified (on purpose, for a starter)

- **Recipients**: "Send to all contacts" sends to your entire opted-in
  list rather than letting you pick a saved segment/list — add
  `contact_lists` filtering in `Campaigns.jsx` and the `/api/campaigns/:id/send`
  route once you need audience targeting.
- **Template variables**: campaigns don't yet have a UI for filling in a
  template's `{{1}}`, `{{2}}`... placeholders per recipient
  (`templateComponents` in the API) — the send call currently sends the
  template with no variable substitution.
- **CSV import**: contacts are added one at a time; bulk import would post
  to `/api/contacts` in a loop (or you can add a dedicated bulk endpoint).
- **No template management UI**: template names are typed in free-text and
  must already be approved in your Meta Business account — there's no
  screen here for submitting new templates for approval
  (`createMessageTemplate` in `src/services/metaApi.js` already supports it
  on the backend if you want to build one).

## Embedded Signup component

`src/components/WhatsAppEmbeddedSignup.jsx` is used directly by
`Dashboard.jsx`. See the comments in that file, or the notes below, for
how the connect flow works end to end.

### Usage (standalone)

```jsx
import WhatsAppEmbeddedSignup from './components/WhatsAppEmbeddedSignup';

<WhatsAppEmbeddedSignup
  appId="YOUR_META_APP_ID"
  configId="YOUR_META_CONFIG_ID"
  authToken={authToken} // from your login/signup response
  apiBaseUrl="https://api.yourapp.com"
  onConnected={(result) => console.log('Connected!', result)}
  onError={(err) => console.error(err)}
/>
```

### Before this works

1. **App must be in Live mode** (or the tenant added as a test user) in
   the Meta App dashboard — Embedded Signup doesn't work in Development
   mode for arbitrary users.
2. **Meta App Review**: onboarding real customers needs
   `whatsapp_business_management` and `whatsapp_business_messaging`
   permissions approved via App Review — this can take days to weeks,
   start early.
3. **HTTPS required**, including in local development (use `ngrok` or
   `mkcert` if testing locally).
4. **Domain allowlist**: add your app's domain under
   Meta App > Settings > Basic > App Domains, and under
   Facebook Login > Settings > Valid OAuth Redirect URIs.
