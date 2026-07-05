-- Phase 1: tags, thread kinds, object links, read state, pins, editors, spaces

ALTER TABLE coaching.message_thread
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'general'
    CHECK (kind IN ('general', 'canonical', 'discussion', 'announcement'));

ALTER TABLE coaching.message_thread
  ADD COLUMN IF NOT EXISTS linked_thread_id BIGINT REFERENCES coaching.message_thread(id) ON DELETE SET NULL;

ALTER TABLE coaching.message_thread
  ADD COLUMN IF NOT EXISTS space_id BIGINT;

ALTER TABLE coaching.message_thread
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'participants'
    CHECK (visibility IN ('participants', 'coach_only', 'parent_only', 'staff_only'));

CREATE TABLE IF NOT EXISTS coaching.message_space (
  id            BIGSERIAL PRIMARY KEY,
  facility_id   BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  object_type   TEXT,
  object_id     BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_message_space_facility
  ON coaching.message_space(facility_id);

CREATE TABLE IF NOT EXISTS coaching.message_thread_tag (
  id            BIGSERIAL PRIMARY KEY,
  facility_id   BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  slug          TEXT NOT NULL,
  label         TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, slug)
);

CREATE TABLE IF NOT EXISTS coaching.message_thread_tag_link (
  thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  tag_id        BIGINT NOT NULL REFERENCES coaching.message_thread_tag(id) ON DELETE CASCADE,
  PRIMARY KEY (thread_id, tag_id)
);

CREATE TABLE IF NOT EXISTS coaching.message_thread_link (
  id            BIGSERIAL PRIMARY KEY,
  thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  object_type   TEXT NOT NULL CHECK (object_type IN (
    'event', 'scheduling_form', 'program', 'scheduling_offering', 'family', 'scheduling_time_slot'
  )),
  object_id     BIGINT NOT NULL,
  link_role     TEXT NOT NULL DEFAULT 'related'
    CHECK (link_role IN ('canonical', 'discussion', 'related')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (thread_id, object_type, object_id, link_role)
);

CREATE INDEX IF NOT EXISTS idx_message_thread_link_object
  ON coaching.message_thread_link(object_type, object_id);

CREATE TABLE IF NOT EXISTS coaching.message_thread_info (
  thread_id     BIGINT PRIMARY KEY REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  info_json     JSONB NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coaching.message_thread_read (
  id                    BIGSERIAL PRIMARY KEY,
  thread_id             BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  user_id               BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id             BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  last_read_message_id  BIGINT REFERENCES coaching.message(id) ON DELETE SET NULL,
  last_read_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_read_user
  ON coaching.message_thread_read(thread_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_read_member
  ON coaching.message_thread_read(thread_id, member_id) WHERE member_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS coaching.message_pin (
  id            BIGSERIAL PRIMARY KEY,
  thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  message_id    BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
  pinned_by_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  pinned_by_member_id BIGINT REFERENCES public.member(id) ON DELETE SET NULL,
  pinned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (thread_id, message_id)
);

CREATE TABLE IF NOT EXISTS coaching.message_thread_editor (
  id            BIGSERIAL PRIMARY KEY,
  thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  can_edit_info BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_editor_user
  ON coaching.message_thread_editor(thread_id, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_thread_editor_member
  ON coaching.message_thread_editor(thread_id, member_id) WHERE member_id IS NOT NULL;

-- Seed default tags per facility (idempotent)
INSERT INTO coaching.message_thread_tag (facility_id, slug, label, sort_order)
SELECT f.id, v.slug, v.label, v.sort_order
FROM public.facility f
CROSS JOIN (VALUES
  ('team-comms', 'Team Comms', 1),
  ('event-info', 'Event Info', 2),
  ('scheduling', 'Scheduling', 3),
  ('billing', 'Billing', 4),
  ('announcements', 'Announcements', 5),
  ('training', 'Training', 6)
) AS v(slug, label, sort_order)
ON CONFLICT (facility_id, slug) DO NOTHING;
