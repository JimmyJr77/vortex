-- ============================================================
-- Migration: Discipline tags associated at the Program level
-- Tags help assign different classes to a variety of sport
-- disciplines (Football, Basketball, Soccer, etc.). Tags are
-- global/searchable like scheduling categories, but they are
-- linked to top-level programs rather than to forms.
-- ============================================================

-- 1) Global discipline tags
CREATE TABLE IF NOT EXISTS discipline_tag (
  id          BIGSERIAL PRIMARY KEY,
  facility_id BIGINT REFERENCES facility(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, name)
);

CREATE INDEX IF NOT EXISTS idx_discipline_tag_facility ON discipline_tag(facility_id);

-- 2) Program <-> discipline tag association (program level)
CREATE TABLE IF NOT EXISTS program_discipline_tag (
  programs_id BIGINT NOT NULL,
  tag_id      BIGINT NOT NULL REFERENCES discipline_tag(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (programs_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_program_discipline_tag_program ON program_discipline_tag(programs_id);
CREATE INDEX IF NOT EXISTS idx_program_discipline_tag_tag ON program_discipline_tag(tag_id);

-- 3) Seed default discipline tags
INSERT INTO discipline_tag (facility_id, name, sort_order)
SELECT (SELECT id FROM facility LIMIT 1), tag.name, tag.sort_order
FROM (
  VALUES
    ('Football', 0),
    ('Basketball', 1),
    ('Soccer', 2),
    ('Lacrosse', 3),
    ('Wrestling', 4),
    ('MMA', 5),
    ('Gymnastics', 6),
    ('Athlete Training', 7)
) AS tag(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM discipline_tag d WHERE d.name = tag.name
);
