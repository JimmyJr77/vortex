-- Planning drafts are independent of enrollment schedules; one weekly plan per facility.
CREATE TABLE IF NOT EXISTS public.floor_planner (
  facility_id BIGINT PRIMARY KEY REFERENCES public.facility(id) ON DELETE CASCADE,
  plan JSONB NOT NULL CHECK (jsonb_typeof(plan) = 'object'),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
