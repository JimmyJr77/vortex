-- Migration 044: email deliverability — suppression list + delivery log
-- Provider-agnostic. Populated by send failures we observe synchronously and by
-- staff action today; by ESP webhooks once a webhook-capable provider is configured.

CREATE TABLE IF NOT EXISTS email_suppression (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL,
  -- scope: 'global' blocks all mail to the address; 'marketing' blocks only the
  -- marketing stream (a marketing unsubscribe must not stop account-security mail).
  scope         TEXT NOT NULL DEFAULT 'global',
  -- reason: 'hard_bounce' | 'complaint' | 'manual' | 'unsubscribe' | 'invalid'
  reason        TEXT NOT NULL,
  source        TEXT,                       -- 'smtp' | 'webhook' | 'staff' | 'system'
  detail        TEXT,                       -- short, non-sensitive note
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at   TIMESTAMPTZ,                -- set when a genuinely-mistyped address is cleared
  released_by   TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_email_suppression_active
  ON email_suppression (LOWER(email), scope)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_email_suppression_email
  ON email_suppression (LOWER(email));

COMMENT ON TABLE email_suppression IS
  'Addresses that must not receive mail (hard bounce / complaint / manual). scope distinguishes global vs marketing-only.';


CREATE TABLE IF NOT EXISTS email_delivery (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT,
  -- reference the related entity rather than duplicating PII where possible
  member_id           BIGINT,
  invitation_id       BIGINT,
  category            TEXT NOT NULL,
  stream              TEXT NOT NULL,        -- 'transactional' | 'marketing'
  template_version    TEXT,
  provider            TEXT,                 -- 'smtp:gmail' | 'postmark' | ...
  provider_message_id TEXT,
  recipient_domain    TEXT,                 -- e.g. 'gmail.com' (mailbox-domain analytics)
  recipient_hash      TEXT,                 -- sha256 of normalized address (no plaintext PII)
  -- status: queued | sent | accepted | deferred | bounced | complaint | suppressed | failed
  status              TEXT NOT NULL DEFAULT 'queued',
  attempt_count       INT NOT NULL DEFAULT 0,
  smtp_code           TEXT,
  provider_reason     TEXT,                 -- redacted, short
  idempotency_key     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at         TIMESTAMPTZ,
  bounced_at          TIMESTAMPTZ,
  complained_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_created
  ON email_delivery (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_delivery_category
  ON email_delivery (category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_delivery_recipient_domain
  ON email_delivery (recipient_domain, created_at DESC);

-- Idempotency: at most one delivery row per idempotency key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_delivery_idempotency
  ON email_delivery (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE email_delivery IS
  'One row per outbound message for staff delivery visibility and reputation monitoring. Stores recipient domain + hash, not full address, and never stores raw tokens or message bodies.';
