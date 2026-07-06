-- Rename session phase fitness_repeatability → sustained_capacity (display: Sustained Capacity).
-- IDEMPOTENT.

UPDATE coaching.session_phase SET
  key = 'sustained_capacity',
  name = 'Sustained Capacity',
  description = 'Sustained work capacity: HIIT, conditioning, intervals, and repeatability under fatigue.',
  updated_at = now()
WHERE key = 'fitness_repeatability'
  AND NOT EXISTS (SELECT 1 FROM coaching.session_phase WHERE key = 'sustained_capacity');

DELETE FROM coaching.education_content ec
WHERE ec.entity_type = 'session_phase'
  AND ec.entity_key = 'fitness_repeatability'
  AND ec.entity_id IS NULL
  AND EXISTS (
    SELECT 1 FROM coaching.education_content
    WHERE entity_type = 'session_phase' AND entity_key = 'sustained_capacity' AND entity_id IS NULL
  );

UPDATE coaching.education_content SET
  entity_key = 'sustained_capacity',
  title = 'Sustained Capacity',
  short_summary = 'HIIT, conditioning, and repeatability under fatigue.',
  what_it_is = 'Sustained Capacity trains the ability to repeat efforts, tolerate fatigue, and sustain work.',
  updated_at = now()
WHERE entity_type = 'session_phase' AND entity_key = 'fitness_repeatability';

UPDATE coaching.education_content SET
  title = replace(replace(title, 'Fitness / Repeatability', 'Sustained Capacity'), 'Fitness/Repeatability', 'Sustained Capacity'),
  short_summary = replace(replace(short_summary, 'Fitness / Repeatability', 'Sustained Capacity'), 'Fitness/Repeatability', 'Sustained Capacity'),
  what_it_is = replace(replace(what_it_is, 'Fitness / Repeatability', 'Sustained Capacity'), 'Fitness/Repeatability', 'Sustained Capacity'),
  why_it_matters = replace(replace(why_it_matters, 'Fitness / Repeatability', 'Sustained Capacity'), 'Fitness/Repeatability', 'Sustained Capacity'),
  why_it_goes_here = replace(replace(why_it_goes_here, 'Fitness / Repeatability', 'Sustained Capacity'), 'Fitness/Repeatability', 'Sustained Capacity'),
  fatigue_logic = replace(replace(fatigue_logic, 'Fitness / Repeatability', 'Sustained Capacity'), 'Fitness/Repeatability', 'Sustained Capacity'),
  programming_guidance = replace(replace(programming_guidance, 'Fitness / Repeatability', 'Sustained Capacity'), 'Fitness/Repeatability', 'Sustained Capacity'),
  updated_at = now()
WHERE title ILIKE '%Fitness / Repeatability%'
   OR short_summary ILIKE '%Fitness / Repeatability%'
   OR what_it_is ILIKE '%Fitness / Repeatability%'
   OR why_it_matters ILIKE '%Fitness / Repeatability%'
   OR why_it_goes_here ILIKE '%Fitness / Repeatability%'
   OR fatigue_logic ILIKE '%Fitness / Repeatability%'
   OR programming_guidance ILIKE '%Fitness / Repeatability%'
   OR title ILIKE '%Fitness/Repeatability%'
   OR short_summary ILIKE '%Fitness/Repeatability%'
   OR what_it_is ILIKE '%Fitness/Repeatability%'
   OR why_it_matters ILIKE '%Fitness/Repeatability%'
   OR why_it_goes_here ILIKE '%Fitness/Repeatability%'
   OR fatigue_logic ILIKE '%Fitness/Repeatability%'
   OR programming_guidance ILIKE '%Fitness/Repeatability%';

UPDATE coaching.education_content SET
  examples_json = replace(replace(examples_json::text, 'fitness_repeatability', 'sustained_capacity'), 'Fitness / Repeatability', 'Sustained Capacity')::jsonb,
  updated_at = now()
WHERE examples_json::text LIKE '%fitness_repeatability%'
   OR examples_json::text LIKE '%Fitness / Repeatability%';

UPDATE coaching.validation_rule SET
  rule_logic_json = replace(rule_logic_json::text, 'fitness_repeatability', 'sustained_capacity')::jsonb
WHERE rule_logic_json::text LIKE '%fitness_repeatability%';

UPDATE coaching.education_content SET
  title = replace(title, 'Fitness Add-On', 'Sustained Capacity Add-On'),
  short_summary = replace(short_summary, 'Fitness add-on', 'Sustained Capacity add-on'),
  updated_at = now()
WHERE entity_key IN ('session_120_fitness_addon', 'addon_fitness_placement');
