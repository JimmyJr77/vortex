-- Named, independent planning layouts. Never modifies the live class schedule.
CREATE TABLE IF NOT EXISTS public.floor_planner_view (
  id UUID PRIMARY KEY,
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL CHECK (length(trim(name)) > 0),
  plan JSONB NOT NULL CHECK (jsonb_typeof(plan) = 'object'),
  selected_day SMALLINT NOT NULL DEFAULT 0 CHECK (selected_day BETWEEN 0 AND 6),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS floor_planner_view_facility_name
  ON public.floor_planner_view (facility_id, lower(name));
