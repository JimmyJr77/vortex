-- Phase 5: polls, checklists, FAQ, reactions, mentions, audit, moderation

CREATE TABLE IF NOT EXISTS coaching.message_poll (
  id            BIGSERIAL PRIMARY KEY,
  message_id    BIGINT NOT NULL UNIQUE REFERENCES coaching.message(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  options_json  JSONB NOT NULL DEFAULT '[]',
  closes_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coaching.message_poll_vote (
  id            BIGSERIAL PRIMARY KEY,
  poll_id       BIGINT NOT NULL REFERENCES coaching.message_poll(id) ON DELETE CASCADE,
  option_index  INT NOT NULL,
  user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  voted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS coaching.message_checklist (
  id            BIGSERIAL PRIMARY KEY,
  message_id    BIGINT NOT NULL UNIQUE REFERENCES coaching.message(id) ON DELETE CASCADE,
  items_json    JSONB NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coaching.thread_faq (
  id            BIGSERIAL PRIMARY KEY,
  thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  created_by_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coaching.message_reaction (
  id            BIGSERIAL PRIMARY KEY,
  message_id    BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reaction_user
  ON coaching.message_reaction(message_id, emoji, user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reaction_member
  ON coaching.message_reaction(message_id, emoji, member_id) WHERE member_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS coaching.message_mention (
  id            BIGSERIAL PRIMARY KEY,
  message_id    BIGINT NOT NULL REFERENCES coaching.message(id) ON DELETE CASCADE,
  user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS coaching.message_thread_mute (
  thread_id     BIGINT NOT NULL REFERENCES coaching.message_thread(id) ON DELETE CASCADE,
  user_id       BIGINT REFERENCES public.app_user(id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES public.member(id) ON DELETE CASCADE,
  muted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR member_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS coaching.message_audit_log (
  id            BIGSERIAL PRIMARY KEY,
  facility_id   BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  thread_id     BIGINT REFERENCES coaching.message_thread(id) ON DELETE SET NULL,
  message_id    BIGINT REFERENCES coaching.message(id) ON DELETE SET NULL,
  actor_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  actor_member_id BIGINT REFERENCES public.member(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  detail_json   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_audit_facility
  ON coaching.message_audit_log(facility_id, created_at DESC);

ALTER TABLE coaching.message_thread
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

ALTER TABLE coaching.message_thread
  ADD COLUMN IF NOT EXISTS locked_by_user_id BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_message_body_search
  ON coaching.message USING gin (to_tsvector('english', coalesce(body, '')));

CREATE INDEX IF NOT EXISTS idx_message_thread_subject_search
  ON coaching.message_thread USING gin (to_tsvector('english', coalesce(subject, '')));
