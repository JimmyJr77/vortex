-- Games & Competitions Library: play-based activities that develop athleticism through fun.
-- Distinct from exercises (movement prescriptions) and programming methods (work formats).
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.game (
  id                    BIGSERIAL PRIMARY KEY,
  facility_id           BIGINT NOT NULL REFERENCES public.facility(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL,
  description           TEXT,
  card_summary          TEXT,
  coach_summary         TEXT,
  athlete_summary       TEXT,
  game_kind             TEXT NOT NULL DEFAULT 'game'
    CHECK (game_kind IN ('game', 'competition', 'both')),
  game_type             TEXT NOT NULL,
  competition_format    TEXT,
  group_structure       TEXT NOT NULL DEFAULT 'pairs'
    CHECK (group_structure IN ('individual', 'pairs', 'small_group', 'large_group', 'teams')),
  min_players           INTEGER NOT NULL DEFAULT 2 CHECK (min_players >= 1),
  max_players           INTEGER CHECK (max_players IS NULL OR max_players >= min_players),
  ideal_players         TEXT,
  age_brackets          TEXT[] NOT NULL DEFAULT '{}',
  age_variations        JSONB NOT NULL DEFAULT '{}'::jsonb,
  space_requirements    JSONB NOT NULL DEFAULT '{}'::jsonb,
  equipment             TEXT[] NOT NULL DEFAULT '{}',
  duration_typical_min  INTEGER,
  duration_typical_max  INTEGER,
  intensity_level       TEXT NOT NULL DEFAULT 'moderate'
    CHECK (intensity_level IN ('low', 'moderate', 'high')),
  contact_level         TEXT NOT NULL DEFAULT 'none'
    CHECK (contact_level IN ('none', 'light', 'moderate')),
  supervision_level     TEXT NOT NULL DEFAULT 'recommended',
  rules                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety                JSONB NOT NULL DEFAULT '{}'::jsonb,
  coaching_notes        TEXT,
  best_session_phase    TEXT,
  compatible_phases     TEXT[] NOT NULL DEFAULT '{}',
  source_exercise_id    BIGINT REFERENCES coaching.exercise(id) ON DELETE SET NULL,
  migrated_from_exercise BOOLEAN NOT NULL DEFAULT FALSE,
  is_published          BOOLEAN NOT NULL DEFAULT TRUE,
  visibility            TEXT NOT NULL DEFAULT 'facility' CHECK (visibility IN ('facility', 'private')),
  created_by            BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  archived              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_coaching_game_facility ON coaching.game(facility_id) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_coaching_game_type ON coaching.game(game_type) WHERE archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_coaching_game_min_players ON coaching.game(min_players) WHERE archived = FALSE;

CREATE TABLE IF NOT EXISTS coaching.game_tag (
  id          BIGSERIAL PRIMARY KEY,
  game_id     BIGINT NOT NULL REFERENCES coaching.game(id) ON DELETE CASCADE,
  facet_type  TEXT NOT NULL CHECK (facet_type IN ('tenet', 'sport', 'equipment')),
  facet_id    BIGINT NOT NULL,
  weight      SMALLINT NOT NULL DEFAULT 3 CHECK (weight BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, facet_type, facet_id)
);

CREATE INDEX IF NOT EXISTS idx_coaching_game_tag_game ON coaching.game_tag(game_id);

CREATE TABLE IF NOT EXISTS coaching.game_exercise_link (
  game_id     BIGINT NOT NULL REFERENCES coaching.game(id) ON DELETE CASCADE,
  exercise_id BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'related' CHECK (role IN ('source_exercise', 'related', 'training_drill')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, exercise_id)
);
