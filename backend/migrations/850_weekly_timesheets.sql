CREATE TABLE IF NOT EXISTS staff_daily_hours (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id),
  user_id BIGINT NOT NULL REFERENCES app_user(id),
  work_date DATE NOT NULL,
  minutes INTEGER CHECK(minutes BETWEEN 0 AND 1440),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(facility_id,user_id,work_date)
);
CREATE TABLE IF NOT EXISTS staff_time_assignment (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id),
  user_id BIGINT NOT NULL REFERENCES app_user(id),
  assigned_by BIGINT NOT NULL REFERENCES app_user(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL CHECK(ended_at>started_at),
  notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  removed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS staff_time_assignment_week ON staff_time_assignment(facility_id,user_id,started_at) WHERE removed_at IS NULL;
CREATE TABLE IF NOT EXISTS staff_timesheet_change (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id),
  actor_user_id BIGINT NOT NULL REFERENCES app_user(id),
  record_type TEXT NOT NULL CHECK(record_type IN ('daily_hours','assignment')),
  record_id BIGINT NOT NULL,
  before_record JSONB,
  after_record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
