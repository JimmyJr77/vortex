-- ============================================================
-- Flip & Fit: facility-scoped schedule configuration
--
-- Stores the deterministic calendar anchor and coach-authored state without
-- coupling it to training_program rows that are currently replaced wholesale.
-- One stable row exists per facility.
--
-- IDEMPOTENT.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.flip_fit_schedule (
  facility_id             BIGINT PRIMARY KEY REFERENCES public.facility(id) ON DELETE CASCADE,
  start_date              DATE NOT NULL,
  end_date                DATE NOT NULL,
  settings_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_overrides_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by              BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  updated_by              BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT flip_fit_schedule_start_monday_chk
    CHECK (EXTRACT(ISODOW FROM start_date) = 1),
  CONSTRAINT flip_fit_schedule_end_date_chk
    CHECK (end_date = start_date + 81),
  CONSTRAINT flip_fit_schedule_settings_object_chk
    CHECK (jsonb_typeof(settings_json) = 'object'),
  CONSTRAINT flip_fit_schedule_overrides_object_chk
    CHECK (jsonb_typeof(session_overrides_json) = 'object')
);
