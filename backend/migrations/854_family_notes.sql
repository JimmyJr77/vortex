-- Keep the existing append-only note log and allow notes owned by a family.
-- The note table can also be initialized by the backend on startup.
CREATE TABLE IF NOT EXISTS note (
  id           BIGSERIAL PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id   BIGINT NOT NULL,
  note_type    TEXT NOT NULL CHECK (note_type IN ('user_comment','staff_note')),
  body         TEXT NOT NULL,
  author_kind  TEXT CHECK (author_kind IN ('user','admin','system')),
  author_id    BIGINT,
  author_email TEXT,
  author_name  TEXT,
  source       TEXT,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE note
  DROP CONSTRAINT IF EXISTS note_subject_type_check,
  ADD CONSTRAINT note_subject_type_check CHECK (subject_type IN ('family','member','registration'));

CREATE INDEX IF NOT EXISTS idx_note_subject ON note(subject_type, subject_id, created_at DESC);
