-- Canonical progression graph edges for lane-valid next-of-kin (C7-MOP-07).
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.exercise_progression (
  from_exercise_id BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  to_exercise_id   BIGINT NOT NULL REFERENCES coaching.exercise(id) ON DELETE CASCADE,
  edge_kind        TEXT NOT NULL DEFAULT 'curated',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (from_exercise_id, to_exercise_id),
  CONSTRAINT exercise_progression_edge_kind_check
    CHECK (edge_kind IN ('pattern', 'family', 'curated'))
);

CREATE INDEX IF NOT EXISTS idx_exercise_progression_from
  ON coaching.exercise_progression (from_exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_progression_to
  ON coaching.exercise_progression (to_exercise_id);

-- Seed curated edges from migration 226 D6–8 progression cards → base primaries
INSERT INTO coaching.exercise_progression (from_exercise_id, to_exercise_id, edge_kind)
SELECT base.id, prog.id, 'curated'
FROM (VALUES
  ('med-ball-chest-pass', 'heavy-med-ball-chest-pass-d7'),
  ('goblet-squat', 'goblet-squat-tempo-d6'),
  ('kettlebell-deadlift-trap-bar-deadlift', 'kettlebell-deadlift-heavy-d7'),
  ('standing-broad-jump', 'reactive-broad-jump-d7'),
  ('triple-broad-jump', 'triple-broad-jump-d7')
) AS v(base_slug, prog_slug)
JOIN coaching.exercise base ON base.slug = v.base_slug
JOIN coaching.exercise prog ON prog.slug = v.prog_slug
ON CONFLICT (from_exercise_id, to_exercise_id) DO UPDATE SET edge_kind = EXCLUDED.edge_kind;
