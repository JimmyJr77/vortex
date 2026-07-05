-- Education content for phase_order_slot rows (Why Layer order-slot teaching).
-- IDEMPOTENT.

INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary, what_it_is, why_it_matters, why_it_goes_here, programming_guidance, common_misuse, fatigue_logic, sort_order
)
SELECT
  'phase_order_slot',
  pos.key,
  pos.id,
  pos.name,
  pos.description,
  pos.description,
  'Order slots keep exercises in the right freshness window within a session phase.',
  'Belongs in ' || sp.name || ' at position ' || pos.order_index::text || '.',
  CASE pos.key
    WHEN 'main_plyometric' THEN 'Place when athlete is fresh — before strength circuits or HIIT.'
    WHEN 'speed_acceleration' THEN 'Early in Output with full recovery between reps.'
    WHEN 'conditioning_intervals' THEN 'Late in session after skill, power, and main strength.'
    WHEN 'post_workout_flexibility' THEN 'After training when tissues are warm; not before power work.'
    ELSE 'Match slot to exercise role and freshness needs within ' || sp.name || '.'
  END,
  CASE pos.key
    WHEN 'main_plyometric' THEN 'Using plyometrics after HIIT or heavy strength.'
    WHEN 'post_workout_flexibility' THEN 'Long static stretching before speed or jumping.'
    ELSE NULL
  END,
  CASE
    WHEN pos.freshness_sensitivity >= 4 THEN 'High freshness sensitivity — quality drops quickly when fatigued.'
    WHEN pos.freshness_sensitivity <= 2 THEN 'Lower freshness demand; can tolerate more prior fatigue.'
    ELSE 'Moderate freshness sensitivity.'
  END,
  pos.order_index
FROM coaching.phase_order_slot pos
JOIN coaching.session_phase sp ON sp.id = pos.phase_id
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  why_it_goes_here = EXCLUDED.why_it_goes_here,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  fatigue_logic = EXCLUDED.fatigue_logic,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
