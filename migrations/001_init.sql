-- 001_init.sql
-- Core schema for the multi-tenant WhatsApp SaaS starter.
-- Run via `npm run migrate` (see scripts/migrate.js).

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

CREATE TABLE tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'trial',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per WhatsApp number a tenant has connected via Embedded Signup.
-- A tenant could in principle connect more than one number.
CREATE TABLE whatsapp_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  waba_id           TEXT NOT NULL,
  phone_number_id   TEXT NOT NULL,
  display_phone     TEXT,
  access_token      TEXT NOT NULL, -- consider encrypting at rest (see note below)
  status            TEXT NOT NULL DEFAULT 'connected', -- connected | disconnected | error
  connected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone_number_id)
);

CREATE TABLE contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL, -- E.164 format, e.g. +15551234567
  name          TEXT,
  opted_in_at   TIMESTAMPTZ,
  opted_out_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, phone)
);

-- Fast lookup when a STOP webhook arrives and you need to opt out a
-- contact by phone number without knowing which tenant list they're in.
CREATE INDEX idx_contacts_phone ON contacts (phone);

CREATE TABLE contact_lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contact_list_members (
  list_id     UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, contact_id)
);

CREATE TABLE message_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meta_name     TEXT NOT NULL, -- name as registered with Meta
  category      TEXT NOT NULL, -- MARKETING | UTILITY | AUTHENTICATION
  language      TEXT NOT NULL DEFAULT 'en_US',
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  body_preview  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, meta_name, language)
);

CREATE TABLE campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id   UUID REFERENCES message_templates(id),
  list_id       UUID REFERENCES contact_lists(id),
  name          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft', -- draft | queued | sending | completed | failed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE TABLE campaign_sends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id    UUID NOT NULL REFERENCES contacts(id),
  message_id    TEXT, -- WhatsApp message ID once sent
  status        TEXT NOT NULL DEFAULT 'queued', -- queued | sent | delivered | read | failed
  error         TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_sends_campaign ON campaign_sends (campaign_id);
-- Fast lookup when a status webhook arrives keyed by WhatsApp message_id.
CREATE INDEX idx_campaign_sends_message_id ON campaign_sends (message_id);

-- NOTE ON access_token STORAGE:
-- whatsapp_accounts.access_token is stored as plain TEXT here for
-- simplicity. In production, encrypt it at the application layer
-- (e.g. AES-256-GCM with a key from a secrets manager) before writing,
-- and decrypt only when making a Graph API call.
