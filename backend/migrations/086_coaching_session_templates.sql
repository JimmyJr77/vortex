-- Session phase allocation templates for 60/90/120 minute models.
-- IDEMPOTENT.

INSERT INTO coaching.education_content (entity_type, entity_key, entity_id, title, short_summary, examples_json) VALUES
  ('template', 'session_60_general', NULL, '60-Minute General Athletic Development',
   'Balanced phase allocation for general athletic development.',
   '[{"phase":"prepare_access","minutes":8},{"phase":"skill_movement_intelligence","minutes":8},{"phase":"output","minutes":15},{"phase":"capacity","minutes":18},{"phase":"control_resilience","minutes":7},{"phase":"fitness_repeatability","minutes":3},{"phase":"restore","minutes":1}]'::jsonb),
  ('template', 'session_90_tumbling_first', NULL, '90-Minute Tumbling First',
   '30 min tumbling block + 60 min training with reduced fitness.',
   '[{"phase":"prepare_access","minutes":8},{"phase":"skill_movement_intelligence","minutes":22,"contains_tumbling":true},{"phase":"output","minutes":12},{"phase":"capacity","minutes":18},{"phase":"control_resilience","minutes":8},{"phase":"fitness_repeatability","minutes":0},{"phase":"restore","minutes":2}]'::jsonb),
  ('template', 'session_90_tumbling_end', NULL, '90-Minute Tumbling End',
   'Training first with tumbling block at end.',
   '[{"phase":"prepare_access","minutes":8},{"phase":"skill_movement_intelligence","minutes":7},{"phase":"output","minutes":13},{"phase":"capacity","minutes":20},{"phase":"control_resilience","minutes":8},{"phase":"skill_movement_intelligence","minutes":30,"contains_tumbling":true},{"phase":"restore","minutes":4}]'::jsonb),
  ('template', 'session_120_speed_addon', NULL, '120-Minute Tumbling First + Speed Add-On',
   'Tumbling first, speed add-on early after reset, then capacity and control.',
   '[{"phase":"prepare_access","minutes":8},{"phase":"skill_movement_intelligence","minutes":22,"contains_tumbling":true},{"phase":"output","minutes":30,"add_on_focus":"speed"},{"phase":"output","minutes":10},{"phase":"capacity","minutes":25},{"phase":"control_resilience","minutes":15},{"phase":"restore","minutes":10}]'::jsonb),
  ('template', 'session_120_fitness_addon', NULL, '120-Minute Tumbling First + Fitness Add-On',
   'Fitness add-on placed late after sensitive work.',
   '[{"phase":"prepare_access","minutes":8},{"phase":"skill_movement_intelligence","minutes":22,"contains_tumbling":true},{"phase":"output","minutes":12},{"phase":"capacity","minutes":23},{"phase":"control_resilience","minutes":15},{"phase":"fitness_repeatability","minutes":30,"add_on_focus":"fitness_conditioning"},{"phase":"restore","minutes":10}]'::jsonb),
  ('template', 'addon_speed_placement', NULL, 'Speed Add-On Placement',
   'Place speed add-on early after tumbling reset while neural output is fresh.',
   '[]'::jsonb),
  ('template', 'addon_fitness_placement', NULL, 'Fitness Add-On Placement',
   'Place fitness add-on late; conditioning intentionally creates fatigue.',
   '[]'::jsonb)
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  examples_json = EXCLUDED.examples_json,
  updated_at = now();
