-- Rename session phases: display names, keys (where changed), and canonical descriptions.
-- IDEMPOTENT.

-- 0) Legacy key → canonical key
UPDATE coaching.session_phase SET key = 'prepare_and_access', updated_at = now()
WHERE key = 'prepare_access';

UPDATE coaching.session_phase SET key = 'movement_intelligence', updated_at = now()
WHERE key = 'skill_movement_intelligence';

UPDATE coaching.session_phase SET key = 'resilience', updated_at = now()
WHERE key = 'control_resilience';

-- 1) Session phase keys + names + descriptions
UPDATE coaching.session_phase SET
  key = 'prepare_and_access',
  name = 'Prepare & Access',
  description = 'Raise temperature, mobilize joints, activate key tissues, and create access to the positions needed for training.',
  updated_at = now()
WHERE key IN ('prepare_and_access', 'prepare_access');

UPDATE coaching.session_phase SET
  key = 'movement_intelligence',
  name = 'Movement Intelligence',
  description = 'Develop coordination, body shapes, rhythm, mechanics, spatial awareness, and movement literacy before fatigue.',
  updated_at = now()
WHERE key IN ('movement_intelligence', 'skill_movement_intelligence');

UPDATE coaching.session_phase SET
  name = 'Output',
  description = 'Express high-quality speed, power, elasticity, acceleration, jumping, throwing, and reactive athleticism while fresh.',
  updated_at = now()
WHERE key = 'output';

UPDATE coaching.session_phase SET
  name = 'Capacity',
  description = 'Build strength, force production, tissue tolerance, and structural reserve through loaded and progressive work.',
  updated_at = now()
WHERE key = 'capacity';

UPDATE coaching.session_phase SET
  key = 'resilience',
  name = 'Resilience',
  description = 'Build control, stability, landing mechanics, braking ability, joint ownership, trunk control, and tissue durability.',
  updated_at = now()
WHERE key IN ('resilience', 'control_resilience');

UPDATE coaching.session_phase SET
  name = 'Sustained Capacity',
  description = 'Build the ability to repeat useful athletic work under fatigue while maintaining quality, posture, and safe mechanics.',
  updated_at = now()
WHERE key IN ('fitness_repeatability', 'sustained_capacity');

UPDATE coaching.session_phase SET
  name = 'Restore',
  description = 'Downshift the nervous system, restore breathing, reduce tension, recover range, and support readiness.',
  updated_at = now()
WHERE key = 'restore';

-- 2) Exercise primary phase keys
UPDATE coaching.exercise SET primary_phase_key = 'prepare_and_access', updated_at = now()
WHERE primary_phase_key IN ('prepare_access', 'prepare_and_access');

UPDATE coaching.exercise SET primary_phase_key = 'movement_intelligence', updated_at = now()
WHERE primary_phase_key IN ('movement_intelligence', 'skill_movement_intelligence');

UPDATE coaching.exercise SET primary_phase_key = 'resilience', updated_at = now()
WHERE primary_phase_key IN ('resilience', 'control_resilience');

UPDATE coaching.exercise SET primary_phase_key = 'sustained_capacity', updated_at = now()
WHERE primary_phase_key = 'fitness_repeatability';

-- 3) Education framework rows (session_phase entity_key)
UPDATE coaching.education_content SET
  entity_key = 'prepare_and_access',
  title = 'Prepare & Access',
  short_summary = 'Raise temperature, mobilize joints, activate key tissues, and create access to the positions needed for training.',
  what_it_is = 'Prepare & Access raises temperature, mobilizes joints, activates key tissues, and creates access to the positions needed for training.',
  updated_at = now()
WHERE entity_type = 'session_phase' AND entity_key IN ('prepare_and_access', 'prepare_and_access');

UPDATE coaching.education_content SET
  entity_key = 'movement_intelligence',
  title = 'Movement Intelligence',
  short_summary = 'Develop coordination, body shapes, rhythm, mechanics, spatial awareness, and movement literacy before fatigue.',
  what_it_is = 'Movement Intelligence develops coordination, body shapes, rhythm, mechanics, spatial awareness, and movement literacy before fatigue.',
  updated_at = now()
WHERE entity_type = 'session_phase' AND entity_key IN ('movement_intelligence', 'movement_intelligence');

UPDATE coaching.education_content SET
  title = 'Output',
  short_summary = 'Express high-quality speed, power, elasticity, acceleration, jumping, throwing, and reactive athleticism while fresh.',
  what_it_is = 'Output expresses high-quality speed, power, elasticity, acceleration, jumping, throwing, and reactive athleticism while fresh.',
  updated_at = now()
WHERE entity_type = 'session_phase' AND entity_key = 'output';

UPDATE coaching.education_content SET
  title = 'Capacity',
  short_summary = 'Build strength, force production, tissue tolerance, and structural reserve through loaded and progressive work.',
  what_it_is = 'Capacity builds strength, force production, tissue tolerance, and structural reserve through loaded and progressive work.',
  updated_at = now()
WHERE entity_type = 'session_phase' AND entity_key = 'capacity';

UPDATE coaching.education_content SET
  entity_key = 'resilience',
  title = 'Resilience',
  short_summary = 'Build control, stability, landing mechanics, braking ability, joint ownership, trunk control, and tissue durability.',
  what_it_is = 'Resilience builds control, stability, landing mechanics, braking ability, joint ownership, trunk control, and tissue durability.',
  updated_at = now()
WHERE entity_type = 'session_phase' AND entity_key IN ('resilience', 'resilience');

UPDATE coaching.education_content SET
  entity_key = 'sustained_capacity',
  title = 'Sustained Capacity',
  short_summary = 'Build the ability to repeat useful athletic work under fatigue while maintaining quality, posture, and safe mechanics.',
  what_it_is = 'Sustained Capacity builds the ability to repeat useful athletic work under fatigue while maintaining quality, posture, and safe mechanics.',
  updated_at = now()
WHERE entity_type = 'session_phase' AND entity_key IN ('fitness_repeatability', 'sustained_capacity');

UPDATE coaching.education_content SET
  title = 'Restore',
  short_summary = 'Downshift the nervous system, restore breathing, reduce tension, recover range, and support readiness.',
  what_it_is = 'Restore downshifts the nervous system, restores breathing, reduces tension, recovers range, and supports readiness.',
  updated_at = now()
WHERE entity_type = 'session_phase' AND entity_key = 'restore';

-- 4) Session templates + validation JSON phase keys
UPDATE coaching.education_content SET
  examples_json = replace(replace(replace(examples_json::text,
    'prepare_and_access', 'prepare_and_access'),
    'movement_intelligence', 'movement_intelligence'),
    'resilience', 'resilience')::jsonb,
  updated_at = now()
WHERE examples_json::text LIKE '%prepare_and_access%'
   OR examples_json::text LIKE '%movement_intelligence%'
   OR examples_json::text LIKE '%resilience%';

UPDATE coaching.validation_rule SET
  condition = replace(replace(replace(condition::text,
    'prepare_and_access', 'prepare_and_access'),
    'movement_intelligence', 'movement_intelligence'),
    'resilience', 'resilience')::jsonb,
  updated_at = now()
WHERE condition::text LIKE '%prepare_and_access%'
   OR condition::text LIKE '%movement_intelligence%'
   OR condition::text LIKE '%resilience%';

-- 5) Replace legacy display strings in education copy
UPDATE coaching.education_content SET
  title = replace(replace(replace(title,
    'Prepare & Access', 'Prepare & Access'),
    'Movement Intelligence', 'Movement Intelligence'),
    'Resilience', 'Resilience'),
  short_summary = replace(replace(replace(short_summary,
    'Prepare & Access', 'Prepare & Access'),
    'Movement Intelligence', 'Movement Intelligence'),
    'Resilience', 'Resilience'),
  what_it_is = replace(replace(replace(what_it_is,
    'Prepare & Access', 'Prepare & Access'),
    'Movement Intelligence', 'Movement Intelligence'),
    'Resilience', 'Resilience'),
  why_it_goes_here = replace(replace(replace(why_it_goes_here,
    'Prepare & Access', 'Prepare & Access'),
    'Movement Intelligence', 'Movement Intelligence'),
    'Resilience', 'Resilience'),
  updated_at = now()
WHERE title ILIKE '%Prepare & Access%'
   OR title ILIKE '%Movement Intelligence%'
   OR title ILIKE '%Resilience%'
   OR short_summary ILIKE '%Prepare & Access%'
   OR short_summary ILIKE '%Movement Intelligence%'
   OR short_summary ILIKE '%Resilience%';
