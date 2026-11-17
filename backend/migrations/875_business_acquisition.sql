-- A source snapshot belongs to one existing inquiry, booking, order, or checkout.
CREATE TABLE IF NOT EXISTS business_acquisition (
  record_kind TEXT NOT NULL CHECK (record_kind IN ('inquiry', 'drop_in', 'store_order', 'enrollment_checkout')),
  record_id BIGINT NOT NULL CHECK (record_id > 0),
  source VARCHAR(100),
  medium VARCHAR(100),
  campaign VARCHAR(100),
  referrer_host VARCHAR(255),
  landing_path TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (record_kind, record_id),
  CHECK (COALESCE(source, medium, campaign, referrer_host, landing_path) IS NOT NULL)
);
