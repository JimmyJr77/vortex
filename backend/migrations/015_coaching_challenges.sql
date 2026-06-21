-- ============================================================
-- Coaching Module: Challenges
-- Migration: 015_coaching_challenges.sql
--
-- Challenges are scored, time-bound competitions tagged with a
-- tenet/methodology/physiology focus. Entries are recorded per member.
--
-- IDEMPOTENT.
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.challenge (
  id                  BIGSERIAL PRIMARY KEY,
  facility_id         BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  description         TEXT,
  sport_id            BIGINT REFERENCES coaching.sport(id) ON DELETE SET NULL,
  scoring_type        TEXT NOT NULL DEFAULT 'max_reps' CHECK (scoring_type IN (
    'max_reps', 'fastest_time', 'max_load', 'distance', 'streak'
  )),
  unit                TEXT,
  starts_on           DATE,
  ends_on             DATE,
  leaderboard_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_by          BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  archived            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_challenge_facility ON coaching.challenge(facility_id);

CREATE TABLE IF NOT EXISTS coaching.challenge_criteria (
  id           BIGSERIAL PRIMARY KEY,
  challenge_id BIGINT NOT NULL REFERENCES coaching.challenge(id) ON DELETE CASCADE,
  facet_type   TEXT NOT NULL CHECK (facet_type IN (
    'tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'sport', 'intent', 'body_region'
  )),
  facet_id     BIGINT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, facet_type, facet_id)
);

CREATE INDEX IF NOT EXISTS idx_coaching_challenge_criteria_challenge ON coaching.challenge_criteria(challenge_id);

CREATE TABLE IF NOT EXISTS coaching.challenge_entry (
  id            BIGSERIAL PRIMARY KEY,
  challenge_id  BIGINT NOT NULL REFERENCES coaching.challenge(id) ON DELETE CASCADE,
  member_id     BIGINT NOT NULL REFERENCES public.member(id) ON DELETE CASCADE,
  value_numeric NUMERIC,
  unit          TEXT,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by   BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_challenge_entry_challenge ON coaching.challenge_entry(challenge_id);
CREATE INDEX IF NOT EXISTS idx_coaching_challenge_entry_member ON coaching.challenge_entry(member_id);
