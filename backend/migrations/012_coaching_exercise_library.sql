-- ============================================================
-- Coaching Module: Exercise / Drill Library
-- Migration: 012_coaching_exercise_library.sql
--
-- The tagged movement library that is the spine of every coach-portal
-- feature. Facility-global ownership model: created_by + is_published +
-- visibility ('facility' | 'private').
--
-- IDEMPOTENT.
-- ============================================================

-- Body region / joint facet (used for contraindication filtering).
CREATE TABLE IF NOT EXISTS coaching.body_region (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO coaching.body_region (key, name, sort_order) VALUES
  ('ankle', 'Ankle', 1),
  ('knee', 'Knee', 2),
  ('hip', 'Hip', 3),
  ('spine', 'Spine / Back', 4),
  ('core', 'Core', 5),
  ('shoulder', 'Shoulder', 6),
  ('elbow', 'Elbow', 7),
  ('wrist', 'Wrist', 8),
  ('full_body', 'Full Body', 9)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- ============================================================
-- EXERCISE
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.exercise (
  id                    BIGSERIAL PRIMARY KEY,
  facility_id           BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  description           TEXT,
  instructions          TEXT,
  sport_id              BIGINT REFERENCES coaching.sport(id) ON DELETE SET NULL,
  skill_level           public.skill_level,
  age_min               INTEGER,
  age_max               INTEGER,
  default_sets          INTEGER,
  default_reps          INTEGER,
  default_work_seconds  INTEGER,
  default_rest_seconds  INTEGER,
  tempo                 TEXT,
  load_note             TEXT,
  -- The field that powers both the live builder clock and time-based search.
  est_seconds_per_set   INTEGER NOT NULL DEFAULT 45,
  created_by            BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  is_published          BOOLEAN NOT NULL DEFAULT TRUE,
  visibility            TEXT NOT NULL DEFAULT 'facility' CHECK (visibility IN ('facility', 'private')),
  archived              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_coaching_exercise_facility ON coaching.exercise(facility_id);
CREATE INDEX IF NOT EXISTS idx_coaching_exercise_sport ON coaching.exercise(sport_id);
CREATE INDEX IF NOT EXISTS idx_coaching_exercise_level ON coaching.exercise(skill_level);
CREATE INDEX IF NOT EXISTS idx_coaching_exercise_seconds ON coaching.exercise(est_seconds_per_set);
CREATE INDEX IF NOT EXISTS idx_coaching_exercise_published ON coaching.exercise(is_published, archived);

-- ============================================================
-- EXERCISE_TAG (generic faceted many-to-many with weight)
-- facet_type identifies the taxonomy table; facet_id is the logical id
-- in that table (validated by app, no hard cross-facet FK).
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.exercise_tag (
  id          BIGSERIAL PRIMARY KEY,
  exercise_id BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  facet_type  TEXT NOT NULL CHECK (facet_type IN (
    'tenet', 'methodology', 'physiology', 'pattern',
    'equipment', 'sport', 'intent', 'body_region'
  )),
  facet_id    BIGINT NOT NULL,
  weight      SMALLINT NOT NULL DEFAULT 3 CHECK (weight BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, facet_type, facet_id)
);

CREATE INDEX IF NOT EXISTS idx_coaching_exercise_tag_exercise ON coaching.exercise_tag(exercise_id);
CREATE INDEX IF NOT EXISTS idx_coaching_exercise_tag_facet ON coaching.exercise_tag(facet_type, facet_id);

-- ============================================================
-- EXERCISE_MEDIA
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.exercise_media (
  id          BIGSERIAL PRIMARY KEY,
  exercise_id BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'video' CHECK (kind IN ('video', 'image', 'diagram')),
  url         TEXT NOT NULL,
  caption     TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_exercise_media_exercise ON coaching.exercise_media(exercise_id);

-- ============================================================
-- EXERCISE_CUE (coaching cues + common faults)
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.exercise_cue (
  id          BIGSERIAL PRIMARY KEY,
  exercise_id BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  cue_type    TEXT NOT NULL DEFAULT 'cue' CHECK (cue_type IN ('cue', 'fault')),
  body        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coaching_exercise_cue_exercise ON coaching.exercise_cue(exercise_id);

-- ============================================================
-- EXERCISE_PREREQUISITE (progression graph; gymnastics/ninja skill trees)
-- ============================================================

CREATE TABLE IF NOT EXISTS coaching.exercise_prerequisite (
  exercise_id              BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  prerequisite_exercise_id BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  note                     TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (exercise_id, prerequisite_exercise_id),
  CHECK (exercise_id <> prerequisite_exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_coaching_exercise_prereq_prereq ON coaching.exercise_prerequisite(prerequisite_exercise_id);
