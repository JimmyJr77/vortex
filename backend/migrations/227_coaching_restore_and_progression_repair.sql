-- Repair restore pool + orphaned conditional profiles after 221/223 boot failures.
-- IDEMPOTENT. Ensures Needs Engine restore phase has primary/secondary eligible cards.

-- Remove conditional restore profiles on exercises that are not restore-primary
DELETE FROM coaching.exercise_phase_profile p
USING coaching.exercise e, coaching.session_phase sp
WHERE p.exercise_id = e.id
  AND p.phase_id = sp.id
  AND sp.key = 'restore'
  AND p.role = 'conditional'
  AND e.primary_phase_key IS DISTINCT FROM 'restore';

-- Promote youth breathing/mobility cards to restore-primary (221 UPDATE may not have run)
UPDATE coaching.exercise SET
  primary_phase_key = 'restore',
  phase_subrole = CASE
    WHEN slug IN ('cat-cow', 'side-lying-open-book') THEN 'mobilize'
    ELSE 'breathing_downshift'
  END,
  updated_at = now()
WHERE slug IN (
  '9090-breathing-with-reach',
  'crocodile-breathing',
  '9090-breathing-with-hip-reset',
  'cat-cow',
  'side-lying-open-book',
  'dead-bug-heel-tap'
)
AND primary_phase_key IN ('prepare_and_access', 'restore', 'movement_intelligence');

INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, 5, 'primary', v.order_slot, pos.order_index,
  FALSE, 1, 1, 1, 0, 'low'
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = 'restore'
JOIN (VALUES
  ('9090-breathing-with-reach', 'cooldown_breathing'),
  ('crocodile-breathing', 'cooldown_breathing'),
  ('9090-breathing-with-hip-reset', 'cooldown_breathing'),
  ('cat-cow', 'post_workout_flexibility'),
  ('side-lying-open-book', 'post_workout_flexibility'),
  ('dead-bug-heel-tap', 'cooldown_breathing')
) AS v(slug, order_slot) ON e.slug = v.slug
JOIN coaching.phase_order_slot pos ON pos.key = v.order_slot AND pos.phase_id = sp.id
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  fit_weight = GREATEST(coaching.exercise_phase_profile.fit_weight, EXCLUDED.fit_weight),
  role = 'primary',
  order_slot = COALESCE(EXCLUDED.order_slot, coaching.exercise_phase_profile.order_slot),
  impact_level = 0,
  intensity_ceiling = 'low',
  fatigue_cost = 1;

-- Ensure restore cards have low youth difficulty for 8-14 sessions
INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, overall, recommended_age_min, recommended_age_max, attention_demand, notes, source, updated_at
)
SELECT e.id, 2, 1, 2, 8, 14, 'low', 'Restore downshift card', 'restore_repair_227', now()
FROM coaching.exercise e
WHERE e.primary_phase_key = 'restore'
  AND e.slug IN (
    '9090-breathing-with-reach', 'crocodile-breathing', '9090-breathing-with-hip-reset',
    'cat-cow', 'side-lying-open-book', 'dead-bug-heel-tap',
    'box-breathing-hold-restore', 'supine-hamstring-hold-restore', 'wall-calf-hold-restore',
    'med-ball-belly-breathing-restore', 'slow-cone-walk-reset-restore', 'dead-hang-breathing-reset-restore'
  )
ON CONFLICT (exercise_id) DO UPDATE SET
  overall = LEAST(coaching.exercise_difficulty_profile.overall, EXCLUDED.overall),
  technical = LEAST(coaching.exercise_difficulty_profile.technical, EXCLUDED.technical),
  load = LEAST(coaching.exercise_difficulty_profile.load, EXCLUDED.load),
  updated_at = now();
