-- Simple staff record keeping, independent of payroll and employee onboarding.
CREATE TABLE IF NOT EXISTS staff_time_entry (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id),
  user_id BIGINT NOT NULL REFERENCES app_user(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 1439),
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deleted_at TIMESTAMPTZ,
  CHECK (ended_at IS NULL OR ended_at > started_at),
  CHECK (ended_at IS NULL OR EXTRACT(EPOCH FROM ended_at-started_at)/60 > break_minutes)
);
CREATE INDEX IF NOT EXISTS staff_time_entry_history ON staff_time_entry(facility_id,user_id,started_at DESC,id DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_time_entry_running ON staff_time_entry(facility_id,user_id) WHERE ended_at IS NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS staff_time_entry_change (
  id BIGSERIAL PRIMARY KEY,
  entry_id BIGINT NOT NULL REFERENCES staff_time_entry(id),
  actor_user_id BIGINT NOT NULL REFERENCES app_user(id),
  action TEXT NOT NULL CHECK (action IN ('create','clock_in','clock_out','edit','remove')),
  before_record JSONB,
  after_record JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS staff_time_entry_change_entry ON staff_time_entry_change(entry_id,id);

INSERT INTO permission(key,description) VALUES ('timesheets.view_all','View everyone’s time logs in the facility.') ON CONFLICT(key) DO NOTHING;
INSERT INTO role_permission(role_id,permission_id)
  SELECT r.id,p.id FROM role r CROSS JOIN permission p
  WHERE r.key IN ('ADMIN','MASTER_ADMIN') AND p.key='timesheets.view_all'
  ON CONFLICT DO NOTHING;
