-- Prepare & Access content support: foot body_region + validation rule education.
-- IDEMPOTENT.

INSERT INTO coaching.body_region (key, name, sort_order) VALUES
  ('foot', 'Foot', 0)
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

-- Re-sort so foot appears before ankle in UI (optional ordering bump).
UPDATE coaching.body_region SET sort_order = 1 WHERE key = 'ankle';
UPDATE coaching.body_region SET sort_order = 2 WHERE key = 'knee';
UPDATE coaching.body_region SET sort_order = 3 WHERE key = 'hip';
UPDATE coaching.body_region SET sort_order = 4 WHERE key = 'spine';
UPDATE coaching.body_region SET sort_order = 5 WHERE key = 'core';
UPDATE coaching.body_region SET sort_order = 6 WHERE key = 'shoulder';
UPDATE coaching.body_region SET sort_order = 7 WHERE key = 'elbow';
UPDATE coaching.body_region SET sort_order = 8 WHERE key = 'wrist';
UPDATE coaching.body_region SET sort_order = 9 WHERE key = 'full_body';

INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_matters, programming_guidance, common_misuse
)
SELECT
  'validation_rule',
  'prepare_readiness_stealing',
  NULL,
  'Prepare & Access readiness without stealing output',
  'Warm-up blocks should increase readiness, not fatigue athletes before Skill or Output.',
  'Prepare & Access should increase readiness without stealing output from later phases.',
  'High fatigue cost, long isometric holds, conditioning circuits, and repeated high-impact contacts in warm-up reduce quality in Skill and Output.',
  'Keep Prepare & Access mostly fatigue_cost 1–2, impact 0–1, and low intensity ceiling. Use Raise/Mobilize/Activate for access; reserve Potentiate Bridge for brief elastic/rhythm prep only.',
  'Do not program HIIT, core burnouts, deep loaded mobility, or max-range aggressive stretching in Prepare & Access.'
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  updated_at = now();
