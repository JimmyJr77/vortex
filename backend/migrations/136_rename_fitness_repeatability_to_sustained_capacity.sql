-- Rename session phase fitness_repeatability → sustained_capacity (display: Sustained Capacity).
-- IDEMPOTENT.

UPDATE coaching.session_phase SET
  key = 'sustained_capacity',
  name = 'Sustained Capacity',
  description = 'Sustained work capacity: HIIT, conditioning, intervals, and repeatability under fatigue.',
  updated_at = now()
WHERE key = 'fitness_repeatability';

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
  fatigue_guidance = replace(replace(fatigue_guidance, 'Fitness / Repeatability', 'Sustained Capacity'), 'Fitness/Repeatability', 'Sustained Capacity'),
  coach_guidance = replace(replace(coach_guidance, 'Fitness / Repeatability', 'Sustained Capacity'), 'Fitness/Repeatability', 'Sustained Capacity'),
  what_belongs_here = replace(replace(what_belongs_here, 'Fitness / Repeatability', 'Sustained Capacity'), 'Fitness/Repeatability', 'Sustained Capacity'),
  what_to_avoid = replace(replace(what_to_avoid, 'Fitness / Repeatability', 'Sustained Capacity'), 'Fitness/Repeatability', 'Sustained Capacity'),
  updated_at = now()
WHERE title ILIKE '%Fitness / Repeatability%'
   OR short_summary ILIKE '%Fitness / Repeatability%'
   OR what_it_is ILIKE '%Fitness / Repeatability%'
   OR why_it_matters ILIKE '%Fitness / Repeatability%'
   OR why_it_goes_here ILIKE '%Fitness / Repeatability%'
   OR fatigue_guidance ILIKE '%Fitness / Repeatability%'
   OR coach_guidance ILIKE '%Fitness / Repeatability%'
   OR what_belongs_here ILIKE '%Fitness / Repeatability%'
   OR what_to_avoid ILIKE '%Fitness / Repeatability%'
   OR title ILIKE '%Fitness/Repeatability%'
   OR short_summary ILIKE '%Fitness/Repeatability%'
   OR what_it_is ILIKE '%Fitness/Repeatability%'
   OR why_it_matters ILIKE '%Fitness/Repeatability%'
   OR why_it_goes_here ILIKE '%Fitness/Repeatability%'
   OR fatigue_guidance ILIKE '%Fitness/Repeatability%'
   OR coach_guidance ILIKE '%Fitness/Repeatability%'
   OR what_belongs_here ILIKE '%Fitness/Repeatability%'
   OR what_to_avoid ILIKE '%Fitness/Repeatability%';

UPDATE coaching.education_content SET
  examples_json = replace(replace(examples_json::text, 'fitness_repeatability', 'sustained_capacity'), 'Fitness / Repeatability', 'Sustained Capacity')::jsonb,
  updated_at = now()
WHERE examples_json::text LIKE '%fitness_repeatability%'
   OR examples_json::text LIKE '%Fitness / Repeatability%';

UPDATE coaching.validation_rule SET
  condition = replace(condition::text, 'fitness_repeatability', 'sustained_capacity')::jsonb,
  updated_at = now()
WHERE condition::text LIKE '%fitness_repeatability%';

UPDATE coaching.education_content SET
  title = replace(title, 'Fitness Add-On', 'Sustained Capacity Add-On'),
  short_summary = replace(short_summary, 'Fitness add-on', 'Sustained Capacity add-on'),
  updated_at = now()
WHERE entity_key IN ('session_120_fitness_addon', 'addon_fitness_placement');
