-- Monthly marketing inputs only; never modifies billing or enrollment records.
CREATE TABLE IF NOT EXISTS enrollment_marketing_spend (
  facility_id bigint NOT NULL REFERENCES facility(id),
  month date NOT NULL CHECK (EXTRACT(day FROM month)=1),
  amount_cents bigint CHECK (amount_cents >= 0 AND amount_cents <= 100000000000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (facility_id, month)
);
