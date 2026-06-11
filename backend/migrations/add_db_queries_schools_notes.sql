-- Schools, member<->school links, registration->member link, append-only note log,
-- and saved DB queries. Additive and idempotent. Seed + backfill are handled in
-- backend/dbfeatures/initTables.js (run automatically on server start).

CREATE TABLE IF NOT EXISTS school (
  id          BIGSERIAL PRIMARY KEY,
  facility_id BIGINT REFERENCES facility(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  level       TEXT CHECK (level IN ('high','middle','elementary','other')),
  location    TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS school_name_unique ON school (facility_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_school_verified ON school(is_verified);

CREATE TABLE IF NOT EXISTS member_school (
  member_id  BIGINT NOT NULL REFERENCES member(id) ON DELETE CASCADE,
  school_id  BIGINT NOT NULL REFERENCES school(id) ON DELETE CASCADE,
  source     TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, school_id)
);
CREATE INDEX IF NOT EXISTS idx_member_school_member ON member_school(member_id);
CREATE INDEX IF NOT EXISTS idx_member_school_school ON member_school(school_id);

ALTER TABLE registrations
  ADD COLUMN IF NOT EXISTS member_id BIGINT REFERENCES member(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_registrations_member ON registrations(member_id);

CREATE TABLE IF NOT EXISTS note (
  id           BIGSERIAL PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('member','registration')),
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
CREATE INDEX IF NOT EXISTS idx_note_subject ON note(subject_type, subject_id, created_at DESC);

CREATE TABLE IF NOT EXISTS saved_query (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  base_entity TEXT NOT NULL,
  config      JSONB NOT NULL,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
