-- One shared class color across the facility's current schedule and saved views.
CREATE TABLE IF NOT EXISTS public.floor_planner_class_color (
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  class_id VARCHAR(100) NOT NULL CHECK (class_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'),
  color VARCHAR(7) NOT NULL CHECK (color ~ '^#[0-9a-f]{6}$'),
  updated_by BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (facility_id, class_id)
);
