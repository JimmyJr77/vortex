-- Historical source records never participate in collection or scheduling.
CREATE TABLE IF NOT EXISTS jackrabbit_history_record (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id),
  organization_id TEXT NOT NULL,
  record_kind TEXT NOT NULL CHECK(record_kind IN ('family','person','transaction','enrollment','lead','note','attendance')),
  source_id TEXT NOT NULL,
  source_family_id TEXT,
  family_id BIGINT REFERENCES family(id),
  member_id BIGINT REFERENCES member(id),
  occurred_on DATE,
  amount_cents BIGINT,
  source_data JSONB NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id,organization_id,record_kind,source_id)
);
CREATE INDEX IF NOT EXISTS jackrabbit_history_family ON jackrabbit_history_record(facility_id,family_id,occurred_on DESC,id DESC);
CREATE INDEX IF NOT EXISTS jackrabbit_history_member ON jackrabbit_history_record(facility_id,member_id,occurred_on DESC,id DESC);
