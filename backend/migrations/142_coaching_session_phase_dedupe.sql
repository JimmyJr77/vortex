-- Merge legacy duplicate session_phase rows and scrub stale education copy.
-- IDEMPOTENT.

DO $$
DECLARE
  rec RECORD;
  old_id BIGINT;
  new_id BIGINT;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('prepare_access', 'prepare_and_access'),
      ('skill_movement_intelligence', 'movement_intelligence'),
      ('control_resilience', 'resilience'),
      ('fitness_repeatability', 'sustained_capacity')
    ) AS t(old_key, new_key)
  LOOP
    SELECT id INTO old_id FROM coaching.session_phase WHERE key = rec.old_key;
    SELECT id INTO new_id FROM coaching.session_phase WHERE key = rec.new_key;

    IF old_id IS NULL THEN
      CONTINUE;
    END IF;

    IF new_id IS NULL THEN
      UPDATE coaching.session_phase SET
        key = rec.new_key,
        name = CASE rec.new_key
          WHEN 'prepare_and_access' THEN 'Prepare & Access'
          WHEN 'movement_intelligence' THEN 'Movement Intelligence'
          WHEN 'resilience' THEN 'Resilience'
          WHEN 'sustained_capacity' THEN 'Sustained Capacity'
        END,
        updated_at = now()
      WHERE id = old_id;
      CONTINUE;
    END IF;

    UPDATE coaching.phase_order_slot pos
    SET phase_id = new_id
    WHERE pos.phase_id = old_id
      AND NOT EXISTS (
        SELECT 1 FROM coaching.phase_order_slot dup
        WHERE dup.phase_id = new_id AND dup.key = pos.key
      );
    DELETE FROM coaching.phase_order_slot WHERE phase_id = old_id;

    UPDATE coaching.exercise_phase_profile SET phase_id = new_id WHERE phase_id = old_id;

    DELETE FROM coaching.regimen_phase_distribution d
    WHERE d.phase_id = old_id
      AND EXISTS (
        SELECT 1 FROM coaching.regimen_phase_distribution x
        WHERE x.regimen_template_id = d.regimen_template_id AND x.phase_id = new_id
      );
    UPDATE coaching.regimen_phase_distribution SET phase_id = new_id WHERE phase_id = old_id;

    DELETE FROM coaching.phase_subrole ps
    WHERE ps.phase_id = old_id
      AND EXISTS (
        SELECT 1 FROM coaching.phase_subrole x
        WHERE x.phase_id = new_id AND x.key = ps.key
      );
    UPDATE coaching.phase_subrole SET phase_id = new_id WHERE phase_id = old_id;

    UPDATE coaching.workout_block SET phase_id = new_id WHERE phase_id = old_id;

    DELETE FROM coaching.session_phase WHERE id = old_id;
  END LOOP;
END $$;

UPDATE coaching.session_phase SET name = 'Prepare & Access', updated_at = now()
WHERE key = 'prepare_and_access' AND name IS DISTINCT FROM 'Prepare & Access';

UPDATE coaching.session_phase SET name = 'Movement Intelligence', updated_at = now()
WHERE key = 'movement_intelligence' AND name IS DISTINCT FROM 'Movement Intelligence';

UPDATE coaching.session_phase SET name = 'Resilience', updated_at = now()
WHERE key = 'resilience' AND name IS DISTINCT FROM 'Resilience';

UPDATE coaching.session_phase SET name = 'Sustained Capacity', updated_at = now()
WHERE key = 'sustained_capacity' AND name IS DISTINCT FROM 'Sustained Capacity';

DELETE FROM coaching.education_content legacy
WHERE legacy.entity_type = 'session_phase'
  AND legacy.entity_id IS NULL
  AND legacy.entity_key IN ('prepare_access', 'skill_movement_intelligence', 'control_resilience', 'fitness_repeatability')
  AND EXISTS (
    SELECT 1 FROM coaching.education_content canonical
    WHERE canonical.entity_type = 'session_phase'
      AND canonical.entity_id IS NULL
      AND canonical.entity_key = CASE legacy.entity_key
        WHEN 'prepare_access' THEN 'prepare_and_access'
        WHEN 'skill_movement_intelligence' THEN 'movement_intelligence'
        WHEN 'control_resilience' THEN 'resilience'
        WHEN 'fitness_repeatability' THEN 'sustained_capacity'
      END
  );

UPDATE coaching.education_content SET entity_key = 'prepare_and_access', title = 'Prepare & Access', updated_at = now()
WHERE entity_type = 'session_phase' AND entity_id IS NULL AND entity_key = 'prepare_access';

UPDATE coaching.education_content SET entity_key = 'movement_intelligence', title = 'Movement Intelligence', updated_at = now()
WHERE entity_type = 'session_phase' AND entity_id IS NULL AND entity_key = 'skill_movement_intelligence';

UPDATE coaching.education_content SET entity_key = 'resilience', title = 'Resilience', updated_at = now()
WHERE entity_type = 'session_phase' AND entity_id IS NULL AND entity_key = 'control_resilience';

UPDATE coaching.education_content SET entity_key = 'sustained_capacity', title = 'Sustained Capacity', updated_at = now()
WHERE entity_type = 'session_phase' AND entity_id IS NULL AND entity_key = 'fitness_repeatability';

UPDATE coaching.education_content SET
  title = replace(replace(replace(replace(title,
    'Prepare / Access', 'Prepare & Access'),
    'Skill / Movement Intelligence', 'Movement Intelligence'),
    'Control / Resilience', 'Resilience'),
    'Fitness / Repeatability', 'Sustained Capacity'),
  short_summary = replace(replace(replace(replace(short_summary,
    'Prepare / Access', 'Prepare & Access'),
    'Skill / Movement Intelligence', 'Movement Intelligence'),
    'Control / Resilience', 'Resilience'),
    'Fitness / Repeatability', 'Sustained Capacity'),
  what_it_is = replace(replace(replace(replace(what_it_is,
    'Prepare / Access', 'Prepare & Access'),
    'Skill / Movement Intelligence', 'Movement Intelligence'),
    'Control / Resilience', 'Resilience'),
    'Fitness / Repeatability', 'Sustained Capacity'),
  updated_at = now()
WHERE title ILIKE '%Prepare / Access%'
   OR title ILIKE '%Skill / Movement Intelligence%'
   OR title ILIKE '%Control / Resilience%'
   OR title ILIKE '%Fitness / Repeatability%'
   OR short_summary ILIKE '%Prepare / Access%'
   OR short_summary ILIKE '%Skill / Movement Intelligence%'
   OR short_summary ILIKE '%Control / Resilience%'
   OR short_summary ILIKE '%Fitness / Repeatability%';
