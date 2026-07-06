-- Skill library: discrete gymnastics/ninja skills, timed holds, and combo sequences.
-- IDEMPOTENT.

CREATE TABLE IF NOT EXISTS coaching.skill (
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
  skill_kind            TEXT NOT NULL DEFAULT 'skill'
                        CHECK (skill_kind IN ('skill', 'combo', 'hold')),
  min_hold_seconds      INTEGER,
  default_hold_seconds  INTEGER,
  assistance_note       TEXT,
  created_by            BIGINT REFERENCES public.app_user(id) ON DELETE SET NULL,
  is_published          BOOLEAN NOT NULL DEFAULT TRUE,
  visibility            TEXT NOT NULL DEFAULT 'facility' CHECK (visibility IN ('facility', 'private')),
  archived              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_coaching_skill_facility ON coaching.skill(facility_id);
CREATE INDEX IF NOT EXISTS idx_coaching_skill_sport ON coaching.skill(sport_id);
CREATE INDEX IF NOT EXISTS idx_coaching_skill_kind ON coaching.skill(skill_kind);
CREATE INDEX IF NOT EXISTS idx_coaching_skill_published ON coaching.skill(is_published, archived);

CREATE TABLE IF NOT EXISTS coaching.skill_component (
  skill_id              BIGINT NOT NULL REFERENCES coaching.skill(id) ON DELETE CASCADE,
  component_skill_id    BIGINT NOT NULL REFERENCES coaching.skill(id) ON DELETE CASCADE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (skill_id, component_skill_id),
  CHECK (skill_id <> component_skill_id)
);

CREATE INDEX IF NOT EXISTS idx_coaching_skill_component_skill ON coaching.skill_component(skill_id);

CREATE TABLE IF NOT EXISTS coaching.skill_prerequisite (
  skill_id                  BIGINT NOT NULL REFERENCES coaching.skill(id) ON DELETE CASCADE,
  prerequisite_skill_id     BIGINT NOT NULL REFERENCES coaching.skill(id) ON DELETE CASCADE,
  note                      TEXT,
  PRIMARY KEY (skill_id, prerequisite_skill_id),
  CHECK (skill_id <> prerequisite_skill_id)
);

CREATE INDEX IF NOT EXISTS idx_coaching_skill_prerequisite_skill ON coaching.skill_prerequisite(skill_id);

-- Starter skill library (gymnastics-focused)
INSERT INTO coaching.skill
  (facility_id, name, slug, description, sport_id, skill_level, skill_kind, min_hold_seconds, default_hold_seconds, assistance_note, is_published, visibility)
SELECT
  (SELECT id FROM public.facility ORDER BY id LIMIT 1),
  d.name, d.slug, d.description,
  (SELECT id FROM coaching.sport WHERE key = d.sport_key),
  NULLIF(d.skill_level, '')::public.skill_level,
  d.skill_kind,
  d.min_hold_seconds,
  d.default_hold_seconds,
  NULLIF(d.assistance_note, ''),
  TRUE, 'facility'
FROM (VALUES
  ('Handstand', 'handstand', 'Inverted balance on hands with stacked body line.', 'gymnastics', 'BEGINNER', 'skill', NULL, NULL, NULL),
  ('Front Tuck', 'front-tuck', 'Forward salto tucked in the air.', 'gymnastics', 'INTERMEDIATE', 'skill', NULL, NULL, NULL),
  ('Back Tuck', 'back-tuck', 'Backward salto tucked.', 'gymnastics', 'INTERMEDIATE', 'skill', NULL, NULL, NULL),
  ('Back Handspring', 'back-handspring', 'Backward handspring through hand support.', 'gymnastics', 'INTERMEDIATE', 'skill', NULL, NULL, NULL),
  ('Front Handspring', 'front-handspring', 'Forward handspring through hand support.', 'gymnastics', 'INTERMEDIATE', 'skill', NULL, NULL, NULL),
  ('Handspring', 'handspring', 'Generic handspring skill (back or front entry).', 'gymnastics', 'INTERMEDIATE', 'skill', NULL, NULL, NULL),
  ('Aerial', 'aerial', 'No-hands cartwheel-style side aerial.', 'gymnastics', 'ADVANCED', 'skill', NULL, NULL, NULL),
  ('Layout', 'layout', 'Salto with straight body position.', 'gymnastics', 'ADVANCED', 'skill', NULL, NULL, NULL),
  ('Muscle-Up', 'muscle-up', 'Transition from pull to support on bar or rings.', 'gymnastics', 'ADVANCED', 'skill', NULL, NULL, NULL),
  ('Round-Off', 'round-off', 'Power rotational entry skill.', 'gymnastics', 'INTERMEDIATE', 'skill', NULL, NULL, NULL),
  ('Plank Hold', 'plank-hold-skill', 'Isometric core brace hold; minimum 30 seconds for proficiency.', 'gymnastics', 'EARLY_STAGE', 'hold', 30, 45, NULL),
  ('Flexed Arm Dead Hang', 'flexed-arm-dead-hang', 'Hanging hold with bent arms; minimum 15 seconds.', 'gymnastics', 'BEGINNER', 'hold', 15, 20, NULL),
  ('Handstand Push-Up (Wall Assisted)', 'handstand-push-up-wall', 'Vertical pressing from handstand against wall.', 'gymnastics', 'INTERMEDIATE', 'skill', NULL, NULL, 'Wall assisted'),
  ('Double Back Handspring', 'double-back-handspring', 'Two consecutive back handsprings.', 'gymnastics', 'ADVANCED', 'combo', NULL, NULL, NULL),
  ('Round-Off Back Handspring', 'round-off-back-handspring', 'Round-off connected to back handspring.', 'gymnastics', 'ADVANCED', 'combo', NULL, NULL, NULL),
  ('Round-Off Back Layout', 'round-off-back-layout', 'Round-off to back handspring to layout salto.', 'gymnastics', 'ADVANCED', 'combo', NULL, NULL, NULL)
) AS d(name, slug, description, sport_key, skill_level, skill_kind, min_hold_seconds, default_hold_seconds, assistance_note)
ON CONFLICT (facility_id, slug) DO NOTHING;

-- Combo components (ordered)
INSERT INTO coaching.skill_component (skill_id, component_skill_id, sort_order)
SELECT combo.id, comp.id, v.sort_order
FROM (VALUES
  ('double-back-handspring', 'back-handspring', 0),
  ('double-back-handspring', 'back-handspring', 1),
  ('round-off-back-handspring', 'round-off', 0),
  ('round-off-back-handspring', 'back-handspring', 1),
  ('round-off-back-layout', 'round-off', 0),
  ('round-off-back-layout', 'back-handspring', 1),
  ('round-off-back-layout', 'layout', 2)
) AS v(combo_slug, comp_slug, sort_order)
JOIN coaching.skill combo ON combo.slug = v.combo_slug
JOIN coaching.skill comp ON comp.slug = v.comp_slug
ON CONFLICT DO NOTHING;

-- Progression prerequisites
INSERT INTO coaching.skill_prerequisite (skill_id, prerequisite_skill_id, note)
SELECT s.id, p.id, v.note
FROM (VALUES
  ('back-handspring', 'handstand', 'Solid handstand line before tumbling through hands.'),
  ('front-handspring', 'handstand', 'Handstand control supports front handspring shape.'),
  ('aerial', 'handstand', 'Cartwheel and handstand control before aerial.'),
  ('layout', 'back-tuck', 'Tuck shape and air awareness before layout.'),
  ('muscle-up', 'flexed-arm-dead-hang', 'Hold flexed-arm hang before linking muscle-up.'),
  ('double-back-handspring', 'back-handspring', 'Consistent single back handspring first.'),
  ('round-off-back-handspring', 'round-off', 'Strong round-off before connecting.'),
  ('round-off-back-handspring', 'back-handspring', 'Independent back handspring before connection.'),
  ('round-off-back-layout', 'round-off-back-handspring', 'Master round-off back handspring before adding layout.')
) AS v(skill_slug, prereq_slug, note)
JOIN coaching.skill s ON s.slug = v.skill_slug
JOIN coaching.skill p ON p.slug = v.prereq_slug
ON CONFLICT DO NOTHING;
