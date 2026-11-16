CREATE SCHEMA IF NOT EXISTS coaching;
CREATE TABLE IF NOT EXISTS coaching.message_panel_preference (
  facility_id BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES public.app_user(id) ON DELETE CASCADE,
  files_visible BOOLEAN NOT NULL DEFAULT TRUE,
  events_visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (facility_id, user_id)
);
