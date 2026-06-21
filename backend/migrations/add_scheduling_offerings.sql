-- Offerings (date ranges per Class/Event form) and program scheduling fields.

CREATE TABLE IF NOT EXISTS scheduling_offering (
  id           BIGSERIAL PRIMARY KEY,
  form_id      BIGINT NOT NULL REFERENCES scheduling_form(id) ON DELETE CASCADE,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  label        VARCHAR(255),
  is_selected  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduling_offering_form ON scheduling_offering(form_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduling_offering_selected
  ON scheduling_offering(form_id) WHERE is_selected = TRUE;

ALTER TABLE scheduling_slot_group
  ADD COLUMN IF NOT EXISTS offering_id BIGINT REFERENCES scheduling_offering(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scheduling_slot_group_offering ON scheduling_slot_group(offering_id);

-- Program-level scheduling config (Overview + Form defaults)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'programs'
  ) THEN
    ALTER TABLE programs
      ADD COLUMN IF NOT EXISTS scheduling_active BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS scheduling_signup_fields JSONB,
      ADD COLUMN IF NOT EXISTS scheduling_mandate_waiver BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS scheduling_overview_saved_at TIMESTAMPTZ;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'program_categories'
  ) THEN
    ALTER TABLE program_categories
      ADD COLUMN IF NOT EXISTS scheduling_active BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS scheduling_signup_fields JSONB,
      ADD COLUMN IF NOT EXISTS scheduling_mandate_waiver BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS scheduling_overview_saved_at TIMESTAMPTZ;
  END IF;
END $$;

-- Backfill: one offering per form from legacy form start/end when both exist
INSERT INTO scheduling_offering (form_id, start_date, end_date, label, is_selected)
SELECT
  sf.id,
  sf.start_date,
  sf.end_date,
  COALESCE(sf.title, 'Default offering'),
  TRUE
FROM scheduling_form sf
WHERE sf.deleted_at IS NULL
  AND sf.start_date IS NOT NULL
  AND sf.end_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM scheduling_offering o WHERE o.form_id = sf.id
  );
