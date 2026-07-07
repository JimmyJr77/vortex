-- Profile and sport cleanup: remove erroneous restore backfill profiles; retag football MI drills.
-- IDEMPOTENT. Supports restoreSelectionPolicy + sportContextPolicy.

-- Remove conditional restore profiles from non-restore-primary exercises (081 backfill orphans)
DELETE FROM coaching.exercise_phase_profile p
USING coaching.exercise e, coaching.session_phase sp
WHERE p.exercise_id = e.id
  AND p.phase_id = sp.id
  AND sp.key = 'restore'
  AND p.role = 'conditional'
  AND e.primary_phase_key IN ('output', 'capacity', 'movement_intelligence', 'sustained_capacity', 'resilience', 'prepare_and_access');

-- Retag football-specific coordination MI drills away from fitness-general pool
UPDATE coaching.exercise SET
  sport_id = (SELECT id FROM coaching.sport WHERE key = 'football'),
  updated_at = now()
WHERE slug IN (
  'scramble-drill-find-grass-catch',
  'jog-cut-catch-scan-drill',
  'defender-leverage-call-route-break-plus-catch',
  'single-leg-football-catch-with-late-color-call',
  'receiver-route-break-and-catch',
  'two-cone-route-break-catch'
)
AND sport_id = (SELECT id FROM coaching.sport WHERE key = 'fitness');

-- Ensure catching drills stay skill_drill (exercise mode filter)
UPDATE coaching.exercise SET programming_kind = 'skill_drill', updated_at = now()
WHERE slug IN (
  'scramble-drill-find-grass-catch',
  'jog-cut-catch-scan-drill',
  'defender-leverage-call-route-break-plus-catch',
  'single-leg-football-catch-with-late-color-call'
)
AND programming_kind = 'exercise';

-- Demote step-behind throw restore conditional profile if any remain
DELETE FROM coaching.exercise_phase_profile p
USING coaching.exercise e, coaching.session_phase sp
WHERE p.exercise_id = e.id
  AND p.phase_id = sp.id
  AND sp.key = 'restore'
  AND e.slug IN (
    'step-behind-rotational-medicine-ball-throw',
    'med-ball-step-behind-rotational-throw',
    'medicine-ball-rotational-scoop-toss-kicking'
  )
  AND e.primary_phase_key <> 'restore';
