-- Phase 3–4: multi-file attachments, critical alerts, notification preferences

CREATE TABLE IF NOT EXISTS coaching.message_file (
  id              BIGSERIAL PRIMARY KEY,
  message_id      BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
  thread_id       BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  facility_id     BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  name            TEXT NOT NULL,
  mime            TEXT,
  size_bytes      BIGINT,
  version         INT NOT NULL DEFAULT 1,
  tag_slug        TEXT,
  uploaded_by_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  uploaded_by_member_id BIGINT REFERENCES public.member(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_file_thread ON coaching.message_file(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_file_facility ON coaching.message_file(facility_id, created_at DESC);

ALTER TABLE coaching.message
  ADD COLUMN IF NOT EXISTS is_critical BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE coaching.message
  ADD COLUMN IF NOT EXISTS requires_ack BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE coaching.message
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

ALTER TABLE coaching.message
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS coaching.message_ack (
  id            BIGSERIAL PRIMARY KEY,
  message_id    BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
  user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL),
  UNIQUE (message_id, user_id),
  UNIQUE (message_id, member_id)
);

CREATE TABLE IF NOT EXISTS coaching.notification_preference (
  id                    BIGSERIAL PRIMARY KEY,
  facility_id           BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  user_id               BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id             BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  allow_critical_email  BOOLEAN NOT NULL DEFAULT FALSE,
  allow_critical_sms    BOOLEAN NOT NULL DEFAULT FALSE,
  phone_e164            TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preference_user
  ON coaching.notification_preference(facility_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preference_member
  ON coaching.notification_preference(facility_id, member_id) WHERE member_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS coaching.message_read (
  id            BIGSERIAL PRIMARY KEY,
  message_id    BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
  user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  read_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_read_user
  ON coaching.message_read(message_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_read_member
  ON coaching.message_read(message_id, member_id) WHERE member_id IS NOT NULL;
