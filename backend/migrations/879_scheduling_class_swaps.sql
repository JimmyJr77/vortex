-- One-time attendance changes preserve the paid enrollment and its billing.
CREATE TABLE IF NOT EXISTS scheduling_class_swap (
  id BIGSERIAL PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES facility(id),
  source_type TEXT NOT NULL CHECK (source_type IN ('scheduling','drop_in')),
  source_id BIGINT NOT NULL,
  source_form_id BIGINT NOT NULL REFERENCES scheduling_form(id),
  source_slot_group_id BIGINT NOT NULL REFERENCES scheduling_slot_group(id),
  source_time_slot_id BIGINT NOT NULL REFERENCES scheduling_time_slot(id),
  source_date DATE NOT NULL,
  target_form_id BIGINT NOT NULL REFERENCES scheduling_form(id),
  target_slot_group_id BIGINT NOT NULL REFERENCES scheduling_slot_group(id),
  target_time_slot_id BIGINT NOT NULL REFERENCES scheduling_time_slot(id),
  target_date DATE NOT NULL,
  athlete JSONB NOT NULL,
  reason TEXT NOT NULL,
  actor_user_id BIGINT NOT NULL REFERENCES app_user(id),
  request_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(facility_id,request_key),
  UNIQUE(source_type,source_id,source_time_slot_id,source_date)
);
CREATE INDEX IF NOT EXISTS idx_class_swap_source_date ON scheduling_class_swap(source_slot_group_id,source_date);
CREATE INDEX IF NOT EXISTS idx_class_swap_target_date ON scheduling_class_swap(target_slot_group_id,target_date);
