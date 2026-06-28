-- Bridge scheduling signups into the family billing ledger.
-- A partial unique index lets us upsert one billing_charge per signup
-- idempotently (source_id is NULL for legacy/manual charges, which stay distinct).

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_charge_source
  ON billing_charge (source_type, source_id)
  WHERE source_id IS NOT NULL;
