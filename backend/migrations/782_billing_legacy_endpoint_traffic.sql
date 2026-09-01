-- Privacy-safe, aggregate-only evidence for the legacy billing retirement gate.
-- Route keys are selected from a static application allowlist. No request path,
-- route parameters, query/body values, account/member/user ids, IP addresses, or
-- user-agent values are persisted.

CREATE TABLE IF NOT EXISTS billing_legacy_endpoint_monitor (
  singleton_id           BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_id),
  monitoring_started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO billing_legacy_endpoint_monitor (singleton_id)
VALUES (TRUE)
ON CONFLICT (singleton_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS billing_legacy_endpoint_traffic (
  route_key      TEXT NOT NULL CHECK (route_key ~ '^[a-z0-9_]{1,100}$'),
  http_method    TEXT NOT NULL CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  observed_on    DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  request_count  BIGINT NOT NULL DEFAULT 1 CHECK (request_count > 0),
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (route_key, http_method, observed_on),
  CHECK (last_seen_at >= first_seen_at)
);

CREATE INDEX IF NOT EXISTS idx_billing_legacy_endpoint_traffic_last_seen
  ON billing_legacy_endpoint_traffic(last_seen_at DESC, route_key, http_method);
